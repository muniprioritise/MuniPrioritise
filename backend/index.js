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
// Writes to the dedicated `evidence` table (report_id, worker_id, photo_urls,
// notes, uploaded_at) rather than a nonexistent reports.worker_evidence column.
app.post(
  '/api/reports/:id/evidence',
  verifyToken,
  requireRole(['worker']),
  upload.array('evidence', 5),
  async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    const evidenceUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    const workerId = req.user.id;

    if (evidenceUrls.length === 0) {
      return res.status(400).json({ error: 'No evidence photos uploaded' });
    }

    try {
      const report = await pool.query('SELECT id FROM reports WHERE id = $1', [id]);
      if (report.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

      const evidenceResult = await pool.query(
        'INSERT INTO evidence (report_id, worker_id, photo_urls, notes) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, workerId, evidenceUrls, notes || null]
      );

      const reportResult = await pool.query(
        'UPDATE reports SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        ['resolved', id]
      );

      res.status(200).json({
        evidence: evidenceResult.rows[0],
        report: reportResult.rows[0]
      });
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
// Now persists each computed assignment into job_assignments (upsert on
// report_id) instead of only returning a computed-on-the-fly response. This
// is what gives accept/resolve/escalate/override a real row with a real id
// to act on — previously nothing in the codebase wrote to this table at all.
app.get('/api/jobs', verifyToken, async (req, res) => {
  try {
    const reportsResult = await pool.query("SELECT * FROM reports WHERE status = 'pending' ORDER BY created_at ASC");
    const pendingReports = reportsResult.rows;

    const reportsForAlgorithm = pendingReports.map(r => ({
      ...r,
      ward_id: r.ward_id ?? 'CPT-001'
    }));

    // Stub: no worker location/availability tracking exists yet, so every
    // worker-role user is treated as available at a fixed coordinate. Real
    // ids are pulled from users so job_assignments.worker_id (a UUID FK) has
    // something valid to reference — a hardcoded placeholder string like
    // 'worker-1' would violate the foreign key the moment this tries to insert.
    const workersResult = await pool.query("SELECT id FROM users WHERE role = 'worker'");
    const workers = workersResult.rows.map((w, i) => ({
      id: w.id,
      lat: -33.9260 + (i * 0.004),
      lng: 18.4260 + (i * 0.004),
      available: true
    }));
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

      // Sequential upsert — dataset size here is small (pending reports per
      // request), so this is simpler than Promise.all and avoids exhausting
      // the pool's connection limit if the pending queue ever gets large.
      const persistedJobs = [];
      for (const a of algoResult.assignments) {
        const upserted = await pool.query(
          `INSERT INTO job_assignments (report_id, worker_id, algorithm_used, priority_score)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (report_id) DO UPDATE SET
             worker_id = EXCLUDED.worker_id,
             algorithm_used = EXCLUDED.algorithm_used,
             priority_score = EXCLUDED.priority_score,
             assigned_at = NOW()
           RETURNING *`,
          [a.report_id, a.worker_id, algoResult.algorithm, a.score]
        );
        const job = upserted.rows[0];
        persistedJobs.push({
          id: job.id,
          report_id: job.report_id,
          worker_id: job.worker_id,
          score: job.priority_score,
          report: reportsById[job.report_id]
        });
      }

      return res.status(200).json({
        algorithm: algoResult.algorithm,
        jobs: persistedJobs,
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
// Rewritten against job_assignments (the real table) instead of the
// nonexistent `jobs` table. "Assigned or accepted, not yet resolved or
// escalated" is derived from the timestamp columns rather than a stored
// status string, so it can't drift out of sync with them.
app.get('/api/workers/assigned', verifyToken, requireRole(['worker']), async (req, res) => {
  try {
    const workerId = req.user.id;
    const result = await pool.query(
      `SELECT ja.*, r.category, r.description, r.lat, r.lng, r.status as report_status
       FROM job_assignments ja
       JOIN reports r ON ja.report_id = r.id
       WHERE ja.worker_id = $1 AND ja.resolved_at IS NULL AND ja.escalated_at IS NULL
       ORDER BY ja.priority_score DESC NULLS LAST, ja.assigned_at DESC`,
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
      `UPDATE job_assignments
       SET accepted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND worker_id = $2 AND accepted_at IS NULL AND resolved_at IS NULL AND escalated_at IS NULL
       RETURNING *`,
      [jobId, workerId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or already accepted' });
    }

    const job = jobResult.rows[0];

    const oldReport = await pool.query('SELECT status FROM reports WHERE id = $1', [job.report_id]);
    const oldStatus = oldReport.rows[0]?.status ?? null;

    await pool.query(
      `UPDATE reports SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [job.report_id]
    );

    await pool.query(
      `INSERT INTO status_events (report_id, changed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, 'in_progress', 'Worker accepted job')`,
      [job.report_id, workerId, oldStatus]
    );

    res.status(200).json(job);
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
    const { notes } = req.body;
    const evidenceUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    if (evidenceUrls.length === 0) {
      return res.status(400).json({ error: 'Evidence photos are required to resolve a job' });
    }

    const jobResult = await pool.query(
      `UPDATE job_assignments
       SET resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND worker_id = $2 AND accepted_at IS NOT NULL AND resolved_at IS NULL
       RETURNING *`,
      [jobId, workerId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or not accepted yet' });
    }

    const job = jobResult.rows[0];

    await pool.query(
      'INSERT INTO evidence (report_id, worker_id, photo_urls, notes) VALUES ($1, $2, $3, $4)',
      [job.report_id, workerId, evidenceUrls, notes || null]
    );

    const oldReport = await pool.query('SELECT status FROM reports WHERE id = $1', [job.report_id]);
    const oldStatus = oldReport.rows[0]?.status ?? null;

    await pool.query(
      `UPDATE reports SET status = 'resolved', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [job.report_id]
    );

    await pool.query(
      `INSERT INTO status_events (report_id, changed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, 'resolved', 'Worker submitted completion evidence')`,
      [job.report_id, workerId, oldStatus]
    );

    res.status(200).json(job);
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
    const escalationReason = reason || 'Worker escalated without providing a reason';

    const jobResult = await pool.query(
      `UPDATE job_assignments
       SET escalated_at = CURRENT_TIMESTAMP, notes = $2
       WHERE id = $1 AND worker_id = $3 AND resolved_at IS NULL
       RETURNING *`,
      [jobId, escalationReason, workerId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    const oldReport = await pool.query('SELECT status FROM reports WHERE id = $1', [job.report_id]);
    const oldStatus = oldReport.rows[0]?.status ?? null;

    await pool.query(
      `UPDATE reports SET status = 'escalated', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [job.report_id]
    );

    await pool.query(
      `INSERT INTO status_events (report_id, changed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, 'escalated', $4)`,
      [job.report_id, workerId, oldStatus, escalationReason]
    );

    res.status(200).json(job);
  } catch (err) {
    console.error('Error escalating job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/supervisor/override
// job_assignments already has override_by for exactly this purpose (NULL =
// algorithm-assigned, set = supervisor overrode). The worker reassignment
// itself is logged via status_events' job_id/old_worker_id/new_worker_id
// columns rather than old_status/new_status, which are for report status
// transitions specifically.
app.post('/api/supervisor/override', verifyToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const { job_id, new_worker_id, new_score, reason } = req.body;
    const supervisorId = req.user.id;
    const overrideReason = reason || 'Manual supervisor override';

    const jobQuery = await pool.query('SELECT * FROM job_assignments WHERE id = $1', [job_id]);
    if (jobQuery.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const oldJob = jobQuery.rows[0];

    const updatedJob = await pool.query(
      `UPDATE job_assignments
       SET worker_id = COALESCE($1, worker_id),
           priority_score = COALESCE($2, priority_score),
           override_by = $3,
           notes = $4
       WHERE id = $5
       RETURNING *`,
      [new_worker_id, new_score, supervisorId, overrideReason, job_id]
    );

    await pool.query(
      `INSERT INTO status_events (report_id, changed_by, job_id, old_worker_id, new_worker_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        oldJob.report_id,
        supervisorId,
        job_id,
        oldJob.worker_id,
        updatedJob.rows[0].worker_id,
        overrideReason
      ]
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
// Rewritten against status_events (existed in canon, never written to)
// instead of the nonexistent audit_logs table.
app.get('/api/supervisor/audit', verifyToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT se.*, u.full_name as changed_by_name, u.email as changed_by_email
       FROM status_events se
       LEFT JOIN users u ON se.changed_by = u.id
       ORDER BY se.occurred_at DESC LIMIT 100`
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
