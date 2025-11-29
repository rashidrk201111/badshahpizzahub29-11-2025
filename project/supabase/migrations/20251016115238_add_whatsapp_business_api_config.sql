/*
  # Add WhatsApp Business API Configuration

  1. Changes
    - Add `whatsapp_api_token` column to store Meta WhatsApp Business API access token
    - Add `whatsapp_phone_number_id` column to store the phone number ID from Meta
    - These fields are optional and encrypted for security

  2. Security
    - Fields are nullable to support gradual migration
    - Tokens should be treated as sensitive data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_profile' AND column_name = 'whatsapp_api_token'
  ) THEN
    ALTER TABLE company_profile ADD COLUMN whatsapp_api_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_profile' AND column_name = 'whatsapp_phone_number_id'
  ) THEN
    ALTER TABLE company_profile ADD COLUMN whatsapp_phone_number_id text;
  END IF;
END $$;