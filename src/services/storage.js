// Local file storage for photo attachments (Part 10: File Storage).
// Files are kept outside the public folder and served only through an
// access-checked route; the database stores the relative path.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png' };

// Checks the file's magic bytes rather than trusting the browser's MIME type.
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && png.every((byte, i) => buffer[i] === byte)) return 'image/png';
  return null;
}

function saveImage(buffer, fileType) {
  const now = new Date();
  const folder = path.posix.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  const relativePath = path.posix.join(folder, `${crypto.randomUUID()}${EXTENSIONS[fileType]}`);
  const absolutePath = resolve(relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, buffer);
  return { relativePath, absolutePath };
}

// Maps a stored relative path back to disk, refusing anything outside uploadDir.
function resolve(relativePath) {
  const absolutePath = path.resolve(config.uploadDir, relativePath);
  if (!absolutePath.startsWith(config.uploadDir + path.sep)) {
    throw new Error('Attachment path escapes the upload directory');
  }
  return absolutePath;
}

function remove(absolutePath) {
  fs.rmSync(absolutePath, { force: true });
}

module.exports = { detectImageType, saveImage, resolve, remove };
