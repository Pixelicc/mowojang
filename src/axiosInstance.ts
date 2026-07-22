import axios from "axios";
import { type AxiosCacheInstance, setupCache } from "axios-cache-interceptor";
import PackageJSON from "../package.json" with { type: "json" };
import type { AxiosOptions } from "../types/index.d.ts";
import type { Logger } from "@pixelic/logger";

export default (options: AxiosOptions, logger: Logger): AxiosCacheInstance => {
  const instance = setupCache(
    axios.create({
      timeout: options?.timeout ?? 10000,
      maxRedirects: 0,
      headers: {
        "User-Agent": `axios/${axios.VERSION} mowojang/${PackageJSON.version} (https://www.npmjs.com/package/mowojang)`,
        Accept: "application/json",
      },
    }),
    {
      methods: ["get", "post"],
      cacheTakeover: false,
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

      if (isConnectionError) {
        const fullURL = axios.getUri(err.config);
        const host = new URL(fullURL).host;

        /**
         * If Mowojang (mowojang.matdoes.dev) is down, this falls back to Seraph (mowojang.seraph.si).
         * This gets ignored if a different `baseURL` is passed in the initial config.
         */
        if (host === "mowojang.matdoes.dev" && !err.config._retry) {
          err.config._retry = true;
          err.config.url = fullURL.replace("mowojang.matdoes.dev", "mowojang.seraph.si");
          if (err.config.baseURL) delete err.config.baseURL;
          logger.critical("Mowojang", `Failed to establish connection to mowojang.matdoes.dev`, err.config.internalId);
          if (options.fallback) {
            logger.info("Mowojang", `Retrying request with fallback of mowojang.seraph.si`, err.config.internalId);
          }
          logger.info("Mowojang", `Check Status of Mowojang on: https://mowojang-status.pixelic.dev`);
          if (options.fallback) return instance(err.config);
        } else if (host === "mowojang.seraph.si") {
          logger.critical("Mowojang", `Failed to establish connection to mowojang.seraph.si`, err.config.internalId);
          logger.info("Mowojang", `Check Status of Seraph on: https://mowojang-status.pixelic.dev`);
        } else {
          /**
           * Logging fallback for a different `baseURL` passed in the initial config.
           */
          logger.critical("Mowojang", `Failed to establish connection to ${host}`, err.config.internalId);
        }
      }
      return Promise.reject(err);
    },
  );
  return instance;
};
