/*
  # Add Company Profile Settings

  1. New Tables
    - `company_profile`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users) - Owner of the company profile
      - `company_name` (text) - Business name
      - `gst_number` (text) - GST/Tax identification number
      - `pan_number` (text) - PAN number
      - `address_line1` (text) - Primary address
      - `address_line2` (text) - Secondary address (optional)
      - `city` (text) - City
      - `state` (text) - State/Province
      - `postal_code` (text) - Postal/ZIP code
      - `country` (text) - Country
      - `phone` (text) - Contact phone
      - `email` (text) - Business email
      - `website` (text) - Company website (optional)
      - `bank_name` (text) - Bank name for payments
      - `account_number` (text) - Bank account number
      - `ifsc_code` (text) - IFSC/routing code
      - `terms_conditions` (text) - Default invoice terms
      - `logo_url` (text) - Company logo URL (optional)
      - `created_at` (timestamptz) - Timestamp of creation
      - `updated_at` (timestamptz) - Timestamp of last update

  2. Security
    - Enable RLS on `company_profile` table
    - Add policy for authenticated users to read their own company profile
    - Add policy for authenticated users to create their own company profile
    - Add policy for authenticated users to update their own company profile
    - Add policy for admin users to view all company profiles

  3. Important Notes
    - Each user can have only one company profile (enforced by unique constraint)
    - All company details are stored in one table for simplicity
    - Logo URL can be used to store company logo from external storage
*/

CREATE TABLE IF NOT EXISTS company_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  company_name text NOT NULL DEFAULT '',
  gst_number text DEFAULT '',
  pan_number text DEFAULT '',
  address_line1 text DEFAULT '',
  address_line2 text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  postal_code text DEFAULT '',
  country text DEFAULT 'India',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  ifsc_code text DEFAULT '',
  terms_conditions text DEFAULT 'Payment due within 30 days',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company profile"
  ON company_profile
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own company profile"
  ON company_profile
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company profile"
  ON company_profile
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all company profiles"
  ON company_profile
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_company_profile_user_id ON company_profile(user_id);

CREATE OR REPLACE FUNCTION update_company_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_company_profile_updated_at
  BEFORE UPDATE ON company_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_company_profile_updated_at();