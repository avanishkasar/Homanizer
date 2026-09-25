import { NextRequest } from "next/server";
import { corsHeaders, jsonError, prisma, userFrom } from "../../../lib";

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = userFrom(request);
    let history: any[] = [];
    try {
      history = await prisma.historyEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
    } catch {
      // In local dev without DB, return empty history
    }
    return Response.json(history, { headers: corsHeaders });
  } catch (error) {
    return jsonError("Unauthorized.", 401);
  }
}

