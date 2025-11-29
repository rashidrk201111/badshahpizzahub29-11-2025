/*
  # Add Delivery Fields to KOTs

  1. Changes
    - Add `delivery_platform` column to store delivery partner name
    - Add `delivery_order_id` column to store platform order ID
    - Add `invoice_id` column to link KOT to invoice
    
  2. Notes
    - These fields are nullable and only used for delivery orders
    - Delivery platform can be 'zomato', 'swiggy', 'jedlo', 'crisf_food', or custom
*/

-- Add delivery platform columns to kots table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kots' AND column_name = 'delivery_platform'
  ) THEN
    ALTER TABLE kots 
    ADD COLUMN delivery_platform text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kots' AND column_name = 'delivery_order_id'
  ) THEN
    ALTER TABLE kots 
    ADD COLUMN delivery_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kots' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE kots 
    ADD COLUMN invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;