// Data access for LOCATIONS.
const { pool } = require('./pool');

// Reuses an existing location row for the same household address so each
// address is stored once (Part 8: avoids redundancy / update anomalies).
async function findOrCreate({ houseNumber, street, barangay, city, postalCode }, db = pool) {
  const existing = await db.query(
    `SELECT location_id FROM locations
     WHERE lower(house_number) = lower($1)
       AND lower(street) = lower($2)
       AND barangay = $3
       AND lower(city) = lower($4)
       AND COALESCE(postal_code, '') = COALESCE($5, '')
     ORDER BY location_id
     LIMIT 1`,
    [houseNumber, street, barangay, city, postalCode]
  );
  if (existing.rows[0]) return existing.rows[0].location_id;

  const { rows } = await db.query(
    `INSERT INTO locations (house_number, street, barangay, city, postal_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING location_id`,
    [houseNumber, street, barangay, city, postalCode]
  );
  return rows[0].location_id;
}

// Addresses a resident has used before, for the "saved address" picker.
async function listForUser(userId) {
  const { rows } = await pool.query(
    `SELECT l.location_id, l.house_number, l.street, l.barangay, l.city, l.postal_code,
            MAX(c.submitted_at) AS last_used
     FROM locations l
     JOIN complaints c ON c.location_id = l.location_id
     WHERE c.user_id = $1
     GROUP BY l.location_id
     ORDER BY last_used DESC
     LIMIT 5`,
    [userId]
  );
  return rows;
}

module.exports = { findOrCreate, listForUser };
