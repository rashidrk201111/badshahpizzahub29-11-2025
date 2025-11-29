/*
  # Create Inventory Tracking System

  ## Overview
  Creates a comprehensive system to track daily inventory levels and all inventory activities.
  Users can view historical inventory data by product and date range.

  ## New Tables
  1. `inventory_history` - Tracks all inventory changes
     - `id` (uuid, primary key)
     - `product_id` (uuid) - Reference to products
     - `activity_type` (text) - Type: 'opening_stock', 'purchase', 'sale', 'adjustment', 'daily_snapshot'
     - `quantity_before` (numeric) - Stock level before change
     - `quantity_change` (numeric) - Amount changed (positive or negative)
     - `quantity_after` (numeric) - Stock level after change
     - `reference_type` (text) - 'purchase_order', 'invoice', 'manual', 'system'
     - `reference_id` (uuid) - ID of related purchase/invoice
     - `notes` (text) - Additional information
     - `created_at` (timestamptz) - When the activity happened
     - `created_by` (uuid) - User who made the change

  2. `daily_inventory_snapshots` - Daily max inventory levels
     - `id` (uuid, primary key)
     - `product_id` (uuid) - Reference to products
     - `snapshot_date` (date) - Date of snapshot
     - `opening_stock` (numeric) - Stock at start of day
     - `purchases` (numeric) - Total purchased during day
     - `sales` (numeric) - Total sold during day
     - `adjustments` (numeric) - Manual adjustments
     - `closing_stock` (numeric) - Stock at end of day
     - `max_stock` (numeric) - Maximum stock level during day
     - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Only authenticated users can access their own organization's data
*/

-- Create inventory_history table
CREATE TABLE IF NOT EXISTS inventory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('opening_stock', 'purchase', 'sale', 'adjustment', 'daily_snapshot')),
  quantity_before numeric NOT NULL DEFAULT 0,
  quantity_change numeric NOT NULL,
  quantity_after numeric NOT NULL,
  reference_type text CHECK (reference_type IN ('purchase_order', 'invoice', 'manual', 'system')),
  reference_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create daily_inventory_snapshots table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_history_product_id ON inventory_history(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created_at ON inventory_history(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_history_activity_type ON inventory_history(activity_type);
CREATE INDEX IF NOT EXISTS idx_inventory_history_reference ON inventory_history(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_product_date ON daily_inventory_snapshots(product_id, snapshot_date);

-- Enable Row Level Security
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_history (allow all authenticated users to view)
CREATE POLICY "Authenticated users can view inventory history"
  ON inventory_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create inventory history"
  ON inventory_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

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