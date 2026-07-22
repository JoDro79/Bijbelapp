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

  const { reference, passage } = req.body || {};
  if (!passage) return res.status(400).json({ error: "Geen tekst om uit te leggen." });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server niet correct geconfigureerd." });
  }

  // Standaardmodel; overschrijf met env-var GEMINI_MODEL indien nodig.
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
          system_instruction: {
            parts: [
              {
                text:
                  "Je bent een behulpzame gids die Bijbelteksten helder en respectvol uitlegt in het Nederlands. " +
                  "Geef context, betekenis en bekende interpretaties, zonder één stroming als de enige juiste te presenteren.",
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: `Leg de volgende Bijbeltekst uit (${reference}):\n\n${passage}` },
              ],
            },
          ],
        }),
      }
    );

    if (!apiRes.ok) {
      console.error("Gemini API-fout:", apiRes.status, await apiRes.text());
      return res.status(502).json({ error: "Gemini API gaf een fout terug." });
    }

    const data = await apiRes.json();
    const explanation =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "";

    if (!explanation) {
      return res.status(502).json({ error: "Gemini gaf geen bruikbaar antwoord." });
    }

    res.json({ explanation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon geen uitleg ophalen." });
  }
}
