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

async function notifyResidentOfStatusChange(reportId, newStatus) {
  try {
    const result = await pool.query(
      'SELECT u.expo_push_token FROM users u JOIN reports r ON u.id = r.user_id WHERE r.id = $1',
      [reportId]
    );
    const token = result.rows[0]?.expo_push_token;

    if (token) {
      const formattedStatus = newStatus.replace(/_/g, ' ');
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: 'MuniPrioritise Update',
          body: `Your report status has changed to: ${formattedStatus}`
        })
      });
    }
  } catch (err) {
    console.error('Failed to send push notification:', err);
  }
}

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

    const { email, password, expo_push_token } = req.body;
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

      if (expo_push_token) {
        await pool.query('UPDATE users SET expo_push_token = $1 WHERE id = $2', [expo_push_token, user.id]);
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

// GET /api/reports/mine (a resident's own reports only)
// Must stay above /api/reports/:id, or "mine" would be read as an id.
app.get('/api/reports/mine', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reports WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching own reports:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/nearby?lat=&lng=&radiusKm=
// Bounding-box search. Returns no user ids or photos, so it is safe to show
// other residents' reports on the map.
app.get('/api/reports/nearby', verifyToken, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusKm = Math.min(parseFloat(req.query.radiusKm) || 5, 50);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' });
  }

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  try {
    const result = await pool.query(
      `SELECT id, category, description, severity, status, lat, lng, created_at
       FROM reports
       WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4
       ORDER BY created_at DESC
       LIMIT 200`,
      [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching nearby reports:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/:id (owner or staff), with the status timeline
app.get('/api/reports/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const reportResult = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];
    const isOwner = report.user_id === req.user.id;
    const isStaff = ['worker', 'supervisor'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Not allowed to view this report' });
    }

    // Supervisor reassignments are logged with no new_status; skip those.
    const events = await pool.query(
      `SELECT new_status, notes, occurred_at
       FROM status_events
       WHERE report_id = $1 AND new_status IS NOT NULL
       ORDER BY occurred_at ASC`,
      [id]
    );

    res.status(200).json({ ...report, status_events: events.rows });
  } catch (err) {
    // A malformed id is a bad lookup, not a server fault.
    if (err.code === '22P02') {
      return res.status(404).json({ error: 'Report not found' });
    }
    console.error('Error fetching report:', err);
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
    body('severity').isInt({ min: 1, max: 5 }).withMessage('Severity must be an integer between 1 and 5'),
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
      await notifyResidentOfStatusChange(id, status);
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Error updating status:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/reports/:id/evidence (worker uploads completion photos)
// Writes to the evidence table, not a column on reports.
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
// Persists each assignment into job_assignments (upsert on report_id) so
// accept/resolve/escalate/override have a real row to act on.
app.get('/api/jobs', verifyToken, async (req, res) => {
  try {
    const reportsResult = await pool.query("SELECT * FROM reports WHERE status = 'pending' ORDER BY created_at ASC");
    const pendingReports = reportsResult.rows;

    const reportsForAlgorithm = pendingReports.map(r => ({
      ...r,
      ward_id: r.ward_id ?? 'CPT-001'
    }));

    // Stub until worker location/availability tracking exists.
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

    await notifyResidentOfStatusChange(job.report_id, 'in_progress');
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

    await notifyResidentOfStatusChange(job.report_id, 'resolved');
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
    const openReports = await pool.query(
      "SELECT COUNT(*) FROM reports WHERE status != 'resolved'"
    );
    const resolvedReports = await pool.query(
      "SELECT COUNT(*) FROM reports WHERE status = 'resolved'"
    );

    // Average hours from creation to last update, resolved reports only.
    // Mirrors computeOverviewMetrics() in dashboard/src/utils/dashboardData.js.
    const avgResponse = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0) AS avg_hours
       FROM reports
       WHERE status = 'resolved'`
    );

    const total = parseInt(totalReports.rows[0].count, 10);
    const resolvedCount = parseInt(resolvedReports.rows[0].count, 10);
    const resolutionRatePercent = total > 0 ? (resolvedCount / total) * 100 : 0;

    // Equity score: average ward sampi_score across currently OPEN reports.
    const equityResult = await pool.query(
      `SELECT AVG(w.sampi_score) AS equity_score
       FROM reports r
       JOIN wards w ON r.ward_id = w.id
       WHERE r.status != 'resolved' AND w.sampi_score IS NOT NULL`
    );

    res.status(200).json({
      total_open: parseInt(openReports.rows[0].count, 10),
      avg_response_time_hours: Number(
        parseFloat(avgResponse.rows[0].avg_hours || 0).toFixed(1)
      ),
      resolution_rate_percent: Number(resolutionRatePercent.toFixed(1)),
      equity_score: Number(parseFloat(equityResult.rows[0].equity_score || 0).toFixed(2)),
    });
  } catch (err) {
    console.error('Error fetching overview:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/supervisor/analytics
app.get('/api/supervisor/analytics', verifyToken, requireRole(['supervisor']), async (req, res) => {
  try {
    const responseTimeByCategory = await pool.query(
      `SELECT
         category,
         ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0)::numeric, 1) AS avg_response_hours
       FROM reports
       WHERE status = 'resolved'
       GROUP BY category
       ORDER BY category`
    );

    const requestsOverTime = await pool.query(
      `SELECT
         TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
         COUNT(*) AS requests
       FROM reports
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY date`
    );

    const equityByWard = await pool.query(
      `SELECT
         w.id AS ward,
         w.sampi_score AS equity_score
       FROM wards w
       WHERE w.sampi_score IS NOT NULL
       ORDER BY w.id`
    );

    res.status(200).json({
      responseTimeByCategory: responseTimeByCategory.rows.map((row) => ({
        category: row.category,
        avg_response_hours: Number(row.avg_response_hours || 0),
      })),
      requestsOverTime: requestsOverTime.rows.map((row) => ({
        date: row.date,
        requests: parseInt(row.requests, 10),
      })),
      equityByWard: equityByWard.rows.map((row) => ({
        ward: row.ward,
        equity_score: Number(row.equity_score),
      })),
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
