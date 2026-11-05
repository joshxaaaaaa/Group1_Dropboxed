// Business logic for complaints (Part 10: Application/API layer).
// The database enforces integrity; this layer enforces the process rules.
const config = require('../config');
const { withTransaction } = require('../db/pool');
const complaintsDb = require('../db/complaints');
const locationsDb = require('../db/locations');
const attachmentsDb = require('../db/attachments');
const assignmentsDb = require('../db/assignments');
const statusLogsDb = require('../db/statusLogs');
const staffDb = require('../db/staff');
const storage = require('./storage');
const { AppError } = require('../errors');

const STATUSES = ['Pending', 'In Progress', 'Resolved'];

// Business Rule 5: Pending -> In Progress -> Resolved, one step at a time.
const NEXT_STATUS = { Pending: 'In Progress', 'In Progress': 'Resolved' };

// Saves a complaint, its location and its photos in one transaction.
// `files` are already validated: [{ originalname, buffer, size, fileType }].
async function submit({ userId, categoryId, location, description, files }) {
  const written = [];
  try {
    return await withTransaction(async (db) => {
      const locationId = await locationsDb.findOrCreate(location, db);

      // Business Rule 10: flag likely duplicates for review instead of rejecting them.
      const similar = await complaintsDb.findRecentSimilar(
        { categoryId, locationId, windowHours: config.duplicateWindowHours },
        db
      );
      const flagReason = similar
        ? `Possible duplicate of complaint #${similar.complaint_id}: same category and household within ` +
          `${config.duplicateWindowHours} hours${similar.user_id === userId ? ', submitted by the same resident' : ''}.`
        : null;

      const complaintId = await complaintsDb.insert(
        { userId, categoryId, locationId, description, isFlagged: Boolean(similar), flagReason },
        db
      );

      for (const file of files) {
        const saved = storage.saveImage(file.buffer, file.fileType);
        written.push(saved.absolutePath);
        await attachmentsDb.create(
          {
            complaintId,
            fileName: file.originalname.slice(0, 255),
            filePath: saved.relativePath,
            fileType: file.fileType,
            fileSizeBytes: file.size,
          },
          db
        );
      }
      return { complaintId, flagged: Boolean(similar) };
    });
  } catch (err) {
    // The transaction rolled back, so remove any files already written.
    written.forEach(storage.remove);
    throw err;
  }
}

// Moves a complaint to its next status and records it in status_logs
// (Business Rules 5 and 7). The row lock stops two staff members from
// advancing the same complaint at once.
async function advanceStatus({ complaintId, staffId, status, remarks }) {
  return withTransaction(async (db) => {
    const current = await complaintsDb.lockForUpdate(complaintId, db);
    if (!current) throw new AppError('Complaint not found.', 404);

    const expected = NEXT_STATUS[current.status];
    if (!expected) throw new AppError('This complaint is already resolved.');
    if (status !== expected) {
      throw new AppError(`A ${current.status} complaint can only be moved to ${expected}.`);
    }

    await complaintsDb.setStatus(complaintId, status, db);
    await statusLogsDb.create({ complaintId, staffId, status, remarks }, db);

    // Whoever starts work on an unassigned complaint becomes its assignee.
    if ((await assignmentsDb.countForComplaint(complaintId, db)) === 0) {
      await assignmentsDb.assign(complaintId, staffId, db);
    }
    return { from: current.status, to: status };
  });
}

// Business Rule 11: flagging never deletes; it only marks for review.
async function setFlag({ complaintId, flagged, reason }) {
  if (flagged && !reason) throw new AppError('Enter a reason for flagging this complaint.');
  await complaintsDb.setFlag(complaintId, flagged, reason);
}

// Business Rule 6: a complaint may have several staff, and vice versa.
async function assignStaff({ complaintId, staffId }) {
  const member = await staffDb.findById(staffId);
  if (!member || member.account_status !== 'Active') {
    throw new AppError('Choose an active staff member to assign.');
  }
  const added = await assignmentsDb.assign(complaintId, staffId);
  return { added, member };
}

module.exports = { STATUSES, NEXT_STATUS, submit, advanceStatus, setFlag, assignStaff };
