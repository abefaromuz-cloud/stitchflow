const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { notifySubscribers } = require('../utils/telegram');

const router = express.Router();

const STAGES = ['received', 'cutting', 'sewing', 'overlock', 'ironing', 'qc', 'packing', 'shipped'];

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

// GET /api/orders - список заказов (с фильтром по статусу)
router.get('/', authenticate, async (req, res) => {
  const { status, client_id } = req.query;
  try {
    let query = `
      SELECT o.*, c.company_name AS client_name
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    if (client_id) {
      params.push(client_id);
      query += ` AND o.client_id = $${params.length}`;
    }
    query += ' ORDER BY o.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/orders/:id - детали заказа (карта производства, прогресс, файлы)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const orderResult = await pool.query(`
      SELECT o.*, c.company_name AS client_name, c.contact_person, c.phone AS client_phone
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      WHERE o.id = $1
    `, [req.params.id]);

    if (!orderResult.rows[0]) return res.status(404).json({ error: 'Заказ не найден' });

    const stagesResult = await pool.query(
      'SELECT * FROM order_stages WHERE order_id = $1 ORDER BY stage_order',
      [req.params.id]
    );

    const progressResult = await pool.query(`
      SELECT oep.*, e.full_name AS employee_name
      FROM order_employee_progress oep
      JOIN employees e ON e.id = oep.employee_id
      WHERE oep.order_id = $1
      ORDER BY oep.work_date DESC
    `, [req.params.id]);

    const filesResult = await pool.query(
      'SELECT * FROM order_files WHERE order_id = $1 ORDER BY uploaded_at DESC',
      [req.params.id]
    );

    const totalDone = progressResult.rows.reduce((sum, r) => sum + Number(r.quantity_done), 0);
    const percentComplete = orderResult.rows[0].quantity > 0
      ? Math.min(100, Math.round((totalDone / orderResult.rows[0].quantity) * 100))
      : 0;

    res.json({
      ...orderResult.rows[0],
      stages: stagesResult.rows.map(s => ({ ...s, stage_label: STAGE_LABELS[s.stage_name] || s.stage_name })),
      progress: progressResult.rows,
      files: filesResult.rows,
      percent_complete: percentComplete,
      total_done: totalDone
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/orders - создать заказ (+ автоматически создает этапы карты производства)
router.post(
  '/',
  authenticate,
  [
    body('order_number').notEmpty().withMessage('Номер заказа обязателен'),
    body('client_id').isUUID().withMessage('Некорректный клиент'),
    body('product_name').notEmpty().withMessage('Название товара обязательно'),
    body('quantity').isInt({ min: 1 }).withMessage('Количество должно быть больше 0'),
    body('unit_price').isFloat({ min: 0 }).withMessage('Цена должна быть положительной')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { order_number, client_id, product_name, quantity, unit_price, due_date, description } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (order_number, client_id, product_name, quantity, unit_price, due_date, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [order_number, client_id, product_name, quantity, unit_price, due_date, description, req.user.id]
      );

      const order = orderResult.rows[0];

      // Создаем этапы карты производства
      for (let i = 0; i < STAGES.length; i++) {
        await client.query(
          `INSERT INTO order_stages (order_id, stage_name, stage_order, status)
           VALUES ($1, $2, $3, $4)`,
          [order.id, STAGES[i], i + 1, i === 0 ? 'done' : 'pending']
        );
      }

      await client.query('COMMIT');

      // Уведомление о новом заказе (не блокирует ответ)
      notifySubscribers(
        'new_order',
        `🧵 <b>Новый заказ №${order.order_number}</b>\nТовар: ${order.product_name}\nКоличество: ${order.quantity} шт\nСумма: $${Number(order.total_amount).toLocaleString()}`,
        { order_id: order.id, order_number: order.order_number }
      ).catch(() => {});

      res.status(201).json(order);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Заказ с таким номером уже существует' });
      }
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
      client.release();
    }
  }
);

// PUT /api/orders/:id - обновить заказ
router.put('/:id', authenticate, async (req, res) => {
  const { product_name, quantity, unit_price, status, due_date, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE orders SET
        product_name = COALESCE($1, product_name),
        quantity = COALESCE($2, quantity),
        unit_price = COALESCE($3, unit_price),
        status = COALESCE($4, status),
        due_date = COALESCE($5, due_date),
        description = COALESCE($6, description)
       WHERE id = $7 RETURNING *`,
      [product_name, quantity, unit_price, status, due_date, description, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Заказ не найден' });

    if (status === 'completed') {
      const o = result.rows[0];
      notifySubscribers(
        'order_completed',
        `✅ <b>Заказ №${o.order_number} завершен</b>\nТовар: ${o.product_name}\nСумма: $${Number(o.total_amount).toLocaleString()}`,
        { order_id: o.id, order_number: o.order_number }
      ).catch(() => {});
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/orders/:id/stages/:stageName - обновить статус этапа производства
router.put('/:id/stages/:stageName', authenticate, async (req, res) => {
  const { status } = req.body; // pending, in_progress, done
  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус этапа' });
  }
  try {
    const result = await pool.query(
      `UPDATE order_stages SET
        status = $1,
        started_at = CASE WHEN $1 = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
        completed_at = CASE WHEN $1 = 'done' THEN now() ELSE completed_at END,
        completed_by = CASE WHEN $1 = 'done' THEN $2 ELSE completed_by END
       WHERE order_id = $3 AND stage_name = $4 RETURNING *`,
      [status, req.body.employee_id || null, req.params.id, req.params.stageName]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Этап не найден' });

    // Если этап done, переводим следующий в in_progress
    if (status === 'done') {
      const current = result.rows[0];
      await pool.query(
        `UPDATE order_stages SET status = 'in_progress', started_at = now()
         WHERE order_id = $1 AND stage_order = $2 AND status = 'pending'`,
        [req.params.id, current.stage_order + 1]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/orders/:id/progress - записать выработку сотрудника по заказу
router.post(
  '/:id/progress',
  authenticate,
  [
    body('employee_id').isUUID().withMessage('Некорректный сотрудник'),
    body('quantity_done').isInt({ min: 0 }).withMessage('Количество должно быть >= 0')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { employee_id, stage_name, quantity_done, quantity_defect, work_date } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO order_employee_progress (order_id, employee_id, stage_name, quantity_done, quantity_defect, work_date)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
         ON CONFLICT (order_id, employee_id, stage_name, work_date)
         DO UPDATE SET quantity_done = $4, quantity_defect = $5
         RETURNING *`,
        [req.params.id, employee_id, stage_name || null, quantity_done, quantity_defect || 0, work_date]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// GET /api/orders/:id/materials - нормы расхода материалов для заказа
router.get('/:id/materials', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT om.*, m.name, m.unit, m.quantity_in_stock, m.unit_cost
      FROM order_materials om
      JOIN materials m ON m.id = om.material_id
      WHERE om.order_id = $1
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/orders/:id/materials - добавить/обновить норму расхода материала на единицу изделия
router.post(
  '/:id/materials',
  authenticate,
  [
    body('material_id').isUUID().withMessage('Некорректный материал'),
    body('quantity_per_unit').isFloat({ gt: 0 }).withMessage('Норма расхода должна быть больше 0')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { material_id, quantity_per_unit } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO order_materials (order_id, material_id, quantity_per_unit)
         VALUES ($1, $2, $3)
         ON CONFLICT (order_id, material_id) DO UPDATE SET quantity_per_unit = $3
         RETURNING *`,
        [req.params.id, material_id, quantity_per_unit]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// POST /api/orders/:id/auto-deduct - автоматически списать материалы по нормам
// исходя из суммарной выработки (total_done) за заказ
router.post('/:id/auto-deduct', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query('SELECT quantity FROM orders WHERE id = $1', [req.params.id]);
    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const progressResult = await client.query(
      `SELECT COALESCE(SUM(quantity_done), 0) AS total_done FROM order_employee_progress WHERE order_id = $1`,
      [req.params.id]
    );
    const totalDone = Number(progressResult.rows[0].total_done);

    const materialsResult = await client.query(
      `SELECT * FROM order_materials WHERE order_id = $1`,
      [req.params.id]
    );

    const deductions = [];
    for (const om of materialsResult.rows) {
      const requiredTotal = totalDone * Number(om.quantity_per_unit);
      const alreadyDeducted = Number(om.quantity_reserved);
      const toDeduct = requiredTotal - alreadyDeducted;

      if (toDeduct > 0) {
        await client.query(
          `INSERT INTO material_movements (material_id, movement_type, quantity, order_id, reason, created_by)
           VALUES ($1, 'out', $2, $3, 'Автосписание по выработке', $4)`,
          [om.material_id, toDeduct, req.params.id, req.user.id]
        );

        await client.query(
          `UPDATE materials SET quantity_in_stock = quantity_in_stock - $1 WHERE id = $2`,
          [toDeduct, om.material_id]
        );

        await client.query(
          `UPDATE order_materials SET quantity_reserved = $1 WHERE id = $2`,
          [requiredTotal, om.id]
        );

        deductions.push({ material_id: om.material_id, deducted: toDeduct });
      }
    }

    await client.query('COMMIT');
    res.json({ total_done: totalDone, deductions });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

module.exports = router;
