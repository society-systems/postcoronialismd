import { Database } from "better-sqlite3";
import nacl from "tweetnacl";
import {
  ConstraintError,
  DuplicateEntity,
  InvalidInviteSignature as InvalidSigner,
  InvalidSignature,
  InviteAlreadyUsed,
  InviteExpired,
} from "./errors";
import { sha256, uint32toUint8Array, uint8ArrayToUint32 } from "./f";
import { getInviteStatus, getUser, sqlInsertUser } from "./users";

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS spaces (
  name STRING NOT NULL PRIMARY KEY,
  jitsiKey STRING NOT NULL,
  etherpadKey STRING NOT NULL,

  UNIQUE (name COLLATE NOCASE),
  CHECK (length(name) <= 64) 
);
`;

const SQL_SPACES_GET = `
SELECT *
FROM SPACES
WHERE name = $name
`;

const SQL_SPACES_CREATE = `
INSERT INTO spaces (name, jitsiKey, etherpadKey)
VALUES ($name, $jitsiKey, $etherpadKey)
`;

export function sqlCreateTableSpaces(db: Database) {
  return db.prepare(SQL_CREATE_TABLE).run();
}

export function sqlInsertSpace(
  db: Database,
  name: string,
  jitsiKey: string,
  etherpadKey: string
) {
  try {
    if (/[\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=]/.test(name)) {
      throw new ConstraintError();
    }
    db.prepare(SQL_SPACES_CREATE).run({
      name,
      jitsiKey,
      etherpadKey,
    });
  } catch (e) {
    if (e.toString() === "SqliteError: UNIQUE constraint failed: spaces.name") {
      throw new DuplicateEntity();
    } else if (
      e.toString() === "SqliteError: CHECK constraint failed: spaces"
    ) {
      throw new ConstraintError();
    } else {
      throw e;
    }
  }
}

export function sqlGetSpace(db: Database, name: string) {
  return db.prepare(SQL_SPACES_GET).get({ name });
}

export function hasSpace(db: Database, name: string) {
  return !!sqlGetSpace(db, name);
}

// Generate an invite. An invite is 133-byte long and has the following form:
// nonce(32bytes) + role(1byte) + expiry(4bytes) + signature(64bytes) + publicKey(32bytes)
export function invite(secretKey: Uint8Array, isAdmin: boolean, expiry: Date) {
  const { publicKey } = nacl.sign.keyPair.fromSecretKey(secretKey);
  const nonce = nacl.randomBytes(32);
  const roleByte = Uint8Array.from([isAdmin ? 1 : 0]);
  const expiryBytes = uint32toUint8Array(Math.floor(expiry.getTime() / 1000));

  const message = Buffer.concat([nonce, roleByte, expiryBytes]);
  const signature = nacl.sign.detached(message, secretKey);
  return Uint8Array.from(Buffer.concat([message, signature, publicKey]));
}

export function createSpace(
  db: Database,
  user: Uint8Array,
  spaceName: string,
  name: string | null = null
) {
  const create = db.transaction(() => {
    sqlInsertSpace(
      db,
      spaceName,
      sha256(nacl.randomBytes(32)),
      sha256(nacl.randomBytes(32)).substr(0, 32) + "-keep"
    );
    sqlInsertUser(db, user, spaceName, name, true, user);
  });
  create();
}

export function verifyInvite(db: Database, invite: Uint8Array) {
  const status = getInviteStatus(db, invite);
  if (status === 1) {
    throw new InviteAlreadyUsed();
  }
  const message = invite.slice(0, 37);
  const signature = invite.slice(37, 101);
  const signer = invite.slice(101, 133);
  const nonce = invite.slice(0, 32);
  const isAdmin = invite.slice(32, 33)[0] === 1;
  const expiry = new Date(uint8ArrayToUint32(invite.slice(33, 37)) * 1000);
  const signerUser = getUser(db, signer);
  if (!signer || !signerUser || !signerUser.isAdmin) {
    throw new InvalidSigner();
  }
  if (!nacl.sign.detached.verify(message, signature, signer)) {
    throw new InvalidSignature();
  }
  if (expiry < new Date()) {
    throw new InviteExpired();
  }
  return { signer, nonce, isAdmin, expiry, space: signerUser.spaceName };
}

export function join(
  db: Database,
  user: Uint8Array,
  name: string | null,
  invite: Uint8Array
) {
  const { isAdmin, space } = verifyInvite(db, invite);
  sqlInsertUser(db, user, space, name, isAdmin, invite);
}
