# HumanizerDad document rewriting research log

## Preregistered question

How can NaturalWrite accept one DOCX or PDF at a time, improve prose while preserving factual meaning and document formatting, and what relevant open-source humanizers or document rewrite tools already exist?

## Hypotheses and falsifiers

- H1: DOCX can preserve source styling by replacing paragraph/run text within existing OOXML nodes rather than rebuilding the document. Falsifier: ordinary documents lose significant structure or styling under text-node replacement.
- H2: PDF formatting can be preserved by replacing text in-place. Falsifier: PDF text operators/fonts/layout make reliable in-place editing unavailable for ordinary files; in that event exact page geometry cannot be promised.
- H3: Open-source humanizers exist, but their quality, safety, detector claims, or document-format support may not meet NaturalWrite requirements. Falsifier: a maintained project directly supports high-fidelity DOCX and PDF prose rewrites with factual validation.

## Frozen method and stopping rules

- R1 (confirmatory): inspect current official format-library documentation for DOCX/PDF extraction and writing capabilities.
- R2 (exploratory): search GitHub and public projects for open-source text humanizers and document rewriting implementations; distinguish code availability from evidence of safe/fidelity-preserving behavior.
- R3 (confirmatory): create representative DOCX/PDF fixtures, rewrite prose, and compare extracted content and rendered page/layout properties; include tables, headers, hyperlinks, mixed runs, and non-prose regions.
- Stop when both format pipelines have a tested preservation strategy, or report a specific unsupported PDF class rather than claiming fidelity.

## Evidence log

- E1 — GitHub repository `https://github.com/hannsxpeter/humanizer`, web search snapshot 2026-09-25, content fingerprint: search result describes prose style/structure rewriting, layered meaning checks, and explicitly excludes document/PDF metadata/layout processing. Supports that prose quality approaches can be reused conceptually, while document handling needs a separate structural pipeline.
- E2 — GitHub repository `https://github.com/opensyndicate/open-humanizer`, web search snapshot 2026-09-25, content fingerprint: search result describes a Writer/Critic iterative loop optimized against detector scores and requires an LLM API key. This is an available open-source humanizer, but its detector-evasion goal conflicts with NaturalWrite's stated product position, so it will not be adopted.
- E3 — PyMuPDF page docs `https://pymupdf.readthedocs.io/en/latest/page.html`, web search snapshot 2026-09-25, content fingerprint: redaction replacement text can be inserted, but longer strings may cause awkward line breaks or fail to appear; replacement fonts have limitations. Supports bounding-box fit checks and rejecting paragraphs that cannot fit.
- E4 — PyMuPDF FAQ `https://pymupdf.readthedocs.io/en/latest/faq/index.html`, web search snapshot 2026-09-25, content fingerprint: replacement text options are limited; higher control requires separate insertion. Supports treating PDF replacement as a layout-sensitive edit, not ordinary text substitution.
- E5 — python-docx docs `https://python-docx.readthedocs.io/en/stable/`, web search snapshot 2026-09-25, content fingerprint: library updates Word DOCX files and exposes paragraph/run APIs. Product code instead operates on existing OOXML parts to avoid recreating the package and its styles.
- E6 — Local Python package inspection, 2026-09-25: PyMuPDF 1.28.2 is installed. `Page.add_redact_annot`, `Page.apply_redactions`, `Page.insert_font`, and `Page.insert_textbox` are available; textbox insertion accepts an existing font buffer and reports fit/deficit. Supports a local PDF worker that can retain page objects and embedded fonts where glyph coverage permits.
- E7 — Local lockfile `pnpm-lock.yaml`, 2026-09-25: Next.js 15.5.25, React 19.2.8, TypeScript 5.9.3, PDF support dependencies being added to the API package. This is the version baseline for implementation.

## Exploratory observations

Two GitHub humanizer projects surfaced. One is an editorial prompt/skill with meaning checks, not a file processor. Another is a detector-score optimization loop, which is out of scope by product policy. Search results do not establish either repository's test quality, maintenance health, or suitability for production. No claim is made that these projects were cloned or executed.

## Confirmatory experiments

- R3: completed 2026-09-25. Vitest fixtures rewrite mixed-run DOCX prose, assert paragraph/run formatting and an unrelated media package part remain, check hyperlink skip behavior and risky-output preservation, and exercise the full TypeScript PDF extraction → fake rewrite provider → Python PDF output path. PyMuPDF unit tests verify retained heading text, changed body text, unchanged page geometry, scanned-PDF rejection, and safe refusal when output cannot fit. All seven document-format tests passed (plus four API tests). Fixtures do not cover every Word feature (such as every field/tracked-change/embedded-object pattern) or raster-diff every PDF class; those remain limits.

## Unanswered questions

- Image-only/scanned PDFs require OCR and reliable text-to-image coordinate matching; this first pass may explicitly reject them if OCR cannot preserve their appearance safely.
- Exact visual preservation is fundamentally constrained when replacement prose has a different length from the PDF's original text box. The implementation must skip any paragraph that cannot fit and report that fact.
- DOCX reflows in Word; preserving OOXML structure and run styles does not guarantee identical page breaks after wording changes.
- The research skill asks for an independent second-agent verdict; multi-agent delegation is disabled in this session, so the research will be described as evidence-collected but not independently audited.
