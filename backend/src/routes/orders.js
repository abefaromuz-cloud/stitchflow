const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { notifySubscribers } = require('../utils/telegram');
const router = express.Router();

const STAGES = ['received','cutting','sewing','overlock','ironing','qc','packing','shipped'];
const STAGE_LABELS = {
  received:'Получен', cutting:'Раскрой', sewing:'Пошив', overlock:'Оверлок',
  ironing:'Утюжка', qc:'Проверка качества', packing:'Упаковка', shipped:'Отгружен'
};

// GET /api/orders
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, c.company_name AS client_name,
        (SELECT COUNT(*) FROM order_items WHERE order_id=o.id) AS items_count
      FROM orders o JOIN clients c ON c.id=o.client_id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [orderR, itemsR, stagesR, progressR, detailsR, reclamR] = await Promise.all([
      pool.query(`SELECT o.*, c.company_name AS client_name, c.contact_person, c.phone AS client_phone
                  FROM orders o JOIN clients c ON c.id=o.client_id WHERE o.id=$1`, [req.params.id]),
      pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY sort_order', [req.params.id]),
      pool.query('SELECT * FROM order_stages WHERE order_id=$1 ORDER BY stage_order', [req.params.id]),
      pool.query(`SELECT oep.*, e.full_name AS employee_name
                  FROM order_employee_progress oep JOIN employees e ON e.id=oep.employee_id
                  WHERE oep.order_id=$1 ORDER BY oep.work_date DESC`, [req.params.id]),
      pool.query(`SELECT sd.*, e.full_name AS employee_name
                  FROM stage_details sd LEFT JOIN employees e ON e.id=sd.employee_id
                  WHERE sd.order_id=$1 ORDER BY sd.created_at DESC`, [req.params.id]),
      pool.query(`SELECT r.*, e.full_name AS employee_name, oi.product_name AS item_name
                  FROM reclamations r
                  LEFT JOIN employees e ON e.id=r.employee_id
                  LEFT JOIN order_items oi ON oi.id=r.order_item_id
                  WHERE r.order_id=$1 ORDER BY r.created_at DESC`, [req.params.id]),
    ]);
    if (!orderR.rows[0]) return res.status(404).json({ error: 'Заказ не найден' });

    const totalDone = progressR.rows.reduce((s,r) => s + Number(r.quantity_done), 0);
    const totalQty = itemsR.rows.reduce((s,r) => s + Number(r.quantity), 0) || orderR.rows[0].quantity;
    const pct = totalQty > 0 ? Math.min(100, Math.round((totalDone / totalQty) * 100)) : 0;

    res.json({
      ...orderR.rows[0],
      items: itemsR.rows,
      stages: stagesR.rows.map(s => ({ ...s, stage_label: STAGE_LABELS[s.stage_name] || s.stage_name })),
      progress: progressR.rows,
      stage_details: detailsR.rows,
      reclamations: reclamR.rows,
      percent_complete: pct,
      total_done: totalDone,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/orders - создать заказ с позициями
router.post('/', authenticate, async (req, res) => {
  const { order_number, client_id, items, due_date, description } = req.body;
  if (!order_number || !client_id || !items?.length)
    return res.status(400).json({ error: 'Номер заказа, клиент и хотя бы одно изделие обязательны' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const totalAmount = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
    const totalQty = items.reduce((s, it) => s + Number(it.quantity), 0);

    const orderR = await client.query(
      `INSERT INTO orders (order_number,client_id,product_name,quantity,unit_price,total_amount,due_date,description,created_by)
       VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8) RETURNING *`,
      [order_number, client_id, items.map(i=>i.product_name).join(', '), totalQty, totalAmount, due_date||null, description||null, req.user.id]
    );
    const order = orderR.rows[0];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await client.query(
        `INSERT INTO order_items (order_id,article,product_name,color,quantity,unit_price,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, it.article||null, it.product_name, it.color||null, it.quantity, it.unit_price, i]
      );
    }

    for (let i = 0; i < STAGES.length; i++) {
      await client.query(
        `INSERT INTO order_stages (order_id,stage_name,stage_order,status) VALUES ($1,$2,$3,$4)`,
        [order.id, STAGES[i], i+1, i===0?'done':'pending']
      );
    }

    await client.query('COMMIT');

    notifySubscribers('new_order',
      `🧵 <b>Новый заказ №${order.order_number}</b>\nИзделий: ${items.length} видов · ${totalQty} шт\nСумма: ₽${totalAmount.toLocaleString()}`,
      { order_id: order.id }
    ).catch(()=>{});

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Заказ с таким номером уже существует' });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

// PUT /api/orders/:id
router.put('/:id', authenticate, async (req, res) => {
  const { status, due_date, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE orders SET status=COALESCE($1,status), due_date=COALESCE($2,due_date), description=COALESCE($3,description)
       WHERE id=$4 RETURNING *`,
      [status||null, due_date||null, description||null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Заказ не найден' });
    if (status === 'completed') {
      const o = result.rows[0];
      notifySubscribers('order_completed',
        `✅ <b>Заказ №${o.order_number} завершён</b>\nСумма: ₽${Number(o.total_amount).toLocaleString()}`,
        { order_id: o.id }
      ).catch(()=>{});
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// PUT /api/orders/:id/stages/:stageName
router.put('/:id/stages/:stageName', authenticate, async (req, res) => {
  const { status } = req.body;
  if (!['pending','in_progress','done'].includes(status))
    return res.status(400).json({ error: 'Некорректный статус' });
  try {
    const result = await pool.query(
      `UPDATE order_stages SET status=$1,
         started_at=CASE WHEN $1='in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
         completed_at=CASE WHEN $1='done' THEN now() ELSE completed_at END
       WHERE order_id=$2 AND stage_name=$3 RETURNING *`,
      [status, req.params.id, req.params.stageName]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Этап не найден' });
    if (status === 'done') {
      await pool.query(
        `UPDATE order_stages SET status='in_progress', started_at=now()
         WHERE order_id=$1 AND stage_order=$2 AND status='pending'`,
        [req.params.id, result.rows[0].stage_order + 1]
      );
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/orders/:id/progress
router.post('/:id/progress', authenticate, async (req, res) => {
  const { employee_id, order_item_id, stage_name, quantity_done, quantity_defect, quantity_rework, work_date } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'Сотрудник обязателен' });
  try {
    const result = await pool.query(
      `INSERT INTO order_employee_progress (order_id,order_item_id,employee_id,stage_name,quantity_done,quantity_defect,quantity_rework,work_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,CURRENT_DATE)) RETURNING *`,
      [req.params.id, order_item_id||null, employee_id, stage_name||null, quantity_done||0, quantity_defect||0, quantity_rework||0, work_date||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/orders/:id/stage-details - детализация этапа
router.post('/:id/stage-details', authenticate, async (req, res) => {
  const { order_item_id, stage_name, employee_id, quantity_done, quantity_defect, quantity_rework,
          cut_quantity, sewn_quantity, qc_checked, qc_passed, qc_defect, qc_rework, qc_wash, qc_fix,
          packed_quantity, work_date, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO stage_details (order_id,order_item_id,stage_name,employee_id,
         quantity_done,quantity_defect,quantity_rework,
         cut_quantity,sewn_quantity,qc_checked,qc_passed,qc_defect,qc_rework,qc_wash,qc_fix,
         packed_quantity,work_date,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,COALESCE($17,CURRENT_DATE),$18) RETURNING *`,
      [req.params.id, order_item_id||null, stage_name, employee_id||null,
       quantity_done||0, quantity_defect||0, quantity_rework||0,
       cut_quantity||null, sewn_quantity||null, qc_checked||null, qc_passed||null,
       qc_defect||null, qc_rework||null, qc_wash||null, qc_fix||null,
       packed_quantity||null, work_date||null, notes||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// GET /api/orders/:id/stage-details/:stageName
router.get('/:id/stage-details/:stageName', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sd.*, e.full_name AS employee_name, oi.product_name AS item_name, oi.article, oi.color
       FROM stage_details sd
       LEFT JOIN employees e ON e.id=sd.employee_id
       LEFT JOIN order_items oi ON oi.id=sd.order_item_id
       WHERE sd.order_id=$1 AND sd.stage_name=$2
       ORDER BY sd.created_at DESC`,
      [req.params.id, req.params.stageName]
    );

    // Aggregated totals
    const totals = result.rows.reduce((acc, r) => {
      acc.done += r.quantity_done||0;
      acc.defect += r.quantity_defect||0;
      acc.rework += r.quantity_rework||0;
      acc.cut += r.cut_quantity||0;
      acc.sewn += r.sewn_quantity||0;
      acc.qc_checked += r.qc_checked||0;
      acc.qc_passed += r.qc_passed||0;
      acc.qc_defect += r.qc_defect||0;
      acc.qc_rework += r.qc_rework||0;
      acc.qc_wash += r.qc_wash||0;
      acc.qc_fix += r.qc_fix||0;
      acc.packed += r.packed_quantity||0;
      return acc;
    }, { done:0,defect:0,rework:0,cut:0,sewn:0,qc_checked:0,qc_passed:0,qc_defect:0,qc_rework:0,qc_wash:0,qc_fix:0,packed:0 });

    res.json({ records: result.rows, totals });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// Reclamations
router.get('/:id/reclamations', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, e.full_name AS employee_name, oi.product_name AS item_name
       FROM reclamations r
       LEFT JOIN employees e ON e.id=r.employee_id
       LEFT JOIN order_items oi ON oi.id=r.order_item_id
       WHERE r.order_id=$1 ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.post('/:id/reclamations', authenticate, async (req, res) => {
  const { order_item_id, employee_id, stage_name, quantity, description, defect_type } = req.body;
  if (!description) return res.status(400).json({ error: 'Описание рекламации обязательно' });
  try {
    const result = await pool.query(
      `INSERT INTO reclamations (order_id,order_item_id,employee_id,stage_name,quantity,description,defect_type,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, order_item_id||null, employee_id||null, stage_name||null, quantity||1, description, defect_type||null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

router.put('/reclamations/:recId', authenticate, async (req, res) => {
  const { status, resolution_notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE reclamations SET status=COALESCE($1,status), resolution_notes=COALESCE($2,resolution_notes),
         resolved_at=CASE WHEN $1='resolved' THEN now() ELSE resolved_at END
       WHERE id=$3 RETURNING *`,
      [status||null, resolution_notes||null, req.params.recId]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;
