/*
  # Suppliers and Purchase Order Management

  1. New Table: suppliers
  2. New Table: purchases
  3. New Table: purchase_items
  4. New Table: purchase_payments
  5. Security - Enable RLS on all new tables
*/

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
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update suppliers"
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

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  status text DEFAULT 'draft',
  payment_status text DEFAULT 'unpaid',
  amount_paid numeric DEFAULT 0,
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
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_status_check'
  ) THEN
    ALTER TABLE purchases ADD CONSTRAINT purchases_status_check 
      CHECK (status IN ('draft', 'ordered', 'received', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_payment_status_check'
  ) THEN
    ALTER TABLE purchases ADD CONSTRAINT purchases_payment_status_check 
      CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
  END IF;
END $$;

CREATE POLICY "Users can view purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update purchases"
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

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
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

CREATE POLICY "Users can view purchase items"
  ON purchase_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert purchase items"
  ON purchase_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update purchase items"
  ON purchase_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete purchase items"
  ON purchase_items FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method_id uuid REFERENCES payment_methods(id),
  reference_number text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase payments"
  ON purchase_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert purchase payments"
  ON purchase_payments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update purchase payments"
  ON purchase_payments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

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