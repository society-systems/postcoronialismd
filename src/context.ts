import { Database } from "better-sqlite3";
import webpush from "web-push";
import { init } from "./db";

export interface IConfig {
  location: string;
  port: Number;
}

export interface IContext {
  location: string;
  port: Number;
  db: Database;
}

interface IContextWrapper {
  current?: IContext;
}

const context: IContextWrapper = {};

function getConfig(): IConfig {
  return {
    location: process.env.DB_PATH || "postcoronialism.sqlite",
    port: parseInt(process.env.PORT || "8001", 10),
  };
}

export function getContext(overrides?: IConfig) {
  // FIXME: move it somewhere else
  //webpush.setVapidDetails(
  //  "mailto:" + process.env.VAPID_EMAIL || "",
  //  process.env.VAPID_PUBLIC_KEY || "",
  //  process.env.VAPID_PRIVATE_KEY || ""
  //);

  if (!context.current || overrides) {
    const config = {
      ...getConfig(),
      ...(overrides || {}),
    };
    context.current = {
      db: init(config.location),
      ...config,
    };
  }
  return context.current;
}
