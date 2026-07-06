const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('./pool');

const STAGES = ['received','cutting','sewing','overlock','ironing','qc','packing','shipped'];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Admin
    const adminId = uuidv4();
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (id, full_name, email, password_hash, role) VALUES ($1,$2,$3,$4,'admin')`,
      [adminId, 'Администратор', 'admin@stitchflow.local', hash]
    );

    // Client
    const clientId = uuidv4();
    await client.query(
      `INSERT INTO clients (id, company_name, contact_person, phone, email, discount_percent)
       VALUES ($1,'Fashion Group','Алишер Каримов','+79001112233','info@fashiongroup.ru',5)`,
      [clientId]
    );

    // Employees
    const emps = [
      {name:'Мадина Юсупова',   pos:'Швея',         salary:45000, rate:90},
      {name:'Саида Рахимова',   pos:'Швея',         salary:45000, rate:90},
      {name:'Зарина Турсунова', pos:'Оверлочница',  salary:40000, rate:80},
      {name:'Бахтиёр Назаров',  pos:'Закройщик',    salary:55000, rate:100},
    ];
    const empIds = [];
    for (const e of emps) {
      const id = uuidv4();
      empIds.push(id);
      await client.query(
        `INSERT INTO employees (id, full_name, position, hire_date, base_salary, piece_rate)
         VALUES ($1,$2,$3,CURRENT_DATE - INTERVAL '6 months',$4,$5)`,
        [id, e.name, e.pos, e.salary, e.rate]
      );
    }

    // Order
    const orderId = uuidv4();
    await client.query(
      `INSERT INTO orders (id, order_number, client_id, product_name, quantity, unit_price, total_amount, status, due_date)
       VALUES ($1,'000145',$2,'Коллекция Summer 2025',250,2250,562500,'sewing',CURRENT_DATE + INTERVAL '7 days')`,
      [orderId, clientId]
    );

    // Order items (3 изделия)
    const items = [
      {article:'SL-001', name:'Платье Summer Lux',   color:'Белый',  qty:100, price:2500},
      {article:'BC-002', name:'Блузка Classic',       color:'Синий',  qty:100, price:1800},
      {article:'SM-003', name:'Юбка Midi',            color:'Чёрный', qty:50,  price:2200},
    ];
    const itemIds = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const id = uuidv4();
      itemIds.push(id);
      await client.query(
        `INSERT INTO order_items (id, order_id, article, product_name, color, quantity, unit_price, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, orderId, it.article, it.name, it.color, it.qty, it.price, i]
      );
    }

    // Update order totals
    await client.query(
      `UPDATE orders SET
         product_name = 'Коллекция Summer 2025 (3 изделия)',
         quantity = 250,
         total_amount = (SELECT COALESCE(SUM(quantity * unit_price),0) FROM order_items WHERE order_id = $1)
       WHERE id = $1`,
      [orderId]
    );

    // Order stages
    for (let i = 0; i < STAGES.length; i++) {
      const status = i < 2 ? 'done' : i === 2 ? 'in_progress' : 'pending';
      const startedAt = status !== 'pending' ? new Date(Date.now() - (STAGES.length - i) * 86400000) : null;
      const completedAt = status === 'done' ? new Date(Date.now() - (STAGES.length - i - 1) * 86400000) : null;
      await client.query(
        `INSERT INTO order_stages (order_id, stage_name, stage_order, status, started_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderId, STAGES[i], i + 1, status, startedAt, completedAt]
      );
    }

    // Stage details - раскрой
    await client.query(
      `INSERT INTO stage_details (order_id, order_item_id, stage_name, employee_id, quantity_done, cut_quantity, work_date)
       VALUES ($1,$2,'cutting',$3,100,100,CURRENT_DATE-1),
              ($1,$4,'cutting',$3,100,100,CURRENT_DATE-1),
              ($1,$5,'cutting',$3,50,50,CURRENT_DATE-1)`,
      [orderId, itemIds[0], empIds[3], itemIds[1], itemIds[2]]
    );

    // Stage details - пошив (текущий этап)
    await client.query(
      `INSERT INTO stage_details (order_id, order_item_id, stage_name, employee_id, quantity_done, sewn_quantity, quantity_defect, quantity_rework, work_date)
       VALUES ($1,$2,'sewing',$3,40,40,1,2,CURRENT_DATE),
              ($1,$2,'sewing',$4,35,35,0,1,CURRENT_DATE),
              ($1,$5,'sewing',$3,25,25,1,0,CURRENT_DATE)`,
      [orderId, itemIds[0], empIds[0], empIds[1], itemIds[1]]
    );

    // Progress
    await client.query(
      `INSERT INTO order_employee_progress (order_id, order_item_id, employee_id, stage_name, quantity_done, quantity_defect, quantity_rework, work_date)
       VALUES ($1,$2,$3,'sewing',40,1,2,CURRENT_DATE),
              ($1,$2,$4,'sewing',35,0,1,CURRENT_DATE),
              ($1,$5,$3,'sewing',25,1,0,CURRENT_DATE)`,
      [orderId, itemIds[0], empIds[0], empIds[1], itemIds[1]]
    );

    // Reclamation example
    await client.query(
      `INSERT INTO reclamations (order_id, order_item_id, employee_id, stage_name, quantity, description, defect_type, status, created_by)
       VALUES ($1,$2,$3,'sewing',3,'Кривая строчка на рукаве','Строчка',  'open',$4)`,
      [orderId, itemIds[0], empIds[0], adminId]
    );

    // Attendance
    for (const empId of empIds) {
      for (let d = 4; d >= 0; d--) {
        const status = d === 2 ? 'late' : 'present';
        await client.query(
          `INSERT INTO attendance (employee_id, work_date, status) VALUES ($1, CURRENT_DATE-$2, $3)
           ON CONFLICT (employee_id, work_date) DO NOTHING`,
          [empId, d, status]
        );
      }
    }

    // Salary
    const now = new Date();
    for (let i = 0; i < empIds.length; i++) {
      const piece = i < 3 ? [40 * 90, 35 * 90, 25 * 80][i] : 0;
      await client.query(
        `INSERT INTO salary_records (employee_id, period_month, period_year, base_salary, piece_work_amount)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [empIds[i], now.getMonth() + 1, now.getFullYear(), emps[i].salary, piece]
      );
    }

    // Materials
    const mats = [
      {name:'Хлопковая ткань (белая)', cat:'fabric', unit:'m',   qty:500, min:50,  cost:315},
      {name:'Нитки полиэстер №40',     cat:'thread', unit:'roll',qty:80,  min:10,  cost:108},
      {name:'Пуговицы 12мм',           cat:'buttons',unit:'pcs', qty:2000,min:200, cost:4.5},
      {name:'Молния потайная 20см',    cat:'zippers',unit:'pcs', qty:8,   min:30,  cost:36},
    ];
    for (const m of mats) {
      await client.query(
        `INSERT INTO materials (name, category, unit, quantity_in_stock, min_stock_level, unit_cost, client_id, order_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [m.name, m.cat, m.unit, m.qty, m.min, m.cost, clientId, orderId]
      );
    }

    // Expenses
    const exps = [
      {cat:'rent',       amt:72000,  desc:'Аренда цеха',            days:10},
      {cat:'utilities',  amt:18000,  desc:'Электричество',           days:8},
      {cat:'materials',  amt:285000, desc:'Закупка тканей',          days:15},
      {cat:'equipment',  amt:45000,  desc:'Ремонт швейной машины',   days:5},
    ];
    for (const e of exps) {
      await client.query(
        `INSERT INTO expenses (category, amount, description, expense_date, created_by)
         VALUES ($1,$2,$3,CURRENT_DATE-$4,$5)`,
        [e.cat, e.amt, e.desc, e.days, adminId]
      );
    }

    // Company profile
    await client.query(
      `INSERT INTO company_profile (company_name, legal_address, tax_id, bank_account, bank_name, phone, email)
       VALUES ('StitchFlow Production','г. Москва, ул. Швейная, 12','7712345678','40702810123456789012','Сбербанк','+79001234567','info@stitchflow.ru')`
    );

    // Invoice
    await client.query(
      `INSERT INTO invoices (invoice_number, order_id, client_id, amount, discount_percent, total_amount, status, due_date, payment_qr_data, created_by)
       VALUES ('INV-0001',$1,$2,562500,5,534375,'unpaid',CURRENT_DATE+14,'stitchflow://pay?invoice=INV-0001&amount=534375',$3)`,
      [orderId, clientId, adminId]
    );

    // Client portal token
    const token = 'demo-client-token-fashion-group-2025';
    await client.query(
      `INSERT INTO client_access_tokens (client_id, token, label, created_by) VALUES ($1,$2,'Ссылка для Fashion Group',$3)`,
      [clientId, token, adminId]
    );

    console.log('Seed completed.');
    console.log('Login: admin@stitchflow.local / admin123');
    console.log(`Client portal: /client/${token}`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
