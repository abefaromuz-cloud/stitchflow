const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/tokens/:clientId', authenticate, async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM client_access_tokens WHERE client_id=$1 ORDER BY created_at DESC', [req.params.clientId])).rows); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/tokens/:clientId', authenticate, async (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  try {
    const result = await pool.query('INSERT INTO client_access_tokens (client_id,token,label,created_by) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.clientId, token, req.body.label||'Ссылка для клиента', req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.delete('/tokens/:id', authenticate, async (req, res) => {
  try { await pool.query('UPDATE client_access_tokens SET is_active=false WHERE id=$1', [req.params.id]); res.json({ success:true }); }
  catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.get('/:token', async (req, res) => {
  try {
    const accessR = await pool.query(`SELECT cat.*, c.company_name FROM client_access_tokens cat JOIN clients c ON c.id=cat.client_id WHERE cat.token=$1 AND cat.is_active=true AND (cat.expires_at IS NULL OR cat.expires_at>now())`, [req.params.token]);
    if (!accessR.rows[0]) return res.status(403).json({ error: 'Ссылка недействительна' });
    const clientId = accessR.rows[0].client_id;
    await pool.query('UPDATE client_access_tokens SET last_used_at=now() WHERE token=$1', [req.params.token]);
    const [clientR, ordersR, invoicesR] = await Promise.all([
      pool.query('SELECT id,company_name,contact_person,phone,email,discount_percent,debt_amount FROM clients WHERE id=$1', [clientId]),
      pool.query(`SELECT o.*, (SELECT COALESCE(SUM(quantity_done),0) FROM order_employee_progress WHERE order_id=o.id) AS done_qty, (SELECT json_agg(row_to_json(oi)) FROM order_items oi WHERE oi.order_id=o.id ORDER BY oi.sort_order) AS items FROM orders o WHERE o.client_id=$1 ORDER BY o.created_at DESC`, [clientId]),
      pool.query('SELECT invoice_number,amount,total_amount,discount_percent,status,issue_date,due_date,paid_at,id FROM invoices WHERE client_id=$1 ORDER BY created_at DESC', [clientId]),
    ]);
    const orders = await Promise.all(ordersR.rows.map(async o => {
      const stagesR = await pool.query('SELECT stage_name,stage_order,status,completed_at FROM order_stages WHERE order_id=$1 ORDER BY stage_order', [o.id]);
      const totalQty = Number(o.quantity)||1;
      return { ...o, stages: stagesR.rows, percent_complete: Math.min(100, Math.round((Number(o.done_qty)/totalQty)*100)) };
    }));
    res.json({ client: clientR.rows[0], orders, invoices: invoicesR.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
