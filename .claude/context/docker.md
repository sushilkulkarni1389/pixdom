# Layer 9 — Docker & Environment
Load ONLY when working on Layer 9 — Docker & Environment tasks.

## Goal
Dockerfile with Node 20 + Chromium + FFmpeg, docker-compose for local dev, and full env documentation.

## Folder / File Structure to Create

```
docker/
└── Dockerfile
docker-compose.yml
.env.example
```

## `Dockerfile` Key Requirements

```dockerfile
FROM node:20-slim

# Install Chromium and FFmpeg system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

CMD ["node", "apps/mcp-server/dist/index.js"]
```

## `docker-compose.yml` Structure

- Service `mcp-server`: build from `./docker/Dockerfile`, mount `./output:/app/output`, port 3000
- Service `cli`: same image, `command: node apps/cli/dist/index.js`

## `.env.example` — All Required Vars

```
# Required
ANTHROPIC_API_KEY=sk-ant-...         # Anthropic API key for generate_and_convert tool

# Optional — defaults shown
NODE_ENV=development                  # development | production | test
OUTPUT_DIR=./output                   # Directory for rendered output files
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH= # Override Chromium path (auto-detected in Docker)
LOG_LEVEL=info                        # debug | info | warn | error
MCP_SERVER_PORT=3000                  # Port for hosted MCP server (v2)
```

## Hard Rules

- `--no-sandbox` flag MUST be in Playwright launch args when running in Docker
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` must be set when `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true`
- Docker image must NOT include `node_modules` from host — always use `--frozen-lockfile` install

## Definition of Done

- `docker build -f docker/Dockerfile -t html2asset .` exits 0
- `docker run html2asset node apps/cli/dist/index.js convert --html "<h1>hi</h1>" --format png --output /tmp/t.png` writes valid PNG
- `.env.example` documents every variable referenced in `packages/types/src/env.ts`
