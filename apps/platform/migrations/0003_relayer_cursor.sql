-- Cursor survives release of the exclusion lease and bounds each cron's scan.
CREATE TABLE relayer_cursor (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	lootbox_id INTEGER NOT NULL
);
