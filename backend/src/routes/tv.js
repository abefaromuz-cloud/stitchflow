const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/tv - публичный эндпоинт (открыт на ТВ в цеху, без авторизации)
// Возвращает: план/выполнение сегодня, просроченные заказы, рейтинг сотрудников,
//             активные этапы, сводку по баллам месяца
router.get('/', async (req, res) => {
  try {
    const [
      todayPlan,
      overdueOrders,
      activeStages,
      leaderboard,
      topEmployee,
      monthStats
    ] = await Promise.all([

      // Сегодняшняя выработка vs план (все активные заказы)
      pool.query(`
        SELECT
          COALESCE(SUM(oep.quantity_done), 0) AS done_today,
          COALESCE(SUM(o.quantity), 0) AS total_planned
        FROM order_employee_progress oep
        JOIN orders o ON o.id = oep.order_id
        WHERE oep.work_date = CURRENT_DATE AND o.status != 'completed'
      `),

      // Просроченные заказы
      pool.query(`
        SELECT o.order_number, o.product_name, o.due_date, c.company_name
        FROM orders o
        JOIN clients c ON c.id = o.client_id
        WHERE o.due_date < CURRENT_DATE AND o.status != 'completed'
        ORDER BY o.due_date
        LIMIT 5
      `),

      // Активные этапы прямо сейчас
      pool.query(`
        SELECT os.stage_name, o.order_number, o.product_name,
               EXTRACT(EPOCH FROM (now() - os.started_at))/3600 AS hours_in_stage
        FROM order_stages os
        JOIN orders o ON o.id = os.order_id
        WHERE os.status = 'in_progress' AND o.status != 'completed'
        ORDER BY os.started_at
        LIMIT 8
      `),

      // Топ сотрудников по баллам (текущий месяц)
      pool.query(`
        SELECT ep.total_points, ep.speed_points, ep.quality_points, ep.attendance_points,
               ep.units_produced, ep.bonus_tier, ep.defect_rate_percent,
               e.full_name, e.position
        FROM employee_points ep
        JOIN employees e ON e.id = ep.employee_id
        WHERE ep.period_month = EXTRACT(MONTH FROM CURRENT_DATE)
          AND ep.period_year = EXTRACT(YEAR FROM CURRENT_DATE)
        ORDER BY ep.total_points DESC
        LIMIT 5
      `),

      // Лучший сотрудник по выработке за всё время
      pool.query(`
        SELECT full_name, total_done, defect_rate_percent
        FROM employee_production_stats
        ORDER BY total_done DESC LIMIT 1
      `),

      // Сводка текущего месяца
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
          COUNT(*) FILTER (WHERE status != 'completed') AS active_orders,
          COALESCE(SUM(total_amount) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)), 0) AS month_revenue
        FROM orders
      `)
    ]);

    const STAGE_LABELS = {
      received: 'Получен', cutting: 'Раскрой', sewing: 'Пошив',
      overlock: 'Оверлок', ironing: 'Утюжка', qc: 'Контроль качества',
      packing: 'Упаковка', shipped: 'Отгружен'
    };

    const TIER_LABELS = { 0: '', 1: '🥉', 2: '🥈', 3: '🥇' };

    const doneToday = Number(todayPlan.rows[0].done_today);
    const totalPlanned = Number(todayPlan.rows[0].total_planned);
    const planPercent = totalPlanned > 0 ? Math.min(100, Math.round((doneToday / totalPlanned) * 100)) : 0;

    res.json({
      updated_at: new Date().toISOString(),
      today: {
        done: doneToday,
        planned: totalPlanned,
        plan_percent: planPercent
      },
      month: {
        completed_orders: Number(monthStats.rows[0].completed_orders),
        active_orders: Number(monthStats.rows[0].active_orders),
        revenue: Number(monthStats.rows[0].month_revenue)
      },
      overdue_orders: overdueOrders.rows.map(o => ({
        order_number: o.order_number,
        product_name: o.product_name,
        client_name: o.company_name,
        due_date: o.due_date
      })),
      active_stages: activeStages.rows.map(s => ({
        stage_label: STAGE_LABELS[s.stage_name] || s.stage_name,
        order_number: s.order_number,
        product_name: s.product_name,
        hours: Math.round(Number(s.hours_in_stage) * 10) / 10
      })),
      leaderboard: leaderboard.rows.map((e, idx) => ({
        rank: idx + 1,
        full_name: e.full_name,
        position: e.position,
        total_points: Number(e.total_points),
        units_produced: Number(e.units_produced),
        defect_rate: Number(e.defect_rate_percent),
        tier_icon: TIER_LABELS[e.bonus_tier] || ''
      })),
      top_employee_ever: topEmployee.rows[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
