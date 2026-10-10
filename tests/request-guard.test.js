import test from "node:test";
import assert from "node:assert/strict";
import { apiHandler } from "../server/api.mjs";
import {
  clientAddress,
  createRateLimiter,
  guardApi,
  restrictedPath,
} from "../server/request-guard.mjs";

test("rate budgets isolate clients and media, expire, and resist capacity eviction", () => {
  let time = 100;
  const check = createRateLimiter({ now: () => time, maxEntries: 2 });
  assert.equal(check("a", "discovery", 1).allowed, true);
  assert.equal(check("a", "discovery", 1).allowed, false);
  assert.equal(check("a", "media", 2).allowed, true);
  assert.equal(check("b", "discovery", 1).allowed, false);
  assert.equal(check("a", "discovery", 1).allowed, false);
  time += 60000;
  assert.equal(check("b", "discovery", 1).allowed, true);
});
test("standalone IP limits ignore forged forwarding headers", () => {
  const old = process.env.VERCEL;
  delete process.env.VERCEL;
  try {
    assert.equal(
      clientAddress({
        headers: { "x-forwarded-for": "8.8.8.8" },
        socket: { remoteAddress: "127.0.0.1" },
      }),
      "127.0.0.1",
    );
  } finally {
    if (old !== undefined) process.env.VERCEL = old;
  }
});
test("API guards reject cross-site fetches and oversized requests", () => {
  const res = {
    setHeader() {},
    end(body) {
      this.body = body;
    },
  };
  assert.equal(
    guardApi(
      { url: "/api/home", headers: { "sec-fetch-site": "cross-site" } },
      res,
      new URL("http://localhost/api/home"),
    ),
    false,
  );
  assert.equal(res.statusCode, 403);
  assert.equal(
    guardApi(
      { url: "/api/home?" + "x".repeat(12000) },
      res,
      new URL("http://localhost/api/home"),
    ),
    false,
  );
  assert.equal(res.statusCode, 414);
});
test("public paths block private artifacts while retaining application assets", () => {
  for (const value of [
    "/.env",
    "/.git/config",
    "/private/library.json",
    "/assets/code.js.map",
    "/backup.sql",
    "/key.pem",
    "/server/api.mjs",
  ])
    assert.equal(restrictedPath(value), true, value);
  for (const value of [
    "/assets/index.js",
    "/robots.txt",
    "/.well-known/security.txt",
    "/watch/one-piece",
  ])
    assert.equal(restrictedPath(value), false, value);
});

test("API returns 429 with retry guidance and keeps CORS closed", async () => {
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(k, v) {
      headers[k] = v;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  for (let i = 0; i < 181; i++)
    await apiHandler(
      {
        url: "/api/health",
        method: "GET",
        socket: { remoteAddress: "198.51.100.9" },
      },
      res,
    );
  assert.equal(res.statusCode, 429);
  assert.ok(Number(headers["Retry-After"]) > 0);
  assert.equal(headers["Access-Control-Allow-Origin"], undefined);
  await apiHandler({ url: "http://[", method: "GET" }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Invalid request URL.");
});
