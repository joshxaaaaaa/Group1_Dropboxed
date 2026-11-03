// Landing page, registration, login and logout.
const express = require('express');
const accounts = require('../services/accounts');
const categoriesDb = require('../db/categories');
const validate = require('../validation');
const { signIn, safeNext } = require('../middleware/auth');
const { AppError } = require('../errors');
const { pool } = require('../db/pool');

const router = express.Router();

const LOGIN_PAGES = {
  resident: { path: '/login', title: 'Resident log in', home: '/my/complaints', prefix: '/my/' },
  staff: { path: '/staff/login', title: 'Staff log in', home: '/admin', prefix: '/admin' },
};

router.get('/', async (req, res) => {
  if (req.account) return res.redirect(req.account.role === 'staff' ? '/admin' : '/my/complaints');
  const categories = await categoriesDb.list();
  res.render('index', { title: 'Report household water problems in San Pedro', categories });
});

// Lets a DBA or monitoring tool confirm the app can reach PostgreSQL.
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'reachable' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

router.get('/register', (req, res) => {
  if (req.account) return res.redirect('/');
  res.render('auth/register', { title: 'Create a resident account' });
});

router.post('/register', async (req, res) => {
  const { data, errors } = validate.registration(req.body);
  const values = { full_name: data.fullName, email: data.email, phone_number: data.phoneNumber };
  if (validate.hasErrors(errors)) {
    return res.status(422).render('auth/register', { title: 'Create a resident account', errors, values });
  }
  try {
    const user = await accounts.registerResident(data);
    signIn(req, 'resident', user.user_id);
    req.flash('success', `Welcome, ${user.full_name}! Your account is ready. You can file your first complaint below.`);
    res.redirect('/my/complaints/new');
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    res.status(422).render('auth/register', {
      title: 'Create a resident account',
      errors: { email: err.message },
      values,
    });
  }
});

for (const [role, page] of Object.entries(LOGIN_PAGES)) {
  router.get(page.path, (req, res) => {
    if (req.account) return res.redirect(req.account.role === 'staff' ? '/admin' : '/my/complaints');
    res.render('auth/login', { title: page.title, role, action: page.path, next: req.query.next || '' });
  });

  router.post(page.path, async (req, res) => {
    const { email, password } = validate.login(req.body);
    const next = typeof req.body.next === 'string' ? req.body.next : '';
    try {
      const account = await accounts.authenticate(role, email, password);
      signIn(req, role, role === 'staff' ? account.staff_id : account.user_id);
      res.redirect(safeNext(next, page.prefix, page.home));
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      res.status(err.status).render('auth/login', {
        title: page.title,
        role,
        action: page.path,
        next,
        loginError: err.message,
        values: { email },
      });
    }
  });
}

router.post('/logout', (req, res) => {
  req.session = { flash: { type: 'info', message: 'You have been logged out.' } };
  res.redirect('/');
});

module.exports = router;
