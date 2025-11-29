/*
  # Add Payment Method Fields to KOTs

  1. Changes
    - Add `payment_method` column to kots table (cash, upi, card, split)
    - Add `cash_amount` column for split payments
    - Add `upi_amount` column for split payments
    - Add `card_amount` column for split payments
    
  2. Notes
    - Default payment method is 'cash'
    - Split payment amounts are nullable (only used when payment_method is 'split')
*/

-- Add payment method columns to kots table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kots' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE kots 
    ADD COLUMN payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card', 'split'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kots' AND column_name = 'cash_amount'
  ) THEN
    ALTER TABLE kots 
    ADD COLUMN cash_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kots' AND column_name = 'upi_amount'
  ) THEN
    ALTER TABLE kots 
    ADD COLUMN upi_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kots' AND column_name = 'card_amount'
  ) THEN
    ALTER TABLE kots 
    ADD COLUMN card_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;