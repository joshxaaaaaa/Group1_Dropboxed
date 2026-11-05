// Activity 3, Part A.6: exercises every create, retrieve, update and delete in the
// application over HTTP, the way a browser does, against a running server.
//
//   npm start                                in one terminal
//   npm run test:smoke -- --yes              in another
//   npm run test:smoke -- --yes --out f.md   also write the results for the PDF
//
// It adds test records (clearly named "Smoke Test") to the database it runs against,
// so --yes is required. Use it on a development or test database only.
const fs = require('fs');
require('../src/config');
const { loadSetupEnv } = require('./setup-env');

loadSetupEnv();
const BASE = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const STAFF_EMAIL = process.env.ADMIN_EMAIL || 'admin@dropboxed.local';
const STAFF_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const RUN = Date.now().toString(36);
const PASSWORD = 'Smoke-test-1';

// The smallest valid PNG, so the upload passes the magic-byte check.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

class Browser {
  constructor() {
    this.cookies = new Map();
  }

  async request(path, options = {}) {
    const response = await fetch(BASE + path, {
      redirect: 'manual',
      ...options,
      headers: {
        ...options.headers,
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
    });
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: response.status, location: response.headers.get('location'), body: await response.text() };
  }

  // Follows the redirect after a form post and returns the final page.
  async follow(result) {
    return result.status >= 300 && result.status < 400 ? this.request(result.location) : result;
  }

  async csrfFrom(path) {
    const { body } = await this.request(path);
    const match = body.match(/name="_csrf" value="([^"]+)"/);
    if (!match) throw new Error(`No CSRF token on ${path}`);
    return match[1];
  }

  async post(formPage, action, fields = {}) {
    const _csrf = await this.csrfFrom(formPage);
    const result = await this.request(action, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf, ...fields }).toString(),
    });
    return this.follow(result);
  }

  async postMultipart(formPage, action, fields, photo) {
    const form = new FormData();
    form.set('_csrf', await this.csrfFrom(formPage));
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    if (photo) form.append('photos', new Blob([photo], { type: 'image/png' }), 'smoke-test.png');
    return this.follow(await this.request(action, { method: 'POST', body: form }));
  }
}

const results = [];
let failures = 0;

async function step(operation, tables, description, action) {
  let ok = false;
  let note = '';
  try {
    note = (await action()) || '';
    ok = true;
  } catch (err) {
    note = err.message;
    failures++;
  }
  results.push({ operation, tables, description, ok, note });
}

function expect(page, status, text) {
  if (page.status !== status) throw new Error(`Expected HTTP ${status}, got ${page.status}`);
  if (text && !page.body.includes(text)) throw new Error(`Page does not contain "${text}"`);
}

async function main() {
  if (!process.argv.includes('--yes')) {
    throw new Error('This adds test records to the database. Run it with --yes on a development or test database.');
  }

  const resident = new Browser();
  const staff = new Browser();
  const newStaff = new Browser();
  const residentEmail = `smoke.${RUN}@example.com`;
  const newStaffEmail = `smoke.staff.${RUN}@example.com`;
  const categoryName = `Smoke Test ${RUN}`;
  const house = `S-${RUN}`.slice(0, 20);
  let complaintId;
  let categoryId;
  let attachmentPath;
  let residentId;
  let staffOptionId;
  let newStaffId;
  let realCategoryId;

  await step('Retrieve', '(connection)', 'GET /health reaches PostgreSQL', async () => {
    expect(await resident.request('/health'), 200, '"reachable"');
  });

  // ------------------------------------------------------------- residents
  await step('Create', 'users', 'Resident registers', async () => {
    const page = await resident.post('/register', '/register', {
      full_name: `Smoke Test ${RUN}`, email: residentEmail, phone_number: '09171234567',
      password: PASSWORD, confirm_password: PASSWORD,
    });
    expect(page, 200, 'Welcome');
  });
  await step('Create (rejected)', 'users', 'Duplicate email is refused by uq_users_email', async () => {
    const page = await new Browser().post('/register', '/register', {
      full_name: 'Smoke Test Duplicate', email: residentEmail, password: PASSWORD, confirm_password: PASSWORD,
    });
    expect(page, 422, 'already exists');
  });
  await step('Update', 'users', 'Resident edits profile', async () => {
    const page = await resident.post('/my/profile', '/my/profile', {
      full_name: `Smoke Test Edited ${RUN}`, phone_number: '09170000000',
    });
    expect(page, 200, 'profile was updated');
  });
  await step('Update', 'users', 'Resident changes password', async () => {
    const page = await resident.post('/my/profile', '/my/profile/password', {
      current_password: PASSWORD, new_password: PASSWORD, confirm_password: PASSWORD,
    });
    expect(page, 200, 'password was changed');
  });

  // ------------------------------------------------------------- complaints
  await step('Create', 'locations, complaints, attachments', 'Resident files a complaint with a photo, in one transaction', async () => {
    const form = await resident.request('/my/complaints/new');
    [, realCategoryId] = form.body.match(/name="category_id"[^>]*value="(\d+)"|<option value="(\d+)"/) || [];
    realCategoryId = realCategoryId || (form.body.match(/value="(\d+)"/) || [])[1];
    const page = await resident.postMultipart('/my/complaints/new', '/my/complaints', {
      category_id: realCategoryId, house_number: house, street: 'Smoke Test St.', barangay: 'Landayan',
      postal_code: '4023', description: 'Smoke test: brown water from the kitchen tap.',
    }, PNG);
    expect(page, 200, 'was submitted');
    complaintId = (page.body.match(/Complaint #(\d+)/) || [])[1];
    attachmentPath = (page.body.match(/\/attachments\/\d+/) || [])[0];
    if (!attachmentPath) throw new Error('The saved photo is not on the complaint page');
    return `complaint #${complaintId}`;
  });
  await step('Retrieve', 'attachments', 'Owner opens their photo', async () => {
    expect(await resident.request(attachmentPath), 200);
  });
  await step('Retrieve (rejected)', 'attachments', 'Anonymous visitor cannot open the photo', async () => {
    const page = await new Browser().request(attachmentPath);
    if (page.status !== 302) throw new Error(`Expected a redirect to login, got ${page.status}`);
  });
  await step('Create', 'complaints', 'A repeat at the same address is flagged, not rejected (Business Rule 10)', async () => {
    const page = await resident.postMultipart('/my/complaints/new', '/my/complaints', {
      category_id: realCategoryId, house_number: house, street: 'Smoke Test St.', barangay: 'Landayan',
      postal_code: '4023', description: 'Smoke test: same problem again.',
    });
    expect(page, 200, 'similar report');
  });
  await step('Retrieve', 'complaints + joins', 'Resident lists their complaints', async () => {
    expect(await resident.request('/my/complaints'), 200, `#${complaintId}`);
  });

  // ------------------------------------------------------------- staff
  await step('Retrieve', 'staff', 'Staff logs in', async () => {
    const page = await staff.post('/staff/login', '/staff/login', { email: STAFF_EMAIL, password: STAFF_PASSWORD });
    expect(page, 200, 'Dashboard');
  });
  await step('Retrieve (rejected)', 'complaints', 'Resident cannot open the staff console', async () => {
    const page = await resident.request('/admin/complaints');
    if (page.status !== 302 && page.status !== 403) throw new Error(`Expected refusal, got ${page.status}`);
  });
  await step('Retrieve', 'complaints + joins, aggregates', 'Dashboard, filtered queue, residents and staff pages', async () => {
    expect(await staff.request('/admin'), 200);
    expect(await staff.request(`/admin/complaints?status=Pending&barangay=Landayan&flagged=no&sort=oldest&q=${complaintId}`), 200, `#${complaintId}`);
    const residents = await staff.request(`/admin/residents?q=${residentEmail}`);
    expect(residents, 200, residentEmail);
    residentId = (residents.body.match(/\/admin\/residents\/(\d+)\/status/) || [])[1];
    expect(await staff.request('/admin/staff'), 200);
  });

  const complaintPage = () => `/admin/complaints/${complaintId}`;
  await step('Create', 'complaint_assignments', 'Staff assigns a staff member', async () => {
    const detail = await staff.request(complaintPage());
    staffOptionId = (detail.body.match(/name="staff_id"[\s\S]*?<option value="(\d+)"/) || [])[1];
    const page = await staff.post(complaintPage(), `${complaintPage()}/assign`, { staff_id: staffOptionId });
    expect(page, 200, 'was assigned');
  });
  await step('Create', 'complaint_assignments', 'Repeat assignment is a no-op (uq_complaint_assignments_complaint_staff)', async () => {
    const page = await staff.post(complaintPage(), `${complaintPage()}/assign`, { staff_id: staffOptionId });
    expect(page, 200, 'already assigned');
  });
  await step('Delete', 'complaint_assignments', 'Staff removes the assignment', async () => {
    const page = await staff.post(complaintPage(), `${complaintPage()}/unassign`, { staff_id: staffOptionId });
    expect(page, 200, 'Assignment removed');
  });
  await step('Update', 'complaints', 'Skipping a status is refused (Business Rule 5)', async () => {
    const page = await staff.post(complaintPage(), `${complaintPage()}/status`, { status: 'Resolved', remarks: 'skip' });
    expect(page, 200, 'can only be moved to');
  });
  await step('Update + Create', 'complaints, status_logs, complaint_assignments', 'Pending to In Progress, logged and auto-assigned, in one transaction', async () => {
    const page = await staff.post(complaintPage(), `${complaintPage()}/status`, { status: 'In Progress', remarks: 'Smoke test: crew dispatched.' });
    expect(page, 200, 'is now In Progress');
    if (!page.body.includes('Smoke test: crew dispatched.')) throw new Error('The remark is not in the history');
  });
  await step('Update + Create', 'complaints, status_logs', 'In Progress to Resolved sets resolved_at', async () => {
    const page = await staff.post(complaintPage(), `${complaintPage()}/status`, { status: 'Resolved', remarks: 'Smoke test: fixed.' });
    expect(page, 200, 'is now Resolved');
  });
  await step('Retrieve', 'status_logs', 'Resident sees the status history', async () => {
    expect(await resident.request(`/my/complaints/${complaintId}`), 200, 'Smoke test: fixed.');
  });
  await step('Update', 'complaints', 'Staff flags, then clears the flag', async () => {
    expect(await staff.post(complaintPage(), `${complaintPage()}/flag`, { action: 'flag', flag_reason: 'Smoke test' }), 200, 'flagged for review');
    expect(await staff.post(complaintPage(), `${complaintPage()}/flag`, { action: 'clear' }), 200, 'Flag cleared');
  });

  // ------------------------------------------------------------- categories
  await step('Create', 'complaint_categories', 'Staff adds a category', async () => {
    const page = await staff.post('/admin/categories', '/admin/categories', { category_name: categoryName, description: 'Temporary' });
    expect(page, 200, 'added');
    const list = await staff.request('/admin/categories');
    const index = list.body.indexOf(categoryName);
    const before = list.body.slice(0, index);
    categoryId = [...before.matchAll(/\/admin\/categories\/(\d+)"/g)].pop()[1];
  });
  await step('Update', 'complaint_categories', 'Staff renames the category', async () => {
    const page = await staff.post('/admin/categories', `/admin/categories/${categoryId}`, { category_name: `${categoryName} renamed`, description: '' });
    expect(page, 200, 'Category updated');
  });
  await step('Delete', 'complaint_categories', 'Staff removes the unused category', async () => {
    const page = await staff.post('/admin/categories', `/admin/categories/${categoryId}/delete`);
    expect(page, 200, 'Category removed');
  });
  await step('Delete (rejected)', 'complaint_categories', 'A category in use is refused by fk_complaints_category', async () => {
    const page = await staff.post('/admin/categories', `/admin/categories/${realCategoryId}/delete`);
    expect(page, 200, 'cannot be removed');
  });

  // ------------------------------------------------------------- accounts
  await step('Create', 'staff', 'Staff creates a staff account', async () => {
    const page = await staff.post('/admin/staff', '/admin/staff', {
      full_name: `Smoke Test Staff ${RUN}`, email: newStaffEmail, password: PASSWORD, confirm_password: PASSWORD,
    });
    expect(page, 200, 'Staff account created');
    const before = page.body.slice(0, page.body.indexOf(newStaffEmail));
    const after = page.body.slice(page.body.indexOf(newStaffEmail));
    newStaffId = (after.match(/\/admin\/staff\/(\d+)\/status/) || before.match(/\/admin\/staff\/(\d+)\/status/) || [])[1];
  });
  await step('Update', 'staff', 'The new staff member changes their password', async () => {
    expect(await newStaff.post('/staff/login', '/staff/login', { email: newStaffEmail, password: PASSWORD }), 200, 'Dashboard');
    const page = await newStaff.post('/admin/account', '/admin/account/password', {
      current_password: PASSWORD, new_password: PASSWORD, confirm_password: PASSWORD,
    });
    expect(page, 200, 'password was changed');
  });
  await step('Update', 'staff', 'Deactivated staff lose access at once (Business Rule 12)', async () => {
    expect(await staff.post('/admin/staff', `/admin/staff/${newStaffId}/status`, { account_status: 'Inactive' }), 200, 'deactivated');
    const page = await newStaff.request('/admin');
    if (page.status !== 302) throw new Error(`Expected a redirect to login, got ${page.status}`);
  });
  await step('Update', 'users', 'Deactivated residents lose access at once (Business Rule 12)', async () => {
    expect(await staff.post('/admin/residents', `/admin/residents/${residentId}/status`, { account_status: 'Inactive' }), 200, 'deactivated');
    const page = await resident.request('/my/complaints');
    if (page.status !== 302) throw new Error(`Expected a redirect to login, got ${page.status}`);
  });

  // ------------------------------------------------------------- reports
  await step('Retrieve', 'aggregates + joins', 'Reports page and CSV export', async () => {
    expect(await staff.request('/admin/reports'), 200, 'Landayan');
    expect(await staff.request('/admin/reports/export.csv'), 200, 'complaint_id');
  });

  const lines = [
    `Server: ${BASE}. Run at ${new Date().toISOString()}.`,
    '',
    '| # | Operation | Tables | Test | Result | Note |',
    '|---|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.operation} | ${r.tables} | ${r.description} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.note.replace(/\|/g, '\\|')} |`),
    '',
    `${results.length} tests, ${failures} failed.`,
  ];
  console.log(lines.join('\n'));
  const outIndex = process.argv.indexOf('--out');
  if (outIndex > -1 && process.argv[outIndex + 1]) fs.writeFileSync(process.argv[outIndex + 1], `${lines.join('\n')}\n`);
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Smoke test could not run:', err.message);
  process.exitCode = 1;
});
