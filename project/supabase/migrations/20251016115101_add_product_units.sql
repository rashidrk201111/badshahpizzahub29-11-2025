/*
  # Add Product Units of Measurement

  1. Changes to products table
    - Add `unit` column - Unit of measurement (kg, meter, liter, piece, box, etc.)
    - Update existing products to default 'piece' unit

  2. Important Notes
    - Supports various units for raw materials and finished goods
    - Quantities will be measured in the specified unit
    - All existing inventory movements remain valid
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'unit'
  ) THEN
    ALTER TABLE products ADD COLUMN unit text DEFAULT 'piece';
  END IF;
END $$;

UPDATE products 
SET unit = 'piece'
WHERE unit IS NULL OR unit = '';