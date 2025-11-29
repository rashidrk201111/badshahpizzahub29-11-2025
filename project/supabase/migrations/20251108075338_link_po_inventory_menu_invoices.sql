/*
  # Link Purchase Orders with Inventory and Menu Items with Invoices

  ## Changes
  1. Add menu_item_id to invoice_items table
     - Links invoice items to menu items (for restaurant orders)
     - Makes product_id optional when menu_item_id is used
  
  2. Ensure purchase_items already links to products (inventory)
     - Already exists via product_id foreign key
     - Purchase orders automatically update inventory

  ## Business Logic
  - Invoice items can reference either:
    - product_id (for inventory items/retail)
    - menu_item_id (for restaurant menu items)
  - Purchase items link to products (inventory items)
  - When creating invoices, can select from both inventory and menu

  ## Notes
  - At least one of product_id or menu_item_id should be set
  - Both can be set if menu item is made from inventory product
*/

-- Add menu_item_id to invoice_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'menu_item_id'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for menu_item_id
CREATE INDEX IF NOT EXISTS idx_invoice_items_menu_item ON invoice_items(menu_item_id);

-- Add product_name and menu_item_name columns to store names even if FK is deleted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'product_name'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN product_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'menu_item_name'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN menu_item_name text;
  END IF;
END $$;

-- Update existing invoice_items to populate product_name from products
UPDATE invoice_items ii
SET product_name = p.name
FROM products p
WHERE ii.product_id = p.id
AND ii.product_name IS NULL;

-- Note: Purchase items already have product_id linking to inventory
-- This creates the connection: Purchases -> purchase_items -> products (inventory)