const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/employees - список с рейтингом производительности
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*,
        COALESCE(s.total_done, 0) AS total_done,
        COALESCE(s.total_defect, 0) AS total_defect,
        COALESCE(s.defect_rate_percent, 0) AS defect_rate_percent
      FROM employees e
      LEFT JOIN employee_production_stats s ON s.employee_id = e.id
      ORDER BY total_done DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/employees/:id - карточка сотрудника
router.get('/:id', authenticate, async (req, res) => {
  try {
    const empResult = await pool.query(`
      SELECT e.*,
        COALESCE(s.total_done, 0) AS total_done,
        COALESCE(s.total_defect, 0) AS total_defect,
        COALESCE(s.defect_rate_percent, 0) AS defect_rate_percent
      FROM employees e
      LEFT JOIN employee_production_stats s ON s.employee_id = e.id
      WHERE e.id = $1
    `, [req.params.id]);

    if (!empResult.rows[0]) return res.status(404).json({ error: 'Сотрудник не найден' });

    const attendanceResult = await pool.query(`
      SELECT work_date, status, check_in, check_out
      FROM attendance
      WHERE employee_id = $1 AND work_date >= date_trunc('month', CURRENT_DATE)
      ORDER BY work_date
    `, [req.params.id]);

    const progressResult = await pool.query(`
      SELECT o.order_number, o.product_name, oep.quantity_done, oep.quantity_defect, oep.work_date, oep.stage_name
      FROM order_employee_progress oep
      JOIN orders o ON o.id = oep.order_id
      WHERE oep.employee_id = $1
      ORDER BY oep.work_date DESC
      LIMIT 20
    `, [req.params.id]);

    res.json({
      ...empResult.rows[0],
      attendance: attendanceResult.rows,
      recent_progress: progressResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/employees
router.post(
  '/',
  authenticate,
  [
    body('full_name').notEmpty().withMessage('ФИО обязательно'),
    body('hire_date').isISO8601().withMessage('Некорректная дата приема')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { full_name, position, phone, photo_url, hire_date, base_salary, piece_rate } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO employees (full_name, position, phone, photo_url, hire_date, base_salary, piece_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [full_name, position, phone, photo_url, hire_date, base_salary || 0, piece_rate || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// PUT /api/employees/:id
router.put('/:id', authenticate, async (req, res) => {
  const { full_name, position, phone, photo_url, base_salary, piece_rate, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE employees SET
        full_name = COALESCE($1, full_name),
        position = COALESCE($2, position),
        phone = COALESCE($3, phone),
        photo_url = COALESCE($4, photo_url),
        base_salary = COALESCE($5, base_salary),
        piece_rate = COALESCE($6, piece_rate),
        is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [full_name, position, phone, photo_url, base_salary, piece_rate, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Сотрудник не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM employees WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Сотрудник не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/employees/:id/rating - рейтинг производительности (для мотивации)
router.get('/rating/top', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT employee_id, full_name, total_done, total_defect, defect_rate_percent
      FROM employee_production_stats
      ORDER BY total_done DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
