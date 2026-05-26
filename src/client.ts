import { isAxiosError } from "axios";
import type { AxiosCacheInstance } from "axios-cache-interceptor";
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
} from "../types/index.d.ts";
import { validateArray, validatePlayer, validateUUID } from "./validators.js";
import { undashUUID } from "./utils.js";
import { Logger } from "@pixelic/logger";

export default class Client {
  private logger: Logger;
  private axios: AxiosCacheInstance;
  private validation: ValidationOptions;
  private baseURL: string;

  constructor(clientOptions?: ClientOptions) {
    this.logger = new Logger(clientOptions?.logger);
    this.axios = axiosInstance(clientOptions ?? {}, this.logger);
    this.validation = clientOptions?.validation ?? {};
    this.baseURL = clientOptions?.baseURL ?? "https://mowojang.matdoes.dev";
  }

  private shouldValidate(config?: MowojangRequestConfig): boolean {
    return this.validation?.enabled || config?.validation?.enabled || false;
  }

  private getValidationMinLength(config?: MowojangRequestConfig): 1 | 2 | undefined {
    if (this.validation?.minimumUsernameLength === 1) return 1;
    if (this.validation?.minimumUsernameLength === 2) return 2;
    if (config?.validation?.minimumUsernameLength === 1) return 1;
    if (config?.validation?.minimumUsernameLength === 2) return 2;
    return undefined;
  }

  /**
   * Returns an Array of Player Profiles consisting of their Usernames and UUIDs
   *
   * Players considered "INVALID" are excluded from the results
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

      const usePost = config?.usePost ?? false;
      if (usePost) {
        const fetchResponse = await this.axios.post(this.baseURL, players, {
          cache: config?.cache ?? { ttl: 15 * 60 * 1000 },
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

      // Default fallback to GET requests via getProfile()
      const profilePromises: MowojangResponse<MowojangProfile, "INVALID_PLAYER">[] = [];
      players.forEach((player) => {
        // @ts-ignore
        profilePromises.push(this.getProfile(player, config));
      });
      const profiles = (await Promise.all(profilePromises)).filter((p) => p.data !== null).map((p) => p.data);

      return {
        // @ts-ignore
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
   */
  public async getProfile(
    player: Player,
    config?: MowojangRequestConfig,
  ): MowojangResponse<MowojangProfile, "INVALID_PLAYER"> {
    try {
      if (this.shouldValidate(config) && !validatePlayer(player, this.getValidationMinLength(config)))
        return { data: null, error: "INVALID_INPUT" };

      const fetchResponse = await this.axios.get(`${this.baseURL}/${player}`, {
        cache: config?.cache ?? { ttl: 15 * 60 * 1000 },
      });

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
   * A Simple Wrapper to Retrieve Only the UUID of a Player's Profile
   *
   */
  public async getUUID(username: Username, config?: MowojangRequestConfig): Promise<null | UUID> {
    const profile = await this.getProfile(username, config);
    if (profile.error) return null;
    return profile.data.UUID;
  }

  /**
   * A Simple Wrapper to Retrieve Only the Username of a Player's Profile
   *
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

      const sessionsPromises: MowojangResponse<MowojangSession, undefined>[] = [];
      players.forEach((player) => {
        // @ts-ignore
        sessionsPromises.push(this.getSession(player, config));
      });
      const sessions = (await Promise.all(sessionsPromises))
        .filter((session) => session.data !== null)
        .map((session) => session.data);

      return {
        // @ts-ignore
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
   */
  public async getSession(
    player: Player,
    config?: MowojangRequestConfig,
  ): MowojangResponse<MowojangSession, "INVALID_PLAYER"> {
    if (this.shouldValidate(config) && !validatePlayer(player, this.getValidationMinLength(config)))
      return { data: null, error: "INVALID_INPUT" };
    const UUID = await this.getUUID(player);
    if (!UUID) return { data: null, error: "INVALID_PLAYER" };

    return await this.axios
      .get(`${this.baseURL}/session/minecraft/profile/${UUID}`, {
        cache: config?.cache ?? { ttl: 15 * 60 * 1000 },
      })
      .then((fetchResponse) => {
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
   * A Simple Wrapper to Retrieve Only the Skin from a Player's Session
   *
   */
  public async getSkin(player: Player, config?: MowojangRequestConfig): Promise<null | MowojangSkin> {
    const session = await this.getSession(player, config);
    if (session.error) return null;
    return session.data.skin;
  }

  /**
   * A Simple Wrapper to Retrieve Only the Player's Skin from their Session Data Loaded into a Buffer
   *
   */
  public async getSkinBuffer(player: Player, config?: MowojangRequestConfig): Promise<null | Buffer> {
    const session = await this.getSession(player, config);
    if (session.error || !session.data.skin) return null;

    const fetchResponse = await this.axios.get(session.data.skin.url, {
      responseType: "arraybuffer",
      cache: config?.cache ?? { ttl: 24 * 60 * 60 * 1000 },
    });

    return Buffer.from(fetchResponse.data, "base64");
  }

  /**
   * A Simple Wrapper to Retrieve Only the Cape Data from a Player's Session
   *
   */
  public async getCape(player: Player, config?: MowojangRequestConfig): Promise<null | MowojangCape> {
    const session = await this.getSession(player, config);
    if (session.error) return null;
    return session.data.cape;
  }

  /**
   * A Simple Wrapper to Retrieve Only the Player's Cape from their Session Data Loaded into a Buffer
   *
   */
  public async getCapeBuffer(player: Player, config?: MowojangRequestConfig): Promise<null | Buffer> {
    const session = await this.getSession(player, config);
    if (session.error || !session.data.cape) return null;

    const fetchResponse = await this.axios.get(session.data.cape.url, {
      responseType: "arraybuffer",
      cache: config?.cache ?? { ttl: 30 * 24 * 60 * 60 * 1000 },
    });

    return Buffer.from(fetchResponse.data, "base64");
  }
}
