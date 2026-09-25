import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryEntry, WritingStyle } from "@naturalwrite/shared";
import { createRoot } from "react-dom/client";
import "./styles.css";

const api = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const sample = "Our team is excited to share that we have made some improvements to the way project updates are communicated, which should make it easier for everyone to stay informed and understand what needs their attention.";
const styles: { id: WritingStyle; label: string; hint: string }[] = [
  { id: "clear", label: "Clear", hint: "Natural & easy to follow" },
  { id: "concise", label: "Concise", hint: "Tighter, fewer words" },
  { id: "professional", label: "Professional", hint: "Polished & assured" },
  { id: "friendly", label: "Friendly", hint: "Warm & conversational" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }): React.JSX.Element {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    pen: <><path d="m15 5 4 4"/><path d="m4 20 4-.8L19.4 7.8a2.1 2.1 0 0 0-3-3L5 16.2 4 20Z"/><path d="M13.5 6.5 17.5 10.5"/></>,
    history: <><path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z" transform="translate(-1 -1) scale(1.08)"/></>,
    sparkle: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.sparkle}</svg>;
}

function App(): React.JSX.Element {
  const [key, setKey] = useState(() => localStorage.getItem("naturalwrite.apiKey") ?? "");
  const [text, setText] = useState(sample);
  const [style, setStyle] = useState<WritingStyle>("clear");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rewritten, setRewritten] = useState("");
  const [risk, setRisk] = useState<{ score: number; issues: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<"write" | "history" | "settings">("write");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const wordCount = useMemo(() => text.trim() ? text.trim().split(/\s+/).length : 0, [text]);

  const load = useCallback(async (): Promise<void> => {
    if (!key) { setHistory([]); return; }
    try {
      const response = await fetch(`${api}/api/history`, { headers: { "x-naturalwrite-key": key } });
      if (!response.ok) { setMessage("Could not connect. Check the API key and server URL in settings."); return; }
      setHistory(await response.json() as HistoryEntry[]); setMessage("");
    } catch { setMessage("API is offline. Start the NaturalWrite API to sync your history."); }
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  const transform = async (): Promise<void> => {
    if (!text.trim()) { setMessage("Add some text before transforming."); return; }
    if (!key) { setMessage("Add your API key in Settings to start transforming."); setView("settings"); return; }
    setBusy(true); setMessage(""); setRewritten(""); setRisk(null);
    try {
      const response = await fetch(`${api}/api/rewrite`, { method: "POST", headers: { "content-type": "application/json", "x-naturalwrite-key": key }, body: JSON.stringify({ text, style, source: "naturalwrite-web" }) });
      const result = await response.json() as { rewritten?: string; validation?: { riskScore: number; issues: string[] }; error?: string; skipped?: boolean; reason?: string };
      if (!response.ok) throw new Error(result.error ?? "Rewrite request failed.");
      if (result.skipped || !result.rewritten) throw new Error(result.reason ?? "This selection cannot be transformed.");
      setRewritten(result.rewritten); setRisk(result.validation ? { score: result.validation.riskScore, issues: result.validation.issues } : null); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not transform this text."); }
    finally { setBusy(false); }
  };

  const saveStyle = async (): Promise<void> => {
    if (!key) { setMessage("Add your API key to save settings."); return; }
    try {
      const response = await fetch(`${api}/api/settings`, { method: "PATCH", headers: { "content-type": "application/json", "x-naturalwrite-key": key }, body: JSON.stringify({ defaultStyle: style }) });
      setMessage(response.ok ? "Your writing style has been saved." : "Could not save settings. Check your API connection.");
    } catch { setMessage("API is offline. Start the NaturalWrite API to save settings."); }
  };

  const deleteEntry = async (id: string): Promise<void> => {
    try { await fetch(`${api}/api/history/${id}`, { method: "DELETE", headers: { "x-naturalwrite-key": key } }); await load(); }
    catch { setMessage("Could not delete this history item."); }
  };

  const copyText = async (value: string): Promise<void> => {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setMessage("Clipboard access is unavailable in this browser."); }
  };

  const chooseView = (next: typeof view): void => { setView(next); setMobileMenu(false); setMessage(""); };
  const activeStyle = styles.find((item) => item.id === style) ?? styles[0]!;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <a className="brand" href="#write" onClick={() => chooseView("write")}><span className="brand-mark"><Icon name="pen" size={20}/></span><span>natural<span className="brand-light">write</span><small>YOUR WRITING SPACE</small></span></a>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button className={`nav-item ${view === "write" ? "active" : ""}`} onClick={() => chooseView("write")}><Icon name="pen"/>Start writing</button>
        <button className={`nav-item ${view === "history" ? "active" : ""}`} onClick={() => chooseView("history")}><Icon name="history"/>History<span className="nav-count">{history.length}</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-note"><span className="privacy-dot"/><div><strong>Your words stay yours</strong><p>Nothing changes until you say so.</p></div></div>
        <button className={`nav-item settings-link ${view === "settings" ? "active" : ""}`} onClick={() => chooseView("settings")}><Icon name="settings"/>Settings</button>
        <div className="sidebar-foot">A little more you in every sentence.</div>
      </div>
    </aside>
    {mobileMenu && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}

    <div className="main-column">
      <header className="topbar">
        <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenu(!mobileMenu)}><Icon name={mobileMenu ? "close" : "menu"}/></button>
        <div className="breadcrumb"><span>Workspace</span><Icon name="arrow" size={13}/><strong>{view === "write" ? "New rewrite" : view === "history" ? "Your history" : "Settings"}</strong></div>
        <div className="topbar-right"><span className={`connection-dot ${key ? "connected" : ""}`}/><span>{key ? "Ready to write" : "Connect your workspace"}</span><button className="avatar" onClick={() => chooseView("settings")} aria-label="Open settings">A</button></div>
      </header>

      <main className="content">
        {view === "write" && <>
          <section className="welcome-row"><div><div className="eyebrow"><Icon name="sparkle" size={15}/> A CLEARER WAY TO SAY IT</div><h1>Good writing, <em>less friction.</em></h1><p className="welcome-copy">A little help finding the words you meant. Your voice stays yours.</p></div><div className="today-card"><span className="today-icon"><Icon name="sparkle" size={17}/></span><span><strong>{history.length} rewrites</strong><small>saved to your history</small></span></div></section>

          <div className="editor-layout">
            <section className="editor-card" aria-label="Writing editor">
              <div className="card-top"><div><span className="step-badge">01</span><div><h2>Your draft</h2><p>Paste something in. We’ll take it from here.</p></div></div><button className="text-button" onClick={() => { setText(""); setRewritten(""); setRisk(null); }}>Clear draft</button></div>
              <div className="textarea-wrap"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Start with what you have…" aria-label="Your draft"/><div className="editor-footer"><span>{wordCount} words <i/> {text.length} characters</span><span className="private-label"><span/> Private by default</span></div></div>
              <div className="style-section"><div className="section-title"><span className="step-badge">02</span><div><h2>Pick your direction</h2><p>Keep the meaning. Change the feel.</p></div></div><div className="style-grid">{styles.map((item, index) => <button key={item.id} onClick={() => setStyle(item.id)} className={`style-option ${style === item.id ? "selected" : ""}`}><span className={`style-symbol style-symbol-${index}`}>{["Aa", "↘", "A+", "✳"][index]}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span>{style === item.id && <span className="selected-check"><Icon name="check" size={13}/></span>}</button>)}</div></div>
              <div className="editor-actions"><span className="action-note"><Icon name="sparkle" size={16}/> Meaning stays yours.</span><button className="primary-button" onClick={() => void transform()} disabled={busy || !text.trim()}>{busy ? <><span className="spinner"/>Finding your words…</> : <>Transform draft <Icon name="arrow" size={16}/></>}</button></div>
            </section>

            <aside className="right-rail">
              <section className={`result-card ${rewritten ? "has-result" : ""}`}><div className="rail-heading"><div><span className="step-badge">03</span><div><h2>Your rewrite</h2><p>A suggestion, never a substitution.</p></div></div><span className="result-spark"><Icon name="sparkle" size={17}/></span></div>
                {rewritten ? <><div className="rewrite-output">{rewritten}</div><div className="result-meta"><span className={`risk-pill ${risk?.score ? "risk-review" : ""}`}><span/>{risk?.score ? `Review suggested · ${risk.score}/100` : "Protected details checked"}</span></div>{Boolean(risk?.issues.length) && <p className="risk-details">{risk!.issues.join(" · ")}</p>}<button className="copy-button" onClick={() => void copyText(rewritten)}><Icon name={copied ? "check" : "copy"} size={16}/>{copied ? "Copied to clipboard" : "Copy rewrite"}</button></> : <div className="result-empty"><div className="empty-illustration"><div className="paper paper-back"/><div className="paper paper-front"><span/><span/><span/><i><Icon name="sparkle" size={18}/></i></div></div><strong>Your words, with a little more room to breathe.</strong><p>Your rewrite will show up here, side by side with your original.</p></div>}
              </section>
              <section className="promise-card"><span className="promise-mark">“</span><p>Clarity without losing <em>your voice.</em></p><span className="promise-rule"/><small>THE NATURALWRITE PROMISE</small></section>
              <div className="safety-note"><span className="safety-check"><Icon name="check" size={13}/></span><p>No silent edits. No detector promises. Just clearer writing.</p></div>
            </aside>
          </div>
          {message && <div className="toast-message" role="status"><span className="toast-dot"/>{message}<button onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}
        </>}

        {view === "history" && <section className="page-section"><div className="eyebrow"><Icon name="history" size={15}/> YOUR WRITING, OVER TIME</div><div className="page-title-row"><div><h1>A record of <em>your progress.</em></h1><p className="welcome-copy">Every rewrite, right where you left it.</p></div><span className="history-total">{history.length} {history.length === 1 ? "rewrite" : "rewrites"}</span></div>{history.length ? <div className="history-list">{history.map((entry) => <article className="history-card" key={entry.id}><div className="history-card-top"><span className="history-style"><Icon name="sparkle" size={14}/>{entry.style}</span><span>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><button onClick={() => void deleteEntry(entry.id)} aria-label="Delete history entry" className="delete-button"><Icon name="trash" size={16}/></button></div><div className="history-columns"><div><small>ORIGINAL</small><p>{entry.original}</p></div><div><small>REWRITTEN</small><p>{entry.rewritten}</p></div></div><div className="history-card-bottom"><span className="risk-pill"><span/>{entry.riskScore ? `Review · ${entry.riskScore}/100` : "Protected details checked"}</span><button className="text-button" onClick={() => { setText(entry.original); setRewritten(entry.rewritten); setRisk({ score: entry.riskScore, issues: [] }); chooseView("write"); }}>Open rewrite <Icon name="arrow" size={14}/></button></div></article>)}</div> : <div className="empty-history"><div className="empty-illustration"><div className="paper paper-back"/><div className="paper paper-front"><span/><span/><span/><i><Icon name="history" size={18}/></i></div></div><h2>A fresh page.</h2><p>Your rewrites will find a home here after your first transformation.</p><button className="primary-button" onClick={() => chooseView("write")}>Start writing <Icon name="arrow" size={16}/></button></div>}</section>}

        {view === "settings" && <section className="page-section settings-page"><div className="eyebrow"><Icon name="settings" size={15}/> YOUR WORKSPACE</div><h1>Make it <em>yours.</em></h1><p className="welcome-copy">A couple of details to make NaturalWrite feel at home.</p><div className="settings-card"><div className="settings-heading"><span className="settings-icon"><Icon name="settings"/></span><div><h2>Connection</h2><p>Your key connects this workspace to your private writing API.</p></div></div><label className="field-label" htmlFor="api-key">NaturalWrite API key</label><input id="api-key" type="password" value={key} onChange={(event) => { setKey(event.target.value); localStorage.setItem("naturalwrite.apiKey", event.target.value); }} placeholder="Paste your API key" autoComplete="off"/><p className="field-hint">Stored in this browser only. Never included in page analytics.</p><label className="field-label" htmlFor="api-url">API server address</label><input id="api-url" value={api} readOnly/><p className="field-hint">Set VITE_API_URL when building the web app to change this address.</p></div><div className="settings-card"><div className="settings-heading"><span className="settings-icon"><Icon name="sparkle"/></span><div><h2>Your default style</h2><p>Choose the starting point for every new rewrite.</p></div></div><div className="settings-style-list">{styles.map((item) => <button key={item.id} className={`settings-style ${style === item.id ? "selected" : ""}`} onClick={() => setStyle(item.id)}><span><strong>{item.label}</strong><small>{item.hint}</small></span>{style === item.id && <span className="selected-check"><Icon name="check" size={13}/></span>}</button>)}</div><button className="primary-button settings-save" onClick={() => void saveStyle()}>Save preferences <Icon name="arrow" size={16}/></button></div><div className="settings-privacy"><span><Icon name="check" size={15}/></span><p><strong>Your writing belongs to you.</strong> Text is sent only when you ask for a rewrite. We never promise detector outcomes or change a page without your say.</p></div>{message && <div className="toast-message settings-toast" role="status"><span className="toast-dot"/>{message}</div>}</section>}
      </main>
      <footer className="app-footer"><span>NaturalWrite <i/> Made for the words you mean.</span><span>Clarity, with care.</span></footer>
    </div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
