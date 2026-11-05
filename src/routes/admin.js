// Water district staff console: complaint queue, status updates, assignments,
// flag review, reports and account management.
const express = require('express');
const config = require('../config');
const complaintsService = require('../services/complaints');
const accounts = require('../services/accounts');
const complaintsDb = require('../db/complaints');
const categoriesDb = require('../db/categories');
const assignmentsDb = require('../db/assignments');
const attachmentsDb = require('../db/attachments');
const statusLogsDb = require('../db/statusLogs');
const usersDb = require('../db/users');
const staffDb = require('../db/staff');
const reportsDb = require('../db/reports');
const validate = require('../validation');
const { requireStaff } = require('../middleware/auth');
const { AppError, PG } = require('../errors');
const { parseId, isDate, localDate } = require('./params');

const router = express.Router();
router.use(requireStaff);

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// ---------------------------------------------------------------- dashboard
router.get('/', async (req, res) => {
  const from = '1900-01-01';
  const to = localDate();
  const [summary, byCategory, oldestPending, mine, flagged] = await Promise.all([
    reportsDb.summary(from, to),
    reportsDb.byCategory(from, to),
    reportsDb.oldestPending(5),
    complaintsDb.search({ assignedTo: req.account.id, status: 'open', sort: 'oldest', pageSize: 5 }),
    complaintsDb.search({ flagged: 'yes', sort: 'newest', pageSize: 5 }),
  ]);
  const recent = await complaintsDb.search({ sort: 'newest', pageSize: 8 });
  res.render('admin/dashboard', {
    title: 'Dashboard',
    summary,
    byCategory,
    oldestPending,
    mine,
    flagged,
    recent: recent.rows,
  });
});

// ---------------------------------------------------------------- complaint queue
function readFilters(q) {
  return {
    q: str(q.q).slice(0, 100),
    status: complaintsService.STATUSES.includes(q.status) || q.status === 'open' ? q.status : '',
    category: Number(q.category) || '',
    barangay: config.barangays.includes(q.barangay) ? q.barangay : '',
    flagged: ['yes', 'no'].includes(q.flagged) ? q.flagged : '',
    assigned: q.assigned === 'none' || q.assigned === 'me' ? q.assigned : Number(q.assigned) || '',
    from: isDate(q.from) ? q.from : '',
    to: isDate(q.to) ? q.to : '',
    sort: complaintsDb.SORTS[q.sort] ? q.sort : 'newest',
  };
}

router.get('/complaints', async (req, res) => {
  const filters = readFilters(req.query);
  const [result, categories, staff] = await Promise.all([
    complaintsDb.search({
      q: filters.q,
      status: filters.status,
      categoryId: filters.category,
      barangay: filters.barangay,
      flagged: filters.flagged,
      assignedTo: filters.assigned === 'me' ? req.account.id : filters.assigned,
      from: filters.from,
      to: filters.to,
      sort: filters.sort,
      page: Number(req.query.page) || 1,
    }),
    categoriesDb.list(),
    staffDb.listActive(),
  ]);
  res.render('admin/complaints', {
    title: 'Complaints',
    filters,
    result,
    categories,
    staff,
    barangays: config.barangays,
    statuses: complaintsService.STATUSES,
    activeFilterCount: Object.entries(filters).filter(([k, v]) => k !== 'sort' && v !== '').length,
  });
});

router.get('/complaints/:id', async (req, res) => {
  const complaint = await complaintsDb.findById(parseId(req.params.id));
  if (!complaint) throw new AppError('Complaint not found.', 404);
  const [attachments, logs, assignments, staff] = await Promise.all([
    attachmentsDb.listForComplaint(complaint.complaint_id),
    statusLogsDb.listForComplaint(complaint.complaint_id),
    assignmentsDb.listForComplaint(complaint.complaint_id),
    staffDb.listActive(),
  ]);
  const assignedIds = new Set(assignments.map((a) => a.staff_id));
  res.render('admin/complaint', {
    title: `Complaint #${complaint.complaint_id}`,
    complaint,
    attachments,
    logs,
    assignments,
    unassignedStaff: staff.filter((s) => !assignedIds.has(s.staff_id)),
    nextStatus: complaintsService.NEXT_STATUS[complaint.status] || null,
  });
});

router.post('/complaints/:id/status', async (req, res) => {
  const complaintId = parseId(req.params.id);
  try {
    const { to } = await complaintsService.advanceStatus({
      complaintId,
      staffId: req.account.id,
      status: str(req.body.status),
      remarks: str(req.body.remarks).slice(0, 2000) || null,
    });
    req.flash('success', `Complaint #${complaintId} is now ${to}.`);
  } catch (err) {
    if (!(err instanceof AppError) || err.status === 404) throw err;
    req.flash('error', err.message);
  }
  res.redirect(`/admin/complaints/${complaintId}`);
});

router.post('/complaints/:id/flag', async (req, res) => {
  const complaintId = parseId(req.params.id);
  const flagged = req.body.action === 'flag';
  try {
    await complaintsService.setFlag({ complaintId, flagged, reason: str(req.body.flag_reason).slice(0, 1000) });
    req.flash('success', flagged ? 'Complaint flagged for review.' : 'Flag cleared. The complaint is no longer marked for review.');
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    req.flash('error', err.message);
  }
  res.redirect(`/admin/complaints/${complaintId}`);
});

router.post('/complaints/:id/assign', async (req, res) => {
  const complaintId = parseId(req.params.id);
  try {
    const { added, member } = await complaintsService.assignStaff({
      complaintId,
      staffId: Number(req.body.staff_id),
    });
    req.flash('success', added ? `${member.full_name} was assigned.` : `${member.full_name} is already assigned.`);
  } catch (err) {
    if (err.code === PG.FOREIGN_KEY_VIOLATION) throw new AppError('Complaint not found.', 404);
    if (!(err instanceof AppError)) throw err;
    req.flash('error', err.message);
  }
  res.redirect(`/admin/complaints/${complaintId}`);
});

router.post('/complaints/:id/unassign', async (req, res) => {
  const complaintId = parseId(req.params.id);
  const removed = await assignmentsDb.unassign(complaintId, Number(req.body.staff_id));
  req.flash(removed ? 'success' : 'error', removed ? 'Assignment removed.' : 'That staff member was not assigned.');
  res.redirect(`/admin/complaints/${complaintId}`);
});

// ---------------------------------------------------------------- reports
function reportPeriod(q) {
  const today = new Date();
  const defaultFrom = localDate(new Date(today.getFullYear(), today.getMonth() - 11, 1));
  let from = isDate(q.from) ? q.from : defaultFrom;
  let to = isDate(q.to) ? q.to : localDate(today);
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

router.get('/reports', async (req, res) => {
  const { from, to } = reportPeriod(req.query);
  const [summary, byCategory, byBarangay, matrixRows, monthly, staffActivity] = await Promise.all([
    reportsDb.summary(from, to),
    reportsDb.byCategory(from, to),
    reportsDb.byBarangay(from, to),
    reportsDb.barangayCategoryMatrix(from, to),
    reportsDb.monthly(from, to),
    reportsDb.staffActivity(from, to),
  ]);

  // Pivot barangay x category counts for the "by area and type" table.
  const matrix = byBarangay.map((b) => ({
    barangay: b.barangay,
    total: b.total,
    counts: Object.fromEntries(
      matrixRows.filter((r) => r.barangay === b.barangay).map((r) => [r.category_id, r.total])
    ),
  }));

  res.render('admin/reports', {
    title: 'Reports',
    from,
    to,
    summary,
    byCategory,
    byBarangay,
    matrix,
    monthly,
    staffActivity,
    generatedAt: new Date(),
  });
});

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  // Stop spreadsheet apps from treating text as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get('/reports/export.csv', async (req, res) => {
  const { from, to } = reportPeriod(req.query);
  const rows = await reportsDb.complaintRows(from, to);
  const columns = [
    'complaint_id', 'submitted_at', 'status', 'category_name', 'house_number', 'street', 'barangay',
    'city', 'postal_code', 'resident_name', 'resident_email', 'is_flagged', 'flag_reason',
    'resolved_at', 'resolution_hours', 'assigned_staff', 'description',
  ];
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="dropboxed-complaints-${from}-to-${to}.csv"`);
  res.send(`﻿${lines.join('\r\n')}\r\n`);
});

// ---------------------------------------------------------------- residents
router.get('/residents', async (req, res) => {
  const q = str(req.query.q).slice(0, 100);
  res.render('admin/residents', { title: 'Residents', residents: await usersDb.list({ q }), q });
});

router.post('/residents/:id/status', async (req, res) => {
  const userId = parseId(req.params.id);
  const status = req.body.account_status === 'Inactive' ? 'Inactive' : 'Active';
  await usersDb.setAccountStatus(userId, status);
  req.flash('success', status === 'Active' ? 'Resident account reactivated.' : 'Resident account deactivated. They can no longer log in.');
  res.redirect('/admin/residents');
});

// ---------------------------------------------------------------- staff
async function renderStaff(res, extra = {}) {
  res.render('admin/staff', { title: 'Staff', staff: await staffDb.listWithWorkload(), ...extra });
}

router.get('/staff', (req, res) => renderStaff(res));

router.post('/staff', async (req, res) => {
  const { data, errors } = validate.newStaff(req.body);
  if (!validate.hasErrors(errors)) {
    try {
      const member = await accounts.createStaff(data);
      req.flash('success', `Staff account created for ${member.full_name}.`);
      return res.redirect('/admin/staff');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      errors.email = err.message;
    }
  }
  res.status(422);
  renderStaff(res, { errors, values: { full_name: data.fullName, email: data.email }, openForm: true });
});

router.post('/staff/:id/status', async (req, res) => {
  const staffId = parseId(req.params.id);
  if (staffId === req.account.id) {
    req.flash('error', 'You cannot deactivate your own account.');
    return res.redirect('/admin/staff');
  }
  const status = req.body.account_status === 'Inactive' ? 'Inactive' : 'Active';
  await staffDb.setAccountStatus(staffId, status);
  req.flash('success', status === 'Active' ? 'Staff account reactivated.' : 'Staff account deactivated.');
  res.redirect('/admin/staff');
});

// ---------------------------------------------------------------- categories
async function renderCategories(res, extra = {}) {
  res.render('admin/categories', { title: 'Categories', categories: await categoriesDb.list(), ...extra });
}

router.get('/categories', (req, res) => renderCategories(res));

router.post('/categories', async (req, res) => {
  const { data, errors } = validate.category(req.body);
  if (!validate.hasErrors(errors)) {
    try {
      await categoriesDb.create(data);
      req.flash('success', `Category "${data.categoryName}" added.`);
      return res.redirect('/admin/categories');
    } catch (err) {
      if (err.code !== PG.UNIQUE_VIOLATION) throw err;
      errors.category_name = 'A category with this name already exists.';
    }
  }
  res.status(422);
  renderCategories(res, { errors, values: req.body });
});

router.post('/categories/:id', async (req, res) => {
  const categoryId = parseId(req.params.id);
  const { data, errors } = validate.category(req.body);
  if (validate.hasErrors(errors)) {
    req.flash('error', errors.category_name);
    return res.redirect('/admin/categories');
  }
  try {
    await categoriesDb.update(categoryId, data);
    req.flash('success', 'Category updated.');
  } catch (err) {
    if (err.code !== PG.UNIQUE_VIOLATION) throw err;
    req.flash('error', 'A category with this name already exists.');
  }
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', async (req, res) => {
  try {
    const removed = await categoriesDb.remove(parseId(req.params.id));
    req.flash(removed ? 'success' : 'error', removed ? 'Category removed.' : 'That category no longer exists.');
  } catch (err) {
    if (err.code !== PG.FOREIGN_KEY_VIOLATION) throw err;
    req.flash('error', 'This category has complaints, so it cannot be removed. You can rename it instead.');
  }
  res.redirect('/admin/categories');
});

// ---------------------------------------------------------------- own account
router.get('/account', (req, res) => {
  res.render('admin/account', { title: 'My account' });
});

router.post('/account/password', async (req, res) => {
  const { data, errors } = validate.passwordChange(req.body);
  if (!validate.hasErrors(errors)) {
    try {
      await accounts.changePassword('staff', req.account.id, data.currentPassword, data.newPassword);
      req.flash('success', 'Your password was changed.');
      return res.redirect('/admin/account');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      errors.current_password = err.message;
    }
  }
  res.status(422).render('admin/account', { title: 'My account', errors });
});

module.exports = router;
