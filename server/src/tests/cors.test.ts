import { describe, expect, it } from "vitest";
import { createCorsMiddleware, resolveOriginDecision } from "../middleware/cors";

const KNOWN = ["https://app.example.com", "https://admin.example.com"];

describe("resolveOriginDecision", () => {
  it("allows requests without an Origin header (curl, server-to-server)", () => {
    expect(resolveOriginDecision(undefined, "ieltspte.vercel.app", KNOWN)).toBe("known");
  });

  it("allows same-origin requests regardless of the configured allowlist", () => {
    expect(resolveOriginDecision("https://ieltspte.vercel.app", "ieltspte.vercel.app", KNOWN)).toBe("same-origin");
    expect(resolveOriginDecision("http://localhost:5173", "localhost:5173", KNOWN)).toBe("same-origin");
  });

  it("does not treat a mismatched port as same-origin", () => {
    expect(resolveOriginDecision("https://localhost:5174", "localhost:5174", KNOWN)).toBe("same-origin");
    expect(resolveOriginDecision("https://localhost:5174", "localhost:5173", KNOWN)).toBe("deny");
  });

  it("allows origins present in the allowlist", () => {
    expect(resolveOriginDecision("https://app.example.com", "ieltspte.vercel.app", KNOWN)).toBe("known");
  });

  it("denies unknown cross-origin requests", () => {
    expect(resolveOriginDecision("https://evil.example.com", "ieltspte.vercel.app", KNOWN)).toBe("deny");
    expect(resolveOriginDecision("https://ieltspte.vercel.app", undefined, KNOWN)).toBe("deny");
  });

  it("normalizes whitespace-only entries out of the allowlist", () => {
    expect(resolveOriginDecision("https://app.example.com", "x", ["", " https://app.example.com "])).toBe("known");
  });
});

function request(origin?: string, host = "ieltspte.vercel.app") {
  const headers: Record<string, string | undefined> = { host };
  if (origin) headers.origin = origin;
  return { headers } as never;
}

function response() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    sent: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.sent = JSON.stringify(payload);
      return res;
    },
    sendStatus(code: number) {
      res.statusCode = code;
      res.sent = String(code);
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
  };
  return res;
}

describe("createCorsMiddleware", () => {
  it("passes through same-origin requests without CORS headers", () => {
    let nextCalled = false;
    createCorsMiddleware(KNOWN)(request("https://ieltspte.vercel.app"), response() as never, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("passes through requests without an Origin header", () => {
    let nextCalled = false;
    createCorsMiddleware(KNOWN)(request(undefined), response() as never, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("rejects unknown cross-origin requests with a 403", () => {
    const res = response();
    createCorsMiddleware(KNOWN)(request("https://evil.example.com"), res as never, () => {
      throw new Error("next must not be called");
    });
    expect(res.statusCode).toBe(403);
  });

  it("fast-tracks preflight OPTIONS for allowed origins", () => {
    const res = response();
    const req = {
      method: "OPTIONS",
      headers: { host: "ieltspte.vercel.app", origin: "https://app.example.com" },
    };
    createCorsMiddleware(KNOWN)(req as never, res as never, () => {
      throw new Error("next must not be called");
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });
});