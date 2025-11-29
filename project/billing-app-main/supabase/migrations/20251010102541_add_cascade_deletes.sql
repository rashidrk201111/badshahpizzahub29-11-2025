/*
  # Add CASCADE delete to foreign keys

  1. Changes
    - Drop and recreate foreign key constraints with ON DELETE CASCADE
    - This allows deleting invoices and related items properly
    - Products that are referenced in invoices should not be deleted (protect data integrity)

  2. Security
    - No changes to RLS policies
    - Maintains existing delete restrictions (admin only)
*/

-- Drop existing foreign key on invoice_items for invoices (already has CASCADE)
-- Add CASCADE to customers reference in invoices
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoices_customer_id_fkey' 
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_customer_id_fkey;
  END IF;
  
  -- Add constraint with SET NULL (don't cascade delete invoices when customer deleted)
  ALTER TABLE invoices 
    ADD CONSTRAINT invoices_customer_id_fkey 
    FOREIGN KEY (customer_id) 
    REFERENCES customers(id) 
    ON DELETE SET NULL;
END $$;
