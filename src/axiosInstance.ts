import axios from "axios";
import { type AxiosCacheInstance, setupCache } from "axios-cache-interceptor";
import type { AxiosOptions } from "../types/index.d.ts";
import { LogLevels, type Logger } from "@pixelic/logger";
import { undashUUID } from "./utils.js";

declare const VERSION: [string];

const PRIMARY_HOST = "mowojang.matdoes.dev";
const FALLBACK_HOST = "playerdb.co";
const PLAYERDB_LOOKUP = "https://playerdb.co/api/player/minecraft";

const isDebugEnabled = (logger: Logger): boolean => LogLevels.DEBUG >= LogLevels[logger.minLevel];

const rewriteToPlayerDB = (fullURL: string, method?: string): string | null => {
  if ((method ?? "get").toLowerCase() !== "get") return null;

  const url = new URL(fullURL);
  if (url.host !== PRIMARY_HOST) return null;

  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path.startsWith("/session/minecraft/profile/")) {
    const id = path.slice("/session/minecraft/profile/".length);
    if (!id || id.includes("/")) return null;
    return `${PLAYERDB_LOOKUP}/${id}`;
  }

  if (path.startsWith("/users/profiles/minecraft/")) {
    const id = path.slice("/users/profiles/minecraft/".length);
    if (!id || id.includes("/")) return null;
    return `${PLAYERDB_LOOKUP}/${id}`;
  }

  if (path === "/" || path.includes("/")) return null;
  return `${PLAYERDB_LOOKUP}/${path.slice(1)}`;
};

const isPlayerDBBody = (data: unknown): data is { success: boolean; data?: { player?: any } } =>
  data != null && typeof data === "object" && typeof (data as { success?: unknown }).success === "boolean";

const toMowojangShape = (body: { success: boolean; data?: { player?: any } }) => {
  const player = body.data?.player;
  if (!body.success || !player) return null;

  return {
    id: player.raw_id ?? undashUUID(String(player.id ?? "")),
    name: player.username,
    properties: player.properties ?? [],
    profileActions: [],
  };
};

export default (options: AxiosOptions, logger: Logger): AxiosCacheInstance => {
  const instance = setupCache(
    axios.create({
      timeout: options?.timeout ?? 10000,
      maxRedirects: 0,
      validateStatus: (status) => status === 200 || status === 404 || status === 400,
      headers: {
        "User-Agent": `axios/${axios.VERSION} mowojang/${VERSION[0]} (https://www.npmjs.com/package/mowojang)`,
        Accept: "application/json",
      },
    }),
    {
      methods: ["get", "post"],
      cacheTakeover: false,
      cachePredicate: {
        statusCheck: (status) => status === 200 || status === 404,
      },
      ...options?.cache,
    },
  );
  instance.interceptors.request.use((req) => {
    // @ts-expect-error
    req.internalId = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
    if (isDebugEnabled(logger)) {
      // @ts-expect-error
      logger.debug("Mowojang", `${req.method?.toUpperCase()} ${axios.getUri(req)}`, req.internalId);
    }
    return req;
  });
  instance.interceptors.response.use(
    (res) => {
      if (isPlayerDBBody(res.data)) {
        const shaped = toMowojangShape(res.data);
        if (!shaped) {
          res.status = 404;
          res.data = "";
        } else {
          res.status = 200;
          res.data = shaped;
        }
      }

      if (res.cached && isDebugEnabled(logger)) {
        logger.debug(
          "Mowojang",
          `${res.stale ? "GET-CACHE-STALE" : "GET-CACHE"} ${axios.getUri(res.config)}`,
          // @ts-expect-error
          res.config.internalId,
        );
      }
      return res;
    },
    (err) => {
      const isConnectionError =
        ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(err.code) ||
        (err?.response?.status ?? 0) >= 500;

      if (!isConnectionError) return Promise.reject(err);

      const fullURL = axios.getUri(err.config);
      const host = new URL(fullURL).host;
      const isPrimaryHost = host === PRIMARY_HOST;
      const isFallbackHost = host === FALLBACK_HOST;
      const playerDBURL = rewriteToPlayerDB(fullURL, err.config.method);
      const shouldRetryWithFallback = isPrimaryHost && !err.config._retry && playerDBURL !== null;

      if (shouldRetryWithFallback) {
        /**
         * If Mowojang (mowojang.matdoes.dev) is down, this falls back to PlayerDB (playerdb.co).
         * PlayerDB responses are reshaped to the Mojang/Mowojang format in the success interceptor.
         * This gets ignored if a different `baseURL` is passed in the initial config, and for
         * unsupported methods/paths (e.g. POST bulk).
         */
        err.config._retry = true;
        err.config.url = playerDBURL;
        if (err.config.baseURL) delete err.config.baseURL;
      }

      /**
       * Logging fallback for a different `baseURL` passed in the initial config.
       */
      logger.critical("Mowojang", `Failed to establish connection to ${host}`, err.config.internalId);

      const shouldFallback = shouldRetryWithFallback && options.fallback;
      if (shouldFallback) {
        logger.info("Mowojang", `Retrying request with fallback of playerdb.co`, err.config.internalId);
      }
      if (isPrimaryHost) {
        logger.info("Mowojang", `Check Status of Mowojang on: https://mowojang-status.pixelic.dev`);
      }
      if (isFallbackHost) {
        logger.info("Mowojang", `Check Status of PlayerDB on: https://playerdb.co`);
      }

      if (shouldFallback) return instance(err.config);
      return Promise.reject(err);
    },
  );
  return instance;
};
