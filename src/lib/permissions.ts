import type { AppRole } from "@/lib/types";

// Mirrors can_access_matter() and the RLS policies in db/migrations. The database is the authority;
// these helpers only decide which controls the interface offers.
export const LEADERSHIP_ROLES: AppRole[] = ["owner", "managing_partner", "admin"];
export const EDITOR_ROLES: AppRole[] = [...LEADERSHIP_ROLES, "advocate", "associate", "paralegal"];
export const ADMIN_ROLES: AppRole[] = ["owner", "admin"];
export const ALL_ROLES: AppRole[] = ["owner", "managing_partner", "admin", "advocate", "associate", "paralegal", "finance"];

export const roleLabel = (role: AppRole) => role.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());

export const canEditMatters = (role: AppRole) => EDITOR_ROLES.includes(role);
export const canManageMatters = (role: AppRole) => LEADERSHIP_ROLES.includes(role);
export const canAdminister = (role: AppRole) => ADMIN_ROLES.includes(role);
export const canViewAudit = (role: AppRole) => LEADERSHIP_ROLES.includes(role);

/** Roles the actor may assign: only owners can create or change owners. */
export const assignableRoles = (actor: AppRole) => ALL_ROLES.filter((role) => role !== "owner" || actor === "owner");
