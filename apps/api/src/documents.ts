import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { spawn } from "node:child_process";
import path from "node:path";
import type { WritingStyle } from "@naturalwrite/shared";
import type { OpenAIRewriteProvider } from "@naturalwrite/ai";
import { classify } from "./lib";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = Number(process.env.MAX_DOCUMENT_CHARS ?? 60_000);
const MAX_DOCUMENT_BLOCKS = Number(process.env.MAX_DOCUMENT_BLOCKS ?? 250);
const MAX_PARAGRAPH_CHARS = Number(process.env.MAX_PARAGRAPH_CHARS ?? 12_000);
const PYTHON_WORKER = path.resolve(process.cwd(), "python", "pdf_worker.py");
type XmlDocument = ReturnType<
  InstanceType<typeof DOMParser>["parseFromString"]
>;
type XmlElement = NonNullable<XmlDocument["documentElement"]>;

export type SupportedDocument = "docx" | "pdf";
export interface DocumentResult {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
  paragraphsProcessed: number;
  paragraphsSkipped: number;
  riskScore: number;
  issues: string[];
  notes: string[];
}

export class DocumentProcessingError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DocumentProcessingError";
  }
}

interface TextNodeRecord {
  node: XmlElement;
  oldText: string;
}
interface RewriteRecord {
  source: string;
  rewritten: string;
  riskScore: number;
  issues: string[];
}
interface PdfTextBlock {
  id: number;
  page: number;
  block: number;
  bbox: number[];
  text: string;
  font: string;
  size: number;
  color: number;
  flags: number;
}
interface PdfDescription {
  pages: number;
  blocks: PdfTextBlock[];
  characters: number;
}
interface PdfWorkerResponse extends Partial<PdfDescription> {
  ok: boolean;
  error?: string;
  code?: string;
  data?: string;
  applied?: { id: number; page: number }[];
  skipped?: string[];
}

function xmlText(node: XmlElement): string {
  return node.textContent ?? "";
}

function paragraphTextNodes(paragraph: XmlElement): TextNodeRecord[] {
  const nodes = Array.from(paragraph.getElementsByTagNameNS(WORD_NS, "t"));
  return nodes.map((node) => ({ node, oldText: xmlText(node) }));
}

function isProtectedDocxParagraph(paragraph: XmlElement): boolean {
  if (
    paragraph.getElementsByTagNameNS(WORD_NS, "hyperlink").length > 0 ||
    paragraph.getElementsByTagNameNS(WORD_NS, "instrText").length > 0 ||
    paragraph.getElementsByTagNameNS(WORD_NS, "del").length > 0 ||
    paragraph.getElementsByTagNameNS(WORD_NS, "ins").length > 0 ||
    paragraph.getElementsByTagNameNS(WORD_NS, "oMath").length > 0
  )
    return true;
  const styles = [
    ...Array.from(paragraph.getElementsByTagNameNS(WORD_NS, "pStyle")),
    ...Array.from(paragraph.getElementsByTagNameNS(WORD_NS, "rStyle")),
  ];
  return styles.some((style) =>
    /(?:code|source|preformatted|macro)/i.test(
      style.getAttributeNS(WORD_NS, "val") ?? "",
    ),
  );
}

function allocateAcrossTextNodes(
  text: string,
  records: TextNodeRecord[],
): string[] {
  if (records.length === 1) return [text];
  const weights = records.map(({ oldText }) => Math.max(oldText.length, 0));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total === 0) return [text, ...records.slice(1).map(() => "")];

  const parts = text.match(/\S+\s*|\s+/g) ?? [];
  const assigned = records.map(() => "");
  let partIndex = 0;
  let weightPassed = 0;
  for (
    let index = 0;
    index < records.length - 1 && partIndex < parts.length;
    index += 1
  ) {
    weightPassed += weights[index] ?? 0;
    const targetLength = (text.length * weightPassed) / total;
    while (partIndex < parts.length) {
      const current = assigned[index] ?? "";
      const next = parts[partIndex] ?? "";
      let laterCharacters = 0;
      for (
        let nextIndex = partIndex + 1;
        nextIndex < parts.length;
        nextIndex += 1
      )
        laterCharacters += (parts[nextIndex] ?? "").length;
      if (
        current.length >= targetLength ||
        (current.length > 0 &&
          current.length + next.length - targetLength >
            targetLength - current.length) ||
        laterCharacters < records.length - index - 1
      )
        break;
      assigned[index] = current + next;
      partIndex += 1;
    }
  }
  assigned[records.length - 1] = parts.slice(partIndex).join("");
  if (assigned.join("") !== text)
    return [text, ...records.slice(1).map(() => "")];
  return assigned;
}

function setTextNodeValue(node: XmlElement, text: string): void {
  while (node.firstChild) node.removeChild(node.firstChild);
  node.appendChild(node.ownerDocument!.createTextNode(text));
  const element = node;
  const whitespace = /^\s|\s$/.test(text);
  if (whitespace)
    element.setAttributeNS(
      "http://www.w3.org/XML/1998/namespace",
      "xml:space",
      "preserve",
    );
  else
    element.removeAttributeNS("http://www.w3.org/XML/1998/namespace", "space");
}

function replaceDocxParagraph(
  records: TextNodeRecord[],
  rewritten: string,
): void {
  const pieces = allocateAcrossTextNodes(rewritten, records);
  records.forEach((record, index) =>
    setTextNodeValue(record.node, pieces[index] ?? ""),
  );
}

async function rewriteRecords(
  records: { text: string; location: string }[],
  style: WritingStyle,
  provider: OpenAIRewriteProvider,
): Promise<{ rewrites: Map<string, RewriteRecord>; skipped: string[] }> {
  const rewrites = new Map<string, RewriteRecord>();
  const skipped: string[] = [];
  const eligible: typeof records = [];
  let total = 0;
  for (const record of records) {
    const text = record.text.trim();
    if (!text || classify(text) !== "prose") {
      skipped.push(record.location);
      continue;
    }
    if (text.length > MAX_PARAGRAPH_CHARS) {
      skipped.push(record.location);
      continue;
    }
    total += text.length;
    if (total > MAX_DOCUMENT_CHARS)
      throw new DocumentProcessingError(
        `Document exceeds the ${MAX_DOCUMENT_CHARS.toLocaleString()} character limit.`,
        "DOCUMENT_TOO_LARGE",
        413,
      );
    eligible.push({ ...record, text });
  }
  if (!eligible.length)
    throw new DocumentProcessingError(
      "No prose paragraphs were found in this file.",
      "NO_PROSE",
    );
  if (eligible.length > MAX_DOCUMENT_BLOCKS)
    throw new DocumentProcessingError(
      `Documents may contain at most ${MAX_DOCUMENT_BLOCKS} prose blocks.`,
      "TOO_MANY_BLOCKS",
      413,
    );

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < eligible.length) {
      const record = eligible[next++];
      if (!record) return;
      const result = await provider.rewrite({ text: record.text, style });
      rewrites.set(record.location, {
        source: record.text,
        rewritten: result.rewritten,
        riskScore: result.validation.riskScore,
        issues: result.validation.issues,
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(3, eligible.length) }, worker),
  );
  return { rewrites, skipped };
}

function addRewriteIssues(rewrites: Map<string, RewriteRecord>): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let total = 0;
  for (const [location, rewrite] of rewrites) {
    total = Math.max(total, rewrite.riskScore);
    for (const issue of rewrite.issues) issues.push(`${location}: ${issue}`);
  }
  return { score: Math.min(100, total), issues: issues.slice(0, 30) };
}

async function rewriteDocx(
  bytes: Uint8Array,
  filename: string,
  style: WritingStyle,
  provider: OpenAIRewriteProvider,
): Promise<DocumentResult> {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch {
    throw new DocumentProcessingError(
      "This DOCX file is damaged or is not a valid Word document.",
      "INVALID_DOCX",
    );
  }
  if (!archive["word/document.xml"] || !archive["[Content_Types].xml"])
    throw new DocumentProcessingError(
      "This file is not a valid DOCX document.",
      "INVALID_DOCX",
    );

  const serializer = new XMLSerializer();
  const parts: {
    name: string;
    document: XmlDocument;
    paragraphs: { location: string; records: TextNodeRecord[] }[];
  }[] = [];
  const sourceParagraphs: { text: string; location: string }[] = [];
  let protectedParagraphs = 0;
  for (const [name, contents] of Object.entries(archive)) {
    if (
      !/^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(
        name,
      )
    )
      continue;
    const xml = strFromU8(contents);
    let parseError = "";
    const document = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") parseError = message;
      },
    }).parseFromString(xml, "application/xml");
    if (parseError)
      throw new DocumentProcessingError(
        "This DOCX contains malformed document XML and could not be processed safely.",
        "INVALID_DOCX",
      );
    const paragraphs = Array.from(
      document.getElementsByTagNameNS(WORD_NS, "p"),
    );
    const indexed = paragraphs
      .map((paragraph, index) => {
        if (isProtectedDocxParagraph(paragraph)) {
          protectedParagraphs += 1;
          return undefined;
        }
        const nodes = paragraphTextNodes(paragraph);
        const text = nodes.map(({ oldText }) => oldText).join("");
        if (!text.trim()) return undefined;
        const location = `${name}#${index}`;
        sourceParagraphs.push({ text, location });
        return { location, records: nodes };
      })
      .filter((item): item is { location: string; records: TextNodeRecord[] } =>
        Boolean(item),
      );
    parts.push({ name, document, paragraphs: indexed });
  }

  const { rewrites, skipped } = await rewriteRecords(
    sourceParagraphs,
    style,
    provider,
  );
  for (const part of parts) {
    for (const paragraph of part.paragraphs) {
      const rewrite = rewrites.get(paragraph.location);
      if (rewrite && rewrite.riskScore === 0)
        replaceDocxParagraph(paragraph.records, rewrite.rewritten);
    }
    archive[part.name] = strToU8(
      serializer.serializeToString(
        part.document as Parameters<
          InstanceType<typeof XMLSerializer>["serializeToString"]
        >[0],
      ),
    );
  }
  const risk = addRewriteIssues(rewrites);
  const riskyCount = [...rewrites.values()].filter(
    (rewrite) => rewrite.riskScore > 0,
  ).length;
  return {
    bytes: zipSync(archive, { level: 6 }),
    contentType: DOCX_MIME,
    filename: outputName(filename),
    paragraphsProcessed: rewrites.size - riskyCount,
    paragraphsSkipped: skipped.length + riskyCount + protectedParagraphs,
    riskScore: risk.score,
    issues: risk.issues,
    notes: [
      "DOCX package parts, paragraph styles, tables, and run formatting are retained. Risky paragraphs are kept unchanged.",
    ],
  };
}

function outputName(filename: string): string {
  const stem =
    filename
      .replace(/\.(?:docx|pdf)$/i, "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .slice(0, 110) || "document";
  return `${stem}-HumanizerDad.${filename.toLowerCase().endsWith(".pdf") ? "pdf" : "docx"}`;
}

function callPdfWorker<T extends PdfWorkerResponse>(
  request: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_EXECUTABLE ?? "python";
    const child = spawn(python, [PYTHON_WORKER], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    const output: Buffer[] = [];
    let size = 0;
    const timeout = setTimeout(() => {
      child.kill();
      reject(
        new DocumentProcessingError(
          "PDF processing took too long. Your original file is unchanged.",
          "PDF_TIMEOUT",
          504,
        ),
      );
    }, 90_000);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 100 * 1024 * 1024) {
        child.kill();
        reject(
          new DocumentProcessingError(
            "Processed PDF exceeds the output limit.",
            "PDF_TOO_LARGE",
            413,
          ),
        );
        return;
      }
      output.push(chunk);
    });
    child.on("error", () => {
      clearTimeout(timeout);
      reject(
        new DocumentProcessingError(
          "PDF support requires Python and PyMuPDF. Install apps/api/requirements.txt.",
          "PDF_RUNTIME_MISSING",
          503,
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(
          new DocumentProcessingError(
            "The PDF processor stopped unexpectedly. Your original file is unchanged.",
            "PDF_PROCESSING_FAILED",
            500,
          ),
        );
        return;
      }
      try {
        const response = JSON.parse(
          Buffer.concat(output).toString("utf8"),
        ) as T;
        if (!response.ok)
          reject(
            new DocumentProcessingError(
              response.error ?? "The PDF could not be processed.",
              response.code ?? "PDF_PROCESSING_FAILED",
            ),
          );
        else resolve(response);
      } catch (error) {
        if (error instanceof DocumentProcessingError) reject(error);
        else
          reject(
            new DocumentProcessingError(
              "The PDF processor returned an invalid response.",
              "PDF_PROCESSING_FAILED",
              500,
            ),
          );
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function rewritePdf(
  bytes: Uint8Array,
  filename: string,
  style: WritingStyle,
  provider: OpenAIRewriteProvider,
): Promise<DocumentResult> {
  const data = Buffer.from(bytes).toString("base64");
  const description = await callPdfWorker<PdfWorkerResponse & PdfDescription>({
    operation: "describe",
    data,
  });
  const records = description.blocks.map((block) => ({
    text: block.text,
    location: `page ${block.page + 1}, block ${block.block + 1}`,
  }));
  const { rewrites, skipped } = await rewriteRecords(records, style, provider);
  const edits = description.blocks.flatMap((block) => {
    const rewrite = rewrites.get(
      `page ${block.page + 1}, block ${block.block + 1}`,
    );
    return rewrite && rewrite.riskScore === 0
      ? [{ id: block.id, rewritten: rewrite.rewritten }]
      : [];
  });
  const riskyCount = [...rewrites.values()].filter(
    (rewrite) => rewrite.riskScore > 0,
  ).length;
  if (!edits.length)
    throw new DocumentProcessingError(
      "Every rewritten paragraph triggered a content safety check, so the PDF was left unchanged.",
      "PDF_RISK_CHECK",
    );
  const rendered = await callPdfWorker<PdfWorkerResponse>({
    operation: "rewrite",
    data,
    edits,
  });
  if (!rendered.data)
    throw new DocumentProcessingError(
      "The PDF processor produced no file.",
      "PDF_PROCESSING_FAILED",
      500,
    );
  const risk = addRewriteIssues(rewrites);
  const skippedByLayout = rendered.skipped?.length ?? 0;
  const appliedCount = rendered.applied?.length ?? 0;
  return {
    bytes: new Uint8Array(Buffer.from(rendered.data, "base64")),
    contentType: PDF_MIME,
    filename: outputName(filename),
    paragraphsProcessed: appliedCount,
    paragraphsSkipped: skipped.length + riskyCount + skippedByLayout,
    riskScore: risk.score,
    issues: risk.issues,
    notes: [
      ...(rendered.skipped ?? []),
      "PDF page geometry, images, and unrelated vector elements remain in place. Paragraphs that would not fit are retained unchanged.",
    ],
  };
}

export async function rewriteUploadedDocument(
  file: File,
  style: WritingStyle,
  provider: OpenAIRewriteProvider,
): Promise<DocumentResult> {
  const filename = file.name || "document";
  const extension = filename.match(/\.(docx|pdf)$/i)?.[1]?.toLowerCase();
  if (file.size === 0)
    throw new DocumentProcessingError(
      "The selected file is empty.",
      "EMPTY_FILE",
    );
  if (file.size > MAX_FILE_BYTES)
    throw new DocumentProcessingError(
      "Files are limited to 15 MB.",
      "FILE_TOO_LARGE",
      413,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === "docx" && file.type !== "application/pdf")
    return rewriteDocx(bytes, filename, style, provider);
  if (
    extension === "pdf" &&
    (file.type === "application/pdf" ||
      (bytes[0] === 0x25 && bytes[1] === 0x50))
  )
    return rewritePdf(bytes, filename, style, provider);
  throw new DocumentProcessingError(
    "Choose one DOCX Word document or a text-based PDF.",
    "UNSUPPORTED_FILE_TYPE",
    415,
  );
}
