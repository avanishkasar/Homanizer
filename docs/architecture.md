# Architecture

## Monorepo Structure

```
apps/
  api/        → Next.js API routes (serverless)
  web/        → Landing page + dashboard (Vite + React)
  extension/  → Chrome extension (content script + popup)
packages/
  shared/     → Common types, constants, utilities
```

## Data Flow

1. User highlights text in browser
2. Extension sends text to `/api/rewrite`
3. API checks cache → calls LLM if miss
4. Response stored in history + cache
5. Extension replaces text in DOM
