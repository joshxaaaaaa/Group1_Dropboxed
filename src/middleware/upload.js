// Parses the multipart complaint form and validates photos (Business Rule 9).
// Files stay in memory until the complaint is saved, so a rejected form
// leaves nothing behind on disk.
const multer = require('multer');
const config = require('../config');
const storage = require('../services/storage');

const maxMb = Math.round(config.maxUploadBytes / (1024 * 1024));

const parse = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: config.maxUploadFiles, fields: 20 },
  defParamCharset: 'utf8',
}).array('photos', config.maxUploadFiles);

// Sets req.photos (validated) and req.uploadError (message or null).
function complaintPhotos(req, res, next) {
  parse(req, res, (err) => {
    req.photos = [];
    req.uploadError = null;
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        req.uploadError = `Each photo must be ${maxMb} MB or smaller.`;
      } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        req.uploadError = `Attach at most ${config.maxUploadFiles} photos.`;
      } else {
        return next(err);
      }
      return next();
    }

    for (const file of req.files || []) {
      if (file.size === 0) continue;
      const fileType = storage.detectImageType(file.buffer);
      if (!fileType) {
        req.uploadError = `"${file.originalname}" is not a JPEG or PNG image.`;
        req.photos = [];
        break;
      }
      req.photos.push({ originalname: file.originalname, buffer: file.buffer, size: file.size, fileType });
    }
    next();
  });
}

module.exports = { complaintPhotos, maxMb };
