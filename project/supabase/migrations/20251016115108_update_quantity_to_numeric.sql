/*
  # Update quantity fields to support decimal values

  1. Changes to products table
    - Change `quantity` from integer to numeric to support decimal values (e.g., 2.5 kg, 10.75 meters)
    - Change `reorder_level` from integer to numeric to support decimal reorder levels

  2. Important Notes
    - Supports fractional quantities for raw materials measured in kg, meters, liters, etc.
    - All existing integer values remain valid
*/

ALTER TABLE products 
ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

ALTER TABLE products 
ALTER COLUMN reorder_level TYPE numeric USING reorder_level::numeric;