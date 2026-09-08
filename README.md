# NaturalWrite

NaturalWrite improves prose clarity, flow, and readability. It does not claim to evade AI detectors or guarantee any detector result.

## Phase 1 architecture

- `apps/extension` — Chrome Manifest V3 extension that presents a Transform action beside selected editable text, then requires Replace, Copy, or Cancel.
- `apps/api` — Next.js REST API, Prisma, PostgreSQL, rate/daily caps, OpenAI Responses API provider.
- `apps/web` — small companion view for history and settings.
- `packages/shared` — transport and provider contracts.
- `packages/ai` — swappable `RewriteProvider` implementation. The OpenAI key is only read by `apps/api`.

The API classifies and rejects code, URL-only values, and Markdown before model invocation. The validation pass checks protected numbers, proper names, URLs, and Markdown links. A non-zero risk score means the review dialog reports potential changes; it never performs a page edit automatically.

## Setup

1. Copy `.env.example` values into `.env` (already created locally and gitignored), then enter `OPENAI_API_KEY` and replace `NATURALWRITE_API_KEY` with a long random value.
2. Install dependencies: `pnpm install`.
3. Start PostgreSQL and make `DATABASE_URL` point to an empty database.
4. Generate and migrate Prisma: `pnpm --filter @naturalwrite/api db:generate` then `pnpm --filter @naturalwrite/api db:migrate --name init`.
5. Start the API: `pnpm --filter @naturalwrite/api dev`.
6. Build the extension: `pnpm --filter @naturalwrite/extension build`.

## Load the extension

1. Visit `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Choose `D:\\VS Code\\Humanizer\\apps\\extension\\dist`.
3. Open the NaturalWrite popup and set the API URL (normally `http://localhost:3000`) and the `NATURALWRITE_API_KEY` value from `.env`.
4. Select prose in a textarea, text input, or contenteditable element. Click **Transform**, then explicitly choose **Replace**, **Copy**, or **Cancel**.

## Endpoints

- `POST /api/rewrite`
- `POST /api/rewrite/validate`
- `GET /api/history`, `DELETE /api/history/:id`
- `GET /api/settings`, `PATCH /api/settings`

All endpoints require `x-naturalwrite-key`. The service intentionally does not log raw document text. History storage is the explicit product feature: it stores source, original, and rewritten text in PostgreSQL only after a successful user request.

## Quality checks

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Phase 2 (GitHub App/PR rewriting) is deliberately out of scope until this end-to-end MVP is stable.
