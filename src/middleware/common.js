const crypto = require('crypto');
const helpers = require('../views/helpers');
const { AppError } = require('../errors');

function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
}

// Values every view can use, plus one-time flash messages.
function viewLocals(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  res.locals.flash = req.session.flash || null;
  if (req.session.flash) req.session.flash = undefined;
  res.locals.currentPath = req.path;
  res.locals.h = helpers;
  res.locals.errors = {};
  res.locals.values = {};
  req.flash = (type, message) => {
    req.session.flash = { type, message };
  };
  next();
}

// Every POST form carries a per-session token. Multipart forms are checked
// by their route after the body is parsed.
function csrfProtection(req, res, next) {
  if (req.method !== 'POST' || req.is('multipart/form-data')) return next();
  verifyCsrf(req, res, next);
}

function verifyCsrf(req, res, next) {
  const sent = Buffer.from(String((req.body && req.body._csrf) || ''));
  const expected = Buffer.from(req.session.csrf || '');
  if (expected.length === 0 || sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected)) {
    return next(new AppError('Your session expired or the form could not be verified. Please go back, refresh the page and try again.', 403));
  }
  next();
}

module.exports = { securityHeaders, viewLocals, csrfProtection, verifyCsrf };
