-- V2-17 (QUALITY V-09, ADR-32): the product and service texts live only in the web app's message files. The API
-- keeps a product as a bare reference (id and slug) because QuoteRequest.productId points at it. Nothing in the web app
-- calls GET /products or /services, so the dropped columns and table are not read by anything.
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "concept",
DROP COLUMN "featured",
DROP COLUMN "sortOrder",
DROP COLUMN "techBenefits",
DROP COLUMN "title",
DROP COLUMN "whatYouGet";

-- DropTable
DROP TABLE "Service";
