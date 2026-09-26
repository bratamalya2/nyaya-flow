import { authenticator } from "otplib";
import { afterEach, describe, expect, it } from "vitest";
import { totpStep } from "@/lib/auth";
import { isSameOriginMutation } from "@/lib/origin";
import { assertSafeRuntime } from "@/lib/runtime";

describe("same-origin mutation check", () => {
  it("allows safe methods and same-host mutations", () => {
    expect(isSameOriginMutation("GET", null, "app.example.in")).toBe(true);
    expect(isSameOriginMutation("POST", "https://app.example.in", "app.example.in")).toBe(true);
    expect(isSameOriginMutation("PATCH", "https://app.example.in", "127.0.0.1:3000", "https://app.example.in")).toBe(true);
  });
  it("rejects missing, foreign, and malformed origins", () => {
    expect(isSameOriginMutation("POST", null, "app.example.in")).toBe(false);
    expect(isSameOriginMutation("DELETE", "https://evil.example", "app.example.in", "https://app.example.in")).toBe(false);
    expect(isSameOriginMutation("PUT", "not a url", "app.example.in")).toBe(false);
  });
});

describe("TOTP steps", () => {
  it("maps a valid code to the current step and rejects wrong codes", () => {
    const secret = authenticator.generateSecret();
    const step = Math.floor(Date.now() / 30_000);
    expect(Math.abs((totpStep(secret, authenticator.generate(secret)) ?? 0) - step)).toBeLessThanOrEqual(1);
    const wrong = String((Number(authenticator.generate(secret)) + 1) % 1_000_000).padStart(6, "0");
    expect(totpStep(secret, wrong)).toBeNull();
  });
});

describe("runtime guard", () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  it("refuses demo mode in production", () => {
    Object.assign(process.env, { NODE_ENV: "production", DEMO_MODE: "true" });
    expect(() => assertSafeRuntime()).toThrow(/DEMO_MODE/);
    process.env.DEMO_MODE = "false";
    expect(() => assertSafeRuntime()).not.toThrow();
  });
});
