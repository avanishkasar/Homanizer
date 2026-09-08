import { useEffect, useState } from "react";
import type { HistoryEntry, WritingStyle } from "@naturalwrite/shared";
import { createRoot } from "react-dom/client";
import "./styles.css";

const api = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
function App(): React.JSX.Element {
  const [key, setKey] = useState(""); const [history, setHistory] = useState<HistoryEntry[]>([]); const [style, setStyle] = useState<WritingStyle>("clear"); const [message, setMessage] = useState("Enter the same API key used by your extension.");
  const headers = { "x-naturalwrite-key": key, "content-type": "application/json" };
  const load = async (): Promise<void> => { const response = await fetch(`${api}/api/history`, { headers }); if (!response.ok) { setMessage("Could not load history."); return; } setHistory(await response.json() as HistoryEntry[]); setMessage(""); };
  useEffect(() => { if (key) void load(); }, [key]);
  const save = async (): Promise<void> => { const response = await fetch(`${api}/api/settings`, { method: "PATCH", headers, body: JSON.stringify({ defaultStyle: style }) }); setMessage(response.ok ? "Settings saved." : "Could not save settings."); };
  const remove = async (id: string): Promise<void> => { await fetch(`${api}/api/history/${id}`, { method: "DELETE", headers }); await load(); };
  return <main><header><h1>NaturalWrite</h1><p>Writing clarity with a human in control.</p></header><section className="card"><h2>Connection &amp; settings</h2><input aria-label="API key" type="password" placeholder="API key" value={key} onChange={(e) => setKey(e.target.value)} /><select value={style} onChange={(e) => setStyle(e.target.value as WritingStyle)}><option value="clear">Clear</option><option value="concise">Concise</option><option value="professional">Professional</option><option value="friendly">Friendly</option></select><button onClick={() => void save()}>Save</button><small>{message}</small></section><section><h2>Rewrite history</h2>{history.map((entry) => <article className="card" key={entry.id}><div><strong>{entry.style}</strong> · risk {entry.riskScore}/100</div><div className="columns"><p>{entry.original}</p><p>{entry.rewritten}</p></div><button onClick={() => void remove(entry.id)}>Delete</button></article>)}{!history.length && <p className="muted">No saved rewrites yet.</p>}</section></main>;
}
createRoot(document.getElementById("root")!).render(<App />);
