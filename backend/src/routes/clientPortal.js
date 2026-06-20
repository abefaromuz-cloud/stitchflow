const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// =========================================
// УПРАВЛЕНИЕ ТОКЕНАМИ (только для менеджеров)
// =========================================

// GET /api/client-portal/tokens/:clientId - список токенов клиента
router.get('/tokens/:clientId', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM client_access_tokens WHERE client_id = $1 ORDER BY created_at DESC`,
      [req.params.clientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/client-portal/tokens/:clientId - создать токен доступа
router.post('/tokens/:clientId', authenticate, async (req, res) => {
  const { label, expires_at } = req.body;
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const result = await pool.query(
      `INSERT INTO client_access_tokens (client_id, token, label, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.clientId, token, label || 'Ссылка для клиента', expires_at || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/client-portal/tokens/:id - отозвать токен
router.delete('/tokens/:id', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE client_access_tokens SET is_active = false WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// =========================================
// ПУБЛИЧНЫЙ КЛИЕНТСКИЙ КАБИНЕТ (без JWT, по токену)
// =========================================

async function resolveToken(token) {
  const result = await pool.query(
    `SELECT cat.*, c.company_name, c.contact_person
     FROM client_access_tokens cat
     JOIN clients c ON c.id = cat.client_id
     WHERE cat.token = $1 AND cat.is_active = true
       AND (cat.expires_at IS NULL OR cat.expires_at > now())`,
    [token]
  );
  return result.rows[0] || null;
}

// GET /api/client-portal/:token - данные клиентского кабинета
router.get('/:token', async (req, res) => {
  try {
    const access = await resolveToken(req.params.token);
    if (!access) return res.status(403).json({ error: 'Ссылка недействительна или истекла' });

    await pool.query(
      `UPDATE client_access_tokens SET last_used_at = now() WHERE token = $1`,
      [req.params.token]
    );

    const clientId = access.client_id;

    const [clientResult, ordersResult, invoicesResult] = await Promise.all([
      pool.query('SELECT id, company_name, contact_person, phone, email, discount_percent, debt_amount FROM clients WHERE id = $1', [clientId]),
      pool.query(`
        SELECT o.id, o.order_number, o.product_name, o.quantity, o.unit_price,
               o.total_amount, o.status, o.due_date, o.created_at,
               (SELECT COALESCE(SUM(quantity_done),0) FROM order_employee_progress WHERE order_id = o.id) AS done_qty
        FROM orders o
        WHERE o.client_id = $1
        ORDER BY o.created_at DESC
      `, [clientId]),
      pool.query(`
        SELECT invoice_number, amount, total_amount, discount_percent, status, issue_date, due_date, paid_at, id
        FROM invoices
        WHERE client_id = $1
        ORDER BY created_at DESC
      `, [clientId])
    ]);

    // Этапы для каждого активного заказа
    const activeOrders = ordersResult.rows.filter(o => o.status !== 'completed');
    const stagesMap = {};
    for (const order of activeOrders) {
      const stagesResult = await pool.query(
        `SELECT stage_name, stage_order, status, completed_at FROM order_stages WHERE order_id = $1 ORDER BY stage_order`,
        [order.id]
      );
      stagesMap[order.id] = stagesResult.rows;
    }

    res.json({
      client: clientResult.rows[0],
      orders: ordersResult.rows.map(o => ({
        ...o,
        percent_complete: o.quantity > 0 ? Math.min(100, Math.round((Number(o.done_qty) / Number(o.quantity)) * 100)) : 0,
        stages: stagesMap[o.id] || []
      })),
      invoices: invoicesResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/client-portal/:token/orders/:orderId/stages - карта производства
router.get('/:token/orders/:orderId/stages', async (req, res) => {
  try {
    const access = await resolveToken(req.params.token);
    if (!access) return res.status(403).json({ error: 'Ссылка недействительна' });

    const stagesResult = await pool.query(
      `SELECT os.*, o.product_name, o.quantity, o.order_number
       FROM order_stages os
       JOIN orders o ON o.id = os.order_id
       WHERE os.order_id = $1 AND o.client_id = $2
       ORDER BY os.stage_order`,
      [req.params.orderId, access.client_id]
    );

    if (!stagesResult.rows[0]) return res.status(404).json({ error: 'Заказ не найден' });
    res.json(stagesResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
