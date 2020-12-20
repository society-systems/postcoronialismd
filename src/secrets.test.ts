import { Database } from "better-sqlite3";
import nacl from "tweetnacl";
import { init } from "./db";
import { sqlInsertSecret, sqlGetSecret } from "./secrets";

describe("SQL functions Secrets", () => {
  let db: Database;

  beforeEach(() => {
    db = init();
  });

  test("A user can store and retrieve a secret", () => {
    const finn = nacl.sign.keyPair();
    const value = Buffer.from("Secret mission with Jake");
    const nonce = Buffer.from("nonce");
    sqlInsertSecret(db, finn.publicKey, value, nonce);
    expect(sqlGetSecret(db, finn.publicKey)).toEqual({ value, nonce });
  });
});
