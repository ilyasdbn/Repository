/*
# Add discount_reason and grab_adjusted_total to orders table

1. Modified Tables
- `orders`:
  - `discount_reason` (text, not null, default '') — reason for the discount applied
  - `grab_adjusted_total` (numeric, nullable) — adjusted total when Grab pricing differs

2. Security
- No changes to RLS policies.
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS grab_adjusted_total numeric NULL;
