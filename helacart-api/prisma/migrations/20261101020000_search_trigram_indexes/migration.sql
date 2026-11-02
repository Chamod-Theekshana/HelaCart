-- Trigram indexes for substring search. Each expression must match the query
-- text exactly for PostgreSQL to use the index:
--   * src/catalog/catalog.service.ts publicProducts:   "title" ILIKE '%q%'
--   * src/discovery/discovery.service.ts suggest:      "title"/"brand" ILIKE, Seller/Category "name" ILIKE
--   * src/discovery/catalog-query.ts browseCatalog:    the concatenated product text below ILIKE '%term%',
--     plus Seller/Category "name" ILIKE '%term%' sub-selects
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx" ON "Product" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_brand_trgm_idx" ON "Product" USING GIN ("brand" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_search_text_trgm_idx" ON "Product" USING GIN (
  (coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("brand", '') || ' ' || coalesce("sku", '')) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS "Seller_name_trgm_idx" ON "Seller" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Category_name_trgm_idx" ON "Category" USING GIN ("name" gin_trgm_ops);
