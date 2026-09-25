import { OpenAIRewriteProvider } from "@naturalwrite/ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { checkLimit, corsHeaders, jsonError, prisma, styles, userFrom } from "../../../lib";
import {
  DocumentProcessingError,
  rewriteUploadedDocument,
} from "../../../documents";

export const runtime = "nodejs";
export const maxDuration = 300;

const styleSchema = z.enum(styles);

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const userId = userFrom(request);
    const form = await request.formData();
    const files = form.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File))
      return Response.json(
        { error: "Upload exactly one DOCX or PDF document." },
        { status: 400, headers: corsHeaders },
      );
    const parsedStyle = styleSchema.safeParse(form.get("style") ?? "clear");
    if (!parsedStyle.success)
      return Response.json(
        { error: "Choose one of the available writing styles." },
        { status: 400, headers: corsHeaders },
      );
    await checkLimit(userId);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return Response.json(
        { error: "The document rewrite service is not configured yet." },
        { status: 503, headers: corsHeaders },
      );
    const provider = new OpenAIRewriteProvider(
      apiKey,
      process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    );
    const result = await rewriteUploadedDocument(
      files[0],
      parsedStyle.data,
      provider,
    );
    try {
      await prisma.usageEvent.create({
        data: {
          userId,
          kind: `document_${result.contentType === "application/pdf" ? "pdf" : "docx"}`,
        },
      });
    } catch {
      // In local dev without DB, continue
    }
    const report = {
      paragraphsProcessed: result.paragraphsProcessed,
      paragraphsSkipped: result.paragraphsSkipped,
      riskScore: result.riskScore,
      notes: result.notes,
    };
    return new Response(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
        "X-HumanizerDad-Report": Buffer.from(JSON.stringify(report)).toString(
          "base64url",
        ),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED")
      return Response.json(
        {
          error:
            "Unauthorized. Add your HumanizerDad workspace key in Settings.",
        },
        { status: 401, headers: corsHeaders },
      );
    if (error instanceof Error && error.message === "DAILY_CAP_REACHED")
      return Response.json(
        { error: "You have reached today's document and rewrite limit." },
        { status: 429, headers: corsHeaders },
      );
    if (error instanceof DocumentProcessingError)
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: corsHeaders },
      );
    console.error("Document rewrite error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The document could not be rewritten. Your original file is unchanged.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
