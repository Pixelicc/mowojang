/**
 * Minecraft Username or UUIDv4 (both undashed and dashed will be accepted)
 *
 * @example "Technoblade" or "b876ec32-e396-476b-a115-8438d83c67d4"
 */
export type Player = string | UUID;

/**
 * Minecraft Username
 *
 * @example "Pixelic"
 */
export type Username = string;

/**
 * Minecraft UUIDv4 (both undashed and dashed will be accepted)
 *
 * @example 14727fae-fbdc-4aff-848c-d2713eb9939e
 */
export type UUID = string;
