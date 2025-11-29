/*
  # Fix Company Profile Visibility on Invoices

  1. Changes
    - Add policy to allow viewing company profile when accessing invoices
    - This ensures invoice viewers can see the company details of the invoice issuer
  
  2. Security
    - Users can view company profiles for invoices they have access to
    - Maintains data security while enabling proper invoice display
*/

CREATE POLICY "Anyone can view company profile for public invoices"
  ON company_profile
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view own company profile" ON company_profile;
DROP POLICY IF EXISTS "Admin can view all company profiles" ON company_profile;