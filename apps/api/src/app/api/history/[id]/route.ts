import { NextRequest } from "next/server";
import { corsHeaders, jsonError, prisma, userFrom } from "../../../../lib";

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const userId = userFrom(request); const { id } = await context.params;
    const result = await prisma.historyEntry.deleteMany({ where: { id, userId } });
    if (!result.count) return jsonError("History entry not found.", 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  } catch { return jsonError("Unable to delete history entry.", 400); }
}

