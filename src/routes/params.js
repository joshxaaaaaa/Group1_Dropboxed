const { AppError } = require('../errors');

// Route ids map to INTEGER primary keys; anything else is a 404.
function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new AppError('Page not found.', 404);
  return id;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

// Local calendar date as 'YYYY-MM-DD'.
function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = { parseId, isDate, localDate };
