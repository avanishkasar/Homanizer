import type { RewriteResult, WritingStyle } from "@naturalwrite/shared";
import { getSettings } from "./config";

interface SelectionTarget { element: HTMLInputElement | HTMLTextAreaElement | HTMLElement; original: string; start?: number; end?: number; }
let current: SelectionTarget | null = null;
let action: HTMLButtonElement | null = null;

function selectedTarget(): SelectionTarget | null {
  const element = document.activeElement;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart; const end = element.selectionEnd;
    return start !== null && end !== null && end > start ? { element, original: element.value.slice(start, end), start, end } : null;
  }
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const container = selection.getRangeAt(0).commonAncestorContainer;
  const host = container.nodeType === Node.ELEMENT_NODE ? container as HTMLElement : container.parentElement;
  if (!host?.closest("[contenteditable='true']")) return null;
  return { element: host.closest("[contenteditable='true']") as HTMLElement, original: selection.toString() };
}

function chunks(text: string, max = 6000): string[] {
  const paragraphs = text.split(/(\n\s*\n)/); const output: string[] = []; let group = "";
  for (const part of paragraphs) { if (group.length + part.length > max && group) { output.push(group); group = ""; } group += part; }
  if (group) output.push(group); return output;
}

function showAction(x: number, y: number): void {
  action?.remove(); action = document.createElement("button"); action.textContent = "Transform";
  action.style.cssText = `position:fixed;z-index:2147483647;left:${x}px;top:${y + 12}px;background:#4f46e5;color:#fff;border:0;border-radius:6px;padding:8px 12px;font:600 13px system-ui;cursor:pointer;box-shadow:0 4px 12px #0004;`;
  action.onclick = () => { void transform(); }; document.body.append(action);
}

async function transform(): Promise<void> {
  if (!current) return; action?.remove(); action = null;
  const settings = await getSettings();
  if (!settings.apiKey) return showDialog(current, "", [], "Configure an API key in the NaturalWrite extension popup.");
  try {
    const replies = await Promise.all(chunks(current.original).map(async (text) => {
      const response = await fetch(`${settings.apiBaseUrl}/api/rewrite`, { method: "POST", headers: { "content-type": "application/json", "x-naturalwrite-key": settings.apiKey }, body: JSON.stringify({ text, style: settings.style as WritingStyle, source: location.origin }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Rewrite request failed.");
      return response.json() as Promise<RewriteResult & { skipped?: boolean; reason?: string }>;
    }));
    if (replies.some((reply) => reply.skipped)) throw new Error(replies.find((reply) => reply.skipped)?.reason ?? "This selection cannot be transformed.");
    showDialog(current, replies.map((reply) => reply.rewritten).join(""), replies.flatMap((reply) => reply.validation.issues), null);
  } catch (error) { showDialog(current, "", [], error instanceof Error ? error.message : "Rewrite request failed."); }
}

function replace(target: SelectionTarget, rewritten: string): void {
  if (target.element instanceof HTMLInputElement || target.element instanceof HTMLTextAreaElement) {
    if (target.start === undefined || target.end === undefined) return;
    target.element.setRangeText(rewritten, target.start, target.end, "end"); target.element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: rewritten })); return;
  }
  const selection = window.getSelection(); if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(document.createTextNode(rewritten)); selection.removeAllRanges();
  target.element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: rewritten }));
}

function showDialog(target: SelectionTarget, rewritten: string, issues: string[], error: string | null): void {
  const overlay = document.createElement("div"); overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0008;display:grid;place-items:center;font-family:system-ui";
  const panel = document.createElement("section"); panel.style.cssText = "width:min(900px,92vw);max-height:85vh;overflow:auto;background:#111827;color:#f9fafb;border:1px solid #374151;border-radius:12px;padding:20px";
  panel.innerHTML = error ? `<h2>NaturalWrite</h2><p>${escapeHtml(error)}</p>` : `<h2>Review rewrite</h2><p>${issues.length ? `Risk review: ${escapeHtml(issues.join("; "))}` : "Validation found no changed protected values."}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><article><h3>Original</h3><pre>${escapeHtml(target.original)}</pre></article><article><h3>Rewritten</h3><pre>${escapeHtml(rewritten)}</pre></article></div>`;
  const buttons = document.createElement("div"); buttons.style.cssText = "display:flex;gap:8px;margin-top:16px";
  const cancel = document.createElement("button"); cancel.textContent = error ? "Close" : "Cancel"; cancel.onclick = () => overlay.remove(); buttons.append(cancel);
  if (!error) { const copy = document.createElement("button"); copy.textContent = "Copy"; copy.onclick = () => { void navigator.clipboard.writeText(rewritten); }; const apply = document.createElement("button"); apply.textContent = "Replace"; apply.onclick = () => { replace(target, rewritten); overlay.remove(); }; buttons.append(copy, apply); }
  panel.append(buttons); overlay.append(panel); document.body.append(overlay);
}
function escapeHtml(value: string): string { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
document.addEventListener("mouseup", (event) => { setTimeout(() => { current = selectedTarget(); if (current) showAction(event.clientX, event.clientY); else { action?.remove(); action = null; } }, 0); });
