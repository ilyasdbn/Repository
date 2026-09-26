/*
# Create POS system tables (single-tenant, no auth)

1. New Tables
- `menu_items`: Stores the restaurant menu with item name, price, and category.
  - `id` (text, primary key)
  - `name` (text, not null)
  - `price` (numeric, not null, default 0)
  - `category` (text, not null)
  - `sort_order` (int, default 0)
  - `created_at` (timestamptz, default now())

- `orders`: Stores completed sales transactions.
  - `id` (text, primary key)
  - `timestamp` (timestamptz, not null, default now())
  - `items` (jsonb, not null, default '[]')
  - `subtotal` (numeric, not null, default 0)
  - `discount_type` (text, not null, default 'none')
  - `discount_value` (numeric, not null, default 0)
  - `discount_amount` (numeric, not null, default 0)
  - `total` (numeric, not null, default 0)
  - `payment_method` (text, not null, default 'Cash')
  - `voided_items` (jsonb, not null, default '[]')
  - `created_at` (timestamptz, default now())

2. Indexes
- `idx_orders_timestamp` on `orders(timestamp)`
- `idx_menu_items_category` on `menu_items(category)`

3. Security
- Enable RLS on both tables.
- Single-tenant POS with no sign-in — all CRUD allowed for anon + authenticated.
*/

CREATE TABLE IF NOT EXISTS menu_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  category text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'none',
  discount_value numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash',
  voided_items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Menu items policies (single-tenant, no auth)
DROP POLICY IF EXISTS "anon_select_menu" ON menu_items;
CREATE POLICY "anon_select_menu" ON menu_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_menu" ON menu_items;
CREATE POLICY "anon_insert_menu" ON menu_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_menu" ON menu_items;
CREATE POLICY "anon_update_menu" ON menu_items
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_menu" ON menu_items;
CREATE POLICY "anon_delete_menu" ON menu_items
  FOR DELETE TO anon, authenticated USING (true);

-- Orders policies (single-tenant, no auth)
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders
  FOR DELETE TO anon, authenticated USING (true);
