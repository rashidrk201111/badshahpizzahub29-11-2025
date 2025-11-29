/*
  # Add WhatsApp Number to Company Profile

  1. Changes
    - Add `whatsapp_number` column to `company_profile` table
    - Column stores WhatsApp number for sending invoice messages
  
  2. Details
    - Field is optional (nullable)
    - Text type to accommodate various phone number formats
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_profile' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE company_profile ADD COLUMN whatsapp_number text;
  END IF;
END $$;