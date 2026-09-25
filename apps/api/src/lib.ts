import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

export const prisma = globalThis.__naturalwritePrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production")
  globalThis.__naturalwritePrisma = prisma;

declare global {
  var __naturalwritePrisma: PrismaClient | undefined;
}

export const styles = ["clear", "concise", "professional", "friendly"] as const;
export const rewriteRequest = z.object({
  text: z.string().min(1),
  style: z.enum(styles).default("clear"),
  source: z.string().max(2048).optional(),
});

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-naturalwrite-key",
  "Access-Control-Expose-Headers": "Content-Disposition, X-HumanizerDad-Report",
  "Access-Control-Allow-Private-Network": "true",
};

export function userFrom(request: NextRequest): string {
  const configured = process.env.NATURALWRITE_API_KEY;
  const supplied = request.headers.get("x-naturalwrite-key");
  if (!configured || !supplied || supplied !== configured)
    throw new Error("UNAUTHORIZED");
  return "local-user";
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: corsHeaders });
}

export function classify(text: string): "prose" | "code" | "url" | "markdown" {
  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/.test(trimmed)) return "url";
  if (
    /^```|^\s*(?:const|let|var|function|class|import|export)\b/m.test(
      trimmed,
    ) ||
    /[{}];\s*$/.test(trimmed)
  )
    return "code";
  if (/^\s*(#{1,6}\s|[-*+]\s|\[.+\]\(.+\)|```)/m.test(trimmed))
    return "markdown";
  return "prose";
}

export async function checkLimit(userId: string): Promise<void> {
  const cap = Number(process.env.DAILY_REWRITE_CAP ?? 50);
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [historyCount, uploadCount] = await Promise.all([
      prisma.historyEntry.count({ where: { userId, createdAt: { gte: today } } }),
      prisma.usageEvent.count({ where: { userId, createdAt: { gte: today } } }),
    ]);
    const count = historyCount + uploadCount;
    if (count >= cap) throw new Error("DAILY_CAP_REACHED");
  } catch (error) {
    if (error instanceof Error && error.message === "DAILY_CAP_REACHED") {
      throw error;
    }
    // In local development without PostgreSQL running, allow requests through
    console.warn("Database offline; skipped daily cap check.");
  }
}
