require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3000;
const { body, validationResult } = require('express-validator');
app.use(cors());
app.use(express.json());
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is live' });
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
// GET /api/jobs 
app.get('/api/jobs', async (req, res) => {
  try {
    const reportsResult = await pool.query("SELECT * FROM reports WHERE status = 'pending' ORDER BY created_at ASC");
    const pendingReports = reportsResult.rows;

    // Algorithm service requires a non-null ward_id string on every report.
    // Reports submitted without one (e.g. mobile Phase 1 thin slice) default here
    // so a single missing ward_id doesn't 422 the whole batch.
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
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
