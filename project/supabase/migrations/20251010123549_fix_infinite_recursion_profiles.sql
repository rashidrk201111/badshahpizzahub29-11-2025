/*
  # Fix Infinite Recursion in Profiles RLS Policies

  1. Problem
    - The "Admins can view all profiles" policy queries the profiles table itself
    - This creates infinite recursion when checking if user is admin
    
  2. Solution
    - Drop the problematic policy that causes recursion
    - Keep only the "Users can view own profile" policy
    - Admins will be able to view their own profile like everyone else
    - For viewing other profiles (like in employees), we'll rely on other table policies
    
  3. Security
    - Users can view their own profile
    - Users can update their own profile
    - Admins can insert new profiles (for creating employees)
*/

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
