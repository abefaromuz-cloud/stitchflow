-- StitchFlow: Полная схема БД (Этапы 1-6)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- ПОЛЬЗОВАТЕЛИ
-- ========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'employee',
    avatar_url VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- КЛИЕНТЫ
-- ========================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    telegram VARCHAR(60),
    email VARCHAR(150),
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    debt_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- СОТРУДНИКИ
-- ========================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    position VARCHAR(100),
    phone VARCHAR(30),
    photo_url VARCHAR(255),
    hire_date DATE NOT NULL,
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    piece_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- ЗАКАЗЫ
-- ========================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(30) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    -- Основной товар (для совместимости), позиции хранятся в order_items
    product_name VARCHAR(200) NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    due_date DATE,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_client ON orders(client_id);

-- ========================
-- ПОЗИЦИИ ЗАКАЗА (несколько изделий в заказе)
-- ========================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    article VARCHAR(100),
    product_name VARCHAR(200) NOT NULL,
    color VARCHAR(100),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ========================
-- ЭТАПЫ ПРОИЗВОДСТВА
-- ========================
CREATE TABLE order_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    stage_order INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES employees(id)
);

CREATE INDEX idx_order_stages_order ON order_stages(order_id);

-- ========================
-- ДЕТАЛИЗАЦИЯ ЭТАПОВ (раскрой, пошив, QC, упаковка)
-- ========================
CREATE TABLE stage_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Общие счётчики
    quantity_done INTEGER NOT NULL DEFAULT 0,
    quantity_defect INTEGER NOT NULL DEFAULT 0,
    quantity_rework INTEGER NOT NULL DEFAULT 0,

    -- Раскрой
    cut_quantity INTEGER,

    -- Пошив
    sewn_quantity INTEGER,

    -- Проверка качества
    qc_checked INTEGER,
    qc_passed INTEGER,
    qc_defect INTEGER,
    qc_rework INTEGER,
    qc_wash INTEGER,
    qc_fix INTEGER,

    -- Упаковка
    packed_quantity INTEGER,

    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stage_details_order ON stage_details(order_id);
CREATE INDEX idx_stage_details_employee ON stage_details(employee_id);

-- ========================
-- РЕКЛАМАЦИИ
-- ========================
CREATE TABLE reclamations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    stage_name VARCHAR(50),
    quantity INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    defect_type VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reclamations_order ON reclamations(order_id);
CREATE INDEX idx_reclamations_employee ON reclamations(employee_id);

-- ========================
-- ПРОГРЕСС СОТРУДНИКА ПО ЗАКАЗУ
-- ========================
CREATE TABLE order_employee_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    stage_name VARCHAR(50),
    quantity_done INTEGER NOT NULL DEFAULT 0,
    quantity_defect INTEGER NOT NULL DEFAULT 0,
    quantity_rework INTEGER NOT NULL DEFAULT 0,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oep_order ON order_employee_progress(order_id);
CREATE INDEX idx_oep_employee ON order_employee_progress(employee_id);

-- ========================
-- ФАЙЛЫ ЗАКАЗА
-- ========================
CREATE TABLE order_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_type VARCHAR(30) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- ПОСЕЩАЕМОСТЬ
-- ========================
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    check_in TIME,
    check_out TIME,
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, work_date)
);

CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, work_date);

-- ========================
-- ЗАРПЛАТА
-- ========================
CREATE TABLE salary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    piece_work_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    penalty_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) GENERATED ALWAYS AS
        (base_salary + piece_work_amount + bonus_amount - penalty_amount) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, period_month, period_year)
);

CREATE TABLE salary_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salary_record_id UUID NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('bonus','penalty')),
    amount NUMERIC(12,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- МАТЕРИАЛЫ / СКЛАД
-- ========================
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    quantity_in_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
    min_stock_level NUMERIC(14,3) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    supplier VARCHAR(150),
    -- Этап 6: привязка к клиенту/заказу/изделию
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE material_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL,
    quantity NUMERIC(14,3) NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    reason VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    quantity_per_unit NUMERIC(14,3) NOT NULL,
    quantity_reserved NUMERIC(14,3) NOT NULL DEFAULT 0,
    UNIQUE(order_id, material_id)
);

-- ========================
-- ФИНАНСЫ
-- ========================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    description VARCHAR(255),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(200) NOT NULL,
    legal_address VARCHAR(255),
    tax_id VARCHAR(50),
    bank_account VARCHAR(50),
    bank_name VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(150),
    logo_url VARCHAR(255)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_at TIMESTAMPTZ,
    payment_qr_data VARCHAR(500),
    pdf_url VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- МОТИВАЦИЯ
-- ========================
CREATE TABLE bonus_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    points_per_unit NUMERIC(6,2) NOT NULL DEFAULT 1,
    speed_bonus_threshold INTEGER NOT NULL DEFAULT 500,
    speed_bonus_points INTEGER NOT NULL DEFAULT 50,
    zero_defect_points INTEGER NOT NULL DEFAULT 100,
    low_defect_max_percent NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    low_defect_points INTEGER NOT NULL DEFAULT 50,
    full_attendance_points INTEGER NOT NULL DEFAULT 80,
    late_penalty_points INTEGER NOT NULL DEFAULT 10,
    absent_penalty_points INTEGER NOT NULL DEFAULT 20,
    tier1_threshold INTEGER NOT NULL DEFAULT 200,
    tier1_bonus NUMERIC(12,2) NOT NULL DEFAULT 9000,
    tier2_threshold INTEGER NOT NULL DEFAULT 350,
    tier2_bonus NUMERIC(12,2) NOT NULL DEFAULT 22500,
    tier3_threshold INTEGER NOT NULL DEFAULT 500,
    tier3_bonus NUMERIC(12,2) NOT NULL DEFAULT 45000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    speed_points INTEGER NOT NULL DEFAULT 0,
    quality_points INTEGER NOT NULL DEFAULT 0,
    attendance_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER GENERATED ALWAYS AS (speed_points + quality_points + attendance_points) STORED,
    units_produced INTEGER NOT NULL DEFAULT 0,
    defect_count INTEGER NOT NULL DEFAULT 0,
    rework_count INTEGER NOT NULL DEFAULT 0,
    defect_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    rework_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    present_days INTEGER NOT NULL DEFAULT 0,
    late_days INTEGER NOT NULL DEFAULT 0,
    absent_days INTEGER NOT NULL DEFAULT 0,
    bonus_tier INTEGER NOT NULL DEFAULT 0,
    bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, period_month, period_year)
);

CREATE TABLE points_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    redemption_type VARCHAR(30) NOT NULL,
    description VARCHAR(255),
    points_used INTEGER NOT NULL DEFAULT 0,
    value_amount NUMERIC(12,2),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- TELEGRAM
-- ========================
CREATE TABLE telegram_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    full_name VARCHAR(150),
    role VARCHAR(30) NOT NULL DEFAULT 'manager',
    notify_new_order BOOLEAN NOT NULL DEFAULT true,
    notify_employee_absent BOOLEAN NOT NULL DEFAULT true,
    notify_order_completed BOOLEAN NOT NULL DEFAULT true,
    notify_payment_received BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    sent_to_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'sent',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- QR СИСТЕМА
-- ========================
CREATE TABLE order_qr_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE qr_scan_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- КЛИЕНТСКИЙ КАБИНЕТ
-- ========================
CREATE TABLE client_access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    label VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- VIEWS
-- ========================
CREATE VIEW employee_production_stats AS
SELECT
    e.id AS employee_id,
    e.full_name,
    COALESCE(SUM(oep.quantity_done), 0) AS total_done,
    COALESCE(SUM(oep.quantity_defect), 0) AS total_defect,
    COALESCE(SUM(oep.quantity_rework), 0) AS total_rework,
    CASE WHEN COALESCE(SUM(oep.quantity_done), 0) > 0
        THEN ROUND(100.0 * SUM(oep.quantity_defect) / SUM(oep.quantity_done), 2)
        ELSE 0
    END AS defect_rate_percent,
    CASE WHEN COALESCE(SUM(oep.quantity_done), 0) > 0
        THEN ROUND(100.0 * SUM(oep.quantity_rework) / SUM(oep.quantity_done), 2)
        ELSE 0
    END AS rework_rate_percent
FROM employees e
LEFT JOIN order_employee_progress oep ON oep.employee_id = e.id
GROUP BY e.id, e.full_name;

CREATE VIEW monthly_finance_summary AS
SELECT
    date_trunc('month', months.month)::date AS period,
    COALESCE(rev.revenue, 0) AS revenue,
    COALESCE(exp.expenses, 0) AS expenses,
    COALESCE(rev.revenue, 0) - COALESCE(exp.expenses, 0) AS profit
FROM (
    SELECT generate_series(
        date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
        date_trunc('month', CURRENT_DATE),
        '1 month'::interval
    ) AS month
) months
LEFT JOIN (
    SELECT date_trunc('month', created_at) AS month, SUM(total_amount) AS revenue
    FROM orders GROUP BY 1
) rev ON rev.month = months.month
LEFT JOIN (
    SELECT date_trunc('month', expense_date) AS month, SUM(amount) AS expenses
    FROM expenses GROUP BY 1
) exp ON exp.month = months.month
ORDER BY period;

-- ========================
-- TRIGGERS
-- ========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default bonus config
INSERT INTO bonus_config (
    points_per_unit, speed_bonus_threshold, speed_bonus_points,
    zero_defect_points, low_defect_max_percent, low_defect_points,
    full_attendance_points, late_penalty_points, absent_penalty_points,
    tier1_threshold, tier1_bonus, tier2_threshold, tier2_bonus, tier3_threshold, tier3_bonus
) VALUES (1, 500, 50, 100, 1.0, 50, 80, 10, 20, 200, 9000, 350, 22500, 500, 45000);
