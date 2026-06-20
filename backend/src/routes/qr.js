const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
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

// GET /api/qr/orders/:id/image - PNG-изображение QR-кода для заказа
router.get('/orders/:id/image', authenticate, async (req, res) => {
  try {
    let tokenResult = await pool.query(
      `SELECT * FROM order_qr_tokens WHERE order_id = $1 AND is_active = true LIMIT 1`,
      [req.params.id]
    );

    let tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      const token = crypto.randomBytes(16).toString('hex');
      const insertResult = await pool.query(
        `INSERT INTO order_qr_tokens (order_id, token) VALUES ($1, $2) RETURNING *`,
        [req.params.id, token]
      );
      tokenRow = insertResult.rows[0];
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const scanUrl = `${frontendUrl}/scan/${tokenRow.token}`;

    const pngBuffer = await QRCode.toBuffer(scanUrl, { width: 300 });
    res.setHeader('Content-Type', 'image/png');
    res.send(pngBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/qr/orders/:id/token - сгенерировать (или вернуть существующий) QR-токен для заказа
router.post('/orders/:id/token', authenticate, async (req, res) => {
  try {
    const existing = await pool.query(
      `SELECT * FROM order_qr_tokens WHERE order_id = $1 AND is_active = true LIMIT 1`,
      [req.params.id]
    );
    if (existing.rows[0]) {
      return res.json(existing.rows[0]);
    }

    const token = crypto.randomBytes(16).toString('hex');
    const result = await pool.query(
      `INSERT INTO order_qr_tokens (order_id, token) VALUES ($1, $2) RETURNING *`,
      [req.params.id, token]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/qr/scan/:token - публичный эндпоинт: мастер сканирует QR и видит заказ + текущий этап
// Не требует авторизации, чтобы любой мастер в цеху мог отметить выполнение этапа со своего телефона.
router.get('/scan/:token', async (req, res) => {
  try {
    const tokenResult = await pool.query(
      `SELECT * FROM order_qr_tokens WHERE token = $1 AND is_active = true`,
      [req.params.token]
    );
    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) return res.status(404).json({ error: 'QR-код недействителен' });

    const orderResult = await pool.query(`
      SELECT o.id, o.order_number, o.product_name, o.quantity, o.status
      FROM orders o WHERE o.id = $1
    `, [tokenRow.order_id]);

    const stagesResult = await pool.query(
      `SELECT * FROM order_stages WHERE order_id = $1 ORDER BY stage_order`,
      [tokenRow.order_id]
    );

    const employeesResult = await pool.query(
      `SELECT id, full_name FROM employees WHERE is_active = true ORDER BY full_name`
    );

    res.json({
      order: orderResult.rows[0],
      stages: stagesResult.rows.map(s => ({ ...s, stage_label: STAGE_LABELS[s.stage_name] || s.stage_name })),
      employees: employeesResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/qr/scan/:token/complete-stage - мастер отмечает этап выполненным через QR
router.post(
  '/scan/:token/complete-stage',
  [
    body('stage_name').notEmpty().withMessage('Этап обязателен'),
    body('employee_id').optional().isUUID().withMessage('Некорректный сотрудник')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { stage_name, employee_id } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tokenResult = await client.query(
        `SELECT * FROM order_qr_tokens WHERE token = $1 AND is_active = true`,
        [req.params.token]
      );
      const tokenRow = tokenResult.rows[0];
      if (!tokenRow) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'QR-код недействителен' });
      }

      const stageResult = await client.query(
        `UPDATE order_stages SET
          status = 'done',
          started_at = COALESCE(started_at, now()),
          completed_at = now(),
          completed_by = $1
         WHERE order_id = $2 AND stage_name = $3 RETURNING *`,
        [employee_id || null, tokenRow.order_id, stage_name]
      );

      if (!stageResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Этап не найден' });
      }

      const current = stageResult.rows[0];

      // Переводим следующий этап в "в работе"
      await client.query(
        `UPDATE order_stages SET status = 'in_progress', started_at = now()
         WHERE order_id = $1 AND stage_order = $2 AND status = 'pending'`,
        [tokenRow.order_id, current.stage_order + 1]
      );

      // Логируем сканирование
      await client.query(
        `INSERT INTO qr_scan_log (order_id, stage_name, employee_id)
         VALUES ($1, $2, $3)`,
        [tokenRow.order_id, stage_name, employee_id || null]
      );

      await client.query('COMMIT');
      res.json({ stage: { ...current, stage_label: STAGE_LABELS[current.stage_name] || current.stage_name } });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
