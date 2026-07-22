export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Alleen POST toegestaan." });
  }

  // Minimale afscherming: sta alleen je eigen domein(en) toe (bots weren, geen aanvallers).
  const allowed = (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin || "";
  if (allowed.length > 0 && !allowed.includes(origin)) {
    return res.status(403).json({ error: "Verzoek niet toegestaan van deze oorsprong." });
  }

  const { reference, passage, messages } = req.body || {};
  if (!passage) return res.status(400).json({ error: "Geen tekst om uit te leggen." });
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Geen gespreksberichten meegestuurd." });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server niet correct geconfigureerd." });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // De system-instructie draagt de rol + de concrete Bijbeltekst, zodat elke
  // vervolgvraag gegrond blijft in dezelfde passage.
  const systemText =
    "Je bent een behulpzame gids die Bijbelteksten helder en respectvol uitlegt in het Nederlands. " +
    "Geef context, betekenis en bekende interpretaties, zonder één stroming als de enige juiste te presenteren. " +
    "Beantwoord vervolgvragen in het licht van de onderstaande tekst.\n\n" +
    `De tekst die centraal staat (${reference}):\n\n${passage}`;

  // Zet de app-berichten om naar Gemini's contents-formaat.
  // Verwacht: messages = [{ role: 'user' | 'model', text: '...' }, ...]
  const contents = messages.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: String(m.text || "") }],
  }));

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents,
        }),
      }
    );

    if (!apiRes.ok) {
      console.error("Gemini API-fout:", apiRes.status, await apiRes.text());
      return res.status(502).json({ error: "Gemini API gaf een fout terug." });
    }

    const data = await apiRes.json();
    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "";

    if (!reply) {
      return res.status(502).json({ error: "Gemini gaf geen bruikbaar antwoord." });
    }

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon geen antwoord ophalen." });
  }
}
