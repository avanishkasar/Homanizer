import OpenAI from "openai";
import type { RewriteInput, RewriteProvider, RewriteResult, ValidationResult } from "@naturalwrite/shared";

const protectedTokens = (value: string): string[] =>
  [...value.matchAll(/\b\d+(?:[.,]\d+)?%?\b|\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\b|https?:\/\/[^\s]+|\[[^\]]+\]\([^)]*\)/g)].map(
    (match) => match[0],
  );

export class OpenAIRewriteProvider implements RewriteProvider {
  private readonly client: OpenAI;

  public constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  public async rewrite(input: RewriteInput): Promise<RewriteResult> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions:
        "Rewrite only prose for clarity, flow, and readability. Preserve every fact, name, number, date, quotation, citation, and meaning. Do not invent claims or add citations. Return only the rewritten text.",
      input: `Style: ${input.style}\n\nText:\n${input.text}`,
    });
    const rewritten = response.output_text.trim();
    if (!rewritten) throw new Error("The rewrite model returned no text.");
    return { rewritten, validation: this.validate(input.text, rewritten) };
  }

  public validate(original: string, rewritten: string): ValidationResult {
    const missing = protectedTokens(original).filter((token) => !rewritten.includes(token));
    const issues = missing.map((token) => `Protected value missing or changed: ${token}`);
    const riskScore = Math.min(100, missing.length * 25 + (rewritten.length < original.length * 0.35 ? 25 : 0));
    return { riskScore, issues, isSafe: riskScore === 0 };
  }
}

