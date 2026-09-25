import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryEntry, WritingStyle } from "@naturalwrite/shared";
import { createRoot } from "react-dom/client";
import "./styles.css";

const defaultApi = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const styles: {
  id: WritingStyle;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { id: "clear", label: "Clear", hint: "Natural & easy to follow", icon: "Aa" },
  { id: "concise", label: "Concise", hint: "Tighter, fewer words", icon: "↘" },
  {
    id: "professional",
    label: "Professional",
    hint: "Polished & assured",
    icon: "A+",
  },
  {
    id: "friendly",
    label: "Friendly",
    hint: "Warm & conversational",
    icon: "✳",
  },
];
const formatSize = (size: number): string =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;

function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}): React.JSX.Element {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<string, React.ReactNode> = {
    pen: (
      <>
        <path d="m15 5 4 4" />
        <path d="m4 20 4-.8L19.4 7.8a2.1 2.1 0 0 0-3-3L5 16.2 4 20Z" />
        <path d="M13.5 6.5 17.5 10.5" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.7-6.4L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z"
          transform="translate(-1 -1) scale(1.08)"
        />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
        <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M20 16.5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h8" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    desktop: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
    code: (
      <>
        <path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-10-2 12" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] ?? paths.sparkle}</svg>;
}

interface RewriteReport {
  paragraphsProcessed: number;
  paragraphsSkipped: number;
  riskScore: number;
  notes: string[];
}
interface CompletedFile {
  name: string;
  size: number;
  report: RewriteReport;
}
type View = "upload" | "history" | "roadmap" | "settings";

function App(): React.JSX.Element {
  const [accessKey, setAccessKey] = useState(
    () => localStorage.getItem("humanizerDad.accessKey") ?? "",
  );
  const [apiUrl, setApiUrl] = useState(
    () => localStorage.getItem("humanizerDad.apiUrl") ?? defaultApi,
  );
  const [style, setStyle] = useState<WritingStyle>("clear");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View>("upload");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [completed, setCompleted] = useState<CompletedFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!accessKey) {
      setHistory([]);
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/api/history`, {
        headers: { "x-naturalwrite-key": accessKey },
      });
      if (response.ok) setHistory((await response.json()) as HistoryEntry[]);
    } catch {
      /* History is optional while the API is offline. */
    }
  }, [accessKey, apiUrl]);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const pickFile = (candidate: File | undefined): void => {
    setMessage("");
    setCompleted(null);
    if (!candidate) return;
    if (!/\.(docx|pdf)$/i.test(candidate.name)) {
      setFile(null);
      setMessage("For now, choose a Word document (.docx) or PDF (.pdf).");
      return;
    }
    if (!candidate.size) {
      setFile(null);
      setMessage("That file is empty. Choose another document.");
      return;
    }
    if (candidate.size > 15 * 1024 * 1024) {
      setFile(null);
      setMessage("Files can be up to 15 MB.");
      return;
    }
    setFile(candidate);
  };

  const transform = async (): Promise<void> => {
    if (!file) {
      setMessage("Choose one document to get started.");
      return;
    }
    if (!accessKey) {
      setMessage("Add your workspace access key in Settings to connect.");
      setView("settings");
      return;
    }
    setBusy(true);
    setMessage("");
    setCompleted(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("style", style);
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/api/documents`,
        { method: "POST", headers: { "x-naturalwrite-key": accessKey }, body },
      );
      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "We could not process this document.");
      }
      const reportHeader = response.headers.get("x-humanizerdad-report");
      const reportText = reportHeader
        ? new TextDecoder().decode(
            Uint8Array.from(
              atob(
                reportHeader
                  .replace(/-/g, "+")
                  .replace(/_/g, "/")
                  .padEnd(Math.ceil(reportHeader.length / 4) * 4, "="),
              ),
              (char) => char.charCodeAt(0),
            ),
          )
        : "{}";
      const report = JSON.parse(reportText) as RewriteReport;
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const encodedFilename = disposition.match(
        /filename\*=UTF-8''([^;]+)/i,
      )?.[1];
      const outputName = encodedFilename
        ? decodeURIComponent(encodedFilename)
        : file.name.replace(/\.(docx|pdf)$/i, "-HumanizerDad.$1");
      const objectUrl = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = objectUrl;
      download.download = outputName;
      document.body.append(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      setCompleted({ name: outputName, size: blob.size, report });
      setFile(null);
      await loadHistory();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not process this document.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (): Promise<void> => {
    localStorage.setItem("humanizerDad.accessKey", accessKey.trim());
    localStorage.setItem(
      "humanizerDad.apiUrl",
      apiUrl.trim().replace(/\/$/, ""),
    );
    setAccessKey(accessKey.trim());
    setApiUrl(apiUrl.trim().replace(/\/$/, ""));
    setMessage("Workspace connection saved in this browser.");
  };
  const chooseView = (next: View): void => {
    setView(next);
    setMessage("");
    setMobileMenu(false);
  };
  const acceptedFiles = (files: FileList | File[]): void => {
    if (files.length !== 1) {
      setMessage("Please add one document at a time.");
      return;
    }
    pickFile(files[0]);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="#upload"
          onClick={() => chooseView("upload")}
        >
          <span className="brand-mark">
            <Icon name="pen" size={20} />
          </span>
          <span>
            Humanizer<span className="brand-light">Dad</span>
            <small>YOUR WRITING SPACE</small>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${view === "upload" ? "active" : ""}`}
            onClick={() => chooseView("upload")}
          >
            <Icon name="upload" />
            Improve a document
          </button>
          <button
            className={`nav-item ${view === "history" ? "active" : ""}`}
            onClick={() => chooseView("history")}
          >
            <Icon name="history" />
            History<span className="nav-count">{history.length}</span>
          </button>
          <button
            className={`nav-item ${view === "roadmap" ? "active" : ""}`}
            onClick={() => chooseView("roadmap")}
          >
            <Icon name="sparkle" />
            The bigger picture<span className="nav-new">VISION</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <span className="privacy-dot" />
            <div>
              <strong>Your original stays safe</strong>
              <p>We send back a new copy to review.</p>
            </div>
          </div>
          <button
            className={`nav-item settings-link ${view === "settings" ? "active" : ""}`}
            onClick={() => chooseView("settings")}
          >
            <Icon name="settings" />
            Settings
          </button>
          <div className="sidebar-foot">A little clearer. Still you.</div>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <div className="main-column">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            <span>HumanizerDad</span>
            <Icon name="arrow" size={13} />
            <strong>
              {view === "upload"
                ? "Improve a document"
                : view === "history"
                  ? "Your history"
                  : view === "roadmap"
                    ? "The bigger picture"
                    : "Settings"}
            </strong>
          </div>
          <div className="topbar-right">
            <span
              className={`connection-dot ${accessKey ? "connected" : ""}`}
            />
            <span>
              {accessKey ? "Workspace connected" : "Set up your workspace"}
            </span>
            <button
              className="avatar"
              onClick={() => chooseView("settings")}
              aria-label="Open settings"
            >
              HD
            </button>
          </div>
        </header>

        <main className="content">
          {view === "upload" && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <Icon name="sparkle" size={15} /> MAKE YOUR MEANING EASIER
                    TO READ
                  </div>
                  <h1>
                    Say it <em>your way.</em>
                  </h1>
                  <p className="welcome-copy">
                    Drop in a document. Get a clearer copy, with your formatting
                    kept in place.
                  </p>
                </div>
                <div className="format-summary">
                  <span className="format-icon word-icon">W</span>
                  <span className="format-icon pdf-icon">PDF</span>
                  <span>
                    <strong>DOCX + PDF</strong>
                    <small>One document at a time</small>
                  </span>
                </div>
              </section>

              <div className="upload-layout">
                <section
                  className="editor-card upload-card"
                  aria-label="Document upload"
                >
                  <div className="card-top">
                    <div>
                      <span className="step-badge">01</span>
                      <div>
                        <h2>Choose your document</h2>
                        <p>
                          We’ll preserve the layout while we improve the
                          wording.
                        </p>
                      </div>
                    </div>
                    {file && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setFile(null);
                          setCompleted(null);
                        }}
                      >
                        Start over
                      </button>
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    className="file-input-hidden"
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
                    aria-label="Choose one DOCX or PDF document"
                    onChange={(event) =>
                      acceptedFiles(event.currentTarget.files ?? [])
                    }
                  />
                  {!file ? (
                    <button
                      className={`drop-zone ${dragging ? "drop-active" : ""}`}
                      onClick={() => inputRef.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        acceptedFiles(event.dataTransfer.files);
                      }}
                    >
                      <span className="upload-illustration">
                        <span className="upload-halo" />
                        <span className="upload-symbol">
                          <Icon name="upload" size={25} />
                        </span>
                        <i>
                          <Icon name="sparkle" size={14} />
                        </i>
                      </span>
                      <strong>Drop one document here</strong>
                      <span className="drop-copy">
                        or <u>browse your files</u>
                      </span>
                      <span className="file-format-pills">
                        <span>DOCX</span>
                        <i />
                        <span>PDF</span>
                        <i />
                        <span>MAX 15 MB</span>
                      </span>
                    </button>
                  ) : (
                    <div className="selected-file">
                      <span
                        className={`file-tile ${file.name.toLowerCase().endsWith(".pdf") ? "file-tile-pdf" : ""}`}
                      >
                        <Icon name="file" size={22} />
                      </span>
                      <span className="selected-file-meta">
                        <strong>{file.name}</strong>
                        <small>
                          {formatSize(file.size)} <i />{" "}
                          {file.name.toLowerCase().endsWith(".pdf")
                            ? "PDF document"
                            : "Word document"}
                        </small>
                      </span>
                      <span className="file-ready">
                        <Icon name="check" size={13} /> Ready
                      </span>
                      <button
                        className="remove-file"
                        aria-label="Remove selected document"
                        onClick={() => setFile(null)}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  )}
                  <div className="section-title style-title">
                    <span className="step-badge">02</span>
                    <div>
                      <h2>Set the tone</h2>
                      <p>A lighter touch or a complete polish. You decide.</p>
                    </div>
                  </div>
                  <div className="style-grid">
                    {styles.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => setStyle(item.id)}
                        className={`style-option ${style === item.id ? "selected" : ""}`}
                      >
                        <span className={`style-symbol style-symbol-${index}`}>
                          {item.icon}
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.hint}</small>
                        </span>
                        {style === item.id && (
                          <span className="selected-check">
                            <Icon name="check" size={13} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="editor-actions">
                    <span className="action-note">
                      <Icon name="check" size={15} /> Original stays untouched.
                    </span>
                    <button
                      className="primary-button"
                      onClick={() => void transform()}
                      disabled={busy || !file}
                    >
                      {busy ? (
                        <>
                          <span className="spinner" />
                          Working through your document…
                        </>
                      ) : (
                        <>
                          Improve document <Icon name="arrow" size={16} />
                        </>
                      )}
                    </button>
                  </div>
                  {message && (
                    <div className="inline-message" role="status">
                      <span className="toast-dot" />
                      {message}
                      <button
                        onClick={() => setMessage("")}
                        aria-label="Dismiss"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {completed && (
                    <div className="completion-card" role="status">
                      <span className="completion-mark">
                        <Icon name="check" />
                      </span>
                      <div>
                        <strong>Your new copy is ready</strong>
                        <p>
                          {completed.name} ·{" "}
                          {completed.report.paragraphsProcessed} passages
                          improved
                          {completed.report.paragraphsSkipped
                            ? ` · ${completed.report.paragraphsSkipped} kept unchanged`
                            : ""}
                        </p>
                        <small>{completed.report.notes[0]}</small>
                      </div>
                    </div>
                  )}
                </section>
                <aside className="right-rail">
                  <section className="result-card file-flow">
                    <div className="rail-heading">
                      <div>
                        <span className="step-badge">03</span>
                        <div>
                          <h2>Your finished copy</h2>
                          <p>Downloaded only when ready.</p>
                        </div>
                      </div>
                      <span className="result-spark">
                        <Icon name="sparkle" size={17} />
                      </span>
                    </div>
                    <div className="flow-steps">
                      <div className="flow-step">
                        <span className="flow-num">1</span>
                        <span>
                          <strong>We read the document</strong>
                          <small>Paragraphs, tables, and pages</small>
                        </span>
                        <span className="flow-status">READY</span>
                      </div>
                      <div className="flow-connector" />
                      <div className="flow-step">
                        <span className="flow-num">2</span>
                        <span>
                          <strong>We refine the writing</strong>
                          <small>Names and numbers checked</small>
                        </span>
                        <span className="flow-status">CAREFUL</span>
                      </div>
                      <div className="flow-connector" />
                      <div className="flow-step">
                        <span className="flow-num">3</span>
                        <span>
                          <strong>You get a new file</strong>
                          <small>Original document stays safe</small>
                        </span>
                        <span className="flow-status">YOURS</span>
                      </div>
                    </div>
                    <div className="result-callout">
                      <span>
                        <Icon name="sparkle" size={16} />
                      </span>
                      <p>
                        Your layout stays familiar. A new copy gives you room to
                        review every change.
                      </p>
                    </div>
                  </section>
                  <section className="promise-card">
                    <span className="promise-mark">“</span>
                    <p>
                      Clarity without losing <em>your voice.</em>
                    </p>
                    <span className="promise-rule" />
                    <small>THE HUMANIZERDAD PROMISE</small>
                  </section>
                  <div className="safety-note">
                    <span className="safety-check">
                      <Icon name="check" size={13} />
                    </span>
                    <p>
                      No silent edits. No detector promises. Just clearer
                      writing.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}

          {view === "history" && (
            <section className="page-section">
              <div className="eyebrow">
                <Icon name="history" size={15} /> YOUR WRITING, OVER TIME
              </div>
              <div className="page-title-row">
                <div>
                  <h1>
                    A record of <em>your progress.</em>
                  </h1>
                  <p className="welcome-copy">
                    Your writing history, right where you left it.
                  </p>
                </div>
                <span className="history-total">
                  {history.length}{" "}
                  {history.length === 1 ? "rewrite" : "rewrites"}
                </span>
              </div>
              {history.length ? (
                <div className="history-list">
                  {history.map((entry) => (
                    <article className="history-card" key={entry.id}>
                      <div className="history-card-top">
                        <span className="history-style">
                          <Icon name="sparkle" size={14} />
                          {entry.style}
                        </span>
                        <span>
                          {new Date(entry.createdAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </span>
                        <button
                          className="delete-button"
                          aria-label="Delete history entries in API"
                          onClick={() =>
                            setMessage(
                              "History deletion is available from the API. Uploaded files are not retained in history.",
                            )
                          }
                        >
                          <Icon name="file" size={15} />
                        </button>
                      </div>
                      <div className="history-columns">
                        <div>
                          <small>ORIGINAL</small>
                          <p>{entry.original}</p>
                        </div>
                        <div>
                          <small>REWRITTEN</small>
                          <p>{entry.rewritten}</p>
                        </div>
                      </div>
                      <div className="history-card-bottom">
                        <span className="risk-pill">
                          <span />
                          {entry.riskScore
                            ? `Review · ${entry.riskScore}/100`
                            : "Protected details checked"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-history">
                  <div className="empty-illustration">
                    <div className="paper paper-back" />
                    <div className="paper paper-front">
                      <span />
                      <span />
                      <span />
                      <i>
                        <Icon name="history" size={18} />
                      </i>
                    </div>
                  </div>
                  <h2>A fresh page.</h2>
                  <p>
                    Your text rewrites will find a home here. Uploaded documents
                    are processed without keeping a copy on our servers.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => chooseView("upload")}
                  >
                    Choose a document <Icon name="arrow" size={16} />
                  </button>
                </div>
              )}
            </section>
          )}

          {view === "roadmap" && (
            <section className="page-section roadmap-page">
              <div className="eyebrow">
                <Icon name="sparkle" size={15} /> WHERE HUMANIZERDAD IS HEADED
              </div>
              <div className="page-title-row">
                <div>
                  <h1>
                    Small start. <em>Big picture.</em>
                  </h1>
                  <p className="welcome-copy">
                    Thoughtful writing help, wherever you work.
                  </p>
                </div>
                <span className="roadmap-chip">PRODUCT VISION</span>
              </div>
              <section className="roadmap-now">
                <span className="roadmap-now-icon">
                  <Icon name="file" size={21} />
                </span>
                <div>
                  <span className="roadmap-state">AVAILABLE NOW</span>
                  <h2>Document clarity</h2>
                  <p>
                    Improve one DOCX or text based PDF at a time. Keep the
                    original safe, preserve familiar formatting, and download a
                    separate rewritten copy.
                  </p>
                  <div className="roadmap-formats">
                    <span>DOCX</span>
                    <span>PDF</span>
                    <span>One file at a time</span>
                  </div>
                </div>
              </section>
              <div className="roadmap-divider">
                <span />
                ON THE HORIZON
                <span />
              </div>
              <div className="roadmap-features">
                <article className="roadmap-feature">
                  <span className="future-icon">
                    <Icon name="desktop" />
                  </span>
                  <span className="future-state">FUTURE PHASE</span>
                  <h3>HumanizerDad desktop</h3>
                  <p>
                    A focused writing companion for documents and drafts across
                    your desktop.
                  </p>
                </article>
                <article className="roadmap-feature">
                  <span className="future-icon">
                    <Icon name="globe" />
                  </span>
                  <span className="future-state">FUTURE PHASE</span>
                  <h3>Browser extension</h3>
                  <p>
                    Bring the same careful rewrite flow into the web pages where
                    you write.
                  </p>
                </article>
                <article className="roadmap-feature">
                  <span className="future-icon">
                    <Icon name="code" />
                  </span>
                  <span className="future-state">LONG TERM</span>
                  <h3>IDE connection</h3>
                  <p>
                    Connect your editor to improve prose in your own project
                    files, with reviewable changes.
                  </p>
                </article>
              </div>
              <p className="roadmap-footnote">
                <Icon name="check" size={15} /> These are ideas on the product
                roadmap, not features available today.
              </p>
            </section>
          )}

          {view === "settings" && (
            <section className="page-section settings-page">
              <div className="eyebrow">
                <Icon name="settings" size={15} /> YOUR WORKSPACE
              </div>
              <h1>
                Make it <em>yours.</em>
              </h1>
              <p className="welcome-copy">
                Connect HumanizerDad to its private rewrite service.
              </p>
              <div className="settings-card">
                <div className="settings-heading">
                  <span className="settings-icon">
                    <Icon name="settings" />
                  </span>
                  <div>
                    <h2>Workspace connection</h2>
                    <p>
                      Your OpenAI credentials stay on the server; never put them
                      in this page.
                    </p>
                  </div>
                </div>
                <label className="field-label" htmlFor="access-key">
                  Workspace access key
                </label>
                <input
                  id="access-key"
                  type="password"
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  placeholder="Enter the access key provided by your workspace"
                  autoComplete="off"
                />
                <p className="field-hint">
                  This is the HumanizerDad workspace key, not an OpenAI API key.
                  Stored in this browser.
                </p>
                <label className="field-label" htmlFor="api-url">
                  Rewrite service address
                </label>
                <input
                  id="api-url"
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                  placeholder="https://your-api.example.com"
                  autoComplete="url"
                />
                <p className="field-hint">
                  For local development, use http://localhost:3000. A deployed
                  app needs a deployed rewrite service.
                </p>
                <button
                  className="primary-button settings-save"
                  onClick={() => void saveSettings()}
                >
                  Save connection <Icon name="arrow" size={16} />
                </button>
              </div>
              <div className="settings-privacy">
                <span>
                  <Icon name="check" size={15} />
                </span>
                <p>
                  <strong>Your original document stays untouched.</strong> The
                  rewrite service processes the upload in memory and returns a
                  separate file. It does not keep the uploaded document in
                  history.
                </p>
              </div>
              {message && (
                <div className="inline-message settings-toast" role="status">
                  {message}
                </div>
              )}
            </section>
          )}
        </main>
        <footer className="app-footer">
          <span>
            HumanizerDad <i /> Made for the words you mean.
          </span>
          <span>Clarity, with care.</span>
        </footer>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
