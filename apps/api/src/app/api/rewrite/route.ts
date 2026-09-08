import { OpenAIRewriteProvider } from "@naturalwrite/ai";
import { NextRequest } from "next/server";
import { checkLimit, classify, jsonError, prisma, rewriteRequest, userFrom } from "../../../lib";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const userId = userFrom(request);
    const payload = rewriteRequest.parse(await request.json());
    const max = Number(process.env.MAX_INPUT_CHARS ?? 12000);
    if (payload.text.length > max) return jsonError(`Input exceeds the ${max}-character limit.`, 413);
    const kind = classify(payload.text);
    if (kind !== "prose") return Response.json({ skipped: true, kind, reason: "Only prose is rewritten; code, URLs, and Markdown are protected." });
    await checkLimit(userId);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonError("OPENAI_API_KEY is not configured.", 503);
    const provider = new OpenAIRewriteProvider(apiKey, process.env.OPENAI_MODEL ?? "gpt-4.1-mini");
    const result = await provider.rewrite(payload);
    const entry = await prisma.historyEntry.create({ data: { userId, source: payload.source, original: payload.text, rewritten: result.rewritten, style: payload.style, riskScore: result.validation.riskScore } });
    return Response.json({ id: entry.id, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized.", 401);
    if (error instanceof Error && error.message === "DAILY_CAP_REACHED") return jsonError("Daily rewrite cap reached.", 429);
    return jsonError("Unable to process the rewrite request.", 400);
  }
}

