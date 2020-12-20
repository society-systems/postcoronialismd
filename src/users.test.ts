import { Database } from "better-sqlite3";
import nacl from "tweetnacl";
import { init } from "./db";
import { ConstraintError, DuplicateEntity, InviteAlreadyUsed } from "./errors";
import { sha256, uint8ArrayToHexString } from "./f";
import { sqlInsertSpace } from "./spaces";
import { getUser, isAdmin, sqlGetUser, sqlInsertUser } from "./users";

describe("SQL constraints for Users", () => {
  let db: Database;

  beforeEach(() => {
    db = init();
  });

  test("Inserts a new user in a space", () => {
    const princessBubblegum = nacl.sign.keyPair();
    sqlInsertSpace(db, "Candy Kingdom", "jitsi", "etherpad");
    sqlInsertUser(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum",
      true,
      Uint8Array.from([0])
    );
    expect(sqlGetUser(db, princessBubblegum.publicKey)).toEqual({
      publicKey: uint8ArrayToHexString(princessBubblegum.publicKey),
      spaceName: "Candy Kingdom",
      name: "Princess Bubblegum",
      isAdmin: 1,
      invite: sha256(Uint8Array.from([0])),
    });
  });

  test("User's name is limited in length", () => {
    const iceKing = nacl.sign.keyPair();
    expect(() =>
      sqlInsertUser(
        db,
        iceKing.publicKey,
        "Ice Kingdom",
        "I'm the Ice King and my name is waaaaaaaaaaaaaaaaaaaaaaaaay too long' i",
        false,
        Uint8Array.from([0])
      )
    ).toThrow(ConstraintError);
  });

  test("Raises an exception on used invites", () => {
    const finn = nacl.sign.keyPair();
    const iceKing = nacl.sign.keyPair();
    sqlInsertSpace(db, "Candy Kingdom", "jitsi", "etherpad");
    sqlInsertUser(
      db,
      finn.publicKey,
      "Candy Kingdom",
      "Finn",
      false,
      Uint8Array.from([0])
    );
    expect(() =>
      sqlInsertUser(
        db,
        iceKing.publicKey,
        "Ice Kingdom",
        "Ice King",
        false,
        Uint8Array.from([0])
      )
    ).toThrow(InviteAlreadyUsed);
  });

  test("Users' names within a space are unique", () => {
    const finn = nacl.sign.keyPair();
    const iceKing = nacl.sign.keyPair();
    sqlInsertSpace(db, "Candy Kingdom", "jitsi", "etherpad");
    sqlInsertUser(
      db,
      finn.publicKey,
      "Candy Kingdom",
      "Finn",
      false,
      Uint8Array.from([0])
    );
    expect(() =>
      sqlInsertUser(
        db,
        iceKing.publicKey,
        "Candy Kingdom",
        "Finn",
        false,
        Uint8Array.from([1])
      )
    ).toThrow(DuplicateEntity);
    expect(() =>
      sqlInsertUser(
        db,
        iceKing.publicKey,
        "candy kingdom",
        "finn",
        false,
        Uint8Array.from([1])
      )
    ).toThrow(DuplicateEntity);
  });

  test("Raises an exception if a user joins with the same public key", () => {
    const finn = nacl.sign.keyPair();
    sqlInsertSpace(db, "Candy Kingdom", "jitsi", "etherpad");
    sqlInsertSpace(db, "Ice Kingdom", "jitsi", "etherpad");
    sqlInsertUser(
      db,
      finn.publicKey,
      "Candy Kingdom",
      "Finn",
      false,
      Uint8Array.from([0])
    );
    expect(() =>
      sqlInsertUser(
        db,
        finn.publicKey,
        "Ice Kingdom",
        "Finn",
        false,
        Uint8Array.from([1])
      )
    ).toThrow(DuplicateEntity);
  });
});

describe("Generic Users functions", () => {
  let db: Database;

  beforeEach(() => {
    db = init();
  });

  test("getUser", () => {
    const someone = nacl.sign.keyPair();
    sqlInsertSpace(db, "Candy Kingdom", "jitsi", "etherpad");
    sqlInsertUser(
      db,
      someone.publicKey,
      "Candy Kingdom",
      null,
      false,
      Uint8Array.from([0])
    );
    expect(getUser(db, someone.publicKey)).toEqual({
      publicKey: uint8ArrayToHexString(someone.publicKey),
      spaceName: "Candy Kingdom",
      name: uint8ArrayToHexString(someone.publicKey),
      isAdmin: false,
      invite: sha256(Uint8Array.from([0])),
    });
  });
  test("isAdmin", () => {
    const princessBubblegum = nacl.sign.keyPair();
    const finn = nacl.sign.keyPair();
    const iceKing = nacl.sign.keyPair();
    sqlInsertSpace(db, "Candy Kingdom", "jitsi", "etherpad");
    sqlInsertUser(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum",
      true,
      Uint8Array.from([0])
    );
    sqlInsertUser(
      db,
      finn.publicKey,
      "Candy Kingdom",
      "Finn",
      false,
      Uint8Array.from([1])
    );
    expect(isAdmin(db, finn.publicKey, "Candy Kingdom")).toEqual(false);
    expect(isAdmin(db, princessBubblegum.publicKey, "Candy Kingdom")).toEqual(
      true
    );
    expect(isAdmin(db, iceKing.publicKey, "Candy Kingdom")).toEqual(false);
  });
});
