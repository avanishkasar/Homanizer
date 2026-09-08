import { NextRequest } from "next/server";
import { jsonError, prisma, userFrom } from "../../../lib";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = userFrom(request);
    const history = await prisma.historyEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
    return Response.json(history);
  } catch { return jsonError("Unauthorized.", 401); }
}

