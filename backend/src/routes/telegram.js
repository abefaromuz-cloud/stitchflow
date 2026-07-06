const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendTelegramMessage } = require('../utils/telegram');
const router = express.Router();

router.get('/subscribers', authenticate, requireRole('admin','manager'), async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM telegram_subscribers ORDER BY created_at DESC')).rows); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/subscribers', authenticate, requireRole('admin','manager'), async (req, res) => {
  const { chat_id, full_name, role } = req.body;
  try {
    const result = await pool.query(`INSERT INTO telegram_subscribers (chat_id,full_name,role) VALUES ($1,$2,COALESCE($3,'manager')) ON CONFLICT (chat_id) DO UPDATE SET full_name=$2, is_active=true RETURNING *`, [chat_id,full_name,role||null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.put('/subscribers/:id', authenticate, requireRole('admin','manager'), async (req, res) => {
  const { notify_new_order, notify_employee_absent, notify_order_completed, notify_payment_received, is_active } = req.body;
  try {
    const result = await pool.query(`UPDATE telegram_subscribers SET notify_new_order=COALESCE($1,notify_new_order), notify_employee_absent=COALESCE($2,notify_employee_absent), notify_order_completed=COALESCE($3,notify_order_completed), notify_payment_received=COALESCE($4,notify_payment_received), is_active=COALESCE($5,is_active) WHERE id=$6 RETURNING *`, [notify_new_order??null, notify_employee_absent??null, notify_order_completed??null, notify_payment_received??null, is_active??null, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.delete('/subscribers/:id', authenticate, requireRole('admin','manager'), async (req, res) => {
  try { await pool.query('DELETE FROM telegram_subscribers WHERE id=$1', [req.params.id]); res.json({ success:true }); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/test', authenticate, requireRole('admin','manager'), async (req, res) => {
  const result = await sendTelegramMessage(req.body.chat_id, '✅ StitchFlow: тестовое уведомление доставлено.');
  res.json(result);
});

router.get('/log', authenticate, requireRole('admin','manager'), async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM notification_log ORDER BY created_at DESC LIMIT 50')).rows); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
