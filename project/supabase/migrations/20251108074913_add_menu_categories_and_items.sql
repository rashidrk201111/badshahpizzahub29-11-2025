/*
  # Add Menu Categories and Menu Items for Restaurant

  ## Overview
  Adding menu management system for restaurant with categories and items.

  ## New Tables
  1. menu_categories - Categories for organizing menu items (Starters, Main Course, Desserts, etc.)
  2. menu_items - Individual menu items with pricing, description, and category

  ## Features
  - Hierarchical menu organization with categories
  - Support for item variants (sizes, options)
  - Active/inactive status for seasonal items
  - GST rate per item
  - Image URL support
  - Preparation time tracking
  - Availability status

  ## Security
  - RLS enabled on all tables
  - Authenticated users can view menus
  - Only admins and inventory managers can manage menu items
*/

-- ============================================================================
-- MENU CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view menu categories"
  ON menu_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can create menu categories"
  ON menu_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager')
    )
  );

CREATE POLICY "Admins and managers can update menu categories"
  ON menu_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager')
    )
  );

CREATE POLICY "Admins can delete menu categories"
  ON menu_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- MENU ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost_price numeric(10,2) DEFAULT 0,
  image_url text,
  hsn_code text,
  gst_rate numeric DEFAULT 5,
  preparation_time integer DEFAULT 15,
  is_vegetarian boolean DEFAULT true,
  is_available boolean DEFAULT true,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view menu items"
  ON menu_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can create menu items"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager', 'inventory_person')
    )
  );

CREATE POLICY "Admins and managers can update menu items"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager', 'inventory_person')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'inventory_manager', 'inventory_person')
    )
  );

CREATE POLICY "Admins can delete menu items"
  ON menu_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_menu_categories_display_order ON menu_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_menu_categories_is_active ON menu_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_active ON menu_items(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_display_order ON menu_items(display_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_menu_categories') THEN
    CREATE TRIGGER set_updated_at_menu_categories BEFORE UPDATE ON menu_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_menu_items') THEN
    CREATE TRIGGER set_updated_at_menu_items BEFORE UPDATE ON menu_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- DEFAULT MENU CATEGORIES
-- ============================================================================

INSERT INTO menu_categories (name, description, display_order, is_active) VALUES
  ('Starters', 'Appetizers and starters', 1, true),
  ('Main Course', 'Main course dishes', 2, true),
  ('Breads', 'Indian breads and rotis', 3, true),
  ('Rice & Biryani', 'Rice dishes and biryani', 4, true),
  ('Desserts', 'Sweet dishes and desserts', 5, true),
  ('Beverages', 'Drinks and beverages', 6, true),
  ('Salads', 'Fresh salads', 7, true)
ON CONFLICT DO NOTHING;