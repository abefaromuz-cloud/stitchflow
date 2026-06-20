const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('./pool');

const STAGES = ['received', 'cutting', 'sewing', 'overlock', 'ironing', 'qc', 'packing', 'shipped'];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const adminId = uuidv4();
    await client.query(
      `INSERT INTO users (id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [adminId, 'Администратор', 'admin@stitchflow.local', adminPasswordHash]
    );

    // Client
    const clientId = uuidv4();
    await client.query(
      `INSERT INTO clients (id, company_name, contact_person, phone, whatsapp, telegram, email, discount_percent)
       VALUES ($1, 'Fashion Group', 'Алишер Каримов', '+998901112233', '+998901112233', '@fashiongroup', 'info@fashiongroup.uz', 5)`,
      [clientId]
    );

    // Employees
    const employees = [
      { name: 'Мадина Юсупова', position: 'Швея', salary: 2000000, rate: 5000 },
      { name: 'Саида Рахимова', position: 'Швея', salary: 2000000, rate: 5000 },
      { name: 'Зарина Турсунова', position: 'Оверлочница', salary: 1800000, rate: 4500 },
      { name: 'Бахтиёр Назаров', position: 'Закройщик', salary: 2500000, rate: 6000 }
    ];

    const employeeIds = [];
    for (const emp of employees) {
      const id = uuidv4();
      employeeIds.push(id);
      await client.query(
        `INSERT INTO employees (id, full_name, position, hire_date, base_salary, piece_rate)
         VALUES ($1, $2, $3, CURRENT_DATE - INTERVAL '6 months', $4, $5)`,
        [id, emp.name, emp.position, emp.salary, emp.rate]
      );
    }

    // Order
    const orderId = uuidv4();
    await client.query(
      `INSERT INTO orders (id, order_number, client_id, product_name, quantity, unit_price, status, due_date, description)
       VALUES ($1, '000145', $2, 'Платье Summer Lux', 100, 25, 'sewing', CURRENT_DATE + INTERVAL '5 days', 'Летняя коллекция, ткань хлопок')`,
      [orderId, clientId]
    );

    // Order stages (карта производства)
    for (let i = 0; i < STAGES.length; i++) {
      const status = i === 0 ? 'done' : i <= 2 ? (i === 2 ? 'in_progress' : 'done') : 'pending';
      await client.query(
        `INSERT INTO order_stages (order_id, stage_name, stage_order, status, started_at, completed_at)
         VALUES ($1, $2, $3, $4,
            CASE WHEN $4 != 'pending' THEN now() - ((${STAGES.length} - $3) * INTERVAL '1 day') ELSE NULL END,
            CASE WHEN $4 = 'done' THEN now() - ((${STAGES.length} - $3 - 1) * INTERVAL '1 day') ELSE NULL END)`,
        [orderId, STAGES[i], i + 1, status]
      );
    }

    // Order employee progress
    await client.query(
      `INSERT INTO order_employee_progress (order_id, employee_id, stage_name, quantity_done, quantity_defect, work_date)
       VALUES
       ($1, $2, 'sewing', 40, 1, CURRENT_DATE),
       ($1, $3, 'sewing', 35, 0, CURRENT_DATE),
       ($1, $4, 'overlock', 25, 1, CURRENT_DATE)`,
      [orderId, employeeIds[0], employeeIds[1], employeeIds[2]]
    );

    // Attendance for last 4 days for all employees
    for (const empId of employeeIds) {
      for (let d = 3; d >= 0; d--) {
        const status = d === 1 ? 'late' : 'present';
        await client.query(
          `INSERT INTO attendance (employee_id, work_date, status, check_in, check_out)
           VALUES ($1, CURRENT_DATE - $2::int, $3, '09:00', '18:00')
           ON CONFLICT (employee_id, work_date) DO NOTHING`,
          [empId, d, status]
        );
      }
    }

    // Salary record (current month)
    const now = new Date();
    for (let i = 0; i < employeeIds.length; i++) {
      const empId = employeeIds[i];
      const emp = employees[i];
      const pieceWork = (i < 3 ? [40 * 5000, 35 * 5000, 25 * 4500][i] : 0);
      await client.query(
        `INSERT INTO salary_records (employee_id, period_month, period_year, base_salary, piece_work_amount, bonus_amount, penalty_amount)
         VALUES ($1, $2, $3, $4, $5, 0, 0)
         ON CONFLICT (employee_id, period_month, period_year) DO NOTHING`,
        [empId, now.getMonth() + 1, now.getFullYear(), emp.salary, pieceWork]
      );
    }

    // ===== Этап 2: Склад =====
    const materials = [
      { name: 'Хлопковая ткань (белая)', category: 'fabric', unit: 'm', qty: 500, min: 50, cost: 3.5, supplier: 'TextilOpt' },
      { name: 'Нитки полиэстер №40', category: 'thread', unit: 'roll', qty: 80, min: 10, cost: 1.2, supplier: 'ThreadCo' },
      { name: 'Пуговицы 12мм', category: 'buttons', unit: 'pcs', qty: 2000, min: 200, cost: 0.05, supplier: 'FurnitureUz' },
      { name: 'Молния потайная 20см', category: 'zippers', unit: 'pcs', qty: 150, min: 30, cost: 0.4, supplier: 'FurnitureUz' }
    ];
    const materialIds = [];
    for (const m of materials) {
      const id = uuidv4();
      materialIds.push(id);
      await client.query(
        `INSERT INTO materials (id, name, category, unit, quantity_in_stock, min_stock_level, unit_cost, supplier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, m.name, m.category, m.unit, m.qty, m.min, m.cost, m.supplier]
      );
    }

    // Нормы расхода материалов для тестового заказа (платье: ткань, нитки, пуговицы)
    await client.query(
      `INSERT INTO order_materials (order_id, material_id, quantity_per_unit)
       VALUES
       ($1, $2, 1.5),
       ($1, $3, 0.05),
       ($1, $4, 3)`,
      [orderId, materialIds[0], materialIds[1], materialIds[2]]
    );

    // Списание материалов по факту выработки (100 шт пошито на сегодня — для примера спишем по 60 шт)
    await client.query(
      `INSERT INTO material_movements (material_id, movement_type, quantity, order_id, reason)
       VALUES
       ($1, 'out', 90, $4, 'Списание на заказ №000145 (раскрой)'),
       ($2, 'out', 3, $4, 'Списание на заказ №000145'),
       ($3, 'out', 180, $4, 'Списание на заказ №000145')`,
      [materialIds[0], materialIds[1], materialIds[2], orderId]
    );
    await client.query(
      `UPDATE materials SET quantity_in_stock = quantity_in_stock - 90 WHERE id = $1`,
      [materialIds[0]]
    );
    await client.query(
      `UPDATE materials SET quantity_in_stock = quantity_in_stock - 3 WHERE id = $1`,
      [materialIds[1]]
    );
    await client.query(
      `UPDATE materials SET quantity_in_stock = quantity_in_stock - 180 WHERE id = $1`,
      [materialIds[2]]
    );

    // ===== Этап 2: Финансы (расходы) =====
    const expenses = [
      { category: 'rent', amount: 800, description: 'Аренда цеха', days_ago: 10 },
      { category: 'utilities', amount: 150, description: 'Электричество и вода', days_ago: 8 },
      { category: 'materials', amount: 1200, description: 'Закупка ткани', days_ago: 15 },
      { category: 'equipment', amount: 300, description: 'Ремонт швейной машины', days_ago: 5 }
    ];
    for (const e of expenses) {
      await client.query(
        `INSERT INTO expenses (category, amount, description, expense_date, created_by)
         VALUES ($1, $2, $3, CURRENT_DATE - $4::int, $5)`,
        [e.category, e.amount, e.description, e.days_ago, adminId]
      );
    }

    // ===== Этап 2: Профиль компании =====
    await client.query(
      `INSERT INTO company_profile (company_name, legal_address, tax_id, bank_account, bank_name, phone, email)
       VALUES ('StitchFlow Production', 'г. Ташкент, ул. Швейная, 12', '123456789', '20208000123456789012', 'Ipak Yo''li Bank', '+998901234567', 'info@stitchflow.local')`
    );

    // ===== Этап 2: Тестовый счет =====
    await client.query(
      `INSERT INTO invoices (invoice_number, order_id, client_id, amount, discount_percent, status, issue_date, due_date, payment_qr_data, created_by)
       VALUES ('INV-0001', $1, $2, 2500, 5, 'unpaid', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'stitchflow://pay?invoice=INV-0001&amount=2375', $3)`,
      [orderId, clientId, adminId]
    );

    console.log('Seed completed.');
    console.log('Admin login: admin@stitchflow.local / admin123');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
