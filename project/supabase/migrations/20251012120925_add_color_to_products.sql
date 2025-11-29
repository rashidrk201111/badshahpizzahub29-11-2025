/*
  # Add color field to products

  1. Changes
    - Add `color` column to `products` table (text, nullable)
    - This allows storing color information for products
    - Color will be displayed on barcode labels

  2. Notes
    - Column is nullable to support existing products
    - No default value to allow flexibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'color'
  ) THEN
    ALTER TABLE products ADD COLUMN color text;
  END IF;
END $$;