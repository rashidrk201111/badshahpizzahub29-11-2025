/*
  # Suppliers and Purchase Order Management

  1. New Table: suppliers
    - `id` (uuid, primary key)
    - `name` (text) - Supplier company name
    - `contact_person` (text) - Contact person name
    - `email` (text) - Email address
    - `phone` (text) - Phone number
    - `address` (text) - Full address
    - `state` (text) - State for GST
    - `gstin` (text) - GST identification number
    - `pan` (text) - PAN number
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. New Table: purchases
    - `id` (uuid, primary key)
    - `purchase_number` (text) - Auto-generated purchase order number
    - `supplier_id` (uuid, references suppliers)
    - `status` (text) - 'draft', 'ordered', 'received', 'cancelled'
    - `payment_status` (text) - 'unpaid', 'partial', 'paid'
    - `amount_paid` (numeric) - Total amount paid
    - `subtotal` (numeric) - Subtotal before tax
    - `cgst` (numeric) - Central GST amount
    - `sgst` (numeric) - State GST amount
    - `igst` (numeric) - Integrated GST amount
    - `tax` (numeric) - Total tax amount
    - `total` (numeric) - Final total amount
    - `is_interstate` (boolean) - Interstate purchase flag
    - `place_of_supply` (text) - Place of supply for GST
    - `order_date` (date) - Date of order
    - `expected_date` (date) - Expected delivery date
    - `received_date` (date) - Actual received date
    - `notes` (text) - Additional notes
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. New Table: purchase_items
    - `id` (uuid, primary key)
    - `purchase_id` (uuid, references purchases)
    - `product_id` (uuid, references products)
    - `quantity` (numeric) - Quantity ordered
    - `unit_price` (numeric) - Price per unit
    - `cgst_rate` (numeric) - CGST rate
    - `sgst_rate` (numeric) - SGST rate
    - `igst_rate` (numeric) - IGST rate
    - `cgst_amount` (numeric) - CGST amount
    - `sgst_amount` (numeric) - SGST amount
    - `igst_amount` (numeric) - IGST amount
    - `total` (numeric) - Total amount for line item
    - `created_at` (timestamptz)

  4. New Table: purchase_payments
    - `id` (uuid, primary key)
    - `purchase_id` (uuid, references purchases)
    - `amount` (numeric) - Payment amount
    - `payment_date` (date) - Payment date
    - `payment_method_id` (uuid, references payment_methods)
    - `reference_number` (text) - Transaction reference
    - `notes` (text) - Payment notes
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  5. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users

  6. Important Notes
    - Purchase orders track inventory purchases from suppliers
    - Partial payment tracking similar to invoices
    - GST calculations for purchase transactions
    - Inventory automatically increases when purchase is received
*/

-- Create suppliers table
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

-- Create purchases table
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

-- Add constraint for purchase status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_status_check'
  ) THEN
    ALTER TABLE purchases ADD CONSTRAINT purchases_status_check 
      CHECK (status IN ('draft', 'ordered', 'received', 'cancelled'));
  END IF;
END $$;

-- Add constraint for payment_status
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

-- Create purchase_items table
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

-- Create purchase_payments table
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