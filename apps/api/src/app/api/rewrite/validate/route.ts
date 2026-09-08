import { OpenAIRewriteProvider } from "@naturalwrite/ai";
import { NextRequest } from "next/server";
import { jsonError, userFrom } from "../../../../lib";
import { z } from "zod";

const schema = z.object({ original: z.string().min(1), rewritten: z.string().min(1) });
export async function POST(request: NextRequest): Promise<Response> {
  try { userFrom(request); const value = schema.parse(await request.json()); return Response.json(new OpenAIRewriteProvider("unused", "unused").validate(value.original, value.rewritten)); }
  catch { return jsonError("Invalid validation request.", 400); }
}

