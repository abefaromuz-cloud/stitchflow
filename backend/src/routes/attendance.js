const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { notifySubscribers } = require('../utils/telegram');
const router = express.Router();

router.get('/summary', authenticate, async (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth()+1), y = year || new Date().getFullYear();
  try {
    const result = await pool.query(`SELECT e.id AS employee_id, e.full_name, COUNT(*) FILTER(WHERE a.status='present') AS present_days, COUNT(*) FILTER(WHERE a.status='late') AS late_days, COUNT(*) FILTER(WHERE a.status='absent') AS absent_days, COUNT(*) FILTER(WHERE a.status='vacation') AS vacation_days, COUNT(*) FILTER(WHERE a.status='sick') AS sick_days FROM employees e LEFT JOIN attendance a ON a.employee_id=e.id AND EXTRACT(MONTH FROM a.work_date)=$1 AND EXTRACT(YEAR FROM a.work_date)=$2 WHERE e.is_active=true GROUP BY e.id,e.full_name ORDER BY e.full_name`, [m,y]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/', authenticate, async (req, res) => {
  const { employee_id, month, year } = req.query;
  const m = month||(new Date().getMonth()+1), y = year||new Date().getFullYear();
  try {
    let q = `SELECT a.*, e.full_name AS employee_name FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE EXTRACT(MONTH FROM a.work_date)=$1 AND EXTRACT(YEAR FROM a.work_date)=$2`;
    const params = [m,y];
    if (employee_id) { params.push(employee_id); q += ` AND a.employee_id=$${params.length}`; }
    q += ' ORDER BY a.work_date, e.full_name';
    res.json((await pool.query(q, params)).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/', authenticate, async (req, res) => {
  const { employee_id, work_date, status, check_in, check_out, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO attendance (employee_id,work_date,status,check_in,check_out,notes) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (employee_id,work_date) DO UPDATE SET status=$3,check_in=$4,check_out=$5,notes=$6 RETURNING *`,
      [employee_id, work_date, status, check_in||null, check_out||null, notes||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/bulk', authenticate, async (req, res) => {
  const { work_date, records } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const r of records) {
      const row = await client.query(
        `INSERT INTO attendance (employee_id,work_date,status) VALUES ($1,$2,$3) ON CONFLICT (employee_id,work_date) DO UPDATE SET status=$3 RETURNING *`,
        [r.employee_id, work_date, r.status]
      );
      results.push(row.rows[0]);
    }
    await client.query('COMMIT');
    const absent = records.filter(r=>r.status==='absent');
    if (absent.length > 0) {
      const empNames = await pool.query(`SELECT full_name FROM employees WHERE id=ANY($1::uuid[])`, [absent.map(r=>r.employee_id)]);
      const names = empNames.rows.map(e=>e.full_name).join(', ');
      notifySubscribers('employee_absent', `⚠️ <b>Отсутствие на работе</b>\nДата: ${work_date}\n${names}`, {}).catch(()=>{});
    }
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

module.exports = router;
