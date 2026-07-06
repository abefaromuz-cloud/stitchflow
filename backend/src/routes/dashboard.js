const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const [ordersByStatus, overdue, revenue, payouts, topEmp, workload] = await Promise.all([
      pool.query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status'),
      pool.query("SELECT COUNT(*) AS count FROM orders WHERE due_date < CURRENT_DATE AND status != 'completed'"),
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS revenue FROM orders WHERE date_trunc('month',created_at)=date_trunc('month',CURRENT_DATE)"),
      pool.query("SELECT COALESCE(SUM(total_amount),0) AS payouts FROM salary_records WHERE period_month=EXTRACT(MONTH FROM CURRENT_DATE) AND period_year=EXTRACT(YEAR FROM CURRENT_DATE)"),
      pool.query('SELECT employee_id, full_name, total_done, total_defect, total_rework, defect_rate_percent, rework_rate_percent FROM employee_production_stats ORDER BY total_done DESC LIMIT 1'),
      pool.query(`SELECT e.id, e.full_name, COALESCE(SUM(oep.quantity_done),0) AS done_today FROM employees e LEFT JOIN order_employee_progress oep ON oep.employee_id=e.id AND oep.work_date=CURRENT_DATE WHERE e.is_active=true GROUP BY e.id, e.full_name ORDER BY done_today DESC`),
    ]);
    const completed = ordersByStatus.rows.find(r=>r.status==='completed');
    const total = ordersByStatus.rows.reduce((s,r)=>s+Number(r.count),0);
    const completedCount = completed ? Number(completed.count) : 0;
    res.json({
      orders: { total, active: total-completedCount, completed: completedCount, overdue: Number(overdue.rows[0].count), by_status: ordersByStatus.rows },
      finance: { monthly_revenue: Number(revenue.rows[0].revenue), monthly_payouts: Number(payouts.rows[0].payouts) },
      top_employee: topEmp.rows[0] || null,
      employee_workload: workload.rows,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
