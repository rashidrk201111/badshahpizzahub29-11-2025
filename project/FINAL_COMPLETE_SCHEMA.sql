/*
  # Complete Billing, Inventory & Accounting System Schema

  ## Overview
  This is the complete database schema for a comprehensive billing and inventory management
  system with support for GST calculations, multi-user roles, and financial tracking.

  ## Tables Created (16 Total)

  ### Core User & Authentication
  1. profiles - User profiles with role-based access control

  ### Product & Customer Management
  2. customers - Customer information with GST details
  3. products - Product catalog with inventory tracking

  ### Sales & Invoicing
  4. invoices - Sales invoices with GST breakdown (CGST/SGST/IGST)
  5. invoice_items - Line items for invoices with per-item GST
  6. invoice_payments - Payment tracking for invoices

  ### Purchase Management
  7. suppliers - Supplier/vendor information with GST details
  8. purchases - Purchase orders with GST breakdown
  9. purchase_items - Line items for purchases with per-item GST
  10. purchase_payments - Payment tracking for purchases

  ### Accounting & Finance
  11. payment_methods - Available payment methods (Cash, UPI, Bank, etc.)
  12. expense_categories - Expense categorization for accounting
  13. transactions - All financial transactions (income/expense)

  ### Inventory & Operations
  14. inventory_movements - Track all inventory changes

  ### Configuration
  15. company_profile - Company settings and information
  16. employees - Employee management system

  ## Security Features
  - Row Level Security (RLS) enabled on ALL tables
  - Role-based access control with 7 roles
  - User-specific data isolation
  - Public access for invoice viewing only

  ## GST Features
  - Support for both intrastate (CGST+SGST) and interstate (IGST) transactions
  - HSN code tracking
  - Automatic GST rate application
  - Place of supply tracking

  ## Notes
  - All monetary values use numeric type for precision
  - Cascade deletes configured for data integrity
  - Performance indexes on frequently queried columns
  - Automatic timestamp updates via triggers
  - Default data pre-populated for payment methods and expense categories
*/

-- ============================================================================
-- ENABLE EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'sales'
    CHECK (role IN ('admin', 'accountant', 'inventory_manager', 'sales', 'sales_person', 'inventory_person', 'purchase_person')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 2. PAYMENT METHODS TABLE (must be before transactions/invoices)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payment methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and accountants can manage payment methods"
  ON payment_methods FOR ALL
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

-- Insert default payment methods
INSERT INTO payment_methods (name, is_active) VALUES
  ('Cash', true),
  ('Bank Transfer', true),
  ('Credit Card', true),
  ('Debit Card', true),
  ('UPI', true),
  ('Cheque', true),
  ('Net Banking', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. EXPENSE CATEGORIES TABLE (required for Accounting module)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and accountants can manage expense categories"
  ON expense_categories FOR ALL
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

-- Insert default expense categories
INSERT INTO expense_categories (name, description, is_active) VALUES
  ('Office Supplies', 'General office supplies and stationery', true),
  ('Utilities', 'Electricity, water, internet, phone bills', true),
  ('Rent', 'Office or warehouse rent', true),
  ('Salaries', 'Employee salaries and wages', true),
  ('Transportation', 'Vehicle fuel, maintenance, and transportation costs', true),
  ('Marketing', 'Advertising and marketing expenses', true),
  ('Insurance', 'Business insurance premiums', true),
  ('Repairs & Maintenance', 'Equipment and facility maintenance', true),
  ('Professional Fees', 'Legal, accounting, consulting fees', true),
  ('Taxes', 'Business taxes and licenses', true),
  ('Raw Materials', 'Raw materials and supplies for production', true),
  ('Packaging', 'Packaging materials and supplies', true),
  ('Miscellaneous', 'Other business expenses', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. CUSTOMERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  state text,
  gstin text,
  opening_balance numeric DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'inventory_manager', 'sales', 'sales_person', 'inventory_person', 'purchase_person')
    )
  );

CREATE POLICY "Authorized users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'inventory_manager', 'sales', 'sales_person', 'inventory_person', 'purchase_person')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'inventory_manager', 'sales', 'sales_person', 'inventory_person', 'purchase_person')
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

-- ============================================================================
-- 5. PRODUCTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sku text UNIQUE NOT NULL,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 10,
  unit text DEFAULT 'piece',
  inventory_type text DEFAULT 'finished_product'
    CHECK (inventory_type IN ('raw_material', 'finished_product')),
  hsn_code text,
  gst_rate numeric DEFAULT 18,
  color text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Inventory staff can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager', 'inventory_person', 'purchase_person')
    )
  );

CREATE POLICY "Inventory staff can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager', 'inventory_person')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager', 'inventory_person')
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

-- ============================================================================
-- 6. INVOICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  payment_status text DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
  amount_paid numeric DEFAULT 0,
  opening_balance numeric DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  cgst numeric(10,2) DEFAULT 0,
  sgst numeric(10,2) DEFAULT 0,
  igst numeric(10,2) DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  is_interstate boolean DEFAULT false,
  place_of_supply text,
  due_date date NOT NULL,
  paid_date date,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales staff can create invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales', 'sales_person')
    )
  );

CREATE POLICY "Sales staff can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales', 'sales_person')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales', 'sales_person')
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

-- ============================================================================
-- 7. INVOICE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  hsn_code text,
  gst_rate numeric DEFAULT 18,
  cgst_amount numeric(10,2) DEFAULT 0,
  sgst_amount numeric(10,2) DEFAULT 0,
  igst_amount numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales staff can create invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales', 'sales_person')
    )
  );

CREATE POLICY "Sales staff can update invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales', 'sales_person')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'accountant', 'sales', 'sales_person')
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

-- ============================================================================
-- 8. INVOICE PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  reference_number text,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice payments"
  ON invoice_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create invoice payments"
  ON invoice_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own invoice payments"
  ON invoice_payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can delete invoice payments"
  ON invoice_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 9. SUPPLIERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  state text,
  gstin text,
  pan text,
  opening_balance numeric DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 10. PURCHASES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  payment_status text DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  amount_paid numeric DEFAULT 0,
  opening_balance numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  cgst numeric DEFAULT 0,
  sgst numeric DEFAULT 0,
  igst numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  is_interstate boolean DEFAULT false,
  place_of_supply text,
  order_date date DEFAULT CURRENT_DATE,
  expected_date date,
  received_date date,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update purchases"
  ON purchases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete purchases"
  ON purchases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 11. PURCHASE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  cgst_rate numeric DEFAULT 0,
  sgst_rate numeric DEFAULT 0,
  igst_rate numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  total numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchase items"
  ON purchase_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage purchase items"
  ON purchase_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 12. PURCHASE PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  reference_number text,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchase payments"
  ON purchase_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create purchase payments"
  ON purchase_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own purchase payments"
  ON purchase_payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can delete purchase payments"
  ON purchase_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 13. TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  amount numeric(10,2) NOT NULL,
  description text,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  reference_number text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- 14. INVENTORY MOVEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity numeric NOT NULL,
  reason text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventory movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Inventory staff can create movements"
  ON inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager', 'inventory_person', 'sales', 'sales_person', 'purchase_person')
    )
  );

-- ============================================================================
-- 15. COMPANY PROFILE TABLE
-- ============================================================================

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
  whatsapp_number text,
  whatsapp_api_token text,
  whatsapp_phone_number_id text,
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  ifsc_code text DEFAULT '',
  terms_conditions text DEFAULT 'Payment due within 30 days',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own company profile"
  ON company_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company profile"
  ON company_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view company profiles"
  ON company_profile FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 16. EMPLOYEES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL
    CHECK (role IN ('admin', 'sales_person', 'inventory_person', 'purchase_person')),
  phone text DEFAULT '',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(gstin);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_inventory_type ON products(inventory_type);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_method ON invoice_payments(payment_method_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_gstin ON suppliers(gstin);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_by ON suppliers(created_by);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_created_by ON purchases(created_by);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON purchase_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_date ON purchase_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_method ON purchase_payments(payment_method_id);

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_method ON transactions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_company_profile_user_id ON company_profile(user_id);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_created_by ON employees(created_by);

CREATE INDEX IF NOT EXISTS idx_expense_categories_is_active ON expense_categories(is_active);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_profiles') THEN
    CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_customers') THEN
    CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON customers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_products') THEN
    CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_invoices') THEN
    CREATE TRIGGER set_updated_at_invoices BEFORE UPDATE ON invoices
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_company_profile') THEN
    CREATE TRIGGER set_updated_at_company_profile BEFORE UPDATE ON company_profile
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_suppliers') THEN
    CREATE TRIGGER set_updated_at_suppliers BEFORE UPDATE ON suppliers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_purchases') THEN
    CREATE TRIGGER set_updated_at_purchases BEFORE UPDATE ON purchases
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_employees') THEN
    CREATE TRIGGER set_updated_at_employees BEFORE UPDATE ON employees
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_expense_categories') THEN
    CREATE TRIGGER set_updated_at_expense_categories BEFORE UPDATE ON expense_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- SCHEMA SETUP COMPLETE
-- ============================================================================

-- Summary of created objects:
-- 16 Tables
-- 50+ RLS Policies
-- 30+ Indexes
-- 9 Update Triggers
-- Default data for payment_methods and expense_categories