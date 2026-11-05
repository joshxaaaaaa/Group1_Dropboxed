// Session-based authentication with role checks (resident vs staff).
const usersDb = require('../db/users');
const staffDb = require('../db/staff');

// Loads the signed-in account on every request so a deactivated account
// (Business Rule 12) loses access immediately, not at its next login.
async function loadAccount(req, res, next) {
  req.account = null;
  const { role, accountId } = req.session;
  if (role && accountId) {
    const record = role === 'staff' ? await staffDb.findById(accountId) : await usersDb.findById(accountId);
    if (record && record.account_status === 'Active') {
      req.account = { role, id: accountId, name: record.full_name, email: record.email, record };
    } else {
      req.session.role = undefined;
      req.session.accountId = undefined;
    }
  }
  res.locals.currentUser = req.account;
  next();
}

// Starts a fresh session for the account (also issues a new CSRF token).
function signIn(req, role, accountId) {
  req.session = { role, accountId };
}

function requireResident(req, res, next) {
  if (req.account && req.account.role === 'resident') return next();
  if (req.account && req.account.role === 'staff') return res.redirect('/admin');
  res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

function requireStaff(req, res, next) {
  if (req.account && req.account.role === 'staff') return next();
  res.redirect(`/staff/login?next=${encodeURIComponent(req.originalUrl)}`);
}

function requireAnyAccount(req, res, next) {
  if (req.account) return next();
  res.redirect('/login');
}

// Only follow ?next= links that stay inside the given section of this site.
function safeNext(next, prefix, fallback) {
  if (typeof next === 'string' && next.startsWith(prefix) && !next.startsWith('//') && !next.includes('\\')) {
    return next;
  }
  return fallback;
}

module.exports = { loadAccount, signIn, requireResident, requireStaff, requireAnyAccount, safeNext };
