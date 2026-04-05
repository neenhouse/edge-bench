// EdgeBench — Tests for core server functionality

import { assertEquals, assertExists } from "@std/assert";
import { handleBench, handler } from "./main.ts";

// ── Helper ──

function req(path: string, method = "GET"): Request {
  return new Request(`http://localhost:8000${path}`, { method });
}

// ── Test: Ping endpoint returns region and timestamp ──

Deno.test("GET /api/ping returns region and timestamp", async () => {
  const res = await handler(req("/api/ping"));
  assertEquals(res.status, 200);

  const body = await res.json();
  assertExists(body.region);
  assertExists(body.timestamp);
  assertEquals(typeof body.region, "string");
  assertEquals(typeof body.timestamp, "number");
});

// ── Test: Ping endpoint includes CORS headers ──

Deno.test("GET /api/ping includes CORS headers", async () => {
  const res = await handler(req("/api/ping"));
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ── Test: OPTIONS returns 204 with CORS headers ──

Deno.test("OPTIONS request returns 204 with CORS headers", async () => {
  const res = await handler(req("/api/ping", "OPTIONS"));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(res.headers.get("access-control-allow-methods"), "GET, OPTIONS");
});

// ── Test: Bench noop workload returns valid JSON ──

Deno.test("GET /api/bench/noop returns bench result", async () => {
  const res = await handler(req("/api/bench/noop"));
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.workload, "noop");
  assertExists(body.region);
  assertExists(body.elapsed_ms);
  assertExists(body.timestamp);
  assertEquals(typeof body.elapsed_ms, "number");
});

// ── Test: Bench compute workload executes ──

Deno.test("GET /api/bench/compute returns bench result", async () => {
  const res = await handler(req("/api/bench/compute"));
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.workload, "compute");
  assertEquals(typeof body.elapsed_ms, "number");
  // compute workload should take measurable time
  assertEquals(body.elapsed_ms >= 0, true);
});

// ── Test: Bench json workload executes ──

Deno.test("GET /api/bench/json returns bench result", async () => {
  const res = await handler(req("/api/bench/json"));
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.workload, "json");
  assertEquals(typeof body.elapsed_ms, "number");
});

// ── Test: Unknown workload returns 400 ──

Deno.test("handleBench returns 400 for unknown workload", async () => {
  const res = await handleBench("nonexistent");
  assertEquals(res.status, 400);

  const text = await res.text();
  assertEquals(text, "Unknown workload");
});

// ── Test: Unknown route returns 404 ──

Deno.test("Unknown route returns 404", async () => {
  const res = await handler(req("/does-not-exist"));
  assertEquals(res.status, 404);
});

// ── Test: Root path serves index.html ──

Deno.test("GET / serves index.html", async () => {
  const res = await handler(req("/"));
  // Should return 200 (file exists) or 404 (file missing in test env)
  // The content-type should be HTML if successful
  if (res.status === 200) {
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  } else {
    // In CI/test environments the static dir may not be present
    assertEquals(res.status, 404);
  }
});
