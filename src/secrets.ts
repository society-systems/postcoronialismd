import { Database } from "better-sqlite3";
import nacl from "tweetnacl";
import {
  ConstraintError,
  DuplicateEntity,
  InvalidInviteSignature as InvalidSigner,
  InvalidSignature,
  InviteExpired,
} from "./errors";
import { sha256, uint32toUint8Array, uint8ArrayToUint32 } from "./f";
import { getUser, sqlInsertUser } from "./users";

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS secrets (
  publicKey STRING PRIMARY KEY,
  value BLOB NOT NULL,
  nonce BLOB NOT NULL
)
`;

const SQL_SECRETS_GET = `
SELECT value, nonce
FROM secrets
WHERE (publicKey = $publicKey)
`;

const SQL_SECRETS_INSERT = `
INSERT OR REPLACE INTO secrets (publicKey, value, nonce)
VALUES ($publicKey, $value, $nonce)
`;

export function sqlCreateTableSecrets(db: Database) {
  return db.prepare(SQL_CREATE_TABLE).run();
}

export function sqlInsertSecret(
  db: Database,
  publicKey: Uint8Array,
  value: Uint8Array,
  nonce: Uint8Array
) {
  return db.prepare(SQL_SECRETS_INSERT).run({ publicKey, value, nonce });
}

export function sqlGetSecret(db: Database, publicKey: Uint8Array) {
  return db.prepare(SQL_SECRETS_GET).get({ publicKey });
}

export function getSecret(db: Database, user: Uint8Array) {
  return sqlGetSecret(db, user);
}

export function setSecret(
  db: Database,
  user: Uint8Array,
  value: Uint8Array,
  nonce: Uint8Array
) {
  return sqlInsertSecret(db, user, value, nonce);
}
