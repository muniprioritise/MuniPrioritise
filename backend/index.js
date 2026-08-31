require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken, requireRole } = require('./middleware/auth');
const upload = require('./middleware/upload');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// POST /api/auth/login
app.post(
  '/api/auth/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
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
        user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/reports 
app.get('/api/reports', verifyToken, async (req, res) => {
  try {
    const { status, category, ward, startDate, endDate } = req.query;
    let query = 'SELECT * FROM reports WHERE 1=1';
    const values = [];
    let count = 1;

    if (status) { query += ` AND status = $${count++}`; values.push(status); }
    if (category) { query += ` AND category = $${count++}`; values.push(category); }
    if (ward) { query += ` AND ward_id = $${count++}`; values.push(ward); }
    if (startDate) { query += ` AND created_at >= $${count++}`; values.push(startDate); }
    if (endDate) { query += ` AND created_at <= $${count++}`; values.push(endDate); }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports 
app.post(
  '/api/reports',
  verifyToken,
  upload.array('photos', 5),
  [
    body('category').isIn(['water', 'electricity', 'roads', 'refuse', 'sanitation']).withMessage('Invalid category'),
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
    const photoUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    const userId = req.user.id;

    try {
      const result = await pool.query(
        'INSERT INTO reports (user_id, category, description, severity, lat, lng, photo_urls) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userId, category, description, severity, lat, lng, photoUrls]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Error saving report:', err);
      res.status(500).json({ error: 'Failed to save report' });
    }
  }
);

// PATCH /api/reports/:id/status (worker updates status)
app.patch(
  '/api/reports/:id/status',
  verifyToken,
  requireRole(['worker', 'supervisor']),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
      const result = await pool.query(
        'UPDATE reports SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/reports/:id/evidence (worker uploads completion photos)
app.post(
  '/api/reports/:id/evidence',
  verifyToken,
  requireRole(['worker']),
  upload.array('evidence', 5),
  async (req, res) => {
    const { id } = req.params;
    const evidenceUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    if (evidenceUrls.length === 0) {
      return res.status(400).json({ error: 'No evidence photos uploaded' });
    }

    try {
      const report = await pool.query('SELECT worker_evidence FROM reports WHERE id = $1', [id]);
      if (report.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

      const existingEvidence = report.rows[0].worker_evidence || [];
      const updatedEvidence = [...existingEvidence, ...evidenceUrls];

      const result = await pool.query(
        'UPDATE reports SET worker_evidence = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [updatedEvidence, 'resolved', id]
      );
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Error uploading evidence:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/reports/:id/rating (resident rates resolution)
app.patch(
  '/api/reports/:id/rating',
  verifyToken,
  async (req, res) => {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
      const report = await pool.query('SELECT user_id FROM reports WHERE id = $1', [id]);
      if (report.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
      if (report.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized to rate this report' });
      }

      const result = await pool.query(
        'UPDATE reports SET resolution_rating = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [rating, id]
      );
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Error submitting rating:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/jobs 
app.get('/api/jobs', verifyToken, async (req, res) => {
  try {
    const reportsResult = await pool.query("SELECT * FROM reports WHERE status = 'pending' ORDER BY created_at ASC");
    const pendingReports = reportsResult.rows;

    const reportsForAlgorithm = pendingReports.map(r => ({
      ...r,
      ward_id: r.ward_id ?? 'CPT-001'
    }));

    const workers = [
      { id: 'worker-1', lat: -33.9260, lng: 18.4260, available: true },
      { id: 'worker-2', lat: -33.9300, lng: 18.4300, available: true }
    ];
    try {
      const algoResponse = await fetch(`${process.env.ALGORITHM_SERVICE_URL}/prioritise/fcfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: reportsForAlgorithm, workers })
      });
      if (!algoResponse.ok) {
        throw new Error(`Algorithm service returned ${algoResponse.status}`);
      }
      const algoResult = await algoResponse.json();
      const reportsById = Object.fromEntries(
        pendingReports.map(r => [r.id, r])
      );
      const jobs = algoResult.assignments.map(a => ({
        report_id: a.report_id,
        worker_id: a.worker_id,
        score: a.score,
        report: reportsById[a.report_id]
      }));
      return res.status(200).json({
        algorithm: algoResult.algorithm,
        jobs,
        metrics: algoResult.metrics
      });
    } catch (algoErr) {
      console.error('Algorithm service unavailable. Falling back to raw reports:', algoErr.message);
      
      return res.status(200).json({
        fallback: true,
        message: 'Algorithm service down. Returning unassigned pending reports.',
        data: pendingReports
      });
    }
  } catch (dbErr) {
    console.error('Error fetching jobs:', dbErr);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workers/assigned
app.get('/api/workers/assigned', verifyToken, requireRole(['worker']), async (req, res) => {
  try {
    const workerId = req.user.id;
    const result = await pool.query(
      `SELECT j.*, r.category, r.description, r.lat, r.lng, r.status as report_status
       FROM jobs j
       JOIN reports r ON j.report_id = r.id
       WHERE j.worker_id = $1 AND j.status IN ('assigned', 'accepted')
       ORDER BY j.score DESC NULLS LAST, j.created_at DESC`,
      [workerId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching assigned jobs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/jobs/:id/accept
app.patch('/api/jobs/:id/accept', verifyToken, requireRole(['worker']), async (req, res) => {
  try {
    const jobId = req.params.id;
    const workerId = req.user.id;
    
    const jobResult = await pool.query(
      `UPDATE jobs SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND worker_id = $2 AND status = 'assigned'
       RETURNING *`,
      [jobId, workerId]
    );
    
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or already accepted' });
    }

    await pool.query(
      `UPDATE reports SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [jobResult.rows[0].report_id]
    );

    res.status(200).json(jobResult.rows[0]);
  } catch (err) {
    console.error('Error accepting job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/jobs/:id/resolve 
app.patch('/api/jobs/:id/resolve', verifyToken, requireRole(['worker']), upload.array('evidence', 5), async (req, res) => {
  try {
    const jobId = req.params.id;
    const workerId = req.user.id;
    const evidenceUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    if (evidenceUrls.length === 0) {
      return res.status(400).json({ error: 'Evidence photos are required to resolve a job' });
    }

    const jobResult = await pool.query(
      `UPDATE jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND worker_id = $2 AND status = 'accepted'
       RETURNING *`,
      [jobId, workerId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or not accepted yet' });
    }

    const reportId = jobResult.rows[0].report_id;
    const report = await pool.query('SELECT worker_evidence FROM reports WHERE id = $1', [reportId]);
    const existingEvidence = report.rows[0].worker_evidence || [];
    const updatedEvidence = [...existingEvidence, ...evidenceUrls];

    await pool.query(
      `UPDATE reports SET status = 'resolved', worker_evidence = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [updatedEvidence, reportId]
    );

    res.status(200).json(jobResult.rows[0]);
  } catch (err) {
    console.error('Error resolving job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/jobs/:id/escalate
app.patch('/api/jobs/:id/escalate', verifyToken, requireRole(['worker']), async (req, res) => {
  try {
    const jobId = req.params.id;
    const workerId = req.user.id;
    const { reason } = req.body;

    const jobResult = await pool.query(
      `UPDATE jobs SET status = 'escalated', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND worker_id = $2
       RETURNING *`,
      [jobId, workerId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await pool.query(
      `INSERT INTO audit_logs (supervisor_id, action, entity_type, entity_id, reason)
       VALUES (NULL, 'ESCALATE_JOB', 'job', $1, $2)`,
      [jobId, reason || 'Worker escalated without providing a reason']
    );

    res.status(200).json(jobResult.rows[0]);
  } catch (err) {
    console.error('Error escalating job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/supervisor/override
app.post('/api/supervisor/override', verifyToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const { job_id, new_worker_id, new_score, reason } = req.body;
    const supervisorId = req.user.id;

    const jobQuery = await pool.query('SELECT * FROM jobs WHERE id = $1', [job_id]);
    if (jobQuery.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const oldJob = jobQuery.rows[0];

    const updatedJob = await pool.query(
      `UPDATE jobs SET worker_id = COALESCE($1, worker_id), score = COALESCE($2, score), assigned_by = 'supervisor', updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [new_worker_id, new_score, job_id]
    );

    await pool.query(
      `INSERT INTO audit_logs (supervisor_id, action, entity_type, entity_id, old_value, new_value, reason)
       VALUES ($1, 'OVERRIDE_JOB', 'job', $2, $3, $4, $5)`,
      [supervisorId, job_id, oldJob, updatedJob.rows[0], reason || 'Manual supervisor override']
    );

    res.status(200).json(updatedJob.rows[0]);
  } catch (err) {
    console.error('Error overriding job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/supervisor/overview
app.get('/api/supervisor/overview', verifyToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const totalReports = await pool.query('SELECT COUNT(*) FROM reports');
    const pendingReports = await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'");
    const resolvedReports = await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'resolved'");
    const avgRating = await pool.query('SELECT AVG(resolution_rating) FROM reports WHERE resolution_rating IS NOT NULL');

    res.status(200).json({
      total_reports: parseInt(totalReports.rows[0].count),
      pending_reports: parseInt(pendingReports.rows[0].count),
      resolved_reports: parseInt(resolvedReports.rows[0].count),
      average_rating: parseFloat(avgRating.rows[0].avg) || 0
    });
  } catch (err) {
    console.error('Error fetching overview:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/supervisor/analytics
app.get('/api/supervisor/analytics', verifyToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const categoryDist = await pool.query('SELECT category, COUNT(*) as count FROM reports GROUP BY category');
    const statusDist = await pool.query('SELECT status, COUNT(*) as count FROM reports GROUP BY status');
    
    res.status(200).json({
      by_category: categoryDist.rows,
      by_status: statusDist.rows
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/supervisor/audit
app.get('/api/supervisor/audit', verifyToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.full_name as supervisor_name, u.email as supervisor_email 
       FROM audit_logs a 
       LEFT JOIN users u ON a.supervisor_id = u.id 
       ORDER BY a.created_at DESC LIMIT 100`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});