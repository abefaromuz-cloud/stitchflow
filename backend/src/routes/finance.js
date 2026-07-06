const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/summary', authenticate, async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM monthly_finance_summary ORDER BY period')).rows); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/overview', authenticate, async (req, res) => {
  try {
    const [rev, exp, expCat, debts, payouts] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS revenue FROM orders WHERE date_trunc('month',created_at)=date_trunc('month',CURRENT_DATE)"),
      pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date_trunc('month',expense_date)=date_trunc('month',CURRENT_DATE)"),
      pool.query("SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses WHERE date_trunc('month',expense_date)=date_trunc('month',CURRENT_DATE) GROUP BY category"),
      pool.query('SELECT COALESCE(SUM(debt_amount),0) AS total FROM clients'),
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM salary_records WHERE period_month=EXTRACT(MONTH FROM CURRENT_DATE) AND period_year=EXTRACT(YEAR FROM CURRENT_DATE)"),
    ]);
    const revenue = Number(rev.rows[0].revenue), expenses = Number(exp.rows[0].total);
    res.json({ revenue, expenses, profit: revenue-expenses, client_debts: Number(debts.rows[0].total), employee_payouts: Number(payouts.rows[0].total), expenses_by_category: expCat.rows });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/expenses', authenticate, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC')).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/expenses', authenticate, requireRole('admin','manager'), async (req, res) => {
  const { category, amount, description, expense_date } = req.body;
  try {
    const result = await pool.query(`INSERT INTO expenses (category,amount,description,expense_date,created_by) VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),$5) RETURNING *`, [category,amount,description||null,expense_date||null,req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.delete('/expenses/:id', authenticate, requireRole('admin','manager'), async (req, res) => {
  try { await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
