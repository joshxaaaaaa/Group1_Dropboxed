// An error whose message is safe to show to the user.
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// PostgreSQL SQLSTATE codes the app reacts to.
const PG = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
};

module.exports = { AppError, PG };
