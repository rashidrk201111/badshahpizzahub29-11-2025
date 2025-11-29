/*
  # Fix cascade delete for transactions when invoice is deleted

  1. Changes
    - Drop and recreate the foreign key constraint on transactions.invoice_id
    - Add ON DELETE CASCADE so transactions are automatically deleted when invoice is deleted
    
  2. Security
    - No changes to RLS policies
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transactions_invoice_id_fkey' 
    AND table_name = 'transactions'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT transactions_invoice_id_fkey;
  END IF;
END $$;

ALTER TABLE transactions 
  ADD CONSTRAINT transactions_invoice_id_fkey 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE CASCADE;