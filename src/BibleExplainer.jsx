import { useState } from "react";
import ReactMarkdown from "react-markdown";

// getBible v2 vertalingen (volledige lijst: https://api.getbible.net/v2/translations.json)
const TRANSLATIONS = [
  { code: "statenvertaling", label: "Statenvertaling (NL)" },
  { code: "kjv", label: "King James Version (EN)" },
  { code: "asv", label: "American Standard Version (EN)" },
];

// De automatische eerste vraag zodra je op "Vragen" klikt.
const SEED_PROMPT =
  "Leg deze Bijbeltekst uit: geef context, betekenis en bekende interpretaties.";

export default function BibleExplainer() {
  const [reference, setReference] = useState("");
  const [translation, setTranslation] = useState("statenvertaling");
  const [verses, setVerses] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState(null);

  // Gesprek: rij van { role: 'user' | 'model', text }
  const [conversation, setConversation] = useState([]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [copied, setCopied] = useState(false);

  const passageText = verses
    ? verses.verses.map((v) => `${v.name}: ${v.text.trim()}`).join("\n")
    : "";

  async function fetchPassage(e) {
    e.preventDefault();
    if (!reference.trim()) return;
    setLoadingText(true);
    setTextError(null);
    setVerses(null);
    setConversation([]);
    setChatError(null);
    setInput("");
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

  // Eén beurt: stuur de volledige geschiedenis mee, voeg het antwoord toe.
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
      // Bij een fout de laatste (mislukte) vraag laten staan zodat de context klopt.
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

  async function copyChat() {
    const lines = [];
    if (verses) lines.push(verses.reference);
    conversation.forEach((m, i) => {
      if (i === 0 && m.role === "user") return; // automatische openingsvraag overslaan
      lines.push(m.role === "user" ? `Vraag: ${m.text}` : `Uitleg: ${m.text}`);
    });
    const text = lines.join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setChatError("Kopiëren mislukt — je browser blokkeert klembordtoegang.");
    }
  }

  const chatStarted = conversation.length > 0;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Bijbeltekst opzoeken</h1>
      <form onSubmit={fetchPassage} style={styles.form}>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="bijv. Johannes 3:16 of Psalm 23:1-6"
          style={styles.input}
          aria-label="Bijbelverwijzing"
        />
        <select
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          style={styles.select}
          aria-label="Vertaling"
        >
          {TRANSLATIONS.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="submit" style={styles.button} disabled={loadingText}>
          {loadingText ? "Bezig…" : "Ophalen"}
        </button>
      </form>

      {textError && <p style={styles.error}>⚠️ {textError}</p>}

      {verses && (
        <section style={styles.passage}>
          <h2 style={styles.passageHeading}>{verses.reference}</h2>
          {verses.verses.map((v) => (
            <p key={v.name} style={styles.verse}>
              <sup style={styles.verseNum}>{v.verse}</sup> {v.text.trim()}
            </p>
          ))}
          {!chatStarted && (
            <button onClick={startChat} style={styles.askButton} disabled={loadingChat}>
              {loadingChat ? "Nadenken…" : "Vragen"}
            </button>
          )}
        </section>
      )}

      {chatStarted && (
        <section style={styles.chat}>
          {conversation.some((m) => m.role === "model") && (
            <div style={styles.chatToolbar}>
              <button onClick={copyChat} style={styles.copyButton}>
                {copied ? "Gekopieerd!" : "Kopieer gesprek"}
              </button>
            </div>
          )}
          {conversation.map((m, i) =>
            m.role === "user" ? (
              // De automatische eerste vraag verbergen we; echte vragen tonen we.
              i === 0 ? null : (
                <div key={i} style={styles.userBubble}>
                  {m.text}
                </div>
              )
            ) : (
              <div key={i} style={styles.modelBubble}>
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            )
          )}

          {loadingChat && <p style={styles.thinking}>Nadenken…</p>}
          {chatError && <p style={styles.error}>⚠️ {chatError}</p>}

          <div style={styles.inputRow}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Stel een vervolgvraag…"
              style={styles.chatInput}
              disabled={loadingChat}
              aria-label="Vervolgvraag"
            />
            <button
              onClick={sendFollowup}
              style={styles.sendButton}
              disabled={loadingChat || !input.trim()}
            >
              Verstuur
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 680, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif", color: "#1a1a1a" },
  title: { fontSize: "1.6rem", marginBottom: "1rem" },
  form: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  input: { flex: "1 1 200px", padding: "0.6rem 0.75rem", fontSize: "1rem", border: "1px solid #ccc", borderRadius: 8 },
  select: { padding: "0.6rem 0.5rem", fontSize: "1rem", border: "1px solid #ccc", borderRadius: 8 },
  button: { padding: "0.6rem 1.1rem", fontSize: "1rem", border: "none", borderRadius: 8, background: "#2d2d2d", color: "#fff", cursor: "pointer" },
  askButton: { marginTop: "1rem", padding: "0.55rem 1rem", fontSize: "0.95rem", border: "none", borderRadius: 8, background: "#c96442", color: "#fff", cursor: "pointer" },
  passage: { marginTop: "1.5rem", padding: "1.25rem", background: "#faf9f7", border: "1px solid #eee", borderRadius: 12 },
  passageHeading: { marginTop: 0, fontSize: "1.15rem" },
  verse: { lineHeight: 1.6, margin: "0.4rem 0" },
  verseNum: { color: "#999", fontWeight: 600, marginRight: 2 },
  chat: { marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" },
  chatToolbar: { display: "flex", justifyContent: "flex-end" },
  copyButton: { padding: "0.35rem 0.75rem", fontSize: "0.85rem", border: "1px solid #ccc", borderRadius: 8, background: "#fff", color: "#333", cursor: "pointer" },
  userBubble: { alignSelf: "flex-end", maxWidth: "85%", padding: "0.6rem 0.9rem", background: "#2d2d2d", color: "#fff", borderRadius: 12, borderBottomRightRadius: 3, lineHeight: 1.5 },
  modelBubble: { alignSelf: "flex-start", maxWidth: "100%", padding: "0.75rem 1rem", background: "#f4f1ee", borderRadius: 12, borderBottomLeftRadius: 3, lineHeight: 1.6 },
  thinking: { color: "#888", fontStyle: "italic", margin: "0.25rem 0" },
  inputRow: { display: "flex", gap: "0.5rem", marginTop: "0.5rem" },
  chatInput: { flex: 1, padding: "0.6rem 0.75rem", fontSize: "1rem", border: "1px solid #ccc", borderRadius: 8 },
  sendButton: { padding: "0.6rem 1.1rem", fontSize: "1rem", border: "none", borderRadius: 8, background: "#c96442", color: "#fff", cursor: "pointer" },
  error: { color: "#b00020", marginTop: "0.5rem" },
};
