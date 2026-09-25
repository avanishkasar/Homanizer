import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { defaultSettings, type ExtensionSettings, getSettings } from "./config";
import "./styles.css";

function Popup(): React.JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  useEffect(() => { void getSettings().then(setSettings); }, []);
  const save = async (): Promise<void> => { await chrome.storage.sync.set(settings); setSaved(true); };
  return <main><h1>HumanizerDad</h1><p>Choose text on a page, then select Transform.</p><label>API URL<input value={settings.apiBaseUrl} onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })} /></label><label>API key<input type="password" value={settings.apiKey} onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })} /></label><label>Default style<select value={settings.style} onChange={(e) => setSettings({ ...settings, style: e.target.value as ExtensionSettings["style"] })}><option value="clear">Clear</option><option value="concise">Concise</option><option value="professional">Professional</option><option value="friendly">Friendly</option></select></label><button onClick={() => void save()}>Save settings</button>{saved && <small>Saved.</small>}</main>;
}
createRoot(document.getElementById("root")!).render(<Popup />);
