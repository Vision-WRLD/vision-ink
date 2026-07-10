import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(__dirname, "public")));

const PROVIDER = (process.env.IMAGE_PROVIDER || "openai").toLowerCase();
const N_IMAGES = 3;

// Turn a raw customer description into a strong tattoo-design prompt.
function buildTattooPrompt(userText, style) {
  // Lead with the STYLE so the model weights it, then the subject, then finish cues.
  const lead = style && style !== "any" ? `${style} tattoo design` : "tattoo design";
  return `${lead} of ${userText.trim()}, isolated centered on a clean solid white background. Bold clean confident linework, crisp sharp edges, intricate high detail, professional tattoo flash artwork, high quality, no background clutter, no text.`;
}

async function generateOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set in .env");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: N_IMAGES,
      size: "1024x1024",
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.data.map((d) => `data:image/png;base64,${d.b64_json}`);
}

async function generateStabilityOne(prompt) {
  const key = process.env.STABILITY_API_KEY;
  if (!key) throw new Error("STABILITY_API_KEY not set in .env");
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("output_format", "png");
  form.append("aspect_ratio", "1:1");
  const res = await fetch(
    "https://api.stability.ai/v2beta/stable-image/generate/core",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
      body: form,
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Stability ${res.status}: ${detail.slice(0, 500)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// Pollinations.ai — 100% free, NO API key, NO signup. Server fetches the image
// and returns a base64 data URI (so the browser CSP `img-src 'self' data:` is happy).
async function generatePollinationsOne(prompt, seed) {
  const tok = process.env.POLLINATIONS_TOKEN;
  const url =
    "https://image.pollinations.ai/prompt/" +
    encodeURIComponent(prompt) +
    `?width=1024&height=1024&nologo=true&seed=${seed}` +
    (tok ? `&token=${encodeURIComponent(tok)}` : "");
  const opts = tok ? { headers: { Authorization: `Bearer ${tok}` } } : {};
  // Free Seed tier = 1 request / 5s → retry on 429 with backoff (sk_ keys have no limit).
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, opts);
    if (res.ok) {
      const type = res.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:${type};base64,${buf.toString("base64")}`;
    }
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 6000));
      continue;
    }
    throw new Error(`Pollinations ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

// Hugging Face Inference — free tier (rate-limited). Needs a free token (hf_...).
async function generateHuggingFaceOne(prompt, seed) {
  const key = process.env.HF_API_KEY;
  if (!key) throw new Error("HF_API_KEY not set in .env");
  const model = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: prompt, parameters: { seed } }),
  });
  if (!res.ok) {
    throw new Error(`HuggingFace ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// Deterministic SVG placeholders as data: URIs — no key, no cost, CSP-safe
// (real providers return base64 data URIs too, so the frontend path is identical).
function generateMock(prompt) {
  const seed = [...prompt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = (n) => {
    let x = (seed + n * 2654435761) >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
  return Array.from({ length: N_IMAGES }, (_, i) => {
    const cx = 512, cy = 512;
    let paths = "";
    const rings = 3 + Math.floor(rnd(i * 9) * 3);
    for (let r = 0; r < rings; r++) {
      const rad = 90 + r * (70 + rnd(i + r) * 60);
      paths += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="#ece9e0" stroke-opacity="${0.15 + rnd(r + i) * 0.25}" stroke-width="${1 + rnd(r) * 2}"/>`;
    }
    const spokes = 6 + Math.floor(rnd(i * 3) * 8);
    for (let s = 0; s < spokes; s++) {
      const ang = (s / spokes) * Math.PI * 2 + rnd(i) * 6;
      const len = 160 + rnd(s + i) * 220;
      paths += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(ang) * len).toFixed(1)}" y2="${(cy + Math.sin(ang) * len).toFixed(1)}" stroke="#ece9e0" stroke-opacity="0.35" stroke-width="1.2"/>`;
    }
    const label = ["A", "B", "C"][i] || i + 1;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'>
<rect width='1024' height='1024' fill='#0e0e10'/>
<rect width='1024' height='1024' fill='none' stroke='#26262c' stroke-width='2'/>
${paths}
<circle cx='${cx}' cy='${cy}' r='4' fill='#ece9e0'/>
<text x='40' y='72' fill='#ece9e0' font-family='monospace' font-size='30' letter-spacing='4'>CONCEPT ${label}</text>
<text x='40' y='980' fill='#8f8d88' font-family='monospace' font-size='22'>AI REFERENCE · MOCK MODE</text>
</svg>`;
    // base64 (no quotes/parens) so it's safe inside CSS url('...') — matches
    // the base64 PNGs the real providers return.
    return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  });
}

app.post("/api/generate", async (req, res) => {
  try {
    const { description, style } = req.body || {};
    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Describe your tattoo first." });
    }
    const prompt = buildTattooPrompt(description, style);
    let images;
    if (PROVIDER === "mock") {
      images = generateMock(prompt);
    } else if (PROVIDER === "pollinations") {
      // Free tier allows only 1 request in-flight per IP — run sequentially.
      // Random base seed each call → regenerate gives fresh art.
      const base = Math.floor(Math.random() * 2_000_000_000);
      images = [];
      for (let i = 0; i < N_IMAGES; i++) {
        images.push(await generatePollinationsOne(prompt, base + i));
      }
    } else if (PROVIDER === "huggingface") {
      const base = Math.floor(Math.random() * 2_000_000_000);
      images = await Promise.all(
        Array.from({ length: N_IMAGES }, (_, i) => generateHuggingFaceOne(prompt, base + i))
      );
    } else if (PROVIDER === "stability") {
      images = await Promise.all(
        Array.from({ length: N_IMAGES }, () => generateStabilityOne(prompt))
      );
    } else {
      images = await generateOpenAI(prompt);
    }
    res.json({ prompt, images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Generation failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`INK studio running → http://localhost:${PORT}  (provider: ${PROVIDER})`);
});
