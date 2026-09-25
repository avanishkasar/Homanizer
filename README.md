# HumanizerDad

HumanizerDad improves document clarity, flow, and readability while preserving document structure. It does not claim to evade AI detectors or guarantee any detector result.

## What works in this phase

- Upload exactly one `.docx` Word document or one text-based `.pdf` per request.
- Choose Clear, Concise, Professional, or Friendly.
- Download a new rewritten file; the uploaded original is not edited.
- DOCX paragraphs, tables, headers, footers, paragraph styles, and run formatting are carried through the original OOXML package. Risk-flagged paragraphs stay unchanged.
- PDF page geometry, images, and unrelated vector elements stay in place. Text is replaced only when the new paragraph fits the same area. Where an embedded font has the needed characters, that font is reused.
- Scanned/image-only PDFs, password-protected PDFs, rotated pages, linked text, and PDF paragraphs on non-uniform backgrounds are reported or kept unchanged for safety. Scanned PDF OCR is future work.
- A separate **The bigger picture** page presents planned desktop, browser-extension, and IDE integrations. These are roadmap items, not available features.

Formatting styles are preserved as far as the source format allows. DOCX can repaginate when rewritten text changes length. A PDF is a fixed-page format; paragraphs that do not fit their original text boxes are retained unchanged and counted in the response report.

## Architecture

- `apps/web` — HumanizerDad upload, history, roadmap, and settings UI.
- `apps/api` — Next.js REST endpoints, Prisma/PostgreSQL, authentication gate, and document upload orchestration.
- `apps/api/python/pdf_worker.py` — isolated PyMuPDF PDF extraction and in-place layout-aware replacement worker. It receives document bytes over stdin and writes only a result over stdout; document contents are not logged.
- `apps/extension` — original single-selection browser prototype, now branded HumanizerDad.
- `packages/shared` — shared transport and provider contracts.
- `packages/ai` — swappable `RewriteProvider` and server-only OpenAI Responses API provider.

The OpenAI key remains on the server. The browser's **workspace access key** is the separate `NATURALWRITE_API_KEY` gate from `.env`; it is not an OpenAI key. For a public multi-user product, replace this initial shared-key gate with user accounts before exposing a paid rewrite service.

## Local setup

1. Install Node.js 22+, pnpm, Python 3.13+, and PostgreSQL.
2. Install the Node workspace packages with `pnpm install`.
3. Install the PDF worker dependency with `python -m pip install -r apps/api/requirements.txt` (PyMuPDF 1.28.2).
4. Copy `.env.example` to `.env`, then add the OpenAI key and local database details. Set a private random `NATURALWRITE_API_KEY`; both templates contain placeholders only.
5. Create the PostgreSQL database named in `DATABASE_URL`.
6. Generate/migrate the database: `pnpm --filter @naturalwrite/api db:generate` and `pnpm --filter @naturalwrite/api db:migrate --name init`.
7. Start the rewrite API: `pnpm --filter @naturalwrite/api dev`.
8. In a second terminal, run `pnpm --filter @naturalwrite/web dev`.
9. In the website's Settings, set the workspace access key to the `NATURALWRITE_API_KEY` from `.env`. Local API URL defaults to `http://localhost:3000`.

Use `PYTHON_EXECUTABLE` if the PDF worker should run with a specific Python interpreter. You can set `MAX_DOCUMENT_CHARS`, `MAX_DOCUMENT_BLOCKS`, `MAX_PARAGRAPH_CHARS`, and `DAILY_REWRITE_CAP` in `.env` to tune limits.

## Upload API

`POST /api/documents` accepts multipart form fields `file` (exactly one `.docx` or `.pdf`) and `style` (`clear`, `concise`, `professional`, or `friendly`). Send the workspace gate using `x-naturalwrite-key`. On success it returns a downloadable document and an `X-HumanizerDad-Report` header with processed/skipped counts and a risk score. File size is limited to 15 MB, with additional page, paragraph, and character limits.

The API also provides `POST /api/rewrite`, `POST /api/rewrite/validate`, `GET /api/history`, `DELETE /api/history/:id`, and `GET/PATCH /api/settings`.

## Load the extension

1. Visit `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Choose `apps/extension/dist` after running `pnpm --filter @naturalwrite/extension build`.
3. Set the API URL and workspace access key in the HumanizerDad popup.
4. Select text in a supported editable field, choose **Transform**, then explicitly select **Replace**, **Copy**, or **Cancel**.

## Public preview

The web interface is published on GitHub Pages at [avanishkasar.github.io/Homanizer](https://avanishkasar.github.io/Homanizer/). GitHub Pages hosts the static UI only. To accept uploads from the public website, deploy `apps/api`, provision PostgreSQL and Python/PyMuPDF, then configure the API address and server secrets; do not publish the OpenAI key in frontend settings.

## Quality checks

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` from the repository root.
