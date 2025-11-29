/*
  # Add Inventory Type Classification

  1. Changes to products table
    - Add `inventory_type` column - 'raw_material' or 'finished_product'
    - Default existing products to 'finished_product'

  2. Important Notes
    - Raw materials are typically added through purchase orders
    - Finished products are manufactured or ready-to-sell items
    - This allows separate management of raw materials and finished goods
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'inventory_type'
  ) THEN
    ALTER TABLE products ADD COLUMN inventory_type text DEFAULT 'finished_product';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_inventory_type_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_inventory_type_check 
      CHECK (inventory_type IN ('raw_material', 'finished_product'));
  END IF;
END $$;

UPDATE products 
SET inventory_type = 'finished_product'
WHERE inventory_type IS NULL OR inventory_type = '';