const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { notifySubscribers } = require('../utils/telegram');

const router = express.Router();

// GET /api/attendance?employee_id=&month=&year=
router.get('/', authenticate, async (req, res) => {
  const { employee_id, month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  try {
    let query = `
      SELECT a.*, e.full_name AS employee_name
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE EXTRACT(MONTH FROM a.work_date) = $1 AND EXTRACT(YEAR FROM a.work_date) = $2
    `;
    const params = [m, y];
    if (employee_id) {
      params.push(employee_id);
      query += ` AND a.employee_id = $${params.length}`;
    }
    query += ' ORDER BY a.work_date, e.full_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/attendance/summary?month=&year= - сводка по сотрудникам за месяц
router.get('/summary', authenticate, async (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  try {
    const result = await pool.query(`
      SELECT e.id AS employee_id, e.full_name,
        COUNT(*) FILTER (WHERE a.status = 'present') AS present_days,
        COUNT(*) FILTER (WHERE a.status = 'late') AS late_days,
        COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_days,
        COUNT(*) FILTER (WHERE a.status = 'vacation') AS vacation_days,
        COUNT(*) FILTER (WHERE a.status = 'sick') AS sick_days
      FROM employees e
      LEFT JOIN attendance a ON a.employee_id = e.id
        AND EXTRACT(MONTH FROM a.work_date) = $1 AND EXTRACT(YEAR FROM a.work_date) = $2
      WHERE e.is_active = true
      GROUP BY e.id, e.full_name
      ORDER BY e.full_name
    `, [m, y]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/attendance - отметить посещаемость (upsert)
router.post(
  '/',
  authenticate,
  [
    body('employee_id').isUUID().withMessage('Некорректный сотрудник'),
    body('work_date').isISO8601().withMessage('Некорректная дата'),
    body('status').isIn(['present', 'late', 'absent', 'vacation', 'sick']).withMessage('Некорректный статус')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { employee_id, work_date, status, check_in, check_out, notes } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO attendance (employee_id, work_date, status, check_in, check_out, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (employee_id, work_date)
         DO UPDATE SET status = $3, check_in = $4, check_out = $5, notes = $6
         RETURNING *`,
        [employee_id, work_date, status, check_in || null, check_out || null, notes || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// POST /api/attendance/bulk - массовая отметка (для целого дня цеха)
router.post('/bulk', authenticate, async (req, res) => {
  const { work_date, records } = req.body; // records: [{employee_id, status}]
  if (!work_date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Требуется work_date и records[]' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const r of records) {
      const result = await client.query(
        `INSERT INTO attendance (employee_id, work_date, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (employee_id, work_date) DO UPDATE SET status = $3
         RETURNING *`,
        [r.employee_id, work_date, r.status]
      );
      results.push(result.rows[0]);
    }
    await client.query('COMMIT');

    const absentRecords = results.filter(r => r.status === 'absent');
    if (absentRecords.length > 0) {
      const namesResult = await pool.query(
        `SELECT id, full_name FROM employees WHERE id = ANY($1::uuid[])`,
        [absentRecords.map(r => r.employee_id)]
      );
      const names = namesResult.rows.map(e => e.full_name).join(', ');
      notifySubscribers(
        'employee_absent',
        `⚠️ <b>Отсутствие на работе</b>\nДата: ${work_date}\nСотрудник(и): ${names}`,
        { work_date, employee_ids: absentRecords.map(r => r.employee_id) }
      ).catch(() => {});
    }

    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

module.exports = router;
