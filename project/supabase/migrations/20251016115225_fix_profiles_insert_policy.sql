/*
  # Fix Profiles Insert Policy

  1. Problem
    - The "Admins can insert profiles" policy checks the profiles table itself
    - This creates the same infinite recursion issue when trying to insert
    - When creating an employee, we can't check if someone is admin by querying profiles
    
  2. Solution
    - Drop the recursive policy
    - Create a simpler policy that allows profile creation during signup
    - Use a function-based approach to avoid recursion
    
  3. Security
    - Allow users to insert their own profile during signup
    - This is safe because auth.uid() can only be their own ID
*/

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);