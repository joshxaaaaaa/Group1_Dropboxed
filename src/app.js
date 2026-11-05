const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const config = require('./config');
const { loadAccount } = require('./middleware/auth');
const { securityHeaders, viewLocals, csrfProtection } = require('./middleware/common');
const { AppError } = require('./errors');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');
// Cache-busts /css and /js links whenever the server restarts.
app.locals.assetVersion = Date.now().toString(36);

app.use(securityHeaders);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(
  cookieSession({
    name: 'dropboxed_session',
    keys: [config.sessionSecret],
    maxAge: 8 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
  })
);
app.use(loadAccount);
app.use(viewLocals);
app.use(csrfProtection);

app.use(require('./routes/auth'));
app.use('/my', require('./routes/resident'));
app.use('/admin', require('./routes/admin'));
app.use(require('./routes/attachments'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    status: 404,
    message: 'The page you were looking for does not exist or may have moved.',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err instanceof AppError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).render('error', {
    title: status === 404 ? 'Not found' : status === 403 ? 'Not allowed' : 'Something went wrong',
    status,
    message:
      err instanceof AppError
        ? err.message
        : 'An unexpected error occurred. Please try again, and contact the system administrator if it keeps happening.',
  });
});

module.exports = app;
