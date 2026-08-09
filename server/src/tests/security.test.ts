import { describe, it, expect } from "vitest";
import { containsOperator, sanitizeMongoQuery, sanitizePagination } from "../middleware/sanitize";
import { startAutoSubmitInterval } from "../jobs/autoSubmit";

function fakeRes() {
  let statusCode = 200;
  let body: unknown = null;
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

function nextFn(): { next: () => void; called: () => boolean } {
  const state = { called: false };
  return { next: () => { state.called = true; }, called: () => state.called };
}

describe("containsOperator", () => {
  it("detects nested $ operators from Express-style query parsing", () => {
    expect(containsOperator({ status: { $ne: "ACTIVE" } })).toBe(true);
    expect(containsOperator({ page: { $gt: 0 } })).toBe(true);
  });
  it("returns false for plain flat queries", () => {
    expect(containsOperator({ page: "2", limit: "10", search: "hello" })).toBe(false);
  });
  it("returns false for arrays of scalar strings", () => {
    expect(containsOperator({ category: ["ielts", "pte"] })).toBe(false);
  });
  it("is safe with cyclic references", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(containsOperator(a)).toBe(false);
  });
});

describe("sanitizeMongoQuery", () => {
  it("rejects operator injection with 400 and does not continue", () => {
    const req = { query: { status: { $ne: "ACTIVE" } }, body: {} } as never;
    const res = fakeRes();
    const next = nextFn();
    sanitizeMongoQuery(req as never, res as never, next.next as never);
    expect(res.statusCode).toBe(400);
    expect(next.called()).toBe(false);
  });

  it("rejects operator keys in the request body", () => {
    const req = { query: {}, body: { title: "x", $rename: { title: "name" } } } as never;
    const res = fakeRes();
    const next = nextFn();
    sanitizeMongoQuery(req as never, res as never, next.next as never);
    expect(res.statusCode).toBe(400);
  });

  it("passes clean requests through", () => {
    const req = { query: { page: "2", limit: "20", search: "ielts" }, body: { title: "x" } } as never;
    const res = fakeRes();
    const next = nextFn();
    sanitizeMongoQuery(req as never, res as never, next.next as never);
    expect(res.statusCode).toBe(200);
    expect(next.called()).toBe(true);
  });
});

describe("sanitizePagination", () => {
  it("clamps limit to a max of 100 and min of 1", () => {
    const req = { query: { limit: "99999" } } as never;
    sanitizePagination(req as never, fakeRes() as never, nextFn().next);
    expect((req as unknown as { query: { limit: string } }).query.limit).toBe("100");

    const req2 = { query: { limit: "-5" } } as never;
    sanitizePagination(req2 as never, fakeRes() as never, nextFn().next);
    expect((req2 as unknown as { query: { limit: string } }).query.limit).toBe("1");
  });

  it("clamps page to a min of 1 and floor of non-integers", () => {
    const req = { query: { page: "2.7" } } as never;
    sanitizePagination(req as never, fakeRes() as never, nextFn().next);
    expect((req as unknown as { query: { page: string } }).query.page).toBe("2");

    const req2 = { query: { page: "0" } } as never;
    sanitizePagination(req2 as never, fakeRes() as never, nextFn().next);
    expect((req2 as unknown as { query: { page: string } }).query.page).toBe("1");
  });

  it("defaults invalid numeric strings instead of propagating NaN", () => {
    const req = { query: { page: "abc" } } as never;
    sanitizePagination(req as never, fakeRes() as never, nextFn().next);
    expect((req as unknown as { query: { page: string } }).query.page).toBe("1");
  });
});

describe("autoSubmitInterval", () => {
  it("starts a no-op under NODE_ENV=test (no interval leaked)", () => {
    const handle = startAutoSubmitInterval();
    expect(handle).toBeNull();
  });
});