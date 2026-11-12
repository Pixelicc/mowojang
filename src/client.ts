import { isAxiosError } from "axios";
import type { AxiosCacheInstance, StorageValue, NotEmptyStorageValue } from "axios-cache-interceptor";
import axiosInstance from "./axiosInstance.js";
import type {
  Player,
  Username,
  UUID,
  ClientOptions,
  ValidationOptions,
  MowojangCape,
  MowojangProfile,
  MowojangRequestConfig,
  MowojangResponse,
  MowojangSession,
  MowojangSkin,
  MowojangCache,
} from "../types/index.d.ts";
import { validateArray, validatePlayer, validateUUID } from "./validators.js";
import { undashUUID } from "./utils.js";
import { Logger } from "@pixelic/logger";

declare const VERSION: [string];

export default class Client {
  private logger: Logger;
  private axios: AxiosCacheInstance;
  private validation: ValidationOptions;
  private baseURL: string;
  public readonly cache: MowojangCache;
  public readonly version: string = VERSION[0];
  public static readonly version: string = VERSION[0];

  /**
   * Creates a new Mowojang Client Instance
   *
   * @example
   * ```TS
   * const client = new Client();
   * ```
   *
   * @example
   * ```TS
   * const client = new Client({
   *   timeout: 5000,
   *   validation: {
   *     enabled: true
   *   }
   * });
   * ```
   */
  constructor(clientOptions?: ClientOptions) {
    this.logger = new Logger(clientOptions?.logger);
    this.validation = clientOptions?.validation ?? {};
    this.baseURL = (clientOptions?.baseURL ?? "https://mowojang.matdoes.dev").toLowerCase().replace(/\/+$/, "");
    this.axios = axiosInstance({ fallback: true, ...clientOptions }, this.logger);
    this.cache = {
      clear: async () => await this._clearCache(),
      set: async (key: string, value: NotEmptyStorageValue) => await this._setCacheKey(key, value),
      get: async (key: string) => await this._getCacheKey(key),
      del: async (key: string) => await this._delCacheKey(key),
      has: async (key: string, allowStale = false) => await this._hasCacheKey(key, allowStale),
      _storage: this.axios.storage,
    };
  }

  private isPathBasedURL(): boolean {
    try {
      const path = new URL(this.baseURL).pathname.replace(/\/+$/, "");
      return path.length > 0;
    } catch {
      return false;
    }
  }

  private getProfileURL(player: string): string {
    return `${this.baseURL}/${player}`;
  }

  private getSessionURL(UUID: string): string {
    if (this.isPathBasedURL()) return this.getProfileURL(UUID);
    return `${this.baseURL}/session/minecraft/profile/${UUID}`;
  }

  private shouldValidate(config?: MowojangRequestConfig): boolean {
    return Boolean(this.validation?.enabled ?? config?.validation?.enabled);
  }

  private getValidationMinLength(config?: MowojangRequestConfig): 1 | 2 | undefined {
    return this.validation?.minimumUsernameLength ?? config?.validation?.minimumUsernameLength;
  }

  private getCacheKey(prefix: string, value: string, hash = false): string {
    if (hash) return `${prefix}:${value}`;
    const normalized = validateUUID(value)
      ? `uuid:${undashUUID(value).toLowerCase()}`
      : `username:${value.toLowerCase()}`;
    return `${prefix}:${normalized}`;
  }

  private async mirrorProfileCacheEntries(
    ID: string,
    username: Username,
    UUID: UUID,
    internalId: string,
  ): Promise<void> {
    try {
      const storage = this.axios.storage;
      if (!storage.get || !storage.set) {
        this.logger.warning(
          "Mowojang",
          `No Storage Methods available or set up for Profile Mirror to work with`,
          internalId,
        );
        return;
      }

      const value = (await storage.get(ID)) as any;
      if (!value) return;

      const usernameID = this.getCacheKey("profile", username);
      const uuidID = this.getCacheKey("profile", UUID);

      if (ID !== usernameID) {
        await storage.set(usernameID, value);
        this.logger.debug("Mowojang", `PROFILE-CACHE-MIRROR-SET ${ID} -> ${usernameID}`, internalId);
      }
      if (ID !== uuidID) {
        await storage.set(uuidID, value);
        this.logger.debug("Mowojang", `PROFILE-CACHE-MIRROR-SET ${ID} -> ${uuidID}`, internalId);
      }
    } catch (error) {
      this.logger.error("Mowojang", error instanceof Error ? error.message : "Unknown Error", internalId);
    }
  }

  private async _clearCache(): Promise<void> {
    try {
      if (this.axios.storage.clear) {
        return await this.axios.storage.clear();
      }
    } catch (error) {
      this.logger.error("Mowojang", error instanceof Error ? error.message : "Unknown Error");
    }
  }

  private async _setCacheKey(key: string, value: NotEmptyStorageValue): Promise<void> {
    try {
      if (this.axios.storage.set) {
        return await this.axios.storage.set(key, value);
      }
    } catch (error) {
      this.logger.error("Mowojang", error instanceof Error ? error.message : "Unknown Error");
    }
  }

  private async _getCacheKey(key: string): Promise<StorageValue> {
    try {
      if (this.axios.storage.get) {
        return await this.axios.storage.get(key);
      }
    } catch (error) {
      this.logger.error("Mowojang", error instanceof Error ? error.message : "Unknown Error");
    }
    return { state: "empty" };
  }

  private async _delCacheKey(key: string): Promise<void> {
    try {
      if (this.axios.storage.remove) {
        return await this.axios.storage.remove(key);
      }
    } catch (error) {
      this.logger.error("Mowojang", error instanceof Error ? error.message : "Unknown Error");
    }
  }

  private async _hasCacheKey(key: string, allowStale: boolean): Promise<boolean> {
    try {
      if (this.axios.storage.get) {
        const value = await this.axios.storage.get(key);
        if (!value) return false;
        return (
          (value.state === "cached" && "data" in value) || (allowStale && value.state === "stale" && "data" in value)
        );
      }
    } catch (error) {
      this.logger.error("Mowojang", error instanceof Error ? error.message : "Unknown Error");
    }
    return false;
  }

  /**
   * Returns an Array of Player Profiles consisting of their Usernames and UUIDs
   *
   * Players considered "INVALID" are excluded from the results
   *
   * Default cache TTL: 1 hour when config.cache is not provided.
   *
   * @example
   * ```TS
   * const profiles = await client.getProfiles(["Pixelic", "14727faefbdc4aff848cd2713eb9939e"]);
   * ```
   */
  public async getProfiles(
    players: Player[],
    config?: MowojangRequestConfig & { usePost?: boolean },
  ): MowojangResponse<MowojangProfile[], undefined> {
    try {
      if (this.shouldValidate(config) && !validateArray(players, validatePlayer, this.getValidationMinLength(config)))
        return { data: null, error: "INVALID_INPUT" };
      players = players
        .map((player) => {
          if (validateUUID(player)) return undashUUID(player);
          return player.toLowerCase();
        })
        .sort();

      const usePost = (config?.usePost ?? false) && !this.isPathBasedURL();
      if (usePost) {
        const fetchResponse = await this.axios.post(this.baseURL, players, {
          cache: config?.cache ?? { ttl: 60 * 60 * 1000 },
        });
        if (!Array.isArray(fetchResponse?.data)) return { data: null, error: "UNKNOWN_ERROR" };

        return {
          data: fetchResponse.data.map((player) => {
            return {
              UUID: player.id,
              username: player.name,
            };
          }),
          error: null,
        };
      }

      const profilePromises = players.map((player) => this.getProfile(player, config));
      const profiles = (await Promise.all(profilePromises)).filter((p) => p.data !== null).map((p) => p.data);

      return {
        data: profiles,
        error: null,
      };
    } catch {
      return { data: null, error: "UNKNOWN_ERROR" };
    }
  }

  /**
   * Returns a Player's Profile consisting of their Username and UUID
   *
   * Default cache TTL: 1 hour when config.cache is not provided.
   *
   * @example
   * ```TS
   * const profile = await client.getProfile("Pixelic");
   * ```
   */
  public async getProfile(
    player: Player,
    config?: MowojangRequestConfig,
  ): MowojangResponse<MowojangProfile, "INVALID_PLAYER"> {
    try {
      if (this.shouldValidate(config) && !validatePlayer(player, this.getValidationMinLength(config)))
        return { data: null, error: "INVALID_INPUT" };

      const fetchResponse = await this.axios.get(this.getProfileURL(player), {
        id: this.getCacheKey("profile", player),
        cache: config?.cache ?? { ttl: 60 * 60 * 1000 },
      });

      if (fetchResponse.status === 404) {
        return { data: null, error: "INVALID_PLAYER" };
      }

      if (config?.cache !== false && (typeof config?.cache !== "object" || config.cache.enabled !== false)) {
        // @ts-expect-error
        const internalId = fetchResponse.config?.internalId as string;
        await this.mirrorProfileCacheEntries(
          fetchResponse.id,
          fetchResponse.data.name,
          fetchResponse.data.id,
          internalId,
        );
      }

      return {
        data: {
          UUID: fetchResponse.data.id,
          username: fetchResponse.data.name,
        },
        error: null,
      };
    } catch {
      return { data: null, error: "INVALID_PLAYER" };
    }
  }

  /**
   * A simple Wrapper to retrieve only the UUID of a Player's Profile
   *
   * Uses getProfile cache behavior (default TTL: 1 hour when config.cache is not provided).
   *
   * @example
   * ```TS
   * const uuid = await client.getUUID("Pixelic");
   * ```
   */
  public async getUUID(username: Username, config?: MowojangRequestConfig): Promise<null | UUID> {
    const profile = await this.getProfile(username, config);
    if (profile.error) return null;
    return profile.data.UUID;
  }

  /**
   * A simple Wrapper to retrieve only the Username of a Player's Profile
   *
   * Uses getProfile cache behavior (default TTL: 1 hour when config.cache is not provided).
   *
   * @example
   * ```TS
   * const username = await client.getUsername("14727faefbdc4aff848cd2713eb9939e");
   * ```
   */
  public async getUsername(UUID: UUID, config?: MowojangRequestConfig): Promise<null | Username> {
    const profile = await this.getProfile(UUID, config);
    if (profile.error) return null;
    return profile.data.username;
  }

  /**
   * Returns an Array of Player Sessions consisting of their Usernames, UUIDs, Skins and Capes
   *
   * Players considered "INVALID" are excluded from the results
   *
   * Uses getSession cache behavior (default TTL: 15 minutes when config.cache is not provided).
   *
   * @example
   * ```TS
   * const sessions = await client.getSessions(["Pixelic", "14727faefbdc4aff848cd2713eb9939e"]);
   * ```
   */
  public async getSessions(
    players: Player[],
    config?: MowojangRequestConfig,
  ): MowojangResponse<MowojangSession[], undefined> {
    try {
      if (this.shouldValidate(config) && !validateArray(players, validatePlayer, this.getValidationMinLength(config)))
        return { data: null, error: "INVALID_INPUT" };
      players = players.map((player) => {
        if (validateUUID(player)) return undashUUID(player);
        return player.toLowerCase();
      });

      const sessionsPromises = players.map((player) => this.getSession(player, config));
      const sessions = (await Promise.all(sessionsPromises))
        .filter((session) => session.data !== null)
        .map((session) => session.data);

      return {
        data: sessions,
        error: null,
      };
    } catch {
      return { data: null, error: "UNKNOWN_ERROR" };
    }
  }

  /**
   * Returns a Player's Sessions consisting of their Username, UUID, Skin and Cape
   *
   * Default cache TTL: 15 minutes when config.cache is not provided.
   *
   * @example
   * ```TS
   * const session = await client.getSession("Pixelic");
   * ```
   */
  public async getSession(
    player: Player,
    config?: MowojangRequestConfig,
  ): MowojangResponse<MowojangSession, "INVALID_PLAYER"> {
    if (this.shouldValidate(config) && !validatePlayer(player, this.getValidationMinLength(config)))
      return { data: null, error: "INVALID_INPUT" };
    const UUID = validateUUID(player) ? undashUUID(player) : await this.getUUID(player);
    if (!UUID) return { data: null, error: "INVALID_PLAYER" };

    return await this.axios
      .get(this.getSessionURL(UUID), {
        id: this.getCacheKey("session", player),
        cache: config?.cache ?? { ttl: 15 * 60 * 1000 },
      })
      .then((fetchResponse) => {
        if (fetchResponse.status === 404) return { data: null, error: "INVALID_PLAYER" as const };

        let textures: any = fetchResponse.data.properties.find((property: any) => property.name === "textures").value;
        let skin: MowojangSkin = null;
        let cape: MowojangCape = null;
        if (textures) {
          textures = JSON.parse(Buffer.from(textures, "base64").toString()).textures;
          if (textures.SKIN) {
            skin = {
              url: textures.SKIN.url,
              hash: textures.SKIN.url.split("/").at(-1),
              metadata: {
                slim: textures.SKIN?.metadata?.model === "slim",
              },
            };
          }
          if (textures.CAPE) {
            cape = {
              url: textures.CAPE.url,
              hash: textures.CAPE.url.split("/").at(-1),
            };
          }
        }

        return {
          data: {
            UUID: fetchResponse.data.id,
            username: fetchResponse.data.name,
            skin,
            cape,
            actions: fetchResponse.data.profileActions,
          },
          error: null,
        };
      })
      .catch((fetchError) => {
        if (isAxiosError(fetchError)) {
          return { data: null, error: "INVALID_PLAYER" };
        }
        return { data: null, error: "UNKNOWN_ERROR" };
      });
  }

  /**
   * A simple Wrapper to retrieve only the Skin from a Player's Session
   *
   * Uses getSession cache behavior (default TTL: 15 minutes when config.cache is not provided).
   *
   * @example
   * ```TS
   * const skin = await client.getSkin("Pixelic");
   * ```
   */
  public async getSkin(player: Player, config?: MowojangRequestConfig): Promise<null | MowojangSkin> {
    const session = await this.getSession(player, config);
    if (session.error) return null;
    return session.data.skin;
  }

  /**
   * A simple Wrapper to retrieve only the Player's Skin from their Session Data loaded into a Buffer
   *
   * Default cache TTL for the skin image request: 24 hours when config.cache is not provided.
   *
   * @example
   * ```TS
   * const skinBuffer = await client.getSkinBuffer("Pixelic");
   * ```
   */
  public async getSkinBuffer(player: Player, config?: MowojangRequestConfig): Promise<null | Buffer> {
    const session = await this.getSession(player, config);
    if (session.error || !session.data.skin) return null;

    try {
      const fetchResponse = await this.axios.get(session.data.skin.url, {
        id: this.getCacheKey("skin", player),
        responseType: "arraybuffer",
        cache: config?.cache ?? { ttl: 24 * 60 * 60 * 1000 },
      });

      return Buffer.from(fetchResponse.data);
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          "Mowojang",
          `An Error occured whilst trying to fetch Skin Texture for ${player}`,
          // @ts-expect-error
          err.config.internalId as string,
        );
        this.logger.info("Mowojang", `Check Status of Mojang Textures API on: https://mowojang-status.pixelic.dev`);
      }
      return null;
    }
  }

  /**
   * A simple Wrapper to retrieve only the Cape Data from a Player's Session
   *
   * Uses getSession cache behavior (default TTL: 15 minutes when config.cache is not provided).
   *
   * @example
   * ```TS
   * const cape = await client.getCape("Pixelic");
   * ```
   */
  public async getCape(player: Player, config?: MowojangRequestConfig): Promise<null | MowojangCape> {
    const session = await this.getSession(player, config);
    if (session.error) return null;
    return session.data.cape;
  }

  /**
   * A simple Wrapper to retrieve only the Player's Cape from their Session Data loaded into a Buffer
   *
   * Default cache TTL for the cape image request: 30 days when config.cache is not provided.
   *
   * @example
   * ```TS
   * const capeBuffer = await client.getCapeBuffer("Pixelic");
   * ```
   */
  public async getCapeBuffer(player: Player, config?: MowojangRequestConfig): Promise<null | Buffer> {
    const session = await this.getSession(player, config);
    if (session.error || !session.data.cape) return null;

    try {
      const fetchResponse = await this.axios.get(session.data.cape.url, {
        id: this.getCacheKey("cape", session.data.cape.hash, true),
        responseType: "arraybuffer",
        cache: config?.cache ?? { ttl: 30 * 24 * 60 * 60 * 1000 },
      });

      return Buffer.from(fetchResponse.data);
    } catch (err) {
      if (isAxiosError(err)) {
        this.logger.error(
          "Mowojang",
          `An Error occured whilst trying to fetch Cape Texture for ${player}`,
          // @ts-expect-error
          err.config.internalId as string,
        );
        this.logger.info("Mowojang", `Check Status of Mojang Textures API on: https://mowojang-status.pixelic.dev`);
      }
      return null;
    }
  }
}
