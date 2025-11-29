/*
  # Add Payment Methods Table
  
  This table is required by invoice_payments and purchase_payments tables
*/

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert payment methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default payment methods
INSERT INTO payment_methods (name) VALUES 
  ('Cash'),
  ('Bank Transfer'),
  ('Credit Card'),
  ('Debit Card'),
  ('UPI'),
  ('Cheque')
ON CONFLICT DO NOTHING;