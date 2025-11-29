/*
  # Fix Profiles Table RLS and Update Roles

  1. Changes
    - Add policy for admins to insert new profiles (needed when creating employees)
    - Update profiles table role constraint to include new role names
    - Add admin view policy for profiles table

  2. Security
    - Admins can now create profiles for employees
    - Admins can view all profiles
    - Users can still only view and update their own profile
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'sales_person', 'inventory_person', 'purchase_person', 'accountant', 'inventory_manager', 'sales'));

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );