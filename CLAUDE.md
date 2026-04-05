# EdgeBench

Global latency observatory — real-time benchmarking across Deno Deploy's 35+
edge regions.

## Tech Stack

- **Runtime**: Deno Deploy (edge functions, 35+ regions)
- **Storage**: Deno KV (built-in, globally replicated)
- **Frontend**: Vanilla HTML/CSS/JS + SVG world map
- **Deploy**: Deno Deploy (deployctl or GitHub integration)

## Commands

- `deno task dev` — Local dev server (port 8000, with watch)
- `deno task check` — TypeScript type check
- `deno task test` — Run tests (Deno built-in test runner)
- `deno task lint` — Lint (excludes static/)
- `deno task fmt` — Format check
- `deno task build` — Full pre-deploy check (type check + lint)
- `deno task deploy` — Deploy to Deno Deploy via deployctl

## CI/CD

GitHub Actions workflow at `.github/workflows/deploy.yml`:
- **CI job**: Runs on all pushes and PRs to main (check, lint, fmt, test)
- **Deploy job**: Deploys to Deno Deploy on push to main (requires `DENO_DEPLOY_TOKEN` secret)
