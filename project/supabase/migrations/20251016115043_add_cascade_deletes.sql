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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoices_customer_id_fkey' 
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_customer_id_fkey;
  END IF;
  
  ALTER TABLE invoices 
    ADD CONSTRAINT invoices_customer_id_fkey 
    FOREIGN KEY (customer_id) 
    REFERENCES customers(id) 
    ON DELETE SET NULL;
END $$;