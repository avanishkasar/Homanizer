import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { strFromU8, unzipSync, zipSync } from "fflate";
import type { OpenAIRewriteProvider } from "@naturalwrite/ai";
import type { WritingStyle } from "@naturalwrite/shared";
import { rewriteUploadedDocument } from "./documents";

const mainXml = (paragraphs: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`;
const paragraph = (runs: string, style = "Normal"): string =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs}</w:p>`;
const run = (text: string, formatting = ""): string =>
  `<w:r>${formatting}<w:t>${text}</w:t></w:r>`;
const contentTypes =
  '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>';

function providerFor(rewrite: (text: string) => string): OpenAIRewriteProvider {
  return {
    rewrite: async ({ text }: { text: string; style: WritingStyle }) => ({
      rewritten: rewrite(text),
      validation: { riskScore: 0, issues: [], isSafe: true },
    }),
  } as unknown as OpenAIRewriteProvider;
}

function docxFile(xml: string): File {
  const archive = zipSync({
    "[Content_Types].xml": new TextEncoder().encode(contentTypes),
    "word/document.xml": new TextEncoder().encode(xml),
    "word/media/pixel.bin": new Uint8Array([0, 1, 2, 255]),
  });
  return new File([Buffer.from(archive)], "sample.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

describe("DOCX upload rewriting", () => {
  it("rewrites prose while retaining paragraph styles, run formatting, and unrelated package parts", async () => {
    const xml = mainXml(
      paragraph(
        `${run("The report explains ", "<w:rPr><w:b/></w:rPr>")}${run("the useful result.")}`,
        "BodyText",
      ),
    );
    const result = await rewriteUploadedDocument(
      docxFile(xml),
      "clear",
      providerFor(() => "The report describes the helpful result."),
    );
    const output = unzipSync(result.bytes);
    const documentXml = strFromU8(output["word/document.xml"]!);
    expect(documentXml).toContain('w:val="BodyText"');
    expect(documentXml).toContain("<w:b");
    expect(documentXml.replace(/<[^>]*>/g, "")).toContain(
      "The report describes the helpful result.",
    );
    expect(output["word/media/pixel.bin"]).toEqual(
      new Uint8Array([0, 1, 2, 255]),
    );
    expect(result.paragraphsProcessed).toBe(1);
  });

  it("keeps hyperlinks and risky rewrites unchanged", async () => {
    const xml = mainXml(
      paragraph(run("A useful paragraph that should remain untouched.")) +
        `<w:p><w:hyperlink r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${run("https://example.com")}</w:hyperlink></w:p>`,
    );
    const result = await rewriteUploadedDocument(docxFile(xml), "clear", {
      rewrite: async ({ text }: { text: string; style: WritingStyle }) => ({
        rewritten: `Changed: ${text}`,
        validation: {
          riskScore: 30,
          issues: ["Protected detail changed"],
          isSafe: false,
        },
      }),
    } as unknown as OpenAIRewriteProvider);
    const documentXml = strFromU8(
      unzipSync(result.bytes)["word/document.xml"]!,
    );
    expect(documentXml).toContain(
      "A useful paragraph that should remain untouched.",
    );
    expect(documentXml).toContain("https://example.com");
    expect(result.paragraphsSkipped).toBe(2);
    expect(result.riskScore).toBe(30);
  });

  it("rejects unsupported and oversized input before processing", async () => {
    await expect(
      rewriteUploadedDocument(
        new File(["plain text"], "sample.txt"),
        "clear",
        providerFor((text) => text),
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
    await expect(
      rewriteUploadedDocument(
        new File([""], "empty.docx"),
        "clear",
        providerFor((text) => text),
      ),
    ).rejects.toMatchObject({ code: "EMPTY_FILE" });
  });
});

describe("PDF upload rewriting", () => {
  it("runs the complete extraction, prose rewrite, and safe PDF output pipeline", async () => {
    const script =
      "import base64,pymupdf; d=pymupdf.open(); p=d.new_page(width=612,height=792); p.insert_text((72,100),'A document heading',fontsize=20); p.insert_textbox(pymupdf.Rect(72,140,400,190),'A sentence that can be improved.',fontsize=12); print(base64.b64encode(d.tobytes()).decode())";
    const encoded = execFileSync(
      process.env.PYTHON_EXECUTABLE ?? "python",
      ["-c", script],
      { encoding: "utf8" },
    ).trim();
    const file = new File([Buffer.from(encoded, "base64")], "sample.pdf", {
      type: "application/pdf",
    });
    const result = await rewriteUploadedDocument(
      file,
      "clear",
      providerFor((text) => text.includes("sentence") ? "A clearer sentence." : text),
    );
    expect(Buffer.from(result.bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.filename).toBe("sample-HumanizerDad.pdf");
    expect(result.paragraphsProcessed).toBe(2);
    expect(result.paragraphsSkipped).toBe(0);
  });
});
