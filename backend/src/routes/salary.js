const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/salary?month=&year= - зарплатная ведомость за период
router.get('/', authenticate, async (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  try {
    const result = await pool.query(`
      SELECT sr.*, e.full_name, e.position
      FROM salary_records sr
      JOIN employees e ON e.id = sr.employee_id
      WHERE sr.period_month = $1 AND sr.period_year = $2
      ORDER BY e.full_name
    `, [m, y]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/salary/:id - детали с бонусами/штрафами
router.get('/:id', authenticate, async (req, res) => {
  try {
    const recordResult = await pool.query(`
      SELECT sr.*, e.full_name, e.position
      FROM salary_records sr
      JOIN employees e ON e.id = sr.employee_id
      WHERE sr.id = $1
    `, [req.params.id]);
    if (!recordResult.rows[0]) return res.status(404).json({ error: 'Запись не найдена' });

    const adjustmentsResult = await pool.query(
      'SELECT * FROM salary_adjustments WHERE salary_record_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    res.json({ ...recordResult.rows[0], adjustments: adjustmentsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/salary/calculate - рассчитать/пересчитать зарплату за период для всех сотрудников
router.post('/calculate', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  const { month, year } = req.body;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const employees = await client.query('SELECT * FROM employees WHERE is_active = true');
    const results = [];

    for (const emp of employees.rows) {
      // Сдельная выработка за месяц
      const pieceWorkResult = await client.query(`
        SELECT COALESCE(SUM(quantity_done), 0) AS total_done
        FROM order_employee_progress
        WHERE employee_id = $1
          AND EXTRACT(MONTH FROM work_date) = $2
          AND EXTRACT(YEAR FROM work_date) = $3
      `, [emp.id, m, y]);

      const totalDone = Number(pieceWorkResult.rows[0].total_done);
      const pieceWorkAmount = totalDone * Number(emp.piece_rate);

      const result = await client.query(`
        INSERT INTO salary_records (employee_id, period_month, period_year, base_salary, piece_work_amount)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (employee_id, period_month, period_year)
        DO UPDATE SET base_salary = $4, piece_work_amount = $5
        RETURNING *
      `, [emp.id, m, y, emp.base_salary, pieceWorkAmount]);

      results.push({ ...result.rows[0], full_name: emp.full_name });
    }

    await client.query('COMMIT');
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

// POST /api/salary/:id/adjustments - добавить бонус/штраф
router.post(
  '/:id/adjustments',
  authenticate,
  requireRole('admin', 'manager'),
  [
    body('type').isIn(['bonus', 'penalty']).withMessage('Тип должен быть bonus или penalty'),
    body('amount').isFloat({ gt: 0 }).withMessage('Сумма должна быть больше 0'),
    body('reason').notEmpty().withMessage('Укажите причину')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { type, amount, reason } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const adjResult = await client.query(
        `INSERT INTO salary_adjustments (salary_record_id, type, amount, reason)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.params.id, type, amount, reason]
      );

      const column = type === 'bonus' ? 'bonus_amount' : 'penalty_amount';
      const updateResult = await client.query(
        `UPDATE salary_records SET ${column} = ${column} + $1 WHERE id = $2 RETURNING *`,
        [amount, req.params.id]
      );

      if (!updateResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Запись о зарплате не найдена' });
      }

      await client.query('COMMIT');
      res.status(201).json({ adjustment: adjResult.rows[0], salary_record: updateResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
      client.release();
    }
  }
);

// PUT /api/salary/:id/pay - отметить как выплачено
router.put('/:id/pay', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE salary_records SET status = 'paid', paid_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Запись не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
