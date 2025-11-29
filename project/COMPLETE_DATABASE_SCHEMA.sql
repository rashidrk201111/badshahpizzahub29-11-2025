/*
  ============================================
  COMPLETE DATABASE SCHEMA
  Billing, Inventory & Accounting Application
  ============================================

  This file contains all database migrations applied to the system.
  It includes all tables, policies, functions, triggers, and indexes.

  ## Tables Created:
  1. profiles - User profiles with role-based access
  2. customers - Customer information
  3. products - Product/inventory items
  4. invoices - Sales invoices
  5. invoice_items - Line items for invoices
  6. transactions - Financial transactions (income/expense)
  7. inventory_movements - Inventory movement tracking
  8. company_profile - Company/business profile settings
  9. inventory_history - Detailed inventory change history
  10. daily_inventory_snapshots - Daily inventory level snapshots

  ## Security:
  - Row Level Security (RLS) enabled on all tables
  - Role-based access control (admin, accountant, inventory_manager, sales)
  - Authenticated users only

  ## Features:
  - Automatic inventory tracking with triggers
  - Daily inventory snapshots
  - Cascade delete for related records
  - Comprehensive indexing for performance
*/

-- ============================================
-- 1. PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'accountant', 'inventory_manager', 'sales')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. CUSTOMERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can create customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'inventory_manager', 'sales')
    )
  );

CREATE POLICY "Sales and above can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'inventory_manager', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'inventory_manager', 'sales')
    )
  );

CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 3. PRODUCTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sku text UNIQUE NOT NULL,
  cost_price decimal(10,2) NOT NULL DEFAULT 0,
  selling_price decimal(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 10,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Inventory managers and admins can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager')
    )
  );

CREATE POLICY "Inventory managers and admins can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager')
    )
  );

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 4. INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  subtotal decimal(10,2) NOT NULL DEFAULT 0,
  tax decimal(10,2) NOT NULL DEFAULT 0,
  total decimal(10,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can create invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales')
    )
  );

CREATE POLICY "Sales and above can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales')
    )
  );

CREATE POLICY "Admins can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 5. INVOICE ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_items
CREATE POLICY "Authenticated users can view invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can create invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales')
    )
  );

CREATE POLICY "Sales and above can update invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales')
    )
  );

CREATE POLICY "Admins can delete invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 6. TRANSACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  amount decimal(10,2) NOT NULL,
  description text,
  invoice_id uuid REFERENCES invoices(id),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions
CREATE POLICY "Accountants and admins can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  );

CREATE POLICY "Accountants and admins can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  );

CREATE POLICY "Accountants and admins can update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant')
    )
  );

CREATE POLICY "Admins can delete transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 7. INVENTORY MOVEMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  type text NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL,
  reason text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_movements
CREATE POLICY "Authenticated users can view inventory movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Inventory managers and admins can create movements"
  ON inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager')
    )
  );

-- ============================================
-- 8. COMPANY PROFILE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS company_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  company_name text NOT NULL DEFAULT '',
  gst_number text DEFAULT '',
  pan_number text DEFAULT '',
  address_line1 text DEFAULT '',
  address_line2 text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  postal_code text DEFAULT '',
  country text DEFAULT 'India',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  ifsc_code text DEFAULT '',
  terms_conditions text DEFAULT 'Payment due within 30 days',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_profile
CREATE POLICY "Users can view own company profile"
  ON company_profile
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own company profile"
  ON company_profile
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company profile"
  ON company_profile
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all company profiles"
  ON company_profile
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 9. INVENTORY HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('opening_stock', 'purchase', 'sale', 'adjustment', 'daily_snapshot', 'consumption')),
  quantity_before numeric NOT NULL DEFAULT 0,
  quantity_change numeric NOT NULL,
  quantity_after numeric NOT NULL,
  reference_type text CHECK (reference_type IN ('purchase_order', 'invoice', 'manual', 'system')),
  reference_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_history
CREATE POLICY "Authenticated users can view inventory history"
  ON inventory_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create inventory history"
  ON inventory_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 10. DAILY INVENTORY SNAPSHOTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS daily_inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL,
  opening_stock numeric NOT NULL DEFAULT 0,
  purchases numeric NOT NULL DEFAULT 0,
  sales numeric NOT NULL DEFAULT 0,
  adjustments numeric NOT NULL DEFAULT 0,
  closing_stock numeric NOT NULL DEFAULT 0,
  max_stock numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, snapshot_date)
);

ALTER TABLE daily_inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_inventory_snapshots
CREATE POLICY "Authenticated users can view daily snapshots"
  ON daily_inventory_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create daily snapshots"
  ON daily_inventory_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update daily snapshots"
  ON daily_inventory_snapshots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_company_profile_user_id ON company_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_product_id ON inventory_history(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created_at ON inventory_history(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_history_activity_type ON inventory_history(activity_type);
CREATE INDEX IF NOT EXISTS idx_inventory_history_reference ON inventory_history(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_product_date ON daily_inventory_snapshots(product_id, snapshot_date);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update company_profile updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for company_profile updated_at
CREATE TRIGGER set_company_profile_updated_at
  BEFORE UPDATE ON company_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_company_profile_updated_at();

-- Function to log inventory changes
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when quantity changes
  IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
    INSERT INTO inventory_history (
      product_id,
      activity_type,
      quantity_before,
      quantity_change,
      quantity_after,
      reference_type,
      notes,
      created_by
    ) VALUES (
      NEW.id,
      'adjustment',
      OLD.quantity,
      NEW.quantity - OLD.quantity,
      NEW.quantity,
      'manual',
      'Stock level updated',
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on products table to log changes
DROP TRIGGER IF EXISTS products_quantity_change ON products;
CREATE TRIGGER products_quantity_change
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_change();

-- Function to create or update daily snapshot
CREATE OR REPLACE FUNCTION update_daily_snapshot(
  p_product_id uuid,
  p_activity_type text,
  p_quantity numeric
)
RETURNS void AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_snapshot_exists boolean;
BEGIN
  -- Check if snapshot exists for today
  SELECT EXISTS (
    SELECT 1 FROM daily_inventory_snapshots
    WHERE product_id = p_product_id
    AND snapshot_date = v_today
  ) INTO v_snapshot_exists;

  IF v_snapshot_exists THEN
    -- Update existing snapshot
    UPDATE daily_inventory_snapshots
    SET
      purchases = CASE WHEN p_activity_type = 'purchase' THEN purchases + p_quantity ELSE purchases END,
      sales = CASE WHEN p_activity_type = 'sale' THEN sales + p_quantity ELSE sales END,
      adjustments = CASE WHEN p_activity_type = 'adjustment' THEN adjustments + p_quantity ELSE adjustments END,
      closing_stock = (SELECT quantity FROM products WHERE id = p_product_id),
      max_stock = GREATEST(max_stock, (SELECT quantity FROM products WHERE id = p_product_id))
    WHERE product_id = p_product_id
    AND snapshot_date = v_today;
  ELSE
    -- Create new snapshot
    INSERT INTO daily_inventory_snapshots (
      product_id,
      snapshot_date,
      opening_stock,
      purchases,
      sales,
      adjustments,
      closing_stock,
      max_stock
    )
    SELECT
      p_product_id,
      v_today,
      COALESCE(quantity, 0),
      CASE WHEN p_activity_type = 'purchase' THEN p_quantity ELSE 0 END,
      CASE WHEN p_activity_type = 'sale' THEN p_quantity ELSE 0 END,
      CASE WHEN p_activity_type = 'adjustment' THEN p_quantity ELSE 0 END,
      COALESCE(quantity, 0),
      COALESCE(quantity, 0)
    FROM products
    WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- END OF SCHEMA
-- ============================================
