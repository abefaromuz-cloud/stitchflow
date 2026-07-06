const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { month, year } = req.query;
  const m = month||(new Date().getMonth()+1), y = year||new Date().getFullYear();
  try {
    const result = await pool.query(`SELECT sr.*, e.full_name, e.position FROM salary_records sr JOIN employees e ON e.id=sr.employee_id WHERE sr.period_month=$1 AND sr.period_year=$2 ORDER BY e.full_name`, [m,y]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/calculate', authenticate, requireRole('admin','manager'), async (req, res) => {
  const { month, year } = req.body;
  const m = month||(new Date().getMonth()+1), y = year||new Date().getFullYear();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const emps = await client.query('SELECT * FROM employees WHERE is_active=true');
    const results = [];
    for (const emp of emps.rows) {
      const [prod, att] = await Promise.all([
        client.query(`SELECT COALESCE(SUM(quantity_done),0) AS done FROM order_employee_progress WHERE employee_id=$1 AND EXTRACT(MONTH FROM work_date)=$2 AND EXTRACT(YEAR FROM work_date)=$3`, [emp.id,m,y]),
        client.query(`SELECT COUNT(*) FILTER(WHERE status='late') AS late, COUNT(*) FILTER(WHERE status='absent') AS absent FROM attendance WHERE employee_id=$1 AND EXTRACT(MONTH FROM work_date)=$2 AND EXTRACT(YEAR FROM work_date)=$3`, [emp.id,m,y]),
      ]);
      const done = Number(prod.rows[0].done);
      const pieceWork = done * Number(emp.piece_rate);
      const r = await client.query(
        `INSERT INTO salary_records (employee_id,period_month,period_year,base_salary,piece_work_amount) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (employee_id,period_month,period_year) DO UPDATE SET base_salary=$4, piece_work_amount=$5 RETURNING *`,
        [emp.id, m, y, emp.base_salary, pieceWork]
      );
      results.push({ ...r.rows[0], full_name: emp.full_name });
    }
    await client.query('COMMIT');
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

router.post('/:id/adjustments', authenticate, requireRole('admin','manager'), async (req, res) => {
  const { type, amount, reason } = req.body;
  if (!type || !amount || !reason) return res.status(400).json({ error: 'Тип, сумма и причина обязательны' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO salary_adjustments (salary_record_id,type,amount,reason) VALUES ($1,$2,$3,$4)`, [req.params.id,type,amount,reason]);
    const col = type==='bonus' ? 'bonus_amount' : 'penalty_amount';
    const result = await client.query(`UPDATE salary_records SET ${col}=${col}+$1 WHERE id=$2 RETURNING *`, [amount, req.params.id]);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

router.put('/:id/pay', authenticate, requireRole('admin','manager'), async (req, res) => {
  try {
    const result = await pool.query(`UPDATE salary_records SET status='paid', paid_at=now() WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
