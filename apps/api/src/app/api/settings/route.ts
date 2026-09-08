import { NextRequest } from "next/server";
import { jsonError, prisma, styles, userFrom } from "../../../lib";
import { z } from "zod";

const patchSchema = z.object({ defaultStyle: z.enum(styles).optional(), dailyCap: z.number().int().min(1).max(500).optional() });
export async function GET(request: NextRequest): Promise<Response> {
  try { const userId = userFrom(request); return Response.json(await prisma.userSettings.upsert({ where: { userId }, update: {}, create: { userId } })); }
  catch { return jsonError("Unauthorized.", 401); }
}
export async function PATCH(request: NextRequest): Promise<Response> {
  try { const userId = userFrom(request); const changes = patchSchema.parse(await request.json()); return Response.json(await prisma.userSettings.upsert({ where: { userId }, update: changes, create: { userId, ...changes } })); }
  catch { return jsonError("Invalid settings request.", 400); }
}

