// Authentication and account management for residents and staff.
// Passwords are hashed with bcrypt in the application layer (Part 10).
const bcrypt = require('bcryptjs');
const usersDb = require('../db/users');
const staffDb = require('../db/staff');
const { AppError, PG } = require('../errors');

const BCRYPT_ROUNDS = 10;
// Compared against when an email is unknown so response time doesn't reveal
// which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('dropboxed-timing-guard', BCRYPT_ROUNDS);

const repoFor = (role) => (role === 'staff' ? staffDb : usersDb);

async function authenticate(role, email, password) {
  const account = await repoFor(role).findByEmail(email);
  const matches = await bcrypt.compare(password, account ? account.password_hash : DUMMY_HASH);
  if (!account || !matches) throw new AppError('Incorrect email or password.', 401);
  // Business Rule 12: only Active accounts may sign in.
  if (account.account_status !== 'Active') {
    throw new AppError('This account is inactive. Please contact the San Pedro water district office.', 403);
  }
  return account;
}

async function registerResident({ fullName, email, password, phoneNumber }) {
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return await usersDb.create({ fullName, email, passwordHash, phoneNumber });
  } catch (err) {
    if (err.code === PG.UNIQUE_VIOLATION) throw new AppError('An account with this email already exists.');
    throw err;
  }
}

async function createStaff({ fullName, email, password }) {
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return await staffDb.create({ fullName, email, passwordHash });
  } catch (err) {
    if (err.code === PG.UNIQUE_VIOLATION) throw new AppError('A staff account with this email already exists.');
    throw err;
  }
}

async function changePassword(role, id, currentPassword, newPassword) {
  const repo = repoFor(role);
  const hash = await repo.getPasswordHash(id);
  if (!hash || !(await bcrypt.compare(currentPassword, hash))) {
    throw new AppError('Your current password is incorrect.');
  }
  await repo.updatePassword(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
}

module.exports = { authenticate, registerResident, createStaff, changePassword };
