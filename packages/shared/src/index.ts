export type WritingStyle = "clear" | "concise" | "professional" | "friendly";

export interface RewriteInput {
  text: string;
  style: WritingStyle;
}

export interface ValidationResult {
  riskScore: number;
  issues: string[];
  isSafe: boolean;
}

export interface RewriteResult {
  rewritten: string;
  validation: ValidationResult;
}

export interface RewriteProvider {
  rewrite(input: RewriteInput): Promise<RewriteResult>;
  validate(original: string, rewritten: string): ValidationResult;
}

export type ContentKind = "prose" | "code" | "url" | "markdown";

export interface HistoryEntry {
  id: string;
  createdAt: string;
  source: string | null;
  original: string;
  rewritten: string;
  style: WritingStyle;
  riskScore: number;
}

