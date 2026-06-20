const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================
// КОНФИГУРАЦИЯ СИСТЕМЫ БАЛЛОВ
// ============================

// GET /api/points/config - текущие настройки
router.get('/config', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bonus_config LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/points/config - обновить настройки (только admin)
router.put('/config', authenticate, requireRole('admin'), async (req, res) => {
  const {
    points_per_unit, speed_bonus_threshold, speed_bonus_points,
    zero_defect_points, low_defect_max_percent, low_defect_points,
    full_attendance_points, late_penalty_points, absent_penalty_points,
    tier1_threshold, tier1_bonus,
    tier2_threshold, tier2_bonus,
    tier3_threshold, tier3_bonus
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE bonus_config SET
        points_per_unit = COALESCE($1, points_per_unit),
        speed_bonus_threshold = COALESCE($2, speed_bonus_threshold),
        speed_bonus_points = COALESCE($3, speed_bonus_points),
        zero_defect_points = COALESCE($4, zero_defect_points),
        low_defect_max_percent = COALESCE($5, low_defect_max_percent),
        low_defect_points = COALESCE($6, low_defect_points),
        full_attendance_points = COALESCE($7, full_attendance_points),
        late_penalty_points = COALESCE($8, late_penalty_points),
        absent_penalty_points = COALESCE($9, absent_penalty_points),
        tier1_threshold = COALESCE($10, tier1_threshold),
        tier1_bonus = COALESCE($11, tier1_bonus),
        tier2_threshold = COALESCE($12, tier2_threshold),
        tier2_bonus = COALESCE($13, tier2_bonus),
        tier3_threshold = COALESCE($14, tier3_threshold),
        tier3_bonus = COALESCE($15, tier3_bonus),
        updated_at = now()
      RETURNING *
    `, [
      points_per_unit, speed_bonus_threshold, speed_bonus_points,
      zero_defect_points, low_defect_max_percent, low_defect_points,
      full_attendance_points, late_penalty_points, absent_penalty_points,
      tier1_threshold, tier1_bonus,
      tier2_threshold, tier2_bonus,
      tier3_threshold, tier3_bonus
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ============================
// РАСЧЁТ БАЛЛОВ ЗА ПЕРИОД
// ============================

/**
 * POST /api/points/calculate
 * Рассчитывает баллы для всех активных сотрудников за указанный месяц.
 *
 * Формула:
 * СКОРОСТЬ:
 *   speed_points = units_produced * points_per_unit
 *   + speed_bonus_points (если units_produced >= speed_bonus_threshold)
 *
 * КАЧЕСТВО:
 *   quality_points = zero_defect_points (если defect_count == 0)
 *                  или low_defect_points (если defect_rate <= low_defect_max_percent)
 *                  или 0 (если брак превышает порог)
 *
 * ПОСЕЩАЕМОСТЬ:
 *   attendance_points = full_attendance_points (если late==0 и absent==0)
 *   - late_days * late_penalty_points
 *   - absent_days * absent_penalty_points
 *   (минимум 0)
 *
 * ПРЕМИЯ: определяется по total_points и порогам tier1/tier2/tier3
 */
router.post('/calculate', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  const { month, year } = req.body;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Загружаем конфиг
    const configResult = await client.query('SELECT * FROM bonus_config LIMIT 1');
    const cfg = configResult.rows[0];
    if (!cfg) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Конфигурация системы баллов не найдена' });
    }

    const employees = await client.query('SELECT id FROM employees WHERE is_active = true');
    const results = [];

    for (const { id: empId } of employees.rows) {
      // 1. Выработка за период
      const productionResult = await client.query(`
        SELECT
          COALESCE(SUM(quantity_done), 0) AS units_produced,
          COALESCE(SUM(quantity_defect), 0) AS defect_count
        FROM order_employee_progress
        WHERE employee_id = $1
          AND EXTRACT(MONTH FROM work_date) = $2
          AND EXTRACT(YEAR FROM work_date) = $3
      `, [empId, m, y]);

      const unitsProduced = Number(productionResult.rows[0].units_produced);
      const defectCount = Number(productionResult.rows[0].defect_count);
      const defectRate = unitsProduced > 0
        ? Math.round((defectCount / unitsProduced) * 10000) / 100
        : 0;

      // 2. Посещаемость за период
      const attendanceResult = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'present') AS present_days,
          COUNT(*) FILTER (WHERE status = 'late') AS late_days,
          COUNT(*) FILTER (WHERE status = 'absent') AS absent_days
        FROM attendance
        WHERE employee_id = $1
          AND EXTRACT(MONTH FROM work_date) = $2
          AND EXTRACT(YEAR FROM work_date) = $3
      `, [empId, m, y]);

      const presentDays = Number(attendanceResult.rows[0].present_days);
      const lateDays = Number(attendanceResult.rows[0].late_days);
      const absentDays = Number(attendanceResult.rows[0].absent_days);

      // 3. Расчёт баллов
      // Скорость
      let speedPoints = Math.floor(unitsProduced * Number(cfg.points_per_unit));
      if (unitsProduced >= cfg.speed_bonus_threshold) {
        speedPoints += cfg.speed_bonus_points;
      }

      // Качество
      let qualityPoints = 0;
      if (unitsProduced > 0) {
        if (defectCount === 0) {
          qualityPoints = cfg.zero_defect_points;
        } else if (defectRate <= Number(cfg.low_defect_max_percent)) {
          qualityPoints = cfg.low_defect_points;
        }
      }

      // Посещаемость
      let attendancePoints;
      if (lateDays === 0 && absentDays === 0 && presentDays > 0) {
        attendancePoints = cfg.full_attendance_points;
      } else {
        attendancePoints = cfg.full_attendance_points
          - (lateDays * cfg.late_penalty_points)
          - (absentDays * cfg.absent_penalty_points);
        attendancePoints = Math.max(0, attendancePoints);
      }

      const totalPoints = speedPoints + qualityPoints + attendancePoints;

      // 4. Определяем уровень премии
      let bonusTier = 0;
      let bonusAmount = 0;
      if (totalPoints >= cfg.tier3_threshold) {
        bonusTier = 3;
        bonusAmount = Number(cfg.tier3_bonus);
      } else if (totalPoints >= cfg.tier2_threshold) {
        bonusTier = 2;
        bonusAmount = Number(cfg.tier2_bonus);
      } else if (totalPoints >= cfg.tier1_threshold) {
        bonusTier = 1;
        bonusAmount = Number(cfg.tier1_bonus);
      }

      // 5. Сохраняем / обновляем
      const record = await client.query(`
        INSERT INTO employee_points (
          employee_id, period_month, period_year,
          speed_points, quality_points, attendance_points,
          units_produced, defect_count, defect_rate_percent,
          present_days, late_days, absent_days,
          bonus_tier, bonus_amount, calculated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
        ON CONFLICT (employee_id, period_month, period_year) DO UPDATE SET
          speed_points = $4, quality_points = $5, attendance_points = $6,
          units_produced = $7, defect_count = $8, defect_rate_percent = $9,
          present_days = $10, late_days = $11, absent_days = $12,
          bonus_tier = $13, bonus_amount = $14, calculated_at = now()
        RETURNING *
      `, [
        empId, m, y,
        speedPoints, qualityPoints, attendancePoints,
        unitsProduced, defectCount, defectRate,
        presentDays, lateDays, absentDays,
        bonusTier, bonusAmount
      ]);

      results.push(record.rows[0]);
    }

    await client.query('COMMIT');
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

// ============================
// ПРОСМОТР БАЛЛОВ
// ============================

// GET /api/points?month=&year= - таблица баллов за период
router.get('/', authenticate, async (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  try {
    const result = await pool.query(`
      SELECT ep.*, e.full_name, e.position
      FROM employee_points ep
      JOIN employees e ON e.id = ep.employee_id
      WHERE ep.period_month = $1 AND ep.period_year = $2
      ORDER BY ep.total_points DESC
    `, [m, y]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/points/leaderboard - топ-10 за текущий месяц (для ТВ-дашборда)
router.get('/leaderboard', authenticate, async (req, res) => {
  const now = new Date();
  try {
    const result = await pool.query(`
      SELECT ep.total_points, ep.bonus_tier, ep.bonus_amount,
             ep.speed_points, ep.quality_points, ep.attendance_points,
             ep.units_produced, ep.defect_rate_percent,
             e.full_name, e.position
      FROM employee_points ep
      JOIN employees e ON e.id = ep.employee_id
      WHERE ep.period_month = $1 AND ep.period_year = $2
      ORDER BY ep.total_points DESC
      LIMIT 10
    `, [now.getMonth() + 1, now.getFullYear()]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/points/employee/:id - история баллов конкретного сотрудника
router.get('/employee/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM employee_points
      WHERE employee_id = $1
      ORDER BY period_year DESC, period_month DESC
      LIMIT 12
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ============================
// ИСПОЛЬЗОВАНИЕ ПРЕМИИ
// ============================

// POST /api/points/redeem - зафиксировать использование премии
router.post(
  '/redeem',
  authenticate,
  requireRole('admin', 'manager'),
  [
    body('employee_id').isUUID().withMessage('Некорректный сотрудник'),
    body('redemption_type').isIn(['cash_bonus', 'day_off', 'gift']).withMessage('Некорректный тип'),
    body('period_month').isInt({ min: 1, max: 12 }),
    body('period_year').isInt({ min: 2020 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { employee_id, period_month, period_year, redemption_type, description, points_used, value_amount } = req.body;
    try {
      const result = await pool.query(`
        INSERT INTO points_redemptions (employee_id, period_month, period_year, redemption_type, description, points_used, value_amount, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `, [employee_id, period_month, period_year, redemption_type, description, points_used || 0, value_amount || null, req.user.id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// GET /api/points/redemptions - история выдачи премий
router.get('/redemptions', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pr.*, e.full_name
      FROM points_redemptions pr
      JOIN employees e ON e.id = pr.employee_id
      ORDER BY pr.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
