const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// ─────────────────────────────────────────────
// ШАБЛОНЫ ОПЕРАЦИЙ
// ─────────────────────────────────────────────

// GET /api/workshop/templates?order_item_id=...
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { order_item_id, product_name } = req.query;
    let q = 'SELECT * FROM sewing_operation_templates WHERE 1=1';
    const params = [];
    if (order_item_id) { params.push(order_item_id); q += ` AND order_item_id=$${params.length}`; }
    else if (product_name) { params.push(`%${product_name}%`); q += ` AND product_name ILIKE $${params.length}`; }
    q += ' ORDER BY operation_number';
    res.json((await pool.query(q, params)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/workshop/templates — создать шаблон
router.post('/templates', authenticate, async (req, res) => {
  const { order_item_id, product_name, operations } = req.body;
  if (!operations?.length) return res.status(400).json({ error: 'Список операций обязателен' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (order_item_id) {
      await client.query('DELETE FROM sewing_operation_templates WHERE order_item_id=$1', [order_item_id]);
    }
    const results = [];
    for (const op of operations) {
      const r = await client.query(
        `INSERT INTO sewing_operation_templates (order_item_id, product_name, operation_number, operation_name)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [order_item_id||null, product_name||null, op.operation_number, op.operation_name]
      );
      results.push(r.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

// ─────────────────────────────────────────────
// ОТГРУЗКА ТКАНИ (рулоны)
// ─────────────────────────────────────────────

// GET /api/workshop/fabric-shipments
router.get('/fabric-shipments', authenticate, async (req, res) => {
  try {
    const { order_id } = req.query;
    let q = `SELECT fs.*, o.order_number, oi.product_name AS item_name
             FROM fabric_shipments fs
             LEFT JOIN orders o ON o.id=fs.order_id
             LEFT JOIN order_items oi ON oi.id=fs.order_item_id
             WHERE 1=1`;
    const params = [];
    if (order_id) { params.push(order_id); q += ` AND fs.order_id=$${params.length}`; }
    q += ' ORDER BY fs.shipment_date DESC, fs.roll_number';
    res.json((await pool.query(q, params)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/workshop/fabric-shipments
router.post('/fabric-shipments', authenticate, async (req, res) => {
  const { order_id, order_item_id, shipment_date, fabric_name, color, roll_number, meters, consumption_per_unit, notes } = req.body;
  if (!meters || !roll_number) return res.status(400).json({ error: 'Метраж и номер рулона обязательны' });
  try {
    const result = await pool.query(
      `INSERT INTO fabric_shipments (order_id,order_item_id,shipment_date,fabric_name,color,roll_number,meters,consumption_per_unit,notes,created_by)
       VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [order_id||null, order_item_id||null, shipment_date||null, fabric_name||null, color||null, roll_number, meters, consumption_per_unit||null, notes||null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// DELETE /api/workshop/fabric-shipments/:id
router.delete('/fabric-shipments/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM fabric_shipments WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// ─────────────────────────────────────────────
// КРОЙ — СЕССИИ КРОЯ
// ─────────────────────────────────────────────

// GET /api/workshop/cutting
router.get('/cutting', authenticate, async (req, res) => {
  try {
    const { order_id } = req.query;
    let q = `SELECT cs.*, e.full_name AS cutter_name, o.order_number,
               (SELECT COUNT(*) FROM bundles b WHERE b.cutting_session_id=cs.id) AS bundle_count_actual
             FROM cutting_sessions cs
             LEFT JOIN employees e ON e.id=cs.cutter_employee_id
             LEFT JOIN orders o ON o.id=cs.order_id
             WHERE 1=1`;
    const params = [];
    if (order_id) { params.push(order_id); q += ` AND cs.order_id=$${params.length}`; }
    q += ' ORDER BY cs.cut_date DESC, cs.created_at DESC';
    res.json((await pool.query(q, params)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/workshop/cutting — создать сессию кроя и автоматически сгенерировать пачки
router.post('/cutting', authenticate, async (req, res) => {
  const { order_id, order_item_id, cut_date, product_name, color, size, total_quantity, bundle_count, bundle_size, cutter_employee_id, notes } = req.body;
  if (!total_quantity || !size || !product_name) return res.status(400).json({ error: 'Изделие, размер и количество обязательны' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Создаём сессию кроя
    const sessionR = await client.query(
      `INSERT INTO cutting_sessions (order_id,order_item_id,cut_date,product_name,color,size,total_quantity,bundle_count,bundle_size,cutter_employee_id,notes,created_by)
       VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [order_id||null, order_item_id||null, cut_date||null, product_name, color||null, size, total_quantity, bundle_count||1, bundle_size||null, cutter_employee_id||null, notes||null, req.user.id]
    );
    const session = sessionR.rows[0];

    // Автоматически создаём пачки с номерами size/1, size/2, ...
    const count = bundle_count || 1;
    const perBundle = bundle_size || Math.ceil(total_quantity / count);
    const bundles = [];
    let remaining = total_quantity;

    for (let i = 1; i <= count; i++) {
      const qty = i === count ? remaining : Math.min(perBundle, remaining);
      if (qty <= 0) break;
      remaining -= qty;
      const bundleNumber = `${size}/${i}`;
      const bundleR = await client.query(
        `INSERT INTO bundles (cutting_session_id,order_id,order_item_id,bundle_number,size,color,quantity,product_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [session.id, order_id||null, order_item_id||null, bundleNumber, size, color||null, qty, product_name]
      );
      bundles.push(bundleR.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ session, bundles });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

// ─────────────────────────────────────────────
// ПАЧКИ (BUNDLES)
// ─────────────────────────────────────────────

// GET /api/workshop/bundles
router.get('/bundles', authenticate, async (req, res) => {
  try {
    const { order_id, cutting_session_id, status } = req.query;
    let q = `SELECT b.*, cs.product_name AS session_product, o.order_number,
               e.full_name AS current_employee_name,
               (SELECT COUNT(*) FROM bundle_operations bo WHERE bo.bundle_id=b.id) AS op_count,
               (SELECT COUNT(*) FROM bundle_operations bo WHERE bo.bundle_id=b.id AND bo.is_done=true) AS op_done_count
             FROM bundles b
             LEFT JOIN cutting_sessions cs ON cs.id=b.cutting_session_id
             LEFT JOIN orders o ON o.id=b.order_id
             LEFT JOIN employees e ON e.id=b.current_employee_id
             WHERE 1=1`;
    const params = [];
    if (order_id) { params.push(order_id); q += ` AND b.order_id=$${params.length}`; }
    if (cutting_session_id) { params.push(cutting_session_id); q += ` AND b.cutting_session_id=$${params.length}`; }
    if (status) { params.push(status); q += ` AND b.status=$${params.length}`; }
    q += ' ORDER BY b.size, b.bundle_number';
    res.json((await pool.query(q, params)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// GET /api/workshop/bundles/:id — детали пачки
router.get('/bundles/:id', authenticate, async (req, res) => {
  try {
    const [bundleR, opsR, reclR, qcR] = await Promise.all([
      pool.query(`SELECT b.*, o.order_number, e.full_name AS current_employee_name
                  FROM bundles b LEFT JOIN orders o ON o.id=b.order_id
                  LEFT JOIN employees e ON e.id=b.current_employee_id
                  WHERE b.id=$1`, [req.params.id]),
      pool.query(`SELECT bo.*, e.full_name AS employee_name
                  FROM bundle_operations bo LEFT JOIN employees e ON e.id=bo.employee_id
                  WHERE bo.bundle_id=$1 ORDER BY bo.operation_number`, [req.params.id]),
      pool.query(`SELECT br.*, e.full_name AS employee_name
                  FROM bundle_reclamations br LEFT JOIN employees e ON e.id=br.employee_id
                  WHERE br.bundle_id=$1 ORDER BY br.created_at DESC`, [req.params.id]),
      pool.query(`SELECT bq.*, e.full_name AS inspector_name
                  FROM bundle_qc bq LEFT JOIN employees e ON e.id=bq.inspector_employee_id
                  WHERE bq.bundle_id=$1 ORDER BY bq.qc_date DESC`, [req.params.id]),
    ]);
    if (!bundleR.rows[0]) return res.status(404).json({ error: 'Пачка не найдена' });
    res.json({ bundle: bundleR.rows[0], operations: opsR.rows, reclamations: reclR.rows, qc: qcR.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// PUT /api/workshop/bundles/:id — обновить статус/сотрудника
router.put('/bundles/:id', authenticate, async (req, res) => {
  const { status, current_employee_id, order_id, order_item_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE bundles SET
         status=COALESCE($1,status),
         current_employee_id=COALESCE($2,current_employee_id),
         order_id=COALESCE($3,order_id),
         order_item_id=COALESCE($4,order_item_id)
       WHERE id=$5 RETURNING *`,
      [status||null, current_employee_id||null, order_id||null, order_item_id||null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Пачка не найдена' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/workshop/bundles/:id/operations — добавить операции пошива
router.post('/bundles/:id/operations', authenticate, async (req, res) => {
  const { operations } = req.body; // [{ operation_number, operation_name, employee_id }]
  if (!operations?.length) return res.status(400).json({ error: 'Список операций обязателен' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Удаляем старые если есть
    await client.query('DELETE FROM bundle_operations WHERE bundle_id=$1', [req.params.id]);
    const results = [];
    for (const op of operations) {
      const r = await client.query(
        `INSERT INTO bundle_operations (bundle_id,operation_number,operation_name,employee_id)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.params.id, op.operation_number, op.operation_name, op.employee_id||null]
      );
      results.push(r.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

// PUT /api/workshop/bundles/:id/operations/:opId — отметить операцию выполненной
router.put('/bundles/:id/operations/:opId', authenticate, async (req, res) => {
  const { is_done, employee_id, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE bundle_operations SET
         is_done=COALESCE($1,is_done),
         employee_id=COALESCE($2,employee_id),
         done_at=CASE WHEN $1=true THEN now() ELSE done_at END,
         notes=COALESCE($3,notes)
       WHERE id=$4 AND bundle_id=$5 RETURNING *`,
      [is_done??null, employee_id||null, notes||null, req.params.opId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Операция не найдена' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/workshop/bundles/:id/reclamations
router.post('/bundles/:id/reclamations', authenticate, async (req, res) => {
  const { operation_id, employee_id, quantity, defect_type, description } = req.body;
  if (!description) return res.status(400).json({ error: 'Описание обязательно' });
  try {
    const result = await pool.query(
      `INSERT INTO bundle_reclamations (bundle_id,operation_id,employee_id,quantity,defect_type,description,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, operation_id||null, employee_id||null, quantity||1, defect_type||null, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

// POST /api/workshop/bundles/:id/qc — ВТО/ОТК
router.post('/bundles/:id/qc', authenticate, async (req, res) => {
  const { qc_date, inspector_employee_id, checked_quantity, passed_quantity, defect_quantity, rework_quantity, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO bundle_qc (bundle_id,qc_date,inspector_employee_id,checked_quantity,passed_quantity,defect_quantity,rework_quantity,notes)
       VALUES ($1,COALESCE($2,CURRENT_DATE),$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, qc_date||null, inspector_employee_id||null, checked_quantity||0, passed_quantity||0, defect_quantity||0, rework_quantity||0, notes||null]
    );
    // Если всё прошло QC — обновить статус пачки
    if (passed_quantity > 0) {
      await client.query(`UPDATE bundles SET status='vto' WHERE id=$1`, [req.params.id]);
    }
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally { client.release(); }
});

// ─────────────────────────────────────────────
// СВОДКА ПО ЦЕХУ
// ─────────────────────────────────────────────
router.get('/summary', authenticate, async (req, res) => {
  try {
    const [bundles, fabric, cutting] = await Promise.all([
      pool.query(`SELECT
          COUNT(*) FILTER(WHERE status='cut') AS in_cutting,
          COUNT(*) FILTER(WHERE status='sewing') AS in_sewing,
          COUNT(*) FILTER(WHERE status='vto') AS in_vto,
          COUNT(*) FILTER(WHERE status='shipped') AS shipped,
          COALESCE(SUM(quantity) FILTER(WHERE status='sewing'),0) AS units_in_sewing
        FROM bundles`),
      pool.query(`SELECT COUNT(*) AS total_rolls, COALESCE(SUM(meters),0) AS total_meters, COALESCE(SUM(expected_units),0) AS expected_units FROM fabric_shipments WHERE shipment_date >= CURRENT_DATE - 30`),
      pool.query(`SELECT COUNT(*) AS sessions, COALESCE(SUM(total_quantity),0) AS total_cut FROM cutting_sessions WHERE cut_date >= CURRENT_DATE - 30`),
    ]);
    res.json({
      bundles: bundles.rows[0],
      fabric_last30: fabric.rows[0],
      cutting_last30: cutting.rows[0],
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Внутренняя ошибка сервера' }); }
});

module.exports = router;

// ─────────────────────────────────────────────
// PDF — МАРШРУТНЫЙ ЛИСТ И РЕКЛАМАЦИЯ
// ─────────────────────────────────────────────
const { generateRouteSheet, generateBundleReclamation } = require('../utils/workshopPdf');

// GET /api/workshop/bundles/:id/pdf/route-sheet
router.get('/bundles/:id/pdf/route-sheet', authenticate, async (req, res) => {
  try {
    const [bundleR, opsR, companyR] = await Promise.all([
      pool.query(`SELECT b.*, o.order_number FROM bundles b LEFT JOIN orders o ON o.id=b.order_id WHERE b.id=$1`, [req.params.id]),
      pool.query(`SELECT bo.*, e.full_name AS employee_name FROM bundle_operations bo LEFT JOIN employees e ON e.id=bo.employee_id WHERE bo.bundle_id=$1 ORDER BY bo.operation_number`, [req.params.id]),
      pool.query('SELECT * FROM company_profile LIMIT 1'),
    ]);
    if (!bundleR.rows[0]) return res.status(404).json({ error: 'Пачка не найдена' });
    const pdf = await generateRouteSheet(bundleR.rows[0], opsR.rows, companyR.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="route-${bundleR.rows[0].bundle_number}.pdf"`);
    res.send(pdf);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Ошибка генерации PDF' }); }
});

// GET /api/workshop/bundles/:id/pdf/reclamation
router.get('/bundles/:id/pdf/reclamation', authenticate, async (req, res) => {
  try {
    const [bundleR, reclR, opsR, companyR] = await Promise.all([
      pool.query(`SELECT b.*, o.order_number FROM bundles b LEFT JOIN orders o ON o.id=b.order_id WHERE b.id=$1`, [req.params.id]),
      pool.query(`SELECT br.*, e.full_name AS employee_name FROM bundle_reclamations br LEFT JOIN employees e ON e.id=br.employee_id WHERE br.bundle_id=$1`, [req.params.id]),
      pool.query(`SELECT * FROM bundle_operations WHERE bundle_id=$1 ORDER BY operation_number`, [req.params.id]),
      pool.query('SELECT * FROM company_profile LIMIT 1'),
    ]);
    if (!bundleR.rows[0]) return res.status(404).json({ error: 'Пачка не найдена' });
    const pdf = await generateBundleReclamation(bundleR.rows[0], reclR.rows, opsR.rows, companyR.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="reclamation-${bundleR.rows[0].bundle_number}.pdf"`);
    res.send(pdf);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Ошибка генерации PDF' }); }
});
