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
    logger.debug("Mowojang", `(${req.internalId}) ${req.method?.toUpperCase()} ${axios.getUri(req)}`);
    return req;
  });
  instance.interceptors.response.use(
    (res) => {
      if (res.cached) {
        logger.debug(
          "Mowojang",
          // @ts-expect-error
          `(${res.config.internalId}) ${res.stale ? "GET-CACHE-STALE" : "GET-CACHE"} ${axios.getUri(res.config)}`,
        );
      }
      return res;
    },
    (err) => {
      if (err.code === "ECONNRESET") {
        const host = new URL(err.config.url).host;
        var cleanHost = host;
        if (host === "mowojang.matdoes.dev") {
          cleanHost = "Mowojang";
        } else if (host === "mowojang.seraph.si") {
          cleanHost = "Seraph";
        }
        logger.critical("Mowojang", `(${err.config.internalId}) Failed to establish Connection to ${host}`);
        logger.info("Mowojang", `Check Status of ${cleanHost} on: https://mowojang-status.pixelic.dev`);
      }
      return Promise.reject(err);
    },
  );
  return instance;
};
