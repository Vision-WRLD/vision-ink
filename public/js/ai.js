// ---------------- INK — AI concept generator ----------------
(function () {
  const form = document.getElementById("gen-form");
  if (!form) return;
  const btn = document.getElementById("gen-btn");
  const status = document.getElementById("gen-status");
  const results = document.getElementById("results");
  const cards = [...document.querySelectorAll(".result-card")];
  const desc = document.getElementById("desc");

  // example prompt chips
  document.querySelectorAll(".ai-chips button").forEach((b) =>
    b.addEventListener("click", () => {
      desc.value = b.dataset.p;
      desc.focus();
    })
  );

  const lines = [
    "Reading your idea…",
    "Engineering the stencil…",
    "Inking three directions…",
    "Rendering linework…",
    "Balancing negative space…",
  ];
  let tick;

  function startLoading() {
    results.hidden = false;
    cards.forEach((c) => {
      c.className = "result-card loading";
      c.querySelector(".result-frame").style.backgroundImage = "";
    });
    btn.disabled = true;
    btn.querySelector(".btn-label").textContent = "Generating…";
    status.classList.remove("error");
    let i = 0;
    status.textContent = lines[0];
    tick = setInterval(() => { i = (i + 1) % lines.length; status.textContent = lines[i]; }, 1400);
  }
  function stopLoading() {
    clearInterval(tick);
    btn.disabled = false;
    btn.querySelector(".btn-label").textContent = "Generate 3 concepts";
  }
  function showError(msg) {
    stopLoading();
    status.classList.add("error");
    status.textContent = "⚠ " + msg;
    cards.forEach((c) => (c.className = "result-card"));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = desc.value.trim();
    const style = document.getElementById("style").value;
    if (!description) return;
    startLoading();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      stopLoading();
      status.textContent = "Three concepts ready — tap any to enlarge.";
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
      });
    } catch (err) {
      showError(err.message);
    }
  });
})();
