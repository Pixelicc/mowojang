export { default as Client } from "./client.js";
import { dashUUID, undashUUID } from "./utils.js";
import { validatePlayer, validateUUID, validateUsername } from "./validators.js";
import { buildStorage, buildMemoryStorage } from "axios-cache-interceptor";

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
