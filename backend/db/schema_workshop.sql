-- ============================================
-- РАЗДЕЛ ЦЕХ (Workshop)
-- ============================================

-- Шаблоны операций пошива (привязаны к изделию)
CREATE TABLE IF NOT EXISTS sewing_operation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    product_name VARCHAR(200),          -- если шаблон общий (не привязан к конкретному изделию)
    operation_number INTEGER NOT NULL,
    operation_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sew_tmpl_item ON sewing_operation_templates(order_item_id);

-- Отгрузка ткани (рулоны)
CREATE TABLE IF NOT EXISTS fabric_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    fabric_name VARCHAR(200),
    color VARCHAR(100),
    roll_number INTEGER NOT NULL,       -- номер рулона
    meters NUMERIC(10,2) NOT NULL,      -- метраж рулона
    consumption_per_unit NUMERIC(10,3), -- расход ткани на 1 единицу (м)
    expected_units INTEGER GENERATED ALWAYS AS (
        CASE WHEN consumption_per_unit > 0
            THEN FLOOR(meters / consumption_per_unit)::INTEGER
            ELSE 0
        END
    ) STORED,                           -- расчётный выход единиц из рулона
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fabric_shipments_order ON fabric_shipments(order_id);

-- Крой — партии кроя
CREATE TABLE IF NOT EXISTS cutting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    cut_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_name VARCHAR(200),
    color VARCHAR(100),
    size VARCHAR(20),                   -- размер (44, 46, S, M, L...)
    total_quantity INTEGER NOT NULL,    -- сколько покроено всего
    bundle_count INTEGER NOT NULL DEFAULT 1, -- на сколько пачек разделить
    bundle_size INTEGER,                -- сколько единиц в одной пачке
    cutter_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cutting_order ON cutting_sessions(order_id);

-- Пачки (bundles) — создаются при крое
CREATE TABLE IF NOT EXISTS bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cutting_session_id UUID NOT NULL REFERENCES cutting_sessions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    bundle_number VARCHAR(20) NOT NULL, -- напр. "44/1", "44/2", "46/1"
    size VARCHAR(20),
    color VARCHAR(100),
    quantity INTEGER NOT NULL,          -- кол-во изделий в пачке
    product_name VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'cut',
    -- cut → sewing → vto → shipped
    current_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundles_cutting ON bundles(cutting_session_id);
CREATE INDEX IF NOT EXISTS idx_bundles_order ON bundles(order_id);
CREATE INDEX IF NOT EXISTS idx_bundles_number ON bundles(bundle_number);

-- Операции пошива по пачке
CREATE TABLE IF NOT EXISTS bundle_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    operation_number INTEGER NOT NULL,
    operation_name TEXT NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL, -- кто выполнял
    is_done BOOLEAN NOT NULL DEFAULT false,
    done_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundle_ops_bundle ON bundle_operations(bundle_id);

-- Рекламации по пачке (отдельные от рекламаций по заказу)
CREATE TABLE IF NOT EXISTS bundle_reclamations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    operation_id UUID REFERENCES bundle_operations(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    defect_type VARCHAR(100),
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundle_recl_bundle ON bundle_reclamations(bundle_id);

-- ВТО / ОТК по пачке
CREATE TABLE IF NOT EXISTS bundle_qc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    qc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    inspector_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    checked_quantity INTEGER NOT NULL DEFAULT 0,
    passed_quantity INTEGER NOT NULL DEFAULT 0,
    defect_quantity INTEGER NOT NULL DEFAULT 0,
    rework_quantity INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundle_qc_bundle ON bundle_qc(bundle_id);

-- Отгрузка готовой продукции
CREATE TABLE IF NOT EXISTS workshop_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workshop_shipment_bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES workshop_shipments(id) ON DELETE CASCADE,
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE
);

-- Trigger for bundles updated_at
CREATE OR REPLACE FUNCTION set_bundle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bundles_updated_at ON bundles;
CREATE TRIGGER trg_bundles_updated_at
BEFORE UPDATE ON bundles
FOR EACH ROW EXECUTE FUNCTION set_bundle_updated_at();
