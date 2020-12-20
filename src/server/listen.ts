import jayson from "jayson";
import cors from "cors";
import { default as express, json as jsonParser } from "express";
import banner from "../banner";

import { IContext } from "../context";
import rpc from "./rpc";
import { jsonrpc, verifySignature } from "./jsonrpc";

export function listen(context: IContext) {
  const app = express();
  const server = new jayson.Server(rpc(context), { useContext: true });

  app.use(cors({ methods: ["POST"] }));
  app.use(jsonParser({ verify: verifySignature }));
  app.use(jsonrpc(server));

  console.log(banner);
  console.log("Sqlite database path:", context.location);
  console.log("JSONRPC server listening at port:", context.port);

  app.listen(context.port);
}
