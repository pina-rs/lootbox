-- Enforce budgets in the same SQLite write transaction as each allocation.
-- Global limits also bound disposable-wallet attacks; wallet auth is not a fee.
CREATE INDEX uploads_owner ON uploads (owner);
ALTER TABLE uploads ADD COLUMN state TEXT NOT NULL DEFAULT 'ready'
	CHECK (state IN ('pending', 'ready', 'deleting'));
CREATE INDEX uploads_cleanup ON uploads (state, created_at);
CREATE INDEX lootboxes_cover ON lootboxes (cover_key);
CREATE INDEX drafts_cover ON drafts (json_extract(data_json, '$.details.coverKey'));

CREATE TRIGGER drafts_insert_budget BEFORE INSERT ON drafts
WHEN NOT EXISTS (SELECT 1 FROM drafts WHERE id = NEW.id)
BEGIN
	SELECT CASE WHEN
		(SELECT count(*) FROM drafts) >= 2000 OR
		(SELECT count(*) FROM drafts WHERE creator = NEW.creator) >= 100 OR
		(NEW.status != 'published' AND
			(SELECT count(*) FROM drafts WHERE creator = NEW.creator AND status != 'published') >= 5)
	THEN RAISE(ABORT, 'storage_quota') END;
END;

CREATE TRIGGER drafts_insert_data BEFORE INSERT ON drafts
BEGIN
	SELECT CASE WHEN length(CAST(NEW.data_json AS BLOB)) > 65536
		THEN RAISE(ABORT, 'storage_quota') END;
	SELECT CASE WHEN json_extract(NEW.data_json, '$.details.coverKey') IS NOT NULL AND
		NOT EXISTS (SELECT 1 FROM uploads WHERE key = json_extract(NEW.data_json, '$.details.coverKey')
			AND owner = NEW.creator AND state = 'ready')
		THEN RAISE(ABORT, 'upload_unavailable') END;
END;

CREATE TRIGGER drafts_update_data BEFORE UPDATE OF data_json ON drafts
BEGIN
	SELECT CASE WHEN length(CAST(NEW.data_json AS BLOB)) > 65536
		THEN RAISE(ABORT, 'storage_quota') END;
	SELECT CASE WHEN json_extract(NEW.data_json, '$.details.coverKey') IS NOT NULL AND
		NOT EXISTS (SELECT 1 FROM uploads WHERE key = json_extract(NEW.data_json, '$.details.coverKey')
			AND owner = NEW.creator AND state = 'ready')
		THEN RAISE(ABORT, 'upload_unavailable') END;
END;

CREATE TRIGGER uploads_insert_budget BEFORE INSERT ON uploads
BEGIN
	SELECT CASE WHEN NEW.size < 0 OR NEW.size > 4194304 OR
		(SELECT count(*) FROM uploads) >= 10000 OR
		(SELECT count(*) FROM uploads WHERE owner = NEW.owner) >= 20 OR
		COALESCE((SELECT sum(size) FROM uploads), 0) + NEW.size > 536870912 OR
		COALESCE((SELECT sum(size) FROM uploads WHERE owner = NEW.owner), 0) + NEW.size > 33554432
	THEN RAISE(ABORT, 'storage_quota') END;
END;

-- A deletion fence and attachment validation serialize reference changes.
CREATE TRIGGER lootboxes_insert_cover BEFORE INSERT ON lootboxes
WHEN NEW.cover_key IS NOT NULL
BEGIN
	SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM uploads
		WHERE key = NEW.cover_key AND owner = NEW.creator AND state = 'ready')
		THEN RAISE(ABORT, 'upload_unavailable') END;
END;

CREATE TRIGGER lootboxes_update_cover BEFORE UPDATE OF cover_key ON lootboxes
WHEN NEW.cover_key IS NOT NULL
BEGIN
	SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM uploads
		WHERE key = NEW.cover_key AND owner = NEW.creator AND state = 'ready')
		THEN RAISE(ABORT, 'upload_unavailable') END;
END;
