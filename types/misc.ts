import { LoggerConfig } from "@pixelic/logger";
import type { CacheOptions, CacheRequestConfig } from "axios-cache-interceptor";

export type ClientOptions = {
  logger?: LoggerConfig;
  validation?: ValidationOptions;
  timeout?: number;
  cache?: CacheOptions;
  baseURL?: string;
  fallback?: boolean;
};

export type AxiosOptions = {
  timeout?: number;
  cache?: CacheOptions;
  fallback: boolean;
};

export type ValidationOptions = {
  enabled?: boolean;
  minimumUsernameLength?: 1 | 2;
};

export type MowojangRequestConfig = {
  validation?: ValidationOptions;
  cache?: CacheRequestConfig<any, any>["cache"];
};

export type MowojangError = "INVALID_PLAYER";

export type MowojangResponse<D, E extends MowojangError | undefined> = Promise<
  | {
      data: D;
      error: null;
    }
  | {
      data: null;
      error: E extends undefined ? "UNKNOWN_ERROR" | "INVALID_INPUT" : E | "UNKNOWN_ERROR" | "INVALID_INPUT";
    }
>;
