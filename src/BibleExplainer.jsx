import { useState } from "react";

// getBible v2 vertalingen (volledige lijst: https://api.getbible.net/v2/translations.json)
const TRANSLATIONS = [
  { code: "statenvertaling", label: "Statenvertaling (NL)" },
  { code: "kjv", label: "King James Version (EN)" },
  { code: "asv", label: "American Standard Version (EN)" },
];

export default function BibleExplainer() {
  const [reference, setReference] = useState("");
  const [translation, setTranslation] = useState("statenvertaling");
  const [verses, setVerses] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState(null);

  async function fetchPassage(e) {
    e.preventDefault();
    if (!reference.trim()) return;
    setLoadingText(true);
    setTextError(null);
    setVerses(null);
    setExplanation("");
    setExplainError(null);
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

  async function askExplanation() {
    if (!verses) return;
    setLoadingExplain(true);
    setExplainError(null);
    setExplanation("");
    const passageText = verses.verses
      .map((v) => `${v.name}: ${v.text.trim()}`)
      .join("\n");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: verses.reference, passage: passageText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Serverfout (${res.status})`);
      }
      const data = await res.json();
      setExplanation(data.explanation);
    } catch (err) {
      setExplainError(err.message);
    } finally {
      setLoadingExplain(false);
    }
  }

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
          <button onClick={askExplanation} style={styles.askButton} disabled={loadingExplain}>
            {loadingExplain ? "Nadenken…" : "Vragen"}
          </button>
        </section>
      )}

      {explainError && <p style={styles.error}>⚠️ {explainError}</p>}

      {explanation && (
        <section style={styles.explanation}>
          <h3 style={styles.explanationHeading}>Uitleg</h3>
          {explanation.split("\n").map((line, i) =>
            line.trim() ? <p key={i}>{line}</p> : null
          )}
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
  explanation: { marginTop: "1.5rem", padding: "1.25rem", background: "#f4f1ee", borderRadius: 12, lineHeight: 1.6 },
  explanationHeading: { marginTop: 0 },
  error: { color: "#b00020", marginTop: "1rem" },
};
