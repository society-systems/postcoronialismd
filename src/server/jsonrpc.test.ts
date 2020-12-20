import jayson from "jayson";
import nacl from "tweetnacl";
import { default as express, json as jsonParser } from "express";
import request from "supertest";
import { uint8ArrayToHexString } from "../f";
import { IRPCContext, jsonrpc, verifySignature } from "./jsonrpc";

describe("JSONRPC", () => {
  const server = new jayson.Server(
    {
      signer: (args: any, rpcContext: IRPCContext, callback: Function) => {
        if (rpcContext.user) {
          callback(null, uint8ArrayToHexString(rpcContext.user));
        }
        callback(null, "");
      },
    },
    { useContext: true }
  );

  const app = express();
  app.use(jsonParser({ verify: verifySignature }));
  app.use(jsonrpc(server));

  test("extracts the public key from a valid signed message", async () => {
    const keyPair = nacl.sign.keyPair();
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "signer",
      id: 1,
    });
    const signature = nacl.sign.detached(Buffer.from(body), keyPair.secretKey);
    const res = await request(app)
      .post("/")
      .send(body)
      .set("content-type", "application/json")
      .set("psst-public-key", uint8ArrayToHexString(keyPair.publicKey))
      .set("psst-signature", uint8ArrayToHexString(signature))
      .expect(200);

    expect(res.body.result).toEqual(uint8ArrayToHexString(keyPair.publicKey));
  });

  test("rejects wrong data", async () => {
    const keyPair = nacl.sign.keyPair();
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "signer",
      id: 1,
    });
    const signature = nacl.sign.detached(Buffer.from(body), keyPair.secretKey);
    await request(app)
      .post("/")
      .send(body)
      .set("content-type", "application/json")
      .set("psst-public-key", uint8ArrayToHexString(keyPair.publicKey.slice(1)))
      .set("psst-signature", uint8ArrayToHexString(signature))
      .expect(403);
  });

  test("rejects a bad signature", async () => {
    const keyPair = nacl.sign.keyPair();
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "signer",
      id: 1,
    });
    const signature = nacl.sign.detached(Buffer.from(body), keyPair.secretKey);
    await request(app)
      .post("/")
      .send(body)
      .set("content-type", "application/json")
      .set(
        "psst-public-key",
        uint8ArrayToHexString(nacl.sign.keyPair().publicKey)
      )
      .set("psst-signature", uint8ArrayToHexString(signature))
      .expect(403);
  });

  test("doesn't set a public key if no headers provided", async () => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "signer",
      id: 1,
    });
    const res = await request(app)
      .post("/")
      .send(body)
      .set("content-type", "application/json")
      .expect(200);

    expect(res.body.result).toEqual("");
  });
});
