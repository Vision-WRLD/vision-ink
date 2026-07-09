// ---------------- VISION INK — guided AI concept builder ----------------
(function () {
  const builder = document.getElementById("builder");
  if (!builder) return;

  const panels = [...builder.querySelectorAll(".step-panel")];
  const dots = [...builder.querySelectorAll(".steps-bar .dot")];
  const backBtn = document.getElementById("b-back");
  const nextBtn = document.getElementById("b-next");
  const genBtn = document.getElementById("b-generate");
  const cooldownEl = document.getElementById("b-cooldown");
  const briefEl = document.getElementById("b-brief");
  const status = document.getElementById("gen-status");
  const results = document.getElementById("results");
  const cards = [...document.querySelectorAll(".result-card")];

  const subject = document.getElementById("b-subject");
  const details = document.getElementById("b-details");
  const place = document.getElementById("b-place");

  const state = { step: 1, style: "any", styleLabel: "Artist's choice", vibes: [] };
  const TOTAL = 4;

  // ---- chip wiring ----
  // set/append chips fill a text input
  builder.querySelectorAll(".chips-row[data-target]").forEach((row) => {
    const target = document.getElementById(row.dataset.target);
    const mode = row.dataset.mode;
    row.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        const txt = b.textContent.trim();
        if (mode === "append" && target.value.trim()) {
          target.value = target.value.replace(/[,\s]+$/, "") + ", " + txt;
        } else {
          target.value = txt;
        }
        target.focus();
        updateBrief();
      })
    );
  });
  // style — pick one
  const styleChips = document.getElementById("style-chips");
  styleChips.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      styleChips.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.style = b.dataset.v;
      state.styleLabel = b.textContent.trim();
      updateBrief();
    })
  );
  // vibe — multi toggle
  document.getElementById("vibe-chips").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      const v = b.dataset.v;
      b.classList.toggle("active");
      if (state.vibes.includes(v)) state.vibes = state.vibes.filter((x) => x !== v);
      else state.vibes.push(v);
      updateBrief();
    })
  );
  [subject, details, place].forEach((i) => i.addEventListener("input", updateBrief));

  // ---- assemble the brief ----
  function assembled() {
    return [subject.value.trim(), details.value.trim(), place.value.trim(), state.vibes.join(", ")]
      .filter(Boolean)
      .join(", ");
  }
  function updateBrief() {
    const d = assembled();
    if (!d) { briefEl.textContent = "—"; return; }
    const styleTxt = state.style === "any" ? "" : ` · <span class="pv-style">${state.styleLabel}</span>`;
    briefEl.innerHTML = d + styleTxt;
  }

  // ---- step navigation ----
  function showStep(n) {
    state.step = n;
    panels.forEach((p) => (p.hidden = +p.dataset.step !== n));
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === n - 1);
      d.classList.toggle("done", i < n - 1);
    });
    backBtn.hidden = n === 1;
    nextBtn.hidden = n === TOTAL;
    genBtn.hidden = n !== TOTAL;
    const focusable = panels[n - 1].querySelector(".b-input");
    if (focusable) setTimeout(() => focusable.focus(), 60);
  }
  nextBtn.addEventListener("click", () => {
    if (state.step === 1 && !subject.value.trim()) {
      subject.focus();
      subject.style.borderColor = "#ff6b6b";
      status.textContent = "Tell us what you want first ✍";
      status.classList.add("error");
      return;
    }
    status.textContent = ""; status.classList.remove("error");
    subject.style.borderColor = "";
    if (state.step < TOTAL) showStep(state.step + 1);
  });
  backBtn.addEventListener("click", () => { if (state.step > 1) showStep(state.step - 1); });
  // Enter advances (except when composing multiline not needed here)
  [subject, details, place].forEach((i) =>
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nextBtn.click(); } })
  );

  // ---- generation ----
  const lines = ["Reading your idea…", "Engineering the stencil…", "Inking three directions…", "Rendering linework…", "Balancing negative space…"];
  let tick;
  function startLoading() {
    results.hidden = false;
    cards.forEach((c) => { c.className = "result-card loading"; c.querySelector(".result-frame").style.backgroundImage = ""; });
    genBtn.disabled = true;
    genBtn.querySelector(".btn-label").textContent = "Generating…";
    status.classList.remove("error");
    let i = 0; status.textContent = lines[0];
    tick = setInterval(() => { i = (i + 1) % lines.length; status.textContent = lines[i]; }, 1400);
  }
  function stopLoading() {
    clearInterval(tick);
    genBtn.querySelector(".btn-label").textContent = "Generate 3 concepts";
  }
  function showError(msg) {
    stopLoading(); genBtn.disabled = false;
    status.classList.add("error"); status.textContent = "⚠ " + msg;
    cards.forEach((c) => (c.className = "result-card"));
  }
  // post-generate cooldown so nobody hammers the generator
  function cooldown(sec) {
    let s = sec;
    genBtn.disabled = true;
    cooldownEl.textContent = `Next set in ${s}s — tweak your brief while you wait`;
    const t = setInterval(() => {
      s--;
      if (s <= 0) { clearInterval(t); cooldownEl.textContent = ""; genBtn.disabled = false; }
      else cooldownEl.textContent = `Next set in ${s}s — tweak your brief while you wait`;
    }, 1000);
  }

  genBtn.addEventListener("click", async () => {
    const description = assembled();
    if (!description) { showStep(1); showError("Add your idea first."); return; }
    startLoading();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, style: state.style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      stopLoading();
      status.textContent = "Three concepts ready — tap any to enlarge.";
      let loaded = 0;
      (data.images || []).forEach((src, i) => {
        const card = cards[i];
        if (!card) return;
        const img = new Image();
        img.onload = () => {
          card.querySelector(".result-frame").style.backgroundImage = `url('${src}')`;
          card.className = "result-card done";
          card.onclick = () => window.openLightbox(src);
        };
        img.onerror = () => (card.className = "result-card");
        img.src = src;
        loaded++;
      });
      results.scrollIntoView({ behavior: "smooth", block: "center" });
      cooldown(loaded ? 8 : 0);
    } catch (err) {
      showError(err.message);
    }
  });

  showStep(1);
})();
