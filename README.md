# INK — AI Tattoo Studio (multipage)

Dark, photo-forward private tattoo studio site. Customers describe a tattoo idea,
an AI renders **3 custom concepts**, then they book a consult.

## Pages
`index` (home) · `gallery` (filterable work + lightbox) · `artists` · `studio`
(process / aftercare / FAQ) · `ai` (the AI Concept Studio) · `book` · `privacy` · `terms`.

## Stack
- Static multipage frontend (`public/`) — no framework. Shared `css/site.css`,
  `js/site.js` (nav, reveal system, scroll progress, count-ups, filter, lightbox,
  FAQ), `js/ai.js` (generator). Real local tattoo photography in `img/`.
- Tiny Express proxy (`server.js`) — keeps the image-API key server-side, serves
  the static site, exposes `POST /api/generate`.
- Design: Anton (condensed display) + Oswald + Inter, near-black + single lime
  accent, film grain + vignette, static heroes with below-fold motion.

## Run

```bash
npm install
cp .env.example .env      # then edit .env
npm start                 # → http://localhost:3000
```

## Image providers (set in `.env`)

`IMAGE_PROVIDER` picks the engine:

| value       | needs                | notes                                  |
|-------------|----------------------|----------------------------------------|
| `openai`    | `OPENAI_API_KEY`     | default. Model `gpt-image-1`, 3 in one call |
| `stability` | `STABILITY_API_KEY`  | Stable Image Core, 3 parallel calls    |
| `mock`      | nothing              | grayscale placeholders — demo / offline |

Get keys: [OpenAI](https://platform.openai.com/api-keys) · [Stability](https://platform.stability.ai/account/keys)

Start with `IMAGE_PROVIDER=mock` to click through the flow free, then swap in a
real key when ready.

## How the AI works
`server.js` → `buildTattooPrompt()` wraps the customer's raw text into a strong
tattoo-design prompt (clean linework, stencil-ready, plain background, chosen
style) before sending it to the provider. Tune that function to shape output.

## Placeholder content — REPLACE before launch
This is a template shell. Nothing below is real; swap it for the actual studio's
details so the site isn't making things up:
- **Portfolio** (`img/t*.jpg`) — stock photos standing in for real healed work.
- **Artists** (`artists.html`) — invented names/photos/bios.
- **Address, hours, contact** (`book.html`, footers) — placeholder ("114 Cedar St", "Tue–Sat").
- **Booking form** — front-end demo only; wire it to email/CRM.

Fabricated stats (years of experience, piece counts) were intentionally removed —
don't re-add numbers you can't back up.

## Notes
- Generated concept images are AI reference art, labeled as such in the UI and Terms.

## Deploy to Cloudflare Pages (from GitHub)
The `/api/generate` backend runs as a **Pages Function** (`functions/api/generate.js`),
so the AI feature works serverless — no separate server needed.

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub, pick **Vision-WRLD/vision-ink**.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **`public`**
4. **Environment variables** (Settings → Environment variables) — add:
   - `IMAGE_PROVIDER` = `pollinations`
   - `POLLINATIONS_TOKEN` = your `sk_...` token — click **Encrypt** (secret)
5. **Save and Deploy** → you get `vision-ink.pages.dev`.
6. If you add/change env vars after the first build, hit **Retry deployment** so the Function reloads them.

The token lives ONLY in Cloudflare's encrypted env — never in the repo.
