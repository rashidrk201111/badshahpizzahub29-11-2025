/*
  # Create Bills Table for Quick Billing

  1. New Tables
    - `bills`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `bill_number` (text, unique)
      - `bill_date` (timestamptz)
      - `customer_name` (text, optional)
      - `customer_phone` (text, optional)
      - `subtotal` (numeric)
      - `tax_amount` (numeric)
      - `total_amount` (numeric)
      - `payment_status` (text) - 'paid', 'pending'
      - `payment_method` (text) - 'cash', 'card', 'upi', etc.
      - `notes` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `bill_items`
      - `id` (uuid, primary key)
      - `bill_id` (uuid, references bills)
      - `menu_item_id` (uuid, references menu_items)
      - `menu_item_name` (text)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `total` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own bills
*/

CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  bill_number text UNIQUE NOT NULL,
  bill_date timestamptz DEFAULT now(),
  customer_name text,
  customer_phone text,
  subtotal numeric(10, 2) DEFAULT 0,
  tax_amount numeric(10, 2) DEFAULT 0,
  total_amount numeric(10, 2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES menu_items(id),
  menu_item_name text NOT NULL,
  quantity numeric(10, 2) NOT NULL,
  unit_price numeric(10, 2) NOT NULL,
  total numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- Bills policies
CREATE POLICY "Users can view own bills"
  ON bills FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bills"
  ON bills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bills"
  ON bills FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bills"
  ON bills FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Bill items policies
CREATE POLICY "Users can view own bill items"
  ON bill_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
      AND bills.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own bill items"
  ON bill_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
      AND bills.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own bill items"
  ON bill_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
      AND bills.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
      AND bills.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own bill items"
  ON bill_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
      AND bills.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
