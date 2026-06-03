import { dashUUID, undashUUID } from "./utils.js";
import { validatePlayer, validateUUID, validateUsername } from "./validators.js";
import { buildStorage, buildMemoryStorage } from "axios-cache-interceptor";

export type * from "../types/index.d.ts";

export { default as Client } from "./client.js";

export const validate = {
  player: validatePlayer,
  UUID: validateUUID,
  username: validateUsername,
};

export const utils = {
  dashUUID,
  undashUUID,
};

export const cache = {
  buildStorage,
  buildMemoryStorage,
};
