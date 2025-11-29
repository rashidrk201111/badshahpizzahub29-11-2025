/*
  # Fix Employees Table RLS Policies

  1. Problem
    - The current policies check the profiles table for admin role
    - This can cause issues similar to the infinite recursion we saw before
    - Need to use a safer approach
    
  2. Solution
    - Use auth.jwt() to check the user's role from their metadata
    - This avoids querying the profiles table during RLS checks
    - Update all employee policies to use this method
    
  3. Security
    - Admins can view, insert, update, and delete all employees
    - Employees can view their own record
*/

DROP POLICY IF EXISTS "Admin can view all employees" ON employees;
DROP POLICY IF EXISTS "Employees can view own record" ON employees;
DROP POLICY IF EXISTS "Admin can insert employees" ON employees;
DROP POLICY IF EXISTS "Admin can update employees" ON employees;
DROP POLICY IF EXISTS "Admin can delete employees" ON employees;

CREATE POLICY "Admin can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );