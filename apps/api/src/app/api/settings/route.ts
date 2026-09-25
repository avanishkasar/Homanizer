import { NextRequest } from "next/server";
import { corsHeaders, jsonError, prisma, styles, userFrom } from "../../../lib";
import { z } from "zod";

const patchSchema = z.object({ defaultStyle: z.enum(styles).optional(), dailyCap: z.number().int().min(1).max(500).optional() });

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = userFrom(request);
    let settings: { userId: string; defaultStyle: string; dailyCap: number; updatedAt?: Date } = {
      userId,
      defaultStyle: "clear",
      dailyCap: 50,
    };
    try {
      settings = await prisma.userSettings.upsert({ where: { userId }, update: {}, create: { userId } });
    } catch {
      // In local dev without DB, return default settings
    }
    return Response.json(settings, { headers: corsHeaders });
  } catch {
    return jsonError("Unauthorized.", 401);
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const userId = userFrom(request);
    const changes = patchSchema.parse(await request.json());
    let settings: { userId: string; defaultStyle: string; dailyCap: number; updatedAt?: Date } = {
      userId,
      defaultStyle: changes.defaultStyle ?? "clear",
      dailyCap: changes.dailyCap ?? 50,
    };
    try {
      settings = await prisma.userSettings.upsert({ where: { userId }, update: changes, create: { userId, ...changes } });
    } catch {
      // In local dev without DB
    }
    return Response.json(settings, { headers: corsHeaders });
  } catch {
    return jsonError("Invalid settings request.", 400);
  }
}

