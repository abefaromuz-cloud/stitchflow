const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/orders/:id/forecast', authenticate, async (req, res) => {
  try {
    const [orderR, dailyR, totalR] = await Promise.all([
      pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]),
      pool.query(`SELECT work_date, SUM(quantity_done) AS done FROM order_employee_progress WHERE order_id=$1 AND work_date>=CURRENT_DATE-14 GROUP BY work_date ORDER BY work_date`, [req.params.id]),
      pool.query(`SELECT COALESCE(SUM(quantity_done),0) AS total_done FROM order_employee_progress WHERE order_id=$1`, [req.params.id]),
    ]);
    const order = orderR.rows[0];
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    const totalDone = Number(totalR.rows[0].total_done);
    const remaining = Math.max(0, Number(order.quantity) - totalDone);
    if (!dailyR.rows.length || remaining===0) return res.json({ order_id:order.id, total_done:totalDone, remaining, message: remaining===0 ? 'Все изделия изготовлены' : 'Недостаточно данных', confidence_percent:0 });
    const vals = dailyR.rows.map(r=>Number(r.done));
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    if (avg<=0) return res.json({ order_id:order.id, total_done:totalDone, remaining, message:'Скорость нулевая', confidence_percent:0 });
    const estDays = Math.ceil(remaining/avg);
    const variance = vals.reduce((s,v)=>s+Math.pow(v-avg,2),0)/vals.length;
    const cv = Math.sqrt(variance)/avg;
    const confidence = Math.min(98, Math.max(30, Math.round(60 + Math.max(0,30*(1-Math.min(1,cv))) + Math.min(10,vals.length))));
    const estDate = new Date(); estDate.setDate(estDate.getDate()+estDays);
    let warning = null;
    if (order.due_date) { const due=new Date(order.due_date); if (estDate>due) warning=`Риск просрочки на ${Math.ceil((estDate-due)/86400000)} дн.`; }
    res.json({ order_id:order.id, order_number:order.order_number, total_done:totalDone, remaining, avg_per_day:Math.round(avg*10)/10, estimated_days:estDays, estimated_date:estDate.toISOString().split('T')[0], confidence_percent:confidence, due_date:order.due_date, warning, message:`Заказ №${order.order_number} будет готов через ${estDays} дн. с вероятностью ${confidence}%` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/employees/insights', authenticate, async (req, res) => {
  try {
    const [prod, att] = await Promise.all([
      pool.query('SELECT * FROM employee_production_stats ORDER BY total_done DESC'),
      pool.query(`SELECT e.id AS employee_id, e.full_name, COUNT(*) FILTER(WHERE a.status='late') AS late_count, COUNT(*) FILTER(WHERE a.status='absent') AS absent_count FROM employees e LEFT JOIN attendance a ON a.employee_id=e.id AND a.work_date>=CURRENT_DATE-30 WHERE e.is_active=true GROUP BY e.id,e.full_name`),
    ]);
    res.json({
      top_performers: prod.rows.filter(r=>Number(r.total_done)>0).slice(0,3),
      high_defect_employees: prod.rows.filter(r=>Number(r.defect_rate_percent)>2&&Number(r.total_done)>0).sort((a,b)=>Number(b.defect_rate_percent)-Number(a.defect_rate_percent)).slice(0,5),
      high_rework_employees: prod.rows.filter(r=>Number(r.rework_rate_percent)>3&&Number(r.total_done)>0).sort((a,b)=>Number(b.rework_rate_percent)-Number(a.rework_rate_percent)).slice(0,5),
      attendance_issues: att.rows.filter(r=>Number(r.late_count)+Number(r.absent_count)>0).sort((a,b)=>(Number(b.late_count)+Number(b.absent_count))-(Number(a.late_count)+Number(a.absent_count))).slice(0,5),
    });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/at-risk-orders', authenticate, async (req, res) => {
  try {
    const ordersR = await pool.query("SELECT id,order_number,quantity,due_date FROM orders WHERE status!='completed' AND due_date IS NOT NULL ORDER BY due_date LIMIT 20");
    const atRisk = [];
    for (const order of ordersR.rows) {
      const [daily, total] = await Promise.all([
        pool.query(`SELECT SUM(quantity_done) AS done FROM order_employee_progress WHERE order_id=$1 AND work_date>=CURRENT_DATE-14`, [order.id]),
        pool.query(`SELECT COALESCE(SUM(quantity_done),0) AS total FROM order_employee_progress WHERE order_id=$1`, [order.id]),
      ]);
      const totalDone = Number(total.rows[0].total);
      const remaining = Math.max(0, Number(order.quantity) - totalDone);
      if (remaining===0) continue;
      const done14 = Number(daily.rows[0].done||0);
      if (done14<=0) continue;
      const avg = done14/14;
      const estDays = Math.ceil(remaining/avg);
      const estDate = new Date(); estDate.setDate(estDate.getDate()+estDays);
      const due = new Date(order.due_date);
      if (estDate>due) atRisk.push({ order_id:order.id, order_number:order.order_number, due_date:order.due_date, estimated_date:estDate.toISOString().split('T')[0], days_late:Math.ceil((estDate-due)/86400000) });
    }
    res.json({ at_risk_orders: atRisk });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
