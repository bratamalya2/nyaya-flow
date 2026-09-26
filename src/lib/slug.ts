export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

/** Workspace slug suggestion from an organization name: "Rao & Iyer Chambers" -> "rao-and-iyer-chambers". */
export function suggestSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
