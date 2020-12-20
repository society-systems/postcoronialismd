-- # Tables
-- ## Posts table
CREATE TABLE IF NOT EXISTS posts (
    id STRING PRIMARY KEY,
    publicKey STRING NOT NULL,
    parentId STRING NOT NULL,
    spaceName STRING NOT NULL,
    title STRING,
    body STRING NOT NULL,
    ts DATETIME DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (publicKey) REFERENCES users (publicKey) ON DELETE CASCADE,
    FOREIGN KEY (spaceName) REFERENCES spaces (name) ON DELETE CASCADE
);

-- ## Threads table
CREATE TABLE IF NOT EXISTS threads (
    id STRING PRIMARY KEY,
    parentId STRING,
    FOREIGN KEY (parentId) REFERENCES threads (id) ON DELETE CASCADE
);

-- ## Seen table
CREATE TABLE IF NOT EXISTS seen (
    publicKey STRING NOT NULL,
    threadId STRING NOT NULL,
    ts DATETIME DEFAULT (strftime('%s', 'now')),
    UNIQUE (publicKey, threadId),
    FOREIGN KEY (publicKey) REFERENCES users (publicKey) ON DELETE CASCADE,
    FOREIGN KEY (threadId) REFERENCES posts (id) ON DELETE CASCADE
);

-- # Triggers
-- ## trigger_insert_thread
DROP TRIGGER IF EXISTS trigger_insert_thread;

CREATE TRIGGER IF NOT EXISTS trigger_insert_thread
AFTER INSERT ON posts -- First check if the parent of the new post is not a thread.
    WHEN (
        SELECT
            COUNT(*)
        FROM
            threads
        WHERE
            threads.id = NEW.parentId
    ) = 0
BEGIN
    INSERT INTO
        threads (id, parentId)
    VALUES
        (
            NEW.parentId,
            (
                SELECT
                    parentId
                FROM
                    posts
                WHERE
                    id = NEW.parentId
            )
        )
    ON CONFLICT DO NOTHING;
END;

DROP TRIGGER IF EXISTS trigger_delete_thread;

CREATE TRIGGER IF NOT EXISTS trigger_delete_thread
AFTER DELETE ON posts
    WHEN (
        WITH RECURSIVE tmp(id, parentId) AS (
            SELECT
                id,
                parentId
            FROM
                threads
            WHERE
                parentId = OLD.parentId

            UNION ALL

            SELECT
                threads.id,
                threads.parentId
            FROM
                threads
                INNER JOIN tmp ON threads.parentId = tmp.id
        )
        SELECT
            COUNT(*)
        FROM
            tmp
            INNER JOIN posts ON tmp.id = posts.parentId
    ) = 0
BEGIN
    DELETE FROM
        threads
    WHERE
        id = OLD.parentId;
END;

DROP TRIGGER IF EXISTS trigger_delete_parent_thread;

CREATE TRIGGER IF NOT EXISTS trigger_delete_parent_thread
AFTER DELETE ON threads
    WHEN (
        WITH RECURSIVE tmp(id, parentId) AS (
            SELECT
                id,
                parentId
            FROM
                threads
            WHERE
                id = OLD.parentId

            UNION ALL

            SELECT
                threads.id,
                threads.parentId
            FROM
                threads
                INNER JOIN tmp ON threads.parentId = tmp.id
        )
        SELECT
            COUNT(*)
        FROM
            tmp
            INNER JOIN posts ON tmp.id = posts.parentId
    ) = 0
BEGIN
    DELETE FROM
        threads
    WHERE
        id = OLD.parentId;
END;