/*
  # Invoice Payment Tracking Enhancement

  1. Changes to Invoices Table
    - Add `amount_paid` column to track total payments received
    - Add `payment_status` column to track: 'unpaid', 'partial', 'paid', 'overdue'
    - Update existing status to support new workflow

  2. New Table: invoice_payments
    - `id` (uuid, primary key)
    - `invoice_id` (uuid, references invoices)
    - `amount` (numeric) - payment amount received
    - `payment_date` (date) - when payment was received
    - `payment_method_id` (uuid, references payment_methods)
    - `reference_number` (text) - transaction reference
    - `notes` (text) - payment notes
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  3. Security
    - Enable RLS on invoice_payments table
    - Add policies for authenticated users

  4. Important Notes
    - Partial payments are tracked separately
    - Invoice status automatically updates based on amount_paid vs total
    - Payment history is maintained for audit trail
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE invoices ADD COLUMN amount_paid numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_status text DEFAULT 'unpaid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_status_check'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_check 
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method_id uuid REFERENCES payment_methods(id),
  reference_number text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice payments"
  ON invoice_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert invoice payments"
  ON invoice_payments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own invoice payments"
  ON invoice_payments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can delete invoice payments"
  ON invoice_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

UPDATE invoices 
SET payment_status = CASE 
  WHEN status = 'paid' THEN 'paid'
  ELSE 'unpaid'
END
WHERE payment_status IS NULL OR payment_status = 'unpaid';

UPDATE invoices 
SET amount_paid = total
WHERE status = 'paid' AND amount_paid = 0;