export default async function handler(req, res) {
  const { translation = "statenvertaling", ref } = req.query;
  if (!ref) return res.status(400).json({ error: "Geen verwijzing opgegeven." });

  try {
    const url = `https://query.getbible.net/v2/${encodeURIComponent(translation)}/${encodeURIComponent(ref)}`;
    const apiRes = await fetch(url);
    if (!apiRes.ok) {
      return res.status(502).json({ error: `getBible gaf ${apiRes.status} terug.` });
    }

    const data = await apiRes.json();
    const verses = [];
    let refLabel = ref;
    for (const block of Object.values(data)) {
      if (block?.verses?.length) {
        refLabel = block.ref?.[0] || `${block.book_name} ${block.chapter}`;
        for (const v of block.verses) {
          verses.push({
            verse: v.verse,
            name: v.name || `${block.book_name} ${v.chapter}:${v.verse}`,
            text: v.text,
          });
        }
      }
    }

    if (verses.length === 0) {
      return res.status(404).json({ error: "Geen verzen gevonden." });
    }
    res.json({ reference: refLabel, translation, verses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kon de Bijbeltekst niet ophalen." });
  }
}
