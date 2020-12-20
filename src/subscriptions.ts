import { Database } from "better-sqlite3";
import webpush from "web-push";
import { sha256, uint8ArrayToHexString } from "./f";

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS subscriptions (
  id STRING PRIMARY KEY,
  publicKey STRING,
  subscription TEXT,

  FOREIGN KEY (publicKey) REFERENCES users (publicKey) ON DELETE CASCADE
)
`;

const SQL_SUBSCRIPTIONS_INSERT = `
INSERT INTO subscriptions (id, publicKey, subscription)
VALUES ($id, $publicKey, $subscription)
`;

const SQL_SUBSCRIPTIONS_DELETE = `
DELETE FROM subscriptions
WHERE id = $id
`;

const SQL_SUBSCRIPTIONS_GET_BY_SPACE = `
SELECT subscriptions.publicKey, subscriptions.subscription
FROM subscriptions
INNER JOIN users ON (subscriptions.publicKey = users.publicKey)
WHERE (users.spaceName = $spaceName)
`;

export function sqlCreateTableSubscriptions(db: Database) {
  return db.prepare(SQL_CREATE_TABLE).run();
}

export function sqlInsertSubscription(
  db: Database,
  publicKey: Uint8Array,
  subscription: any
) {
  const endpoint = subscription.endpoint;
  const id = sha256(endpoint);
  return db.prepare(SQL_SUBSCRIPTIONS_INSERT).run({
    id,
    publicKey: uint8ArrayToHexString(publicKey),
    subscription: JSON.stringify(subscription),
  });
}

export function sqlDeleteSubscription(db: Database, subscription: any) {
  const endpoint = subscription.endpoint;
  const id = sha256(endpoint);
  return db.prepare(SQL_SUBSCRIPTIONS_DELETE).run({ id });
}

export function sqlGetSubscriptionsBySpace(db: Database, spaceName: string) {
  return db
    .prepare(SQL_SUBSCRIPTIONS_GET_BY_SPACE)
    .all({
      spaceName,
    })
    .map((record) => ({
      publicKey: record.publicKey,
      subscription: JSON.parse(record.subscription),
    }));
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export function addSubscription(
  db: Database,
  user: Uint8Array,
  subscription: any
) {
  sqlInsertSubscription(db, user, subscription);
}

export async function sendNotifications(
  db: Database,
  spaceName: string,
  user: string,
  message: string
) {
  const records = sqlGetSubscriptionsBySpace(db, spaceName);
  for (let { publicKey, subscription } of records) {
    if (publicKey !== user) {
      console.log("Send notification to", publicKey);
      try {
        await webpush.sendNotification(subscription, message);
      } catch (e) {
        if (e.statusCode === 410) {
          console.log("Subscription no longer valid");
          sqlDeleteSubscription(db, subscription);
        } else {
          console.log(e);
        }
      }
    }
  }
}
