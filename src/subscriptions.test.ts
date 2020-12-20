import { Database } from "better-sqlite3";
import nacl from "tweetnacl";
import { init } from "./db";
import { sha256, uint8ArrayToHexString } from "./f";
import { sqlInsertSpace } from "./spaces";
import {
  sqlDeleteSubscription,
  sqlGetSubscriptionsBySpace,
  sqlInsertSubscription,
} from "./subscriptions";
import { sqlInsertUser } from "./users";

describe("Subscriptions", () => {
  let db: Database;

  const finn = nacl.sign.keyPair();
  const jake = nacl.sign.keyPair();

  const finnSubscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/finn",
    expirationTime: null,
    keys: {
      p256dh: "BPvSNUb",
      auth: "6AknBV",
    },
  };

  const jakeSubscription = {
    endpoint: "https://updates.push.services.mozilla.com/wpush/jake",
    expirationTime: null,
    keys: {
      p256dh: "abc",
      auth: "def",
    },
  };
  beforeEach(() => {
    db = init();
    sqlInsertSpace(db, "Candy Kingdom", "a", "b");
    sqlInsertUser(
      db,
      finn.publicKey,
      "Candy Kingdom",
      "Finn",
      false,
      finn.publicKey
    );
    sqlInsertUser(
      db,
      jake.publicKey,
      "Candy Kingdom",
      "Jake",
      false,
      jake.publicKey
    );
  });

  test("Create a subscription", () => {
    sqlInsertSubscription(db, finn.publicKey, finnSubscription);
    const subscriptions = sqlGetSubscriptionsBySpace(db, "Candy Kingdom");
    expect(subscriptions.length).toEqual(1);
    expect(subscriptions[0]).toEqual({
      publicKey: uint8ArrayToHexString(finn.publicKey),
      subscription: finnSubscription,
    });
  });

  test("Delete a subscription", () => {
    sqlInsertSubscription(db, finn.publicKey, finnSubscription);
    sqlDeleteSubscription(db, finnSubscription);
    const subscriptions = sqlGetSubscriptionsBySpace(db, "Candy Kingdom");
    expect(subscriptions.length).toEqual(0);
  });

  test("Get all subscriptions", () => {
    sqlInsertSubscription(db, finn.publicKey, finnSubscription);
    sqlInsertSubscription(db, jake.publicKey, jakeSubscription);
    const subscriptions = sqlGetSubscriptionsBySpace(db, "Candy Kingdom");
    expect(subscriptions.length).toEqual(2);
    expect(subscriptions[0]).toEqual({
      publicKey: uint8ArrayToHexString(finn.publicKey),
      subscription: finnSubscription,
    });
    expect(subscriptions[1]).toEqual({
      publicKey: uint8ArrayToHexString(jake.publicKey),
      subscription: jakeSubscription,
    });
  });
});
