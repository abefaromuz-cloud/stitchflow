-- StitchFlow: схема базы данных (Этап 2)
-- Добавляет: склад материалов, финансы (расходы), счета (invoices) с QR-оплатой
-- Применяется после schema.sql

-- ========================
-- СКЛАД: МАТЕРИАЛЫ
-- ========================
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other',
        -- fabric (ткань), thread (нитки), buttons (пуговицы), zippers (молнии), other (фурнитура)
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs', -- pcs, m, kg, roll
    quantity_in_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
    min_stock_level NUMERIC(14,3) NOT NULL DEFAULT 0, -- порог для уведомлений о низком остатке
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    supplier VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_materials_category ON materials(category);

-- Движения по складу (поступления/списания)
CREATE TABLE material_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- in (поступление), out (списание), adjustment (корректировка)
    quantity NUMERIC(14,3) NOT NULL, -- положительное число; знак применяется по movement_type
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- если списание привязано к заказу
    reason VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_material_movements_material ON material_movements(material_id);
CREATE INDEX idx_material_movements_order ON material_movements(order_id);

-- Состав заказа: какие материалы и сколько требуются на заказ (нормы расхода)
CREATE TABLE order_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    quantity_per_unit NUMERIC(14,3) NOT NULL, -- расход материала на 1 изделие
    quantity_reserved NUMERIC(14,3) NOT NULL DEFAULT 0, -- зарезервировано/списано всего
    UNIQUE(order_id, material_id)
);

-- ========================
-- ФИНАНСЫ: РАСХОДЫ
-- ========================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
        -- rent, utilities, materials, salary, tax, equipment, other
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    description VARCHAR(255),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ========================
-- РЕКВИЗИТЫ КОМПАНИИ (для счетов)
-- ========================
CREATE TABLE company_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(200) NOT NULL,
    legal_address VARCHAR(255),
    tax_id VARCHAR(50), -- ИНН
    bank_account VARCHAR(50),
    bank_name VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(150),
    logo_url VARCHAR(255)
);

-- ========================
-- СЧЕТА (INVOICES)
-- ========================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS
        (amount - (amount * discount_percent / 100)) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- unpaid, paid, overdue, cancelled
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_at TIMESTAMPTZ,
    payment_qr_data VARCHAR(500), -- данные для генерации QR-кода оплаты
    pdf_url VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================
-- VIEW: финансовая сводка по месяцам
-- ========================
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
    FROM orders
    GROUP BY 1
) rev ON rev.month = months.month
LEFT JOIN (
    SELECT date_trunc('month', expense_date) AS month, SUM(amount) AS expenses
    FROM expenses
    GROUP BY 1
) exp ON exp.month = months.month
ORDER BY period;
