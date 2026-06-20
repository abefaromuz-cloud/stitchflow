const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendTelegramMessage } = require('../utils/telegram');

const router = express.Router();

// GET /api/telegram/subscribers - список подписчиков
router.get('/subscribers', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM telegram_subscribers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/telegram/subscribers - добавить подписчика
router.post(
  '/subscribers',
  authenticate,
  requireRole('admin', 'manager'),
  [
    body('chat_id').notEmpty().withMessage('chat_id обязателен'),
    body('full_name').notEmpty().withMessage('Имя обязательно')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { chat_id, full_name, role, employee_id } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO telegram_subscribers (chat_id, full_name, role, employee_id)
         VALUES ($1, $2, COALESCE($3, 'manager'), $4)
         ON CONFLICT (chat_id) DO UPDATE SET full_name = $2, role = COALESCE($3, telegram_subscribers.role), is_active = true
         RETURNING *`,
        [chat_id, full_name, role, employee_id || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// PUT /api/telegram/subscribers/:id - обновить настройки уведомлений
router.put('/subscribers/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  const { notify_new_order, notify_employee_absent, notify_order_completed, notify_payment_received, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE telegram_subscribers SET
        notify_new_order = COALESCE($1, notify_new_order),
        notify_employee_absent = COALESCE($2, notify_employee_absent),
        notify_order_completed = COALESCE($3, notify_order_completed),
        notify_payment_received = COALESCE($4, notify_payment_received),
        is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [notify_new_order, notify_employee_absent, notify_order_completed, notify_payment_received, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Подписчик не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/telegram/subscribers/:id
router.delete('/subscribers/:id', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM telegram_subscribers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Подписчик не найден' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/telegram/test - отправить тестовое сообщение по chat_id
router.post(
  '/test',
  authenticate,
  requireRole('admin', 'manager'),
  [body('chat_id').notEmpty().withMessage('chat_id обязателен')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { chat_id } = req.body;
    const result = await sendTelegramMessage(chat_id, '✅ StitchFlow: тестовое уведомление успешно доставлено.');
    res.json(result);
  }
);

// GET /api/telegram/log - журнал уведомлений
router.get('/log', authenticate, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notification_log ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
