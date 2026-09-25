import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

function request(protocol: "http" | "https", forwardedProto?: string) {
  return {
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
  } as Parameters<typeof getSessionCookieOptions>[0];
}

describe("cookies de sessão", () => {
  it("usa cookie HttpOnly, host-only e SameSite=Lax no HTTP local", () => {
    const options = getSessionCookieOptions(request("http"), false);

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
    expect(options).not.toHaveProperty("domain");
  });

  it("exige Secure em produção e em requisições HTTPS", () => {
    expect(getSessionCookieOptions(request("http"), true)).toMatchObject({
      secure: true,
      sameSite: "lax",
    });
    expect(getSessionCookieOptions(request("https"), false)).toMatchObject({
      secure: true,
      sameSite: "lax",
    });
    expect(getSessionCookieOptions(request("http", "https"), false)).toMatchObject({
      secure: true,
      sameSite: "lax",
    });
  });
});
