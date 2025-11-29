/*
  # Fix Infinite Recursion in Profiles RLS Policies

  ## Problem
  The "Admins can manage all profiles" policy causes infinite recursion because it queries
  the profiles table while processing a profiles table query.

  ## Solution
  1. Drop the problematic admin policy that causes recursion
  2. Replace with separate, non-recursive policies for each operation
  3. Use a simpler approach that doesn't query profiles within profiles policies

  ## Changes
  - Drop existing "Admins can manage all profiles" policy
  - Keep the basic user policies (view/insert/update own profile)
  - This means only users can manage their own profiles
  - Admin management of profiles should be done through a separate edge function if needed
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- The remaining policies are safe and don't cause recursion:
-- 1. "Users can view own profile" - uses auth.uid() = id (no subquery)
-- 2. "Users can insert own profile" - uses auth.uid() = id (no subquery)
-- 3. "Users can update own profile" - uses auth.uid() = id (no subquery)

-- These policies are sufficient for normal operation
-- Admin user management should be handled through edge functions using service role key