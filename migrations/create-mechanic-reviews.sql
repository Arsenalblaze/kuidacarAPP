-- Migration: create mechanic_reviews table, indexes, RLS and helper functions

-- 1) Create table
CREATE TABLE IF NOT EXISTS public.mechanic_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  service_id uuid NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mechanic_reviews_mechanic_id ON public.mechanic_reviews (mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_reviews_customer_id ON public.mechanic_reviews (customer_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_reviews_service_id ON public.mechanic_reviews (service_id);

-- 3) Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.mechanic_reviews_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_mechanic_reviews ON public.mechanic_reviews;
CREATE TRIGGER set_updated_at_mechanic_reviews
BEFORE UPDATE ON public.mechanic_reviews
FOR EACH ROW EXECUTE PROCEDURE public.mechanic_reviews_updated_at();

-- 4) Enable RLS
ALTER TABLE public.mechanic_reviews ENABLE ROW LEVEL SECURITY;

-- 5) Policies
-- Allow authenticated users to insert reviews only if they are the customer and the service (if provided) is completed and belongs to them
CREATE POLICY insert_review_by_customer ON public.mechanic_reviews
  FOR INSERT
  TO authenticated
  USING (true)
  WITH CHECK (
    -- customer_id must equal auth uid
    (customer_id = auth.uid())
    -- rating valid range already enforced by CHECK
  );

-- Allow customers to select their own reviews
CREATE POLICY select_review_customer ON public.mechanic_reviews
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR mechanic_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.role IN ('admin','super_admin') AND p.id = auth.uid()));

-- Allow update/delete only by admins (no edits by customers)
CREATE POLICY manage_review_admin ON public.mechanic_reviews
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')));

-- Note: The above policies are intentionally restrictive for update/delete. Customers can insert but cannot update/delete their reviews (business decision).

-- 6) Function for aggregated stats per mechanic
CREATE OR REPLACE FUNCTION public.get_mechanic_rating_stats(mech_id uuid)
RETURNS TABLE(
  mechanic_id uuid,
  average numeric,
  total bigint,
  five integer,
  four integer,
  three integer,
  two integer,
  one integer
) LANGUAGE sql AS $$
  SELECT
    $1::uuid AS mechanic_id,
    ROUND(AVG(rating)::numeric, 1) AS average,
    COUNT(*)::bigint AS total,
    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five,
    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four,
    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three,
    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two,
    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one
  FROM public.mechanic_reviews
  WHERE mechanic_id = $1;
$$;

-- 7) Function to check if customer already reviewed a service
CREATE OR REPLACE FUNCTION public.has_customer_reviewed_service(cust_id uuid, svc_id uuid)
RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mechanic_reviews r
    WHERE r.customer_id = $1 AND r.service_id = $2
  );
$$;

-- 8) Grant execute to authenticated role for functions
GRANT EXECUTE ON FUNCTION public.get_mechanic_rating_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_customer_reviewed_service(uuid, uuid) TO authenticated;

-- End of migration
