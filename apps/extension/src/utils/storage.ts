interface Settings {
  enabled: boolean;
  tone: "formal" | "casual" | "neutral";
  autoRewrite: boolean;
  maxLength: number;
}

const DEFAULTS: Settings = {
  enabled: true,
  tone: "neutral",
  autoRewrite: false,
  maxLength: 2000,
};

export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.sync.get("settings");
  return { ...DEFAULTS, ...data.settings };
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.sync.set({ settings: { ...current, ...partial } });
}
