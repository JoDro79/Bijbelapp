import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import "./styles.css";

const TRANSLATIONS = [
  { code: "statenvertaling", label: "Statenvertaling (NL)" },
  { code: "kjv", label: "King James Version (EN)" },
  { code: "asv", label: "American Standard Version (EN)" },
];

const SEED_PROMPT =
  "Leg deze Bijbeltekst uit: geef context, betekenis en bekende interpretaties.";

const STORE_KEY = "bijbelstudie-gesprekken";
const MAX_SAVED = 50;

// --- Onthoud de gekozen Obsidian-map (een maphandle mag niet in localStorage) ---
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("bijbelstudie", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction("kv", "readonly").objectStore("kv").get(key);
    t.onsuccess = () => res(t.result);
    t.onerror = () => rej(t.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction("kv", "readwrite").objectStore("kv").put(val, key);
    t.onsuccess = () => res();
    t.onerror = () => rej(t.error);
  });
}

const CAN_PICK_FOLDER =
  typeof window !== "undefined" && "showDirectoryPicker" in window;


// --- Opslag in de browser (blijft op dit apparaat) ---
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function persistHistory(list) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
    return true;
  } catch {
    return false;
  }
}

function BrandMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M6 12c5-2.5 11-2.5 18 0v26c-7-2.5-13-2.5-18 0V12Z" fill="currentColor" opacity="0.9" />
      <path d="M42 12c-5-2.5-11-2.5-18 0v26c7-2.5 13-2.5 18 0V12Z" fill="currentColor" opacity="0.7" />
      <path d="M24 10v30" stroke="#fff" strokeWidth="1.4" opacity="0.5" />
      <path d="M22 4h4v10h-4zM18 7h12v3H18z" fill="currentColor" />
    </svg>
  );
}

export default function BibleExplainer() {
  const [reference, setReference] = useState("");
  const [translation, setTranslation] = useState("statenvertaling");
  const [verses, setVerses] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState(null);

  const [conversation, setConversation] = useState([]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [vaultName, setVaultName] = useState(null);
  const [savedToVault, setSavedToVault] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (CAN_PICK_FOLDER) {
      idbGet("vaultHandle")
        .then((h) => h && setVaultName(h.name))
        .catch(() => {});
    }
  }, []);

  const passageText = verses
    ? verses.verses.map((v) => `${v.name}: ${v.text.trim()}`).join("\n")
    : "";

  // Bewaar automatisch zodra er een antwoord is.
  useEffect(() => {
    if (!verses || !conversation.some((m) => m.role === "model")) return;
    const id = sessionId || String(Date.now());
    if (!sessionId) setSessionId(id);
    const entry = {
      id,
      reference: verses.reference,
      translation,
      verses: verses.verses,
      conversation,
      savedAt: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.id !== id)];
      persistHistory(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation, verses]);

  async function fetchPassage(e) {
    e.preventDefault();
    if (!reference.trim()) return;
    setLoadingText(true);
    setTextError(null);
    setVerses(null);
    setConversation([]);
    setChatError(null);
    setInput("");
    setSessionId(null);
    try {
      const res = await fetch(
        `/api/bible?translation=${encodeURIComponent(translation)}&ref=${encodeURIComponent(reference)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Serverfout (${res.status})`);
      }
      const data = await res.json();
      if (!data.verses || data.verses.length === 0) {
        throw new Error("Geen verzen gevonden voor deze verwijzing.");
      }
      setVerses(data);
    } catch (err) {
      setTextError(err.message);
    } finally {
      setLoadingText(false);
    }
  }

  async function runTurn(historyToSend) {
    setLoadingChat(true);
    setChatError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: verses.reference,
          passage: passageText,
          messages: historyToSend,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Serverfout (${res.status})`);
      }
      const data = await res.json();
      setConversation([...historyToSend, { role: "model", text: data.reply }]);
    } catch (err) {
      setConversation(historyToSend);
      setChatError(err.message);
    } finally {
      setLoadingChat(false);
    }
  }

  function startChat() {
    runTurn([{ role: "user", text: SEED_PROMPT }]);
  }

  function sendFollowup() {
    const text = input.trim();
    if (!text || loadingChat) return;
    setInput("");
    runTurn([...conversation, { role: "user", text }]);
  }

  function onInputKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendFollowup();
    }
  }

  // Boeknaam uit de verwijzing halen, voor een bruikbare tag in Obsidian.
  function bookTag(ref) {
    const naam = String(ref || "")
      .replace(/[0-9:：\-–,\s]+$/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return naam || "algemeen";
  }

  function buildTranscript() {
    const ref = verses?.reference || "Bijbelstudie";
    const datum = new Date().toISOString().slice(0, 10);
    const lines = [
      "---",
      `titel: "${ref}"`,
      `verwijzing: "${ref}"`,
      `vertaling: ${translation}`,
      `datum: ${datum}`,
      `tags: [bijbelstudie, ${bookTag(ref)}]`,
      "---",
      "",
      `# ${ref}`,
      "",
    ];
    if (verses) {
      verses.verses.forEach((v) => lines.push(`> [!quote] ${v.verse}`, `> ${v.text.trim()}`, ""));
    }
    conversation.forEach((m, i) => {
      if (i === 0 && m.role === "user") return;
      lines.push(m.role === "user" ? `## Vraag: ${m.text}` : m.text, "");
    });
    return lines.join("\n");
  }

  function fileName() {
    const slug = (verses?.reference || "gesprek")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `Bijbelstudie ${slug} ${new Date().toISOString().slice(0, 10)}.md`;
  }

  async function copyChat() {
    try {
      await navigator.clipboard.writeText(buildTranscript());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setChatError("Kopiëren mislukt — je browser blokkeert klembordtoegang.");
    }
  }

  function downloadChat() {
    const blob = new Blob([buildTranscript()], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Rechtstreeks in de gekozen Obsidian-map schrijven (Chrome/Edge).
  async function saveToVault() {
    try {
      let handle = await idbGet("vaultHandle");
      if (!handle) {
        handle = await window.showDirectoryPicker({ mode: "readwrite" });
        await idbSet("vaultHandle", handle);
      }
      let perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        perm = await handle.requestPermission({ mode: "readwrite" });
      }
      if (perm !== "granted") {
        setChatError("Geen toestemming om in die map te schrijven.");
        return;
      }
      const fh = await handle.getFileHandle(fileName(), { create: true });
      const writable = await fh.createWritable();
      await writable.write(buildTranscript());
      await writable.close();
      setVaultName(handle.name);
      setSavedToVault(true);
      setTimeout(() => setSavedToVault(false), 2500);
    } catch (err) {
      if (err && err.name === "AbortError") return; // gebruiker klikte weg
      setChatError("Opslaan in de map mislukt: " + (err?.message || "onbekende fout"));
    }
  }

  async function forgetVault() {
    await idbSet("vaultHandle", undefined);
    setVaultName(null);
  }

  function openSaved(entry) {
    setVerses({ reference: entry.reference, verses: entry.verses });
    setTranslation(entry.translation || "statenvertaling");
    setReference(entry.reference);
    setConversation(entry.conversation);
    setSessionId(entry.id);
    setChatError(null);
    setShowHistory(false);
  }

  function deleteSaved(id) {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      persistHistory(next);
      return next;
    });
    if (id === sessionId) setSessionId(null);
  }

  const chatStarted = conversation.length > 0;
  const hasModelReply = conversation.some((m) => m.role === "model");

  return (
    <>
      <header className="bs-header">
        <div className="bs-header-inner">
          <div className="bs-brand">
            <BrandMark />
            <div className="bs-wordmark">
              Bijbelstudie<span>Gids</span>
            </div>
          </div>
          <button
            className="bs-btn bs-btn-ghost"
            onClick={() => setShowHistory((v) => !v)}
          >
            Bewaard ({history.length})
          </button>
        </div>
      </header>

      <section className="bs-hero">
        <p className="bs-eyebrow">Bijbelstudie Gids</p>
        <h1 className="bs-hero-title">God leren kennen</h1>
        <hr className="bs-hero-rule" />
        <p className="bs-hero-sub">Verstaan | Volgen | Verkondigen</p>
      </section>

      <main className="bs-main">
        {showHistory && (
          <section className="bs-saved">
            <h2 className="bs-saved-title">Bewaarde gesprekken</h2>
            {history.length === 0 ? (
              <p className="bs-intro">
                Nog niets bewaard. Zodra je een uitleg opvraagt, verschijnt het gesprek hier.
              </p>
            ) : (
              <ul className="bs-saved-list">
                {history.map((h) => (
                  <li key={h.id} className="bs-saved-item">
                    <button className="bs-saved-open" onClick={() => openSaved(h)}>
                      <span className="bs-saved-ref">{h.reference}</span>
                      <span className="bs-saved-date">
                        {new Date(h.savedAt).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </button>
                    <button
                      className="bs-btn bs-btn-ghost"
                      onClick={() => deleteSaved(h.id)}
                      aria-label={`Verwijder ${h.reference}`}
                    >
                      Wissen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <p className="bs-intro">
          Zoek een Bijbelgedeelte op, lees de tekst en verdiep je met vervolgvragen.
        </p>

        <form onSubmit={fetchPassage} className="bs-lookup">
          <div className="bs-field">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="bijv. Johannes 3:16 of Psalm 23:1-6"
              className="bs-input"
              aria-label="Bijbelverwijzing"
            />
          </div>
          <select
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            className="bs-select"
            aria-label="Vertaling"
            style={{ flex: "0 0 auto", width: "auto" }}
          >
            {TRANSLATIONS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="submit" className="bs-btn bs-btn-primary" disabled={loadingText}>
            {loadingText ? "Bezig…" : "Ophalen"}
          </button>
        </form>

        {textError && <p className="bs-error">⚠️ {textError}</p>}

        {verses && (
          <section className="bs-passage">
            <h2 className="bs-passage-ref">{verses.reference}</h2>
            {verses.verses.map((v) => (
              <p key={v.name} className="bs-verse">
                <sup className="bs-verse-num">{v.verse}</sup>
                {v.text.trim()}
              </p>
            ))}
            {!chatStarted && (
              <div className="bs-ask-row">
                <button
                  onClick={startChat}
                  className="bs-btn bs-btn-primary"
                  disabled={loadingChat}
                >
                  {loadingChat ? "Nadenken…" : "Vragen"}
                </button>
              </div>
            )}
          </section>
        )}

        {chatStarted && (
          <section className="bs-chat">
            {hasModelReply && (
              <div className="bs-chat-toolbar">
                <button onClick={copyChat} className="bs-btn bs-btn-ghost">
                  {copied ? "Gekopieerd!" : "Kopieer gesprek"}
                </button>
                <button onClick={downloadChat} className="bs-btn bs-btn-ghost">
                  Download als bestand
                </button>
                {CAN_PICK_FOLDER && (
                  <button onClick={saveToVault} className="bs-btn bs-btn-ghost">
                    {savedToVault
                      ? "Opgeslagen!"
                      : vaultName
                      ? `Opslaan in ${vaultName}`
                      : "Opslaan in Obsidian-map…"}
                  </button>
                )}
              </div>
            )}

            {conversation.map((m, i) =>
              m.role === "user" ? (
                i === 0 ? null : (
                  <div key={i} className="bs-bubble-user">
                    {m.text}
                  </div>
                )
              ) : (
                <div key={i} className="bs-bubble-model">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              )
            )}

            {loadingChat && <p className="bs-thinking">Nadenken…</p>}
            {chatError && <p className="bs-error">⚠️ {chatError}</p>}

            <div className="bs-input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Stel een vervolgvraag…"
                className="bs-chat-input"
                disabled={loadingChat}
                aria-label="Vervolgvraag"
              />
              <button
                onClick={sendFollowup}
                className="bs-btn bs-btn-primary"
                disabled={loadingChat || !input.trim()}
              >
                Verstuur
              </button>
            </div>
          </section>
        )}

        {vaultName && (
          <p className="bs-vault-note">
            Notities worden geschreven naar de map <strong>{vaultName}</strong>.{" "}
            <button className="bs-linkbtn" onClick={forgetVault}>
              Andere map kiezen
            </button>
          </p>
        )}
      </main>
    </>
  );
}
