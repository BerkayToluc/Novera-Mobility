-- The frequently asked questions now live in the web app's message files (G's decision, 27 October 2026):
-- GET /faq is gone, so the table and its two enums go with it.
-- DropTable
DROP TABLE "FaqItem";

-- DropEnum
DROP TYPE "FaqAudience";

-- DropEnum
DROP TYPE "FaqTopic";
