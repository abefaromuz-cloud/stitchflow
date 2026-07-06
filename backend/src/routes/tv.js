const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [today, overdue, stages, lb, topEver, month] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(oep.quantity_done),0) AS done_today, COALESCE(SUM(o.quantity),0) AS total_planned FROM order_employee_progress oep JOIN orders o ON o.id=oep.order_id WHERE oep.work_date=CURRENT_DATE AND o.status!='completed'"),
      pool.query("SELECT o.order_number,o.product_name,o.due_date,c.company_name FROM orders o JOIN clients c ON c.id=o.client_id WHERE o.due_date<CURRENT_DATE AND o.status!='completed' ORDER BY o.due_date LIMIT 5"),
      pool.query("SELECT os.stage_name, o.order_number, o.product_name, EXTRACT(EPOCH FROM (now()-os.started_at))/3600 AS hours_in_stage FROM order_stages os JOIN orders o ON o.id=os.order_id WHERE os.status='in_progress' AND o.status!='completed' ORDER BY os.started_at LIMIT 6"),
      pool.query(`SELECT ep.total_points,ep.bonus_tier,ep.units_produced,e.full_name,e.position FROM employee_points ep JOIN employees e ON e.id=ep.employee_id WHERE ep.period_month=EXTRACT(MONTH FROM CURRENT_DATE) AND ep.period_year=EXTRACT(YEAR FROM CURRENT_DATE) ORDER BY ep.total_points DESC LIMIT 5`),
      pool.query('SELECT full_name,total_done,defect_rate_percent FROM employee_production_stats ORDER BY total_done DESC LIMIT 1'),
      pool.query("SELECT COUNT(*) FILTER(WHERE status='completed') AS completed, COUNT(*) FILTER(WHERE status!='completed') AS active, COALESCE(SUM(total_amount) FILTER(WHERE date_trunc('month',created_at)=date_trunc('month',CURRENT_DATE)),0) AS revenue FROM orders"),
    ]);
    const LABELS = {received:'Получен',cutting:'Раскрой',sewing:'Пошив',overlock:'Оверлок',ironing:'Утюжка',qc:'Контроль QC',packing:'Упаковка',shipped:'Отгружен'};
    const TIER = {0:'',1:'🥉',2:'🥈',3:'🥇'};
    const done = Number(today.rows[0].done_today), planned = Number(today.rows[0].total_planned);
    res.json({
      updated_at: new Date().toISOString(),
      today: { done, planned, plan_percent: planned>0?Math.min(100,Math.round((done/planned)*100)):0 },
      month: { completed_orders:Number(month.rows[0].completed), active_orders:Number(month.rows[0].active), revenue:Number(month.rows[0].revenue) },
      overdue_orders: overdue.rows.map(o=>({order_number:o.order_number,product_name:o.product_name,client_name:o.company_name,due_date:o.due_date})),
      active_stages: stages.rows.map(s=>({stage_label:LABELS[s.stage_name]||s.stage_name,order_number:s.order_number,product_name:s.product_name,hours:Math.round(Number(s.hours_in_stage)*10)/10})),
      leaderboard: lb.rows.map((e,i)=>({rank:i+1,full_name:e.full_name,position:e.position,total_points:Number(e.total_points),units_produced:Number(e.units_produced),tier_icon:TIER[e.bonus_tier]||''})),
      top_employee_ever: topEver.rows[0]||null,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
