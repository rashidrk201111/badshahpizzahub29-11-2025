/*
  # Create Kitchen Order Ticket (KOT) System

  ## Overview
  Creates a complete KOT system for restaurant operations with three order types:
  - Dine-in: Orders for customers dining at the restaurant
  - Delivery: Orders from delivery apps (Zomato, Swiggy, etc.)
  - Take-away: Orders for customer pickup

  ## New Tables
  1. `kots` - Kitchen order tickets
     - `id` (uuid, primary key)
     - `kot_number` (text, unique) - Auto-generated KOT number
     - `order_type` (text) - 'dine_in', 'delivery', or 'take_away'
     - `table_number` (text) - For dine-in orders
     - `customer_name` (text) - Customer name
     - `customer_phone` (text) - Customer phone
     - `delivery_platform` (text) - For delivery orders (Zomato, Swiggy, etc.)
     - `delivery_order_id` (text) - Order ID from delivery platform
     - `status` (text) - 'pending', 'preparing', 'ready', 'served', 'cancelled'
     - `notes` (text) - Special instructions
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)
     - `user_id` (uuid) - Reference to user who created
     - `invoice_id` (uuid) - Linked invoice (nullable initially)

  2. `kot_items` - Items in each KOT
     - `id` (uuid, primary key)
     - `kot_id` (uuid) - Foreign key to kots
     - `menu_item_id` (uuid) - Foreign key to menu_items
     - `menu_item_name` (text) - Cached name
     - `quantity` (numeric)
     - `unit_price` (numeric)
     - `notes` (text) - Item-specific notes (e.g., "extra spicy")
     - `status` (text) - 'pending', 'preparing', 'ready'

  ## Security
  - Enable RLS on all tables
  - Only authenticated users can access
  - Users can only see their own organization's KOTs

  ## Important Notes
  - When a KOT is created, an invoice is automatically created
  - KOT can be edited until status is 'served' or 'cancelled'
  - KOT number format: KOT-YYYYMMDD-XXXX
  - Invoice is linked to KOT via invoice_id field
*/

-- Create kots table
CREATE TABLE IF NOT EXISTS kots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kot_number text UNIQUE NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('dine_in', 'delivery', 'take_away')),
  table_number text,
  customer_name text,
  customer_phone text,
  delivery_platform text,
  delivery_order_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT table_number_required_for_dine_in CHECK (
    (order_type != 'dine_in') OR (order_type = 'dine_in' AND table_number IS NOT NULL)
  )
);

-- Create kot_items table
CREATE TABLE IF NOT EXISTS kot_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kot_id uuid REFERENCES kots(id) ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  menu_item_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kots_user_id ON kots(user_id);
CREATE INDEX IF NOT EXISTS idx_kots_status ON kots(status);
CREATE INDEX IF NOT EXISTS idx_kots_order_type ON kots(order_type);
CREATE INDEX IF NOT EXISTS idx_kots_created_at ON kots(created_at);
CREATE INDEX IF NOT EXISTS idx_kots_invoice_id ON kots(invoice_id);
CREATE INDEX IF NOT EXISTS idx_kot_items_kot_id ON kot_items(kot_id);
CREATE INDEX IF NOT EXISTS idx_kot_items_menu_item_id ON kot_items(menu_item_id);

-- Enable Row Level Security
ALTER TABLE kots ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kots table
CREATE POLICY "Users can view own kots"
  ON kots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own kots"
  ON kots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kots"
  ON kots FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own kots"
  ON kots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for kot_items table
CREATE POLICY "Users can view kot items of own kots"
  ON kot_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kots
      WHERE kots.id = kot_items.kot_id
      AND kots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create kot items for own kots"
  ON kot_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kots
      WHERE kots.id = kot_items.kot_id
      AND kots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update kot items of own kots"
  ON kot_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kots
      WHERE kots.id = kot_items.kot_id
      AND kots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kots
      WHERE kots.id = kot_items.kot_id
      AND kots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete kot items of own kots"
  ON kot_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kots
      WHERE kots.id = kot_items.kot_id
      AND kots.user_id = auth.uid()
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for kots
DROP TRIGGER IF EXISTS update_kots_updated_at ON kots;
CREATE TRIGGER update_kots_updated_at
  BEFORE UPDATE ON kots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate KOT number
CREATE OR REPLACE FUNCTION generate_kot_number()
RETURNS text AS $$
DECLARE
  today_date text;
  sequence_num integer;
  new_kot_number text;
BEGIN
  today_date := to_char(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM kots
  WHERE kot_number LIKE 'KOT-' || today_date || '-%';
  
  new_kot_number := 'KOT-' || today_date || '-' || LPAD(sequence_num::text, 4, '0');
  
  RETURN new_kot_number;
END;
$$ LANGUAGE plpgsql;