import { useState } from "react";
import ReactMarkdown from "react-markdown";
import "./styles.css";

// getBible v2 vertalingen (volledige lijst: https://api.getbible.net/v2/translations.json)
const TRANSLATIONS = [
  { code: "statenvertaling", label: "Statenvertaling (NL)" },
  { code: "kjv", label: "King James Version (EN)" },
  { code: "asv", label: "American Standard Version (EN)" },
];

const SEED_PROMPT =
  "Leg deze Bijbeltekst uit: geef context, betekenis en bekende interpretaties.";

// Boek-met-kruis logo, in lijn met de mockup.
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

  async function copyChat() {
    const lines = [];
    if (verses) lines.push(verses.reference);
    conversation.forEach((m, i) => {
      if (i === 0 && m.role === "user") return;
      lines.push(m.role === "user" ? `Vraag: ${m.text}` : `Uitleg: ${m.text}`);
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setChatError("Kopiëren mislukt — je browser blokkeert klembordtoegang.");
    }
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
          <div className="bs-tagline">Verstaan · Volgen · Verkondigen</div>
        </div>
      </header>

      <section className="bs-hero">
        <p className="bs-eyebrow">Bijbelstudie Gids</p>
        <h1 className="bs-hero-title">God leren kennen</h1>
        <hr className="bs-hero-rule" />
        <p className="bs-hero-sub">Verstaan | Volgen | Verkondigen</p>
      </section>

      <main className="bs-main">
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
      </main>
    </>
  );
}
