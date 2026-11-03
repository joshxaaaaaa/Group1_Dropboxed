// Serves uploaded photos only to staff and to the resident who filed the complaint.
const express = require('express');
const fs = require('fs');
const attachmentsDb = require('../db/attachments');
const storage = require('../services/storage');
const { requireAnyAccount } = require('../middleware/auth');
const { AppError } = require('../errors');
const { parseId } = require('./params');

const router = express.Router();

router.get('/attachments/:id', requireAnyAccount, async (req, res) => {
  const attachment = await attachmentsDb.findById(parseId(req.params.id));
  const allowed =
    attachment && (req.account.role === 'staff' || attachment.user_id === req.account.id);
  if (!allowed) throw new AppError('Photo not found.', 404);

  const absolutePath = storage.resolve(attachment.file_path);
  if (!fs.existsSync(absolutePath)) throw new AppError('The photo file is missing from storage.', 404);

  res.set('Content-Type', attachment.file_type);
  res.set('Cache-Control', 'private, max-age=3600');
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
  res.sendFile(absolutePath);
});

module.exports = router;
