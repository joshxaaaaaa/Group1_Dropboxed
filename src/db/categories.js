// Data access for COMPLAINT_CATEGORIES.
const { pool } = require('./pool');

async function list() {
  const { rows } = await pool.query(
    `SELECT cat.category_id, cat.category_name, cat.description,
            COUNT(c.complaint_id)::int AS complaint_count
     FROM complaint_categories cat
     LEFT JOIN complaints c ON c.category_id = cat.category_id
     GROUP BY cat.category_id
     ORDER BY cat.category_id`
  );
  return rows;
}

async function findById(categoryId) {
  const { rows } = await pool.query('SELECT * FROM complaint_categories WHERE category_id = $1', [categoryId]);
  return rows[0] || null;
}

async function create({ categoryName, description }) {
  const { rows } = await pool.query(
    'INSERT INTO complaint_categories (category_name, description) VALUES ($1, $2) RETURNING *',
    [categoryName, description]
  );
  return rows[0];
}

async function update(categoryId, { categoryName, description }) {
  await pool.query(
    'UPDATE complaint_categories SET category_name = $2, description = $3 WHERE category_id = $1',
    [categoryId, categoryName, description]
  );
}

module.exports = { list, findById, create, update };
