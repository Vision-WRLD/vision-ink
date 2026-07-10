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
  const actions = document.getElementById("results-actions");
  const regenBtn = document.getElementById("b-regen");
  const restartBtn = document.getElementById("b-restart");
  const cards = [...document.querySelectorAll(".result-card")];

  const subject = document.getElementById("b-subject");
  const details = document.getElementById("b-details");
  const place = document.getElementById("b-place");
  const styleCustom = document.getElementById("b-style-custom");

  const state = { step: 1, style: "any", styleLabel: "Artist's choice", vibes: [], busy: false };
  const TOTAL = 4;

  // ---- chip wiring ----
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
        updateBrief(); updateNav();
      })
    );
  });
  const styleChips = document.getElementById("style-chips");
  styleChips.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      styleChips.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      if (styleCustom) styleCustom.value = "";
      state.style = b.dataset.v;
      state.styleLabel = b.textContent.trim();
      updateBrief();
    })
  );
  // custom style — typing overrides the chip choice
  if (styleCustom) {
    styleCustom.addEventListener("input", () => {
      const v = styleCustom.value.trim();
      if (v) {
        styleChips.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        state.style = v;
        state.styleLabel = v.length > 26 ? v.slice(0, 26) + "…" : v;
      } else {
        const any = styleChips.querySelector('[data-v="any"]');
        styleChips.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        any.classList.add("active");
        state.style = "any";
        state.styleLabel = "Artist's choice";
      }
      updateBrief();
    });
  }
  // help toggles — describe each step
  document.querySelectorAll(".help-toggle").forEach((t) =>
    t.addEventListener("click", () => {
      const ht = t.closest(".step-panel").querySelector(".help-text");
      const open = ht.hidden;
      ht.hidden = !open;
      t.setAttribute("aria-expanded", open ? "true" : "false");
    })
  );
  document.getElementById("vibe-chips").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      const v = b.dataset.v;
      b.classList.toggle("active");
      if (state.vibes.includes(v)) state.vibes = state.vibes.filter((x) => x !== v);
      else state.vibes.push(v);
      updateBrief();
    })
  );
  [subject, details, place].forEach((i) =>
    i.addEventListener("input", () => { updateBrief(); updateNav(); })
  );

  // ---- assemble the brief ----
  function assembled() {
    return [subject.value.trim(), details.value.trim(), place.value.trim(), state.vibes.join(", ")]
      .filter(Boolean).join(", ");
  }
  function updateBrief() {
    const d = assembled();
    if (!d) { briefEl.textContent = "—"; return; }
    const styleTxt = state.style === "any" ? "" : ` · <span class="pv-style">${state.styleLabel}</span>`;
    briefEl.innerHTML = d + styleTxt;
  }

  // ---- navigation / button visibility ----
  function updateNav() {
    const hasIdea = !!subject.value.trim();
    // Generate is available the moment there's an idea — even on step 1 (low friction).
    genBtn.hidden = !hasIdea || state.busy;
    nextBtn.hidden = state.step === TOTAL;
    backBtn.hidden = state.step === 1;
  }
  function showStep(n) {
    state.step = n;
    panels.forEach((p) => (p.hidden = +p.dataset.step !== n));
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === n - 1);
      d.classList.toggle("done", i < n - 1);
    });
    updateNav();
    const f = panels[n - 1].querySelector(".b-input");
    if (f) setTimeout(() => f.focus(), 60);
  }
  nextBtn.addEventListener("click", () => {
    if (state.step === 1 && !subject.value.trim()) {
      subject.focus(); subject.style.borderColor = "#ff6b6b";
      status.textContent = "Tell us what you want first ✍"; status.classList.add("error");
      return;
    }
    status.textContent = ""; status.classList.remove("error"); subject.style.borderColor = "";
    if (state.step < TOTAL) showStep(state.step + 1);
  });
  backBtn.addEventListener("click", () => { if (state.step > 1) showStep(state.step - 1); });
  [subject, details, place].forEach((i) =>
    i.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); if (state.step < TOTAL) nextBtn.click(); else genBtn.click(); }
    })
  );

  // ---- generation ----
  const lines = ["Reading your idea…", "Engineering the stencil…", "Inking three directions…", "Rendering linework…", "Balancing negative space…"];
  let tick;
  function startLoading(label) {
    results.hidden = false; actions.hidden = true;
    cards.forEach((c) => { c.className = "result-card loading"; c.querySelector(".result-frame").style.backgroundImage = ""; });
    state.busy = true; genBtn.disabled = true; regenBtn.disabled = true;
    genBtn.querySelector(".btn-label").textContent = "Generating…";
    regenBtn.querySelector(".btn-label").textContent = "Generating…";
    status.classList.remove("error");
    let i = 0; status.textContent = lines[0];
    tick = setInterval(() => { i = (i + 1) % lines.length; status.textContent = lines[i]; }, 1400);
    results.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function stopLoading() {
    clearInterval(tick); state.busy = false;
    genBtn.querySelector(".btn-label").textContent = "Generate 3 concepts";
    regenBtn.querySelector(".btn-label").textContent = "↻ Regenerate — fresh set";
    updateNav();
  }
  function showError(msg) {
    stopLoading(); genBtn.disabled = false; regenBtn.disabled = false;
    status.classList.add("error"); status.textContent = "⚠ " + msg;
    cards.forEach((c) => (c.className = "result-card"));
  }
  function cooldown(sec) {
    let s = sec; regenBtn.disabled = true;
    cooldownEl.textContent = `Fresh set in ${s}s…`;
    const t = setInterval(() => {
      s--;
      if (s <= 0) { clearInterval(t); cooldownEl.textContent = ""; regenBtn.disabled = false; }
      else cooldownEl.textContent = `Fresh set in ${s}s…`;
    }, 1000);
  }

  async function runGeneration(regen) {
    const description = assembled();
    if (!description) { showStep(1); showError("Type your idea first."); return; }
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
      status.textContent = regen ? "Fresh concepts ready — tap any to enlarge." : "Three concepts ready — tap any to enlarge.";
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
        img.src = src; loaded++;
      });
      actions.hidden = false;
      cooldown(loaded ? 3 : 0);
    } catch (err) {
      showError(err.message);
    }
  }

  genBtn.addEventListener("click", () => runGeneration(false));
  regenBtn.addEventListener("click", () => runGeneration(true));
  restartBtn.addEventListener("click", () => {
    subject.value = ""; details.value = ""; place.value = "";
    if (styleCustom) styleCustom.value = "";
    state.vibes = []; state.style = "any"; state.styleLabel = "Artist's choice";
    styleChips.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
    styleChips.querySelector('[data-v="any"]').classList.add("active");
    document.querySelectorAll("#vibe-chips button.active").forEach((x) => x.classList.remove("active"));
    // fully wipe the previous concept, not just hide it
    cards.forEach((c) => {
      c.className = "result-card";
      c.querySelector(".result-frame").style.backgroundImage = "";
      c.onclick = null;
    });
    results.hidden = true; actions.hidden = true; status.textContent = ""; cooldownEl.textContent = "";
    updateBrief(); showStep(1);
    builder.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  showStep(1);
})();
