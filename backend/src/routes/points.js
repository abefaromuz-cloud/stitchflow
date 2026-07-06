const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/config', authenticate, async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM bonus_config LIMIT 1')).rows[0]); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.put('/config', authenticate, requireRole('admin'), async (req, res) => {
  const { points_per_unit,speed_bonus_threshold,speed_bonus_points,zero_defect_points,low_defect_max_percent,low_defect_points,full_attendance_points,late_penalty_points,absent_penalty_points,tier1_threshold,tier1_bonus,tier2_threshold,tier2_bonus,tier3_threshold,tier3_bonus } = req.body;
  try {
    const result = await pool.query(`UPDATE bonus_config SET points_per_unit=COALESCE($1,points_per_unit),speed_bonus_threshold=COALESCE($2,speed_bonus_threshold),speed_bonus_points=COALESCE($3,speed_bonus_points),zero_defect_points=COALESCE($4,zero_defect_points),low_defect_max_percent=COALESCE($5,low_defect_max_percent),low_defect_points=COALESCE($6,low_defect_points),full_attendance_points=COALESCE($7,full_attendance_points),late_penalty_points=COALESCE($8,late_penalty_points),absent_penalty_points=COALESCE($9,absent_penalty_points),tier1_threshold=COALESCE($10,tier1_threshold),tier1_bonus=COALESCE($11,tier1_bonus),tier2_threshold=COALESCE($12,tier2_threshold),tier2_bonus=COALESCE($13,tier2_bonus),tier3_threshold=COALESCE($14,tier3_threshold),tier3_bonus=COALESCE($15,tier3_bonus),updated_at=now() RETURNING *`, [points_per_unit,speed_bonus_threshold,speed_bonus_points,zero_defect_points,low_defect_max_percent,low_defect_points,full_attendance_points,late_penalty_points,absent_penalty_points,tier1_threshold,tier1_bonus,tier2_threshold,tier2_bonus,tier3_threshold,tier3_bonus]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/calculate', authenticate, requireRole('admin','manager'), async (req, res) => {
  const { month, year } = req.body;
  const m = month||(new Date().getMonth()+1), y = year||new Date().getFullYear();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cfg = (await client.query('SELECT * FROM bonus_config LIMIT 1')).rows[0];
    const emps = await client.query('SELECT * FROM employees WHERE is_active=true');
    const results = [];
    for (const emp of emps.rows) {
      const [prod, att] = await Promise.all([
        client.query(`SELECT COALESCE(SUM(quantity_done),0) AS done, COALESCE(SUM(quantity_defect),0) AS defect, COALESCE(SUM(quantity_rework),0) AS rework FROM order_employee_progress WHERE employee_id=$1 AND EXTRACT(MONTH FROM work_date)=$2 AND EXTRACT(YEAR FROM work_date)=$3`, [emp.id,m,y]),
        client.query(`SELECT COUNT(*) FILTER(WHERE status='present') AS present, COUNT(*) FILTER(WHERE status='late') AS late, COUNT(*) FILTER(WHERE status='absent') AS absent FROM attendance WHERE employee_id=$1 AND EXTRACT(MONTH FROM work_date)=$2 AND EXTRACT(YEAR FROM work_date)=$3`, [emp.id,m,y]),
      ]);
      const done=Number(prod.rows[0].done), defect=Number(prod.rows[0].defect), rework=Number(prod.rows[0].rework);
      const present=Number(att.rows[0].present), late=Number(att.rows[0].late), absent=Number(att.rows[0].absent);
      const defectRate = done>0?Math.round((defect/done)*10000)/100:0;
      const reworkRate = done>0?Math.round((rework/done)*10000)/100:0;
      let speed = Math.floor(done*Number(cfg.points_per_unit)); if (done>=cfg.speed_bonus_threshold) speed+=cfg.speed_bonus_points;
      let quality = 0; if (done>0) { if (defect===0) quality=cfg.zero_defect_points; else if (defectRate<=Number(cfg.low_defect_max_percent)) quality=cfg.low_defect_points; }
      let attendance = late===0&&absent===0&&present>0 ? cfg.full_attendance_points : Math.max(0, cfg.full_attendance_points - late*cfg.late_penalty_points - absent*cfg.absent_penalty_points);
      const total = speed+quality+attendance;
      let tier=0, bonus=0;
      if (total>=cfg.tier3_threshold){tier=3;bonus=Number(cfg.tier3_bonus);}
      else if (total>=cfg.tier2_threshold){tier=2;bonus=Number(cfg.tier2_bonus);}
      else if (total>=cfg.tier1_threshold){tier=1;bonus=Number(cfg.tier1_bonus);}
      const r = await client.query(`INSERT INTO employee_points (employee_id,period_month,period_year,speed_points,quality_points,attendance_points,units_produced,defect_count,rework_count,defect_rate_percent,rework_rate_percent,present_days,late_days,absent_days,bonus_tier,bonus_amount,calculated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now()) ON CONFLICT (employee_id,period_month,period_year) DO UPDATE SET speed_points=$4,quality_points=$5,attendance_points=$6,units_produced=$7,defect_count=$8,rework_count=$9,defect_rate_percent=$10,rework_rate_percent=$11,present_days=$12,late_days=$13,absent_days=$14,bonus_tier=$15,bonus_amount=$16,calculated_at=now() RETURNING *`, [emp.id,m,y,speed,quality,attendance,done,defect,rework,defectRate,reworkRate,present,late,absent,tier,bonus]);
      results.push({ ...r.rows[0], full_name:emp.full_name });
    }
    await client.query('COMMIT');
    res.json(results);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
  finally { client.release(); }
});

router.get('/', authenticate, async (req, res) => {
  const { month, year } = req.query;
  const m = month||(new Date().getMonth()+1), y = year||new Date().getFullYear();
  try {
    res.json((await pool.query(`SELECT ep.*, e.full_name, e.position FROM employee_points ep JOIN employees e ON e.id=ep.employee_id WHERE ep.period_month=$1 AND ep.period_year=$2 ORDER BY ep.total_points DESC`, [m,y])).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/leaderboard', authenticate, async (req, res) => {
  const now = new Date();
  try {
    res.json((await pool.query(`SELECT ep.total_points,ep.bonus_tier,ep.bonus_amount,ep.speed_points,ep.quality_points,ep.attendance_points,ep.units_produced,ep.defect_rate_percent,ep.rework_rate_percent,e.full_name,e.position FROM employee_points ep JOIN employees e ON e.id=ep.employee_id WHERE ep.period_month=$1 AND ep.period_year=$2 ORDER BY ep.total_points DESC LIMIT 10`, [now.getMonth()+1, now.getFullYear()])).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/employee/:id', authenticate, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM employee_points WHERE employee_id=$1 ORDER BY period_year DESC, period_month DESC LIMIT 12', [req.params.id])).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/redeem', authenticate, requireRole('admin','manager'), async (req, res) => {
  const { employee_id, period_month, period_year, redemption_type, description, points_used, value_amount } = req.body;
  try {
    const result = await pool.query(`INSERT INTO points_redemptions (employee_id,period_month,period_year,redemption_type,description,points_used,value_amount,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [employee_id,period_month,period_year,redemption_type,description||null,points_used||0,value_amount||null,req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/redemptions', authenticate, async (req, res) => {
  try {
    res.json((await pool.query(`SELECT pr.*, e.full_name FROM points_redemptions pr JOIN employees e ON e.id=pr.employee_id ORDER BY pr.created_at DESC LIMIT 50`)).rows);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
