/*
  # Add Consumption Tracking to Inventory

  ## Overview
  Updates the inventory tracking system to log manual inventory updates as "consumption" activities.
  When a user manually reduces inventory, it will be recorded as consumption.

  ## Changes
  1. Add 'consumption' to allowed activity types
  2. Update trigger to detect manual consumption (quantity decreases)
  3. Distinguish between system adjustments and manual consumption

  ## Activity Types
  - opening_stock: Initial stock level
  - purchase: Stock added via purchase orders
  - sale: Stock removed via sales/invoices
  - consumption: Manual reduction of stock (e.g., usage, wastage, raw materials used)
  - adjustment: Other manual adjustments (increases or system corrections)
  - daily_snapshot: End of day snapshot
*/

-- Drop existing constraint and add new one with consumption
ALTER TABLE inventory_history 
  DROP CONSTRAINT IF EXISTS inventory_history_activity_type_check;

ALTER TABLE inventory_history
  ADD CONSTRAINT inventory_history_activity_type_check 
  CHECK (activity_type IN ('opening_stock', 'purchase', 'sale', 'consumption', 'adjustment', 'daily_snapshot'));

-- Update the log_inventory_change function to detect consumption
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type text;
  v_notes text;
BEGIN
  -- Log when quantity changes
  IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
    -- Determine if it's consumption or adjustment
    IF NEW.quantity < OLD.quantity THEN
      -- Quantity decreased - this is consumption
      v_activity_type := 'consumption';
      v_notes := 'Manual stock consumption/usage';
    ELSE
      -- Quantity increased - this is adjustment
      v_activity_type := 'adjustment';
      v_notes := 'Manual stock adjustment';
    END IF;

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
      v_activity_type,
      OLD.quantity,
      NEW.quantity - OLD.quantity,
      NEW.quantity,
      'manual',
      v_notes,
      auth.uid()
    );

    -- Update daily snapshot
    PERFORM update_daily_snapshot(NEW.id, v_activity_type, ABS(NEW.quantity - OLD.quantity));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the daily snapshot function to handle consumption
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
      sales = CASE WHEN p_activity_type IN ('sale', 'consumption') THEN sales + p_quantity ELSE sales END,
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
      CASE WHEN p_activity_type IN ('sale', 'consumption') THEN p_quantity ELSE 0 END,
      CASE WHEN p_activity_type = 'adjustment' THEN p_quantity ELSE 0 END,
      COALESCE(quantity, 0),
      COALESCE(quantity, 0)
    FROM products
    WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;