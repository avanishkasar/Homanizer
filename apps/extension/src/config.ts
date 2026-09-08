export interface ExtensionSettings { apiBaseUrl: string; apiKey: string; style: "clear" | "concise" | "professional" | "friendly"; }
export const defaultSettings: ExtensionSettings = { apiBaseUrl: "http://localhost:3000", apiKey: "", style: "clear" };
export const getSettings = async (): Promise<ExtensionSettings> => ({ ...defaultSettings, ...(await chrome.storage.sync.get(defaultSettings)) });

