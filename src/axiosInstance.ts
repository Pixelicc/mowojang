import axios from "axios";
import { type AxiosCacheInstance, setupCache } from "axios-cache-interceptor";
import type { AxiosOptions } from "../types/index.d.ts";
import type { Logger } from "@pixelic/logger";

declare const VERSION: [string];

export default (options: AxiosOptions, logger: Logger): AxiosCacheInstance => {
  const instance = setupCache(
    axios.create({
      timeout: options?.timeout ?? 10000,
      maxRedirects: 0,
      validateStatus: (status) => status === 200 || status === 404,
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
    // @ts-expect-error
    logger.debug("Mowojang", `${req.method?.toUpperCase()} ${axios.getUri(req)}`, req.internalId);
    return req;
  });
  instance.interceptors.response.use(
    (res) => {
      if (res.cached) {
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
      const isPrimaryHost = host === "mowojang.matdoes.dev";
      const isFallbackHost = host === "mowojang.seraph.si";
      const shouldRetryWithFallback = isPrimaryHost && !err.config._retry;

      if (shouldRetryWithFallback) {
        /**
         * If Mowojang (mowojang.matdoes.dev) is down, this falls back to Seraph (mowojang.seraph.si).
         * This gets ignored if a different `baseURL` is passed in the initial config.
         */
        err.config._retry = true;
        err.config.url = fullURL.replace("mowojang.matdoes.dev", "mowojang.seraph.si");
        if (err.config.baseURL) delete err.config.baseURL;
      }

      /**
       * Logging fallback for a different `baseURL` passed in the initial config.
       */
      logger.critical("Mowojang", `Failed to establish connection to ${host}`, err.config.internalId);

      const shouldFallback = shouldRetryWithFallback && options.fallback;
      if (shouldFallback) {
        logger.info("Mowojang", `Retrying request with fallback of mowojang.seraph.si`, err.config.internalId);
      }
      if (isPrimaryHost || isFallbackHost) {
        const service = isFallbackHost ? "Seraph" : "Mowojang";
        logger.info("Mowojang", `Check Status of ${service} on: https://mowojang-status.pixelic.dev`);
      }

      if (shouldFallback) return instance(err.config);
      return Promise.reject(err);
    },
  );
  return instance;
};
