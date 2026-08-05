require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const seedDatabase = async () => {
  try {
    const query = `
      TRUNCATE TABLE reports RESTART IDENTITY CASCADE;

      INSERT INTO reports (category, description, severity, lat, lng) VALUES
      ('water', 'Burst pipe on main road', 3, -33.9249, 18.4241),
      ('roads', 'Large pothole in left lane', 2, -33.9250, 18.4250),
      ('electricity', 'Streetlights not working', 1, -33.9260, 18.4260),
      ('sanitation', 'Uncollected refuse', 2, -33.9270, 18.4270),
      ('water', 'Leaking fire hydrant', 1, -33.9280, 18.4280),
      ('roads', 'Traffic light out of order', 3, -33.9290, 18.4290),
      ('electricity', 'Power outage in neighborhood', 3, -33.9300, 18.4300),
      ('sanitation', 'Illegal dumping site', 2, -33.9310, 18.4310),
      ('water', 'No water pressure', 3, -33.9320, 18.4320),
      ('roads', 'Faded road markings', 1, -33.9330, 18.4330);
    `;

    await pool.query(query);
    console.log('Successfully seeded 10 fake reports.');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    pool.end();
  }
};

seedDatabase();