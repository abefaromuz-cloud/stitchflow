const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const STAGE_LABELS = {
  received: 'Получен',
  cutting: 'Раскрой',
  sewing: 'Пошив',
  overlock: 'Оверлок',
  ironing: 'Утюжка',
  qc: 'Проверка качества',
  packing: 'Упаковка',
  shipped: 'Отгружен'
};

/**
 * GET /api/ai/orders/:id/forecast
 * Прогноз срока завершения заказа на основе текущей скорости выработки.
 *
 * Логика:
 * 1. Берем суммарную выработку (quantity_done) по дням за последние 14 дней для этого заказа.
 * 2. Считаем среднюю дневную скорость (шт/день).
 * 3. Остаток = quantity - total_done.
 * 4. Прогнозируемое число дней = остаток / средняя_скорость.
 * 5. Уверенность прогноза зависит от количества дней с данными и стабильности скорости
 *    (чем меньше разброс — тем выше уверенность).
 */
router.get('/orders/:id/forecast', authenticate, async (req, res) => {
  try {
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    if (order.status === 'completed') {
      return res.json({
        order_id: order.id,
        status: 'completed',
        message: 'Заказ уже завершен'
      });
    }

    const dailyResult = await pool.query(`
      SELECT work_date, SUM(quantity_done) AS done
      FROM order_employee_progress
      WHERE order_id = $1 AND work_date >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY work_date
      ORDER BY work_date
    `, [req.params.id]);

    const totalDoneResult = await pool.query(`
      SELECT COALESCE(SUM(quantity_done), 0) AS total_done
      FROM order_employee_progress
      WHERE order_id = $1
    `, [req.params.id]);

    const totalDone = Number(totalDoneResult.rows[0].total_done);
    const remaining = Math.max(0, Number(order.quantity) - totalDone);

    if (remaining === 0) {
      return res.json({
        order_id: order.id,
        total_done: totalDone,
        remaining: 0,
        message: 'Все изделия изготовлены, ожидает завершения этапов'
      });
    }

    const dailyValues = dailyResult.rows.map(r => Number(r.done));

    if (dailyValues.length === 0) {
      return res.json({
        order_id: order.id,
        total_done: totalDone,
        remaining,
        message: 'Недостаточно данных о выработке для прогноза',
        confidence_percent: 0
      });
    }

    const avgPerDay = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;

    if (avgPerDay <= 0) {
      return res.json({
        order_id: order.id,
        total_done: totalDone,
        remaining,
        message: 'Текущая скорость выработки равна нулю — прогноз невозможен',
        confidence_percent: 0
      });
    }

    const estimatedDays = Math.ceil(remaining / avgPerDay);

    const variance = dailyValues.reduce((sum, v) => sum + Math.pow(v - avgPerDay, 2), 0) / dailyValues.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgPerDay > 0 ? stdDev / avgPerDay : 1;

    const stabilityBonus = Math.max(0, 30 * (1 - Math.min(1, coefficientOfVariation)));
    const dataBonus = Math.min(10, dailyValues.length);
    let confidence = Math.round(60 + stabilityBonus + dataBonus);
    confidence = Math.min(98, Math.max(30, confidence));

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

    let warning = null;
    if (order.due_date) {
      const due = new Date(order.due_date);
      if (estimatedDate > due) {
        const daysLate = Math.ceil((estimatedDate - due) / (1000 * 60 * 60 * 24));
        warning = `Риск просрочки: прогноз на ${daysLate} дн. позже установленного срока`;
      }
    }

    res.json({
      order_id: order.id,
      order_number: order.order_number,
      total_done: totalDone,
      remaining,
      avg_per_day: Math.round(avgPerDay * 10) / 10,
      estimated_days: estimatedDays,
      estimated_date: estimatedDate.toISOString().split('T')[0],
      confidence_percent: confidence,
      due_date: order.due_date,
      warning,
      message: `Заказ №${order.order_number} будет готов через ${estimatedDays} дн. с вероятностью ${confidence}%`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/ai/employees/insights
 * Аналитика по сотрудникам: лучшие по выработке, наибольший брак,
 * наибольшее число опозданий/прогулов.
 */
router.get('/employees/insights', authenticate, async (req, res) => {
  try {
    const [productivity, attendance] = await Promise.all([
      pool.query(`
        SELECT employee_id, full_name, total_done, total_defect, defect_rate_percent
        FROM employee_production_stats
        ORDER BY total_done DESC
      `),
      pool.query(`
        SELECT e.id AS employee_id, e.full_name,
          COUNT(*) FILTER (WHERE a.status = 'late') AS late_count,
          COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
          COUNT(*) AS total_days
        FROM employees e
        LEFT JOIN attendance a ON a.employee_id = e.id
          AND a.work_date >= CURRENT_DATE - INTERVAL '30 days'
        WHERE e.is_active = true
        GROUP BY e.id, e.full_name
      `)
    ]);

    const productivityRows = productivity.rows.filter(r => Number(r.total_done) > 0);

    const topPerformers = productivityRows.slice(0, 3).map(r => ({
      employee_id: r.employee_id,
      full_name: r.full_name,
      total_done: Number(r.total_done),
      defect_rate_percent: Number(r.defect_rate_percent)
    }));

    const highDefectEmployees = productivity.rows
      .filter(r => Number(r.defect_rate_percent) > 2 && Number(r.total_done) > 0)
      .sort((a, b) => Number(b.defect_rate_percent) - Number(a.defect_rate_percent))
      .slice(0, 5)
      .map(r => ({
        employee_id: r.employee_id,
        full_name: r.full_name,
        total_done: Number(r.total_done),
        total_defect: Number(r.total_defect),
        defect_rate_percent: Number(r.defect_rate_percent)
      }));

    const attendanceIssues = attendance.rows
      .filter(r => Number(r.late_count) > 0 || Number(r.absent_count) > 0)
      .sort((a, b) => (Number(b.late_count) + Number(b.absent_count)) - (Number(a.late_count) + Number(a.absent_count)))
      .slice(0, 5)
      .map(r => ({
        employee_id: r.employee_id,
        full_name: r.full_name,
        late_count: Number(r.late_count),
        absent_count: Number(r.absent_count),
        period_days: 30
      }));

    res.json({
      top_performers: topPerformers,
      high_defect_employees: highDefectEmployees,
      attendance_issues: attendanceIssues
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/ai/bottlenecks
 * Узкие места производства: этапы, на которых заказы задерживаются
 * дольше исторической нормы.
 */
router.get('/bottlenecks', authenticate, async (req, res) => {
  try {
    const activeStagesResult = await pool.query(`
      SELECT os.stage_name, COUNT(*) AS active_count,
        AVG(EXTRACT(EPOCH FROM (now() - os.started_at)) / 3600) AS avg_hours_in_stage
      FROM order_stages os
      JOIN orders o ON o.id = os.order_id
      WHERE os.status = 'in_progress' AND o.status != 'completed'
      GROUP BY os.stage_name
    `);

    const avgDurationResult = await pool.query(`
      SELECT stage_name,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) AS avg_completion_hours,
        COUNT(*) AS completed_count
      FROM order_stages
      WHERE status = 'done' AND started_at IS NOT NULL AND completed_at IS NOT NULL
      GROUP BY stage_name
    `);

    const avgDurationMap = {};
    avgDurationResult.rows.forEach(r => {
      avgDurationMap[r.stage_name] = {
        avg_completion_hours: Math.round(Number(r.avg_completion_hours) * 10) / 10,
        completed_count: Number(r.completed_count)
      };
    });

    const bottlenecks = activeStagesResult.rows
      .map(r => {
        const historical = avgDurationMap[r.stage_name];
        const currentAvgHours = Math.round(Number(r.avg_hours_in_stage) * 10) / 10;
        const isBottleneck = !!historical && currentAvgHours > historical.avg_completion_hours * 1.5;

        return {
          stage_name: r.stage_name,
          stage_label: STAGE_LABELS[r.stage_name] || r.stage_name,
          active_orders_count: Number(r.active_count),
          current_avg_hours: currentAvgHours,
          historical_avg_hours: historical ? historical.avg_completion_hours : null,
          is_bottleneck: isBottleneck
        };
      })
      .sort((a, b) => b.current_avg_hours - a.current_avg_hours);

    res.json({ bottlenecks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/ai/at-risk-orders
 * Список активных заказов с прогнозом просрочки (для дашборда).
 * Прогноз вычисляется напрямую SQL-запросами (без HTTP self-call).
 */
router.get('/at-risk-orders', authenticate, async (req, res) => {
  try {
    const ordersResult = await pool.query(`
      SELECT o.id, o.order_number, o.quantity, o.due_date, o.status
      FROM orders o
      WHERE o.status != 'completed' AND o.due_date IS NOT NULL
      ORDER BY o.due_date ASC
      LIMIT 20
    `);

    const atRisk = [];

    for (const order of ordersResult.rows) {
      const [dailyResult, totalDoneResult] = await Promise.all([
        pool.query(`
          SELECT work_date, SUM(quantity_done) AS done
          FROM order_employee_progress
          WHERE order_id = $1 AND work_date >= CURRENT_DATE - INTERVAL '14 days'
          GROUP BY work_date
        `, [order.id]),
        pool.query(`
          SELECT COALESCE(SUM(quantity_done), 0) AS total_done
          FROM order_employee_progress
          WHERE order_id = $1
        `, [order.id])
      ]);

      const totalDone = Number(totalDoneResult.rows[0].total_done);
      const remaining = Math.max(0, Number(order.quantity) - totalDone);
      if (remaining === 0) continue;

      const dailyValues = dailyResult.rows.map(r => Number(r.done));
      if (dailyValues.length === 0) continue;

      const avgPerDay = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
      if (avgPerDay <= 0) continue;

      const estimatedDays = Math.ceil(remaining / avgPerDay);
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

      const due = new Date(order.due_date);
      if (estimatedDate > due) {
        const daysLate = Math.ceil((estimatedDate - due) / (1000 * 60 * 60 * 24));
        atRisk.push({
          order_id: order.id,
          order_number: order.order_number,
          due_date: order.due_date,
          estimated_date: estimatedDate.toISOString().split('T')[0],
          days_late: daysLate
        });
      }
    }

    res.json({ at_risk_orders: atRisk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
