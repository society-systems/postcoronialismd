#!/usr/bin/env node

require("dotenv").config();

import { Command } from "commander";
import webpush from "web-push";
import { getContext } from "./context";

import { listen } from "./server";

const program = new Command();

program.name("psst");
program.version("0.0.1");

program
  .command("generate-vapid-keys <email>")
  .description("output new vapid keys")
  .action((email) => {
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();
    const out = [
      "VAPID_EMAIL=" + email,
      "VAPID_PUBLIC_KEY=" + publicKey,
      "VAPID_PRIVATE_KEY=" + privateKey,
    ];
    console.log(out.join("\n"));
  });

program
  .command("daemon", { isDefault: true })
  .description("run the psst daemon")
  .action(() => {
    const context = getContext();
    listen(context);
  });

program.parse(process.argv);
