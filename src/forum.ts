import { Database } from "better-sqlite3";
import nacl from "tweetnacl";
import { Unauthorized } from "./errors";
import { sha256, uint8ArrayToHexString } from "./f";
import { getUser } from "./users";
import fs from "fs";
import path from "path";
import { sendNotifications } from "./subscriptions";

const SQL_STATEMENTS = fs.readFileSync(
  path.resolve(__dirname, "forum.sql"),
  "utf-8"
);

const SQL_SEEN_INSERT = `
INSERT OR REPLACE INTO seen (publicKey, threadId, ts)
VALUES ($publicKey, $threadId, strftime('%s', 'now'))
`;

const SQL_SEEN_DELETE = `
DELETE FROM seen
WHERE threadId = $threadId AND publicKey = $publicKey
`;

const SQL_POSTS_INSERT = `
INSERT INTO posts (id, publicKey, parentId, spaceName, title, body)
VALUES ($id, $publicKey, $parentId, $spaceName, $title, $body)
`;

const SQL_POSTS_UPDATE = `
UPDATE
    posts

SET
    title = $title,
    body = $body

WHERE
    publicKey = $publicKey
    AND id = $id
`;

const SQL_POSTS_DELETE = `
DELETE FROM posts
WHERE id = $id AND publicKey = $publicKey
`;

const SQL_POSTS_GET = `
SELECT
    posts.id,
    posts.parentId,
    posts.title,
    posts.body,
    posts.ts,
    users.name,
    users.publicKey,
    seen.ts AS seenTs

FROM
    posts
    INNER JOIN users
        ON posts.spaceName = users.spaceName
            AND posts.publicKey = users.publicKey
    LEFT OUTER JOIN seen
        ON posts.id = seen.threadId
            AND seen.publicKey = $publicKey

WHERE
    posts.id = $id
`;

const SQL_POSTS_SELECT = `
SELECT
    posts.id,
    posts.parentId,
    posts.title,
    posts.body,
    posts.ts,
    users.name,
    users.publicKey,
    seen.ts AS seenTs,
    MAX(IFNULL(replies.ts, posts.ts)) AS lastTs,
    -- MAX(IFNULL(timestamps.lastTs, posts.ts)) AS lastTs2,
    seen.ts >= MAX(IFNULL(timestamps.lastTs, posts.ts)) AS seen
    -- MAX(MAX(posts.ts), MAX(IFNULL(replies.ts, 0))) AS lastTs,
    -- seen.ts >= MAX(MAX(posts.ts), MAX(IFNULL(replies.ts, 0))) AS seen

FROM
    posts
    INNER JOIN users
        ON posts.spaceName = users.spaceName
            AND posts.publicKey = users.publicKey
    LEFT OUTER JOIN (
        SELECT posts.id, MAX(max(posts.ts), max(IFNULL(replies.ts, 0))) as lastTs
        FROM posts
        LEFT OUTER JOIN posts as replies
        ON posts.id = replies.parentId
        WHERE replies.publicKey IS NOT $publicKey
        GROUP BY posts.id
      ) AS timestamps
        ON posts.id = timestamps.id
    LEFT OUTER JOIN posts AS replies
        on posts.id = replies.parentId
    LEFT OUTER JOIN seen
        ON posts.id = seen.threadId
            AND seen.publicKey = $publicKey

WHERE
    posts.spaceName = $spaceName
    AND posts.parentId = $parentId

GROUP BY
    posts.id

ORDER BY
    -- CASE WHEN LENGTH($parentId) THEN lastTs ELSE 0 END,
    lastTs DESC

LIMIT
    $limit

OFFSET
    $offset
`;

export function sqlCreateTablePosts(db: Database) {
  db.exec(SQL_STATEMENTS);
}

export function sqlCreatePost(
  db: Database,
  id: string,
  publicKey: Uint8Array,
  spaceName: string,
  parentId: string,
  title: string,
  body: string
) {
  const result = db.prepare(SQL_POSTS_INSERT).run({
    id,
    publicKey: uint8ArrayToHexString(publicKey),
    parentId,
    spaceName,
    title,
    body,
  });
  return id;
}

export function sqlUpdatePost(
  db: Database,
  id: string,
  publicKey: Uint8Array,
  title: string,
  body: string
) {
  const result = db.prepare(SQL_POSTS_UPDATE).run({
    id,
    publicKey: uint8ArrayToHexString(publicKey),
    title,
    body,
  });
  return result;
}

export function sqlDeletePost(db: Database, user: Uint8Array, id: string) {
  return db.prepare(SQL_POSTS_DELETE).run({
    id,
    publicKey: uint8ArrayToHexString(user),
  });
}

export function sqlGetPost(db: Database, publicKey: Uint8Array, id: string) {
  return db.prepare(SQL_POSTS_GET).get({
    publicKey: uint8ArrayToHexString(publicKey),
    id,
  });
}

export function sqlGetPosts(
  db: Database,
  publicKey: Uint8Array,
  spaceName: string,
  parentId: string,
  limit: number,
  offset: number
) {
  return db.prepare(SQL_POSTS_SELECT).all({
    publicKey: uint8ArrayToHexString(publicKey),
    spaceName,
    parentId,
    limit,
    offset,
  });
}

export function sqlSeenInsert(
  db: Database,
  publicKey: Uint8Array,
  threadId: string
) {
  try {
    return db.prepare(SQL_SEEN_INSERT).run({
      publicKey: uint8ArrayToHexString(publicKey),
      threadId,
    });
  } catch (e) {
    if (e.toString() === "SqliteError: FOREIGN KEY constraint failed") {
      throw new Unauthorized();
    } else {
      throw e;
    }
  }
}

export function sqlSeenDelete(
  db: Database,
  publicKey: Uint8Array,
  threadId: string
) {
  return db.prepare(SQL_SEEN_DELETE).run({
    publicKey: uint8ArrayToHexString(publicKey),
    threadId,
  });
}

export function addPost(
  db: Database,
  user: Uint8Array,
  parentId: string,
  title: string,
  body: string
) {
  const id = sha256(nacl.randomBytes(32));
  const userData = getUser(db, user);
  if (!userData) {
    throw new Unauthorized();
  }
  sqlCreatePost(db, id, user, userData.spaceName, parentId, title, body);
  sendNotifications(
    db,
    userData.spaceName,
    uint8ArrayToHexString(user),
    `${userData.spaceName}: new post!`
  );
  return id;
}

export function editPost(
  db: Database,
  user: Uint8Array,
  id: string,
  title: string,
  body: string
) {
  const result = sqlUpdatePost(db, id, user, title, body);
  if (result.changes === 0) {
    throw new Unauthorized();
  }
  return getPost(db, user, id);
}
export function deletePost(db: Database, user: Uint8Array, id: string) {
  const result = sqlDeletePost(db, user, id);
  if (result.changes === 0) {
    throw new Unauthorized();
  }
}

export function getPost(db: Database, user: Uint8Array, id: string) {
  const userData = getUser(db, user);
  if (!userData) {
    throw new Unauthorized();
  }
  return sqlGetPost(db, user, id);
}

export function markPostAsSeen(db: Database, user: Uint8Array, id: string) {
  // Check if the user can read the post, raises `Unauthorized` otherwise.
  getPost(db, user, id);
  sqlSeenInsert(db, user, id);
}

export function markPostAsUnseen(db: Database, user: Uint8Array, id: string) {
  const result = sqlSeenDelete(db, user, id);
  if (result.changes === 0) {
    throw new Unauthorized();
  }
}

export function getPosts(
  db: Database,
  user: Uint8Array,
  parentId: string,
  limit: number,
  offset: number
) {
  const userData = getUser(db, user);
  if (!userData) {
    throw new Unauthorized();
  }
  return sqlGetPosts(db, user, userData.spaceName, parentId, limit, offset);
}
