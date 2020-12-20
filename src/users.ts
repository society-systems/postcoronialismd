import { Database } from "better-sqlite3";
import { ConstraintError, DuplicateEntity, InviteAlreadyUsed } from "./errors";
import { sha256, uint8ArrayToHexString } from "./f";

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  publicKey STRING PRIMARY KEY,
  spaceName STRING NOT NULL,
  name STRING,
  isAdmin BOOLEAN DEFAULT 0,
  invite STRING NOT NULL,

  FOREIGN KEY (spaceName) REFERENCES spaces (name) ON DELETE CASCADE,
  UNIQUE (publicKey COLLATE NOCASE),
  UNIQUE (invite COLLATE NOCASE),
  UNIQUE (name COLLATE NOCASE, spaceName COLLATE NOCASE),
  CHECK (length(name) <= 64) 
)
`;

const SQL_USERS_INSERT = `
INSERT INTO users (publicKey, spaceName, name, isAdmin, invite)
VALUES ($publicKey, $spaceName, $name, $isAdmin, $invite)
`;

const SQL_USERS_GET = `
SELECT *
FROM users
WHERE (publicKey = $publicKey)
`;

const SQL_USERS_SPACES_GET = `
SELECT
  users.name as name,
  users.isAdmin,
  spaces.name as spaceName,
  spaces.jitsiKey,
  spaces.etherpadKey
FROM
  users INNER JOIN spaces ON users.spaceName = spaces.name
WHERE
  (users.publicKey = $publicKey)
`;

const SQL_USERS_SPACES_INVITE_DETAILS = `
SELECT
  users.name as userName,
  spaces.name as spaceName
FROM
  users INNER JOIN spaces ON users.spaceName = spaces.name
WHERE
  (users.publicKey = $publicKey)
`;

const SQL_USERS_INVITE_STATUS = `
SELECT
  COUNT(*) as count
FROM
  users
WHERE
  invite = $invite
`;

export function sqlCreateTableUsers(db: Database) {
  return db.prepare(SQL_CREATE_TABLE).run();
}

export function sqlInsertUser(
  db: Database,
  publicKey: Uint8Array,
  spaceName: string,
  name: string | null,
  isAdmin: boolean,
  invite: Uint8Array
) {
  try {
    return db.prepare(SQL_USERS_INSERT).run({
      publicKey: uint8ArrayToHexString(publicKey),
      spaceName,
      name,
      isAdmin: isAdmin ? 1 : 0,
      invite: sha256(invite),
    });
  } catch (e) {
    if (
      e.toString() === "SqliteError: UNIQUE constraint failed: users.invite"
    ) {
      throw new InviteAlreadyUsed();
    } else if (
      e.toString() === "SqliteError: UNIQUE constraint failed: users.publicKey"
    ) {
      throw new DuplicateEntity();
    } else if (
      e.toString() ===
      "SqliteError: UNIQUE constraint failed: users.name, users.spaceName"
    ) {
      throw new DuplicateEntity();
    } else if (e.toString() === "SqliteError: CHECK constraint failed: users") {
      throw new ConstraintError();
    } else {
      throw e;
    }
  }
}

export function sqlGetUser(db: Database, publicKey: Uint8Array) {
  return db
    .prepare(SQL_USERS_GET)
    .get({ publicKey: uint8ArrayToHexString(publicKey) });
}

export function sqlGetSpaceByUser(db: Database, publicKey: Uint8Array) {
  return db
    .prepare(SQL_USERS_SPACES_GET)
    .get({ publicKey: uint8ArrayToHexString(publicKey) });
}

export function getInviteStatus(db: Database, invite: Uint8Array) {
  const result = db
    .prepare(SQL_USERS_INVITE_STATUS)
    .get({ invite: sha256(invite) });
  return result["count"];
}

export function getInviteDetails(db: Database, publicKey: Uint8Array) {
  return db
    .prepare(SQL_USERS_SPACES_INVITE_DETAILS)
    .get({ publicKey: uint8ArrayToHexString(publicKey) });
}

export function getSpaceByUser(db: Database, user: Uint8Array) {
  const record = sqlGetSpaceByUser(db, user);
  if (record) {
    record.isAdmin = !!record.isAdmin;
    record.name = record.name || record.publicKey;
  }
  return record;
}

export function getUser(db: Database, user: Uint8Array) {
  const record = sqlGetUser(db, user);
  if (record) {
    record.isAdmin = !!record.isAdmin;
    record.name = record.name || record.publicKey;
  }
  return record;
}

export function isAdmin(db: Database, user: Uint8Array, space: string) {
  const record = sqlGetUser(db, user);
  return !!(record && record.isAdmin);
}
