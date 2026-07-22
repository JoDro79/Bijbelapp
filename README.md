# Bijbeltekst-app

Zoek een Bijbelverwijzing op (via de getBible v2 query-API) en vraag om uitleg.
De API-sleutel voor de uitleg blijft server-side in een Vercel serverless function.

## Structuur

```
api/
  bible.js      → haalt de Bijbeltekst op (geen sleutel nodig)
  explain.js    → stuurt de tekst naar het taalmodel (sleutel via env-var)
src/
  BibleExplainer.jsx  → de React-UI
```

## Lokaal draaien

```bash
npm install
cp .env.example .env.local     # vul GEMINI_API_KEY in, laat ALLOWED_ORIGIN leeg
npm i -g vercel
vercel dev                     # draait frontend + /api samen op http://localhost:3000
```

## Online zetten (Vercel + GitHub)

1. Push deze map naar een GitHub-repository.
2. Ga naar vercel.com -> Add New -> Project -> importeer de repo.
3. Framework wordt automatisch herkend als Vite. Klik Deploy.
4. Ga naar Settings -> Environment Variables en voeg toe:
   - GEMINI_API_KEY = je sleutel van aistudio.google.com/apikey
   - ALLOWED_ORIGIN = je Vercel-URL, bijv. https://bijbel-app.vercel.app
   - GEMINI_MODEL (optioneel) = ander model dan gemini-2.5-flash
5. Redeploy (Deployments -> ... -> Redeploy) zodat de env-vars actief worden.

## Belangrijk

- .env.local staat in .gitignore en mag NOOIT gecommit worden.
- Er is nog geen echte rate limiting. Voeg die toe (bijv. Upstash Redis) voordat
  je dit breed deelt, anders kan iemand je tegoed opstoken.
