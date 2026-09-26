const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase());
}

export function normalizeEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  return `${local}@${domain}`;
}
