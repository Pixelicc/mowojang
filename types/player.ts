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
 * @example b876ec32e396476ba1158438d83c67d4
 */
export type UUID = string;
