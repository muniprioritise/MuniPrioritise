require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const { body, validationResult } = require('express-validator');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken, requireRole } = require('./middleware/auth');

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is live' });
});

// POST /api/auth/register
app.post(
  '/api/auth/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['worker', 'supervisor']).withMessage('Role must be worker or supervisor')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role } = req.body;

    try {
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Save user
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
        [email, passwordHash, role]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports 
app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports 
app.post(
  '/api/reports',
  [
    body('category')
      .isIn(['water', 'electricity', 'roads', 'refuse', 'sanitation'])
      .withMessage('Invalid category. Must be water, electricity, roads, refuse, or sanitation.'),
    body('description').notEmpty().withMessage('Description is required'),
    body('severity').isInt({ min: 1, max: 3 }).withMessage('Severity must be an integer between 1 and 3'),
    body('lat').isNumeric().withMessage('Latitude must be a valid number'),
    body('lng').isNumeric().withMessage('Longitude must be a valid number')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { category, description, severity, lat, lng } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO reports (category, description, severity, lat, lng) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [category, description, severity, lat, lng]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Error saving report:', err);
      res.status(500).json({ error: 'Failed to save report' });
    }
  }
);

// POST /api/auth/register
app.post(
  '/api/auth/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['resident', 'worker', 'supervisor']).withMessage('Role must be resident, worker or supervisor'),
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('phone').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password, role, full_name, phone } = req.body;
    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, role, full_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, full_name, phone, created_at',
        [email, passwordHash, role, full_name, phone || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already in use' });
      }
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
