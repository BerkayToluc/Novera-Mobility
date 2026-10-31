-- Every table of the public schema with its exact row count (V2-45, docs/DEPLOY.md §9c). Run it on the live database and on the one a backup was
-- restored into: the two lists must be the same line for line. Reads only. The tables are named, no row is shown, so nothing personal is printed.
SELECT table_name AS "table",
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS "rows"
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
