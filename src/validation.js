// Form validation. Each validator returns { data, errors } where errors is
// keyed by form field name so views can show messages next to inputs.
const config = require('./config');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const raw = (value) => (typeof value === 'string' ? value : '');

function checkName(name, errors, field = 'full_name') {
  if (name.length < 2 || name.length > 150) errors[field] = 'Enter a full name (2 to 150 characters).';
}

function checkEmail(email, errors) {
  if (!EMAIL_RE.test(email) || email.length > 150) errors.email = 'Enter a valid email address.';
}

function checkPhone(phone, errors) {
  if (phone && !PHONE_RE.test(phone)) errors.phone_number = 'Enter a valid phone number, e.g. 0917 123 4567.';
}

function checkNewPassword(password, confirm, errors, field = 'password') {
  if (password.length < 8) errors[field] = 'Use at least 8 characters.';
  else if (Buffer.byteLength(password) > 72) errors[field] = 'Use at most 72 characters.';
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors[field] = 'Include at least one letter and one number.';
  }
  if (password !== confirm) errors.confirm_password = 'Passwords do not match.';
}

function registration(body = {}) {
  const data = {
    fullName: str(body.full_name),
    email: str(body.email).toLowerCase(),
    phoneNumber: str(body.phone_number) || null,
    password: raw(body.password),
  };
  const errors = {};
  checkName(data.fullName, errors);
  checkEmail(data.email, errors);
  checkPhone(data.phoneNumber, errors);
  checkNewPassword(data.password, raw(body.confirm_password), errors);
  return { data, errors };
}

function login(body = {}) {
  return { email: str(body.email).toLowerCase(), password: raw(body.password) };
}

function profile(body = {}) {
  const data = { fullName: str(body.full_name), phoneNumber: str(body.phone_number) || null };
  const errors = {};
  checkName(data.fullName, errors);
  checkPhone(data.phoneNumber, errors);
  return { data, errors };
}

function passwordChange(body = {}) {
  const data = { currentPassword: raw(body.current_password), newPassword: raw(body.new_password) };
  const errors = {};
  if (!data.currentPassword) errors.current_password = 'Enter your current password.';
  checkNewPassword(data.newPassword, raw(body.confirm_password), errors, 'new_password');
  return { data, errors };
}

function newStaff(body = {}) {
  const data = {
    fullName: str(body.full_name),
    email: str(body.email).toLowerCase(),
    password: raw(body.password),
  };
  const errors = {};
  checkName(data.fullName, errors);
  checkEmail(data.email, errors);
  checkNewPassword(data.password, raw(body.confirm_password), errors);
  return { data, errors };
}

// Business Rule 2: category, location and description are all required.
function complaint(body = {}, categoryIds = []) {
  const data = {
    categoryId: Number(body.category_id),
    description: str(body.description),
    location: {
      houseNumber: str(body.house_number),
      street: str(body.street),
      barangay: str(body.barangay),
      city: config.city,
      postalCode: str(body.postal_code) || null,
    },
  };
  const errors = {};
  if (!categoryIds.includes(data.categoryId)) errors.category_id = 'Choose the type of water problem.';
  if (data.description.length < 10) errors.description = 'Describe the problem in at least 10 characters.';
  else if (data.description.length > 2000) errors.description = 'Keep the description under 2,000 characters.';
  if (!data.location.houseNumber) errors.house_number = 'Enter the house or building number.';
  else if (data.location.houseNumber.length > 50) errors.house_number = 'Use at most 50 characters.';
  if (!data.location.street) errors.street = 'Enter the street.';
  else if (data.location.street.length > 150) errors.street = 'Use at most 150 characters.';
  if (!config.barangays.includes(data.location.barangay)) errors.barangay = 'Choose your barangay.';
  if (data.location.postalCode && !/^\d{4}$/.test(data.location.postalCode)) {
    errors.postal_code = 'Postal codes are 4 digits.';
  }
  return { data, errors };
}

function category(body = {}) {
  const data = { categoryName: str(body.category_name), description: str(body.description) || null };
  const errors = {};
  if (!data.categoryName || data.categoryName.length > 100) {
    errors.category_name = 'Enter a category name (up to 100 characters).';
  }
  return { data, errors };
}

const hasErrors = (errors) => Object.keys(errors).length > 0;

module.exports = {
  registration,
  login,
  profile,
  passwordChange,
  newStaff,
  complaint,
  category,
  hasErrors,
};
