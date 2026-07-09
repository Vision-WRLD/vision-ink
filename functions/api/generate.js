// Cloudflare Pages Function → serves POST /api/generate on Cloudflare.
// Mirrors server.js but for the Workers runtime (no Buffer; token from env).
// Set these in the Cloudflare Pages dashboard → Settings → Environment variables:
//   IMAGE_PROVIDER = pollinations   (or mock / huggingface / openai / stability)
//   POLLINATIONS_TOKEN = sk_...      (encrypted secret)

const N_IMAGES = 3;

function buildTattooPrompt(userText, style) {
  const styleLine = style && style !== "any" ? `Style: ${style}.` : "";
  return [
    "Professional tattoo design concept, high detail, clean linework,",
    "isolated on a plain light background, ink illustration, stencil-ready,",
    styleLine,
    "Subject:",
    userText.trim(),
  ].filter(Boolean).join(" ");
}

function bytesToB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function pollinationsOne(prompt, seed, env) {
  const tok = env.POLLINATIONS_TOKEN;
  const url =
    "https://image.pollinations.ai/prompt/" +
    encodeURIComponent(prompt) +
    `?width=1024&height=1024&nologo=true&seed=${seed}` +
    (tok ? `&token=${encodeURIComponent(tok)}` : "");
  const opts = tok ? { headers: { Authorization: `Bearer ${tok}` } } : {};
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, opts);
    if (res.ok) {
      const type = res.headers.get("content-type") || "image/jpeg";
      const bytes = new Uint8Array(await res.arrayBuffer());
      return `data:${type};base64,${bytesToB64(bytes)}`;
    }
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 6000));
      continue;
    }
    throw new Error(`Pollinations ${res.status}`);
  }
}

async function huggingfaceOne(prompt, seed, env) {
  const key = env.HF_API_KEY;
  if (!key) throw new Error("HF_API_KEY not set");
  const model = env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: prompt, parameters: { seed } }),
  });
  if (!res.ok) throw new Error(`HuggingFace ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return `data:image/png;base64,${bytesToB64(bytes)}`;
}

async function openai(prompt, env) {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, n: N_IMAGES, size: "1024x1024" }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.data.map((d) => `data:image/png;base64,${d.b64_json}`);
}

// Deterministic SVG placeholder (base64) — no key, CSP-safe.
function mock(prompt) {
  const seed = [...prompt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = (n) => {
    let x = (seed + n * 2654435761) >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
  return Array.from({ length: N_IMAGES }, (_, i) => {
    let paths = "";
    const rings = 3 + Math.floor(rnd(i * 9) * 3);
    for (let r = 0; r < rings; r++) {
      const rad = 90 + r * (70 + rnd(i + r) * 60);
      paths += `<circle cx="512" cy="512" r="${rad}" fill="none" stroke="#ece9e0" stroke-opacity="${0.15 + rnd(r + i) * 0.25}" stroke-width="${1 + rnd(r) * 2}"/>`;
    }
    const spokes = 6 + Math.floor(rnd(i * 3) * 8);
    for (let s = 0; s < spokes; s++) {
      const ang = (s / spokes) * Math.PI * 2 + rnd(i) * 6;
      const len = 160 + rnd(s + i) * 220;
      paths += `<line x1="512" y1="512" x2="${(512 + Math.cos(ang) * len).toFixed(1)}" y2="${(512 + Math.sin(ang) * len).toFixed(1)}" stroke="#ece9e0" stroke-opacity="0.35" stroke-width="1.2"/>`;
    }
    const label = ["A", "B", "C"][i] || i + 1;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'><rect width='1024' height='1024' fill='#0e0e10'/><rect width='1024' height='1024' fill='none' stroke='#26262c' stroke-width='2'/>${paths}<circle cx='512' cy='512' r='4' fill='#ece9e0'/><text x='40' y='72' fill='#ece9e0' font-family='monospace' font-size='30' letter-spacing='4'>CONCEPT ${label}</text><text x='40' y='980' fill='#8f8d88' font-family='monospace' font-size='22'>AI REFERENCE · MOCK MODE</text></svg>`;
    return "data:image/svg+xml;base64," + btoa(svg);
  });
}

// Diagnostic: GET /api/generate → confirms whether the token/env reached the Function
// WITHOUT calling the provider (isolates "env missing" from "rate-limited").
export async function onRequestGet({ env }) {
  return Response.json({
    ok: true,
    provider: (env.IMAGE_PROVIDER || "pollinations (default)").toLowerCase(),
    tokenPresent: !!env.POLLINATIONS_TOKEN,
    tokenPrefix: env.POLLINATIONS_TOKEN ? env.POLLINATIONS_TOKEN.slice(0, 3) : null,
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { description, style } = await request.json();
    if (!description || !description.trim()) {
      return Response.json({ error: "Describe your tattoo first." }, { status: 400 });
    }
    const provider = (env.IMAGE_PROVIDER || "pollinations").toLowerCase();
    const prompt = buildTattooPrompt(description, style);
    let images;
    if (provider === "mock") {
      images = mock(prompt);
    } else if (provider === "pollinations") {
      images = [];
      for (let i = 0; i < N_IMAGES; i++) images.push(await pollinationsOne(prompt, 1000 + i, env));
    } else if (provider === "huggingface") {
      images = [];
      for (let i = 0; i < N_IMAGES; i++) images.push(await huggingfaceOne(prompt, 1000 + i, env));
    } else if (provider === "openai") {
      images = await openai(prompt, env);
    } else {
      images = mock(prompt);
    }
    return Response.json({ prompt, images });
  } catch (err) {
    return Response.json({ error: err.message || "Generation failed." }, { status: 500 });
  }
}
