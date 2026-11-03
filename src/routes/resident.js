// Resident pages: file complaints, track their status, manage profile.
const express = require('express');
const config = require('../config');
const complaintsService = require('../services/complaints');
const accounts = require('../services/accounts');
const complaintsDb = require('../db/complaints');
const categoriesDb = require('../db/categories');
const locationsDb = require('../db/locations');
const usersDb = require('../db/users');
const attachmentsDb = require('../db/attachments');
const statusLogsDb = require('../db/statusLogs');
const validate = require('../validation');
const { requireResident } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/common');
const { complaintPhotos, maxMb } = require('../middleware/upload');
const { AppError } = require('../errors');
const { parseId } = require('./params');

const router = express.Router();
router.use(requireResident);

router.get('/', (req, res) => res.redirect('/my/complaints'));

router.get('/complaints', async (req, res) => {
  const [complaints, counts] = await Promise.all([
    complaintsDb.listForUser(req.account.id),
    complaintsDb.countByStatusForUser(req.account.id),
  ]);
  const status = complaintsService.STATUSES.includes(req.query.status) ? req.query.status : '';
  res.render('resident/complaints', {
    title: 'My complaints',
    complaints: status ? complaints.filter((c) => c.status === status) : complaints,
    counts,
    status,
  });
});

async function renderNewComplaint(res, req, extra = {}) {
  const [categories, savedLocations] = await Promise.all([
    categoriesDb.list(),
    locationsDb.listForUser(req.account.id),
  ]);
  res.render('resident/new-complaint', {
    title: 'File a complaint',
    categories,
    savedLocations,
    barangays: config.barangays,
    city: config.city,
    defaultPostalCode: config.postalCode,
    maxMb,
    maxFiles: config.maxUploadFiles,
    ...extra,
  });
}

router.get('/complaints/new', async (req, res) => {
  const categoryId = Number(req.query.category) || '';
  await renderNewComplaint(res, req, { values: { category_id: categoryId, postal_code: config.postalCode } });
});

router.post('/complaints', complaintPhotos, verifyCsrf, async (req, res) => {
  const categories = await categoriesDb.list();
  const { data, errors } = validate.complaint(req.body, categories.map((c) => c.category_id));
  if (req.uploadError) errors.photos = req.uploadError;
  if (validate.hasErrors(errors)) {
    res.status(422);
    return renderNewComplaint(res, req, { errors, values: req.body || {} });
  }

  const { complaintId, flagged } = await complaintsService.submit({
    userId: req.account.id,
    categoryId: data.categoryId,
    location: data.location,
    description: data.description,
    files: req.photos,
  });
  req.flash(
    flagged ? 'warning' : 'success',
    flagged
      ? `Complaint #${complaintId} was submitted. A similar report for this address was filed recently, so staff will review it alongside the earlier one.`
      : `Complaint #${complaintId} was submitted. The water district will review it shortly.`
  );
  res.redirect(`/my/complaints/${complaintId}`);
});

router.get('/complaints/:id', async (req, res) => {
  const complaint = await complaintsDb.findById(parseId(req.params.id));
  if (!complaint || complaint.user_id !== req.account.id) throw new AppError('Complaint not found.', 404);
  const [attachments, logs] = await Promise.all([
    attachmentsDb.listForComplaint(complaint.complaint_id),
    statusLogsDb.listForComplaint(complaint.complaint_id),
  ]);
  res.render('resident/complaint', { title: `Complaint #${complaint.complaint_id}`, complaint, attachments, logs });
});

function renderProfile(res, req, extra = {}) {
  const user = req.account.record;
  res.render('resident/profile', {
    title: 'My profile',
    user,
    values: { full_name: user.full_name, phone_number: user.phone_number || '' },
    ...extra,
  });
}

router.get('/profile', (req, res) => renderProfile(res, req));

router.post('/profile', async (req, res) => {
  const { data, errors } = validate.profile(req.body);
  if (validate.hasErrors(errors)) {
    res.status(422);
    return renderProfile(res, req, { errors, values: req.body });
  }
  await usersDb.updateProfile(req.account.id, data);
  req.flash('success', 'Your profile was updated.');
  res.redirect('/my/profile');
});

router.post('/profile/password', async (req, res) => {
  const { data, errors } = validate.passwordChange(req.body);
  if (!validate.hasErrors(errors)) {
    try {
      await accounts.changePassword('resident', req.account.id, data.currentPassword, data.newPassword);
      req.flash('success', 'Your password was changed.');
      return res.redirect('/my/profile');
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      errors.current_password = err.message;
    }
  }
  res.status(422);
  renderProfile(res, req, { passwordErrors: errors });
});

module.exports = router;
