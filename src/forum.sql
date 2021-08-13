-- # Tables
-- ## Posts table
CREATE TABLE IF NOT EXISTS posts (
    id STRING PRIMARY KEY,
    publicKey STRING NOT NULL,
    parentId STRING NULL,
    spaceName STRING NOT NULL,
    title STRING,
    body STRING NOT NULL,
    ts DATETIME DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (publicKey) REFERENCES users (publicKey) ON DELETE CASCADE,
    FOREIGN KEY (spaceName) REFERENCES spaces (name) ON DELETE CASCADE,
    FOREIGN KEY (parentId) REFERENCES posts (id) ON DELETE CASCADE
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