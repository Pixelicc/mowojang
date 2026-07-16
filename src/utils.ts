import type { UUID } from "../types/index.d.ts";

/**
 * Removes dashes from a UUID string
 *
 * @example
 * ```TS
 * undashUUID("14727fae-fbdc-4aff-848c-d2713eb9939e"); // "14727faefbdc4aff848cd2713eb9939e"
 * ```
 */
export const undashUUID = (UUID: UUID): UUID => UUID.replace(/-/g, "").toLowerCase();

/**
 * Adds dashes to a UUID string if not already dashed
 *
 * @example
 * ```TS
 * dashUUID("14727faefbdc4aff848cd2713eb9939e"); // "14727fae-fbdc-4aff-848c-d2713eb9939e"
 * ```
 */
export const dashUUID = (UUID: UUID): UUID =>
  undashUUID(UUID).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
