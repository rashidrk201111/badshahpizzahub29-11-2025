import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'accountant' | 'inventory_manager' | 'sales';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  gstin: string | null;
  opening_balance: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  unit: string;
  hsn_code: string | null;
  gst_rate: number;
  color: string | null;
  barcode?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  amount_paid: number;
  subtotal: number;
  tax: number;
  total: number;
  due_date: string;
  paid_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string | null;
  invoice_id: string | null;
  transaction_date: string;
  created_by: string;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string;
  gst_number: string | null;
  pan_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  terms_conditions: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}
