import argon2 from "argon2";
import { authenticator } from "otplib";
import { describe, expect, it } from "vitest";
import { encodePasswordHash, platformConfig } from "@/lib/platform";
import { SLUG_PATTERN, suggestSlug } from "@/lib/slug";
import { operatorInput } from "@/lib/validation";

describe("platform superadmin configuration", () => {
  it("is enabled only with an email, an encoded Argon2id hash, and a TOTP secret", async () => {
    const hash = await argon2.hash("correct horse battery staple", { type: argon2.argon2id });
    const secret = authenticator.generateSecret(20);
    const env = { SUPERADMIN_EMAIL: " Root@Example.IN ", SUPERADMIN_PASSWORD_HASH: encodePasswordHash(hash), SUPERADMIN_TOTP_SECRET: secret };
    expect(platformConfig(env)).toEqual({ email: "root@example.in", passwordHash: hash, totpSecret: secret });
    expect(platformConfig({ ...env, SUPERADMIN_TOTP_SECRET: "" })).toBeNull();
    // A raw hash contains `$`, which .env variable expansion can corrupt; only the encoded form is accepted.
    expect(platformConfig({ ...env, SUPERADMIN_PASSWORD_HASH: hash })).toBeNull();
    expect(platformConfig({ ...env, SUPERADMIN_TOTP_SECRET: "not base32!" })).toBeNull();
  });
});

describe("operator form", () => {
  it("suggests valid workspace slugs", () => {
    expect(suggestSlug("Rao & Iyer Chambers")).toBe("rao-and-iyer-chambers");
    expect(suggestSlug("  Société Légale, New Delhi ")).toBe("societe-legale-new-delhi");
    expect(SLUG_PATTERN.test(suggestSlug("Harbor & Vale Chambers"))).toBe(true);
  });
  it("validates operator input", () => {
    expect(operatorInput.safeParse({ organizationName: "Harbor Chambers", slug: "harbor-chambers", ownerEmail: "Owner@Harbor.IN" }).data?.ownerEmail).toBe("owner@harbor.in");
    expect(operatorInput.safeParse({ organizationName: "Harbor Chambers", slug: "-bad", ownerEmail: "owner@harbor.in" }).success).toBe(false);
    expect(operatorInput.safeParse({ organizationName: "Harbor Chambers", slug: "harbor", ownerEmail: "owner@harbor.in", expiresInDays: 30 }).success).toBe(false);
  });
});
