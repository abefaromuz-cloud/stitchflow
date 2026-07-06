const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/orders/:id/image', authenticate, async (req, res) => {
  try {
    let tokenR = await pool.query('SELECT * FROM order_qr_tokens WHERE order_id=$1 AND is_active=true LIMIT 1', [req.params.id]);
    let tokenRow = tokenR.rows[0];
    if (!tokenRow) {
      const token = crypto.randomBytes(16).toString('hex');
      tokenRow = (await pool.query('INSERT INTO order_qr_tokens (order_id,token) VALUES ($1,$2) RETURNING *', [req.params.id,token])).rows[0];
    }
    const url = `${process.env.FRONTEND_URL||'http://localhost:4000'}/scan/${tokenRow.token}`;
    const png = await QRCode.toBuffer(url, {width:300});
    res.setHeader('Content-Type','image/png');
    res.send(png);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/scan/:token', async (req, res) => {
  try {
    const tokenR = await pool.query('SELECT * FROM order_qr_tokens WHERE token=$1 AND is_active=true', [req.params.token]);
    if (!tokenR.rows[0]) return res.status(404).json({ error: 'QR-код недействителен' });
    const orderId = tokenR.rows[0].order_id;
    const [orderR, stagesR, empsR] = await Promise.all([
      pool.query('SELECT id,order_number,product_name,quantity,status FROM orders WHERE id=$1', [orderId]),
      pool.query('SELECT * FROM order_stages WHERE order_id=$1 ORDER BY stage_order', [orderId]),
      pool.query('SELECT id,full_name FROM employees WHERE is_active=true ORDER BY full_name'),
    ]);
    const LABELS = {received:'Получен',cutting:'Раскрой',sewing:'Пошив',overlock:'Оверлок',ironing:'Утюжка',qc:'Проверка',packing:'Упаковка',shipped:'Отгружен'};
    res.json({ order:orderR.rows[0], stages:stagesR.rows.map(s=>({...s,stage_label:LABELS[s.stage_name]||s.stage_name})), employees:empsR.rows });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/scan/:token/complete-stage', async (req, res) => {
  const { stage_name, employee_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenR = await client.query('SELECT * FROM order_qr_tokens WHERE token=$1 AND is_active=true', [req.params.token]);
    if (!tokenR.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'QR-код недействителен' }); }
    const orderId = tokenR.rows[0].order_id;
    const stageR = await client.query(`UPDATE order_stages SET status='done', started_at=COALESCE(started_at,now()), completed_at=now(), completed_by=$1 WHERE order_id=$2 AND stage_name=$3 RETURNING *`, [employee_id||null, orderId, stage_name]);
    if (!stageR.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Этап не найден' }); }
    await client.query(`UPDATE order_stages SET status='in_progress', started_at=now() WHERE order_id=$1 AND stage_order=$2 AND status='pending'`, [orderId, stageR.rows[0].stage_order+1]);
    await client.query('INSERT INTO qr_scan_log (order_id,stage_name,employee_id) VALUES ($1,$2,$3)', [orderId,stage_name,employee_id||null]);
    await client.query('COMMIT');
    res.json(stageR.rows[0]);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
  finally { client.release(); }
});

module.exports = router;
