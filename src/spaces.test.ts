import { Database } from "better-sqlite3";
import nacl from "tweetnacl";
import { init } from "./db";
import { ConstraintError, DuplicateEntity, InviteAlreadyUsed } from "./errors";
import { sha256, uint8ArrayToHexString } from "./f";
import {
  createSpace,
  hasSpace,
  invite,
  join,
  sqlGetSpace,
  sqlInsertSpace,
} from "./spaces";
import {
  getInviteStatus,
  getSpaceByUser,
  getUser,
  sqlGetSpaceByUser,
} from "./users";

describe("SQL constraints for Spaces", () => {
  let db: Database;

  beforeEach(() => {
    db = init();
  });

  test("Create a space", () => {
    sqlInsertSpace(db, "Candy Kingdom", "jitsi", "etherpad");
    expect(sqlGetSpace(db, "Candy Kingdom")).toEqual({
      name: "Candy Kingdom",
      jitsiKey: "jitsi",
      etherpadKey: "etherpad",
    });
  });

  test("Name is limited in length", () => {
    expect(() =>
      sqlInsertSpace(
        db,
        "This is the Ice Kingoooooooooooooooooooooooooooooooooooooooooooooooooooom",
        "jisti",
        "etherpad"
      )
    ).toThrow(ConstraintError);
  });

  test("Space name is unique", () => {
    sqlInsertSpace(db, "Candy Kingdom", "jisti", "etherpad");
    expect(() =>
      sqlInsertSpace(db, "Candy Kingdom", "jisti", "etherpad")
    ).toThrow(DuplicateEntity);
    expect(() =>
      sqlInsertSpace(db, "candy kingdom", "jisti", "etherpad")
    ).toThrow(DuplicateEntity);
  });
});

describe("Spaces functions", () => {
  let db: Database;

  beforeEach(() => {
    db = init();
  });

  test("A user can create a new space and become admin", () => {
    const princessBubblegum = nacl.sign.keyPair();
    createSpace(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum"
    );
    expect(getUser(db, princessBubblegum.publicKey)).toEqual({
      publicKey: uint8ArrayToHexString(princessBubblegum.publicKey),
      spaceName: "Candy Kingdom",
      name: "Princess Bubblegum",
      isAdmin: true,
      invite: sha256(princessBubblegum.publicKey),
    });
  });

  test("An admin can invite other members", () => {
    const princessBubblegum = nacl.sign.keyPair();
    const finn = nacl.sign.keyPair();
    createSpace(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum"
    );
    const candyKingdomSpace = sqlGetSpace(db, "Candy Kingdom");
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const finnInvite = invite(princessBubblegum.secretKey, false, expiry);
    join(db, finn.publicKey, "Finn", finnInvite);
    expect(getUser(db, finn.publicKey)).toEqual({
      publicKey: uint8ArrayToHexString(finn.publicKey),
      spaceName: "Candy Kingdom",
      name: "Finn",
      isAdmin: false,
      invite: sha256(finnInvite),
    });
    expect(getSpaceByUser(db, finn.publicKey)).toEqual({
      name: "Finn",
      isAdmin: false,
      spaceName: "Candy Kingdom",
      jitsiKey: candyKingdomSpace.jitsiKey,
      etherpadKey: candyKingdomSpace.etherpadKey,
    });
  });

  test("Invites cannot be reused", () => {
    const princessBubblegum = nacl.sign.keyPair();
    const finn = nacl.sign.keyPair();
    const iceKing = nacl.sign.keyPair();
    createSpace(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum"
    );
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const finnInvite = invite(princessBubblegum.secretKey, false, expiry);
    join(db, finn.publicKey, "Finn", finnInvite);
    expect(() => join(db, iceKing.publicKey, "Ice King", finnInvite)).toThrow(
      InviteAlreadyUsed
    );
  });

  test("Return the status of an invite", () => {
    const princessBubblegum = nacl.sign.keyPair();
    const finn = nacl.sign.keyPair();
    const iceKing = nacl.sign.keyPair();
    createSpace(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum"
    );
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const finnInvite = invite(princessBubblegum.secretKey, false, expiry);
    expect(getInviteStatus(db, finnInvite)).toEqual(0);
    join(db, finn.publicKey, "Finn", finnInvite);
    expect(getInviteStatus(db, finnInvite)).toEqual(1);
    expect(() => join(db, iceKing.publicKey, "Ice King", finnInvite)).toThrow(
      InviteAlreadyUsed
    );
  });

  test("Given the name of a space, a user can know if it exists or not", () => {
    const princessBubblegum = nacl.sign.keyPair();
    const finn = nacl.sign.keyPair();
    createSpace(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum"
    );
    expect(hasSpace(db, "Candy Kingdom")).toEqual(true);
    expect(hasSpace(db, "Ice Kingdom")).toEqual(false);
  });
});
