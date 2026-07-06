const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT e.*, COALESCE(s.total_done,0) AS total_done, COALESCE(s.total_defect,0) AS total_defect, COALESCE(s.total_rework,0) AS total_rework, COALESCE(s.defect_rate_percent,0) AS defect_rate_percent, COALESCE(s.rework_rate_percent,0) AS rework_rate_percent FROM employees e LEFT JOIN employee_production_stats s ON s.employee_id=e.id ORDER BY total_done DESC NULLS LAST`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/rating/top', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employee_production_stats ORDER BY total_done DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const [e, att, prog, pts] = await Promise.all([
      pool.query(`SELECT e.*, COALESCE(s.total_done,0) AS total_done, COALESCE(s.total_defect,0) AS total_defect, COALESCE(s.total_rework,0) AS total_rework, COALESCE(s.defect_rate_percent,0) AS defect_rate_percent, COALESCE(s.rework_rate_percent,0) AS rework_rate_percent FROM employees e LEFT JOIN employee_production_stats s ON s.employee_id=e.id WHERE e.id=$1`, [req.params.id]),
      pool.query("SELECT work_date,status,check_in,check_out FROM attendance WHERE employee_id=$1 AND work_date>=date_trunc('month',CURRENT_DATE) ORDER BY work_date", [req.params.id]),
      pool.query(`SELECT oep.*, o.order_number, o.product_name, oi.product_name AS item_name, oi.article FROM order_employee_progress oep JOIN orders o ON o.id=oep.order_id LEFT JOIN order_items oi ON oi.id=oep.order_item_id WHERE oep.employee_id=$1 ORDER BY oep.work_date DESC LIMIT 20`, [req.params.id]),
      pool.query('SELECT * FROM employee_points WHERE employee_id=$1 ORDER BY period_year DESC, period_month DESC LIMIT 12', [req.params.id]),
    ]);
    if (!e.rows[0]) return res.status(404).json({ error: 'Сотрудник не найден' });
    res.json({ ...e.rows[0], attendance: att.rows, recent_progress: prog.rows, points_history: pts.rows });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/', authenticate, async (req, res) => {
  const { full_name, position, phone, hire_date, base_salary, piece_rate } = req.body;
  if (!full_name || !hire_date) return res.status(400).json({ error: 'ФИО и дата приёма обязательны' });
  try {
    const result = await pool.query(
      `INSERT INTO employees (full_name,position,phone,hire_date,base_salary,piece_rate) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [full_name, position||null, phone||null, hire_date, base_salary||0, piece_rate||0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  const { full_name, position, phone, base_salary, piece_rate, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE employees SET full_name=COALESCE($1,full_name), position=COALESCE($2,position), phone=COALESCE($3,phone), base_salary=COALESCE($4,base_salary), piece_rate=COALESCE($5,piece_rate), is_active=COALESCE($6,is_active) WHERE id=$7 RETURNING *`,
      [full_name||null, position||null, phone||null, base_salary||null, piece_rate||null, is_active??null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
