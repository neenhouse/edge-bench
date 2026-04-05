// EdgeBench — Global Latency Observatory for Deno Deploy

async function serveFile(path: string, contentType: string): Promise<Response> {
  try {
    const file = await Deno.readFile(path);
    return new Response(file, {
      headers: { "content-type": contentType },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function handleBench(workload: string): Promise<Response> {
  const region = Deno.env.get("DENO_REGION") || "local";
  const start = performance.now();

  try {
    switch (workload) {
      case "noop": {
        // Pure network latency — do nothing
        break;
      }

      case "kv-read": {
        // Deno.openKv requires --unstable-kv locally; always available on Deploy
        if (typeof Deno.openKv !== "function") {
          // Simulate latency for local dev
          break;
        }
        const kv = await Deno.openKv();
        await kv.get(["bench-key"]);
        kv.close();
        break;
      }

      case "kv-write": {
        if (typeof Deno.openKv !== "function") {
          break;
        }
        const kv = await Deno.openKv();
        await kv.set(["bench-" + crypto.randomUUID()], { ts: Date.now() });
        kv.close();
        break;
      }

      case "compute": {
        const encoder = new TextEncoder();
        for (let i = 0; i < 10_000; i++) {
          await crypto.subtle.digest("SHA-256", encoder.encode(`bench-${i}`));
        }
        break;
      }

      case "json": {
        // Generate a ~100KB JSON blob with 1000 nested items
        const data: Record<string, unknown> = {};
        for (let i = 0; i < 1000; i++) {
          data[`item_${i}`] = {
            id: i,
            name: `Item ${i}`,
            value: Math.random(),
            tags: [`tag-${i % 10}`, `tag-${i % 5}`, `tag-${i % 3}`],
            meta: {
              created: Date.now(),
              region,
              payload: `${"x".repeat(60)}`,
            },
          };
        }
        const serialized = JSON.stringify(data);
        JSON.parse(serialized);
        break;
      }

      default:
        return new Response("Unknown workload", { status: 400 });
    }

    const elapsed_ms = performance.now() - start;

    return Response.json({
      region,
      workload,
      elapsed_ms: Math.round(elapsed_ms * 100) / 100,
      timestamp: Date.now(),
    });
  } catch (err) {
    const elapsed_ms = performance.now() - start;
    return Response.json({
      region,
      workload,
      elapsed_ms: Math.round(elapsed_ms * 100) / 100,
      timestamp: Date.now(),
      error: String(err),
    });
  }
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // CORS headers for API routes
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Serve index
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const res = await serveFile(
      "static/index.html",
      "text/html; charset=utf-8",
    );
    return res;
  }

  // Serve static files
  if (url.pathname.startsWith("/static/")) {
    const filePath = url.pathname.slice(1); // remove leading /
    const ext = filePath.split(".").pop() ?? "";
    const contentTypes: Record<string, string> = {
      css: "text/css; charset=utf-8",
      js: "application/javascript; charset=utf-8",
      html: "text/html; charset=utf-8",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      webp: "image/webp",
      png: "image/png",
    };
    const contentType = contentTypes[ext] ?? "application/octet-stream";
    return await serveFile(filePath, contentType);
  }

  // API: ping
  if (url.pathname === "/api/ping") {
    return Response.json(
      {
        region: Deno.env.get("DENO_REGION") || "local",
        timestamp: Date.now(),
      },
      { headers: corsHeaders },
    );
  }

  // API: bench workloads
  if (url.pathname.startsWith("/api/bench/")) {
    const workload = url.pathname.slice("/api/bench/".length);
    const res = await handleBench(workload);
    // Add CORS headers
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
    });
  }

  return new Response("Not Found", { status: 404 });
}

// Export handleBench for direct testing
export { handleBench };

// Start server when run directly
if (import.meta.main) {
  Deno.serve({ port: 8000 }, handler);
}
