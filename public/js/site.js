// ---------------- INK shared site JS ----------------
(function () {
  // year
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // active nav link
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    if (a.getAttribute("href") === "/" + path) a.classList.add("active");
  });

  // mobile nav
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => links.classList.remove("open"))
    );
  }

  // scroll progress
  const bar = document.getElementById("progress");
  if (bar) {
    const onScroll = () => {
      const h = document.documentElement;
      const p = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      bar.style.width = (p || 0) + "%";
    };
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- reveal system (IO + guaranteed fallbacks per LAWS) ----
  function revealEl(el) { el.classList.add("in"); }
  function inView(el) {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.92 && r.bottom > 0;
  }
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => entries.forEach((e) => { if (e.isIntersecting) { revealEl(e.target); io.unobserve(e.target); } }),
          { threshold: 0.12 }
        )
      : null;
  window.revealScan = function () {
    document.querySelectorAll(".reveal:not(.in), .rise:not(.in)").forEach((el) => {
      if (inView(el)) revealEl(el);
      else if (io) io.observe(el);
    });
  };
  window.revealScan();
  // safety: force-reveal anything still hidden (bg tabs / IO never fires)
  setTimeout(() => {
    document.querySelectorAll(".reveal:not(.in), .rise:not(.in)").forEach(revealEl);
  }, 1600);

  // ---- count-ups ----
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const dur = 1200; const t0 = performance.now();
      const step = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (Math.round(eased * target * 10) / 10).toString().replace(/\.0$/, "") + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const cio = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); }
    }), { threshold: 0.5 });
    counters.forEach((c) => cio.observe(c));
    setTimeout(() => counters.forEach((c) => { if (!c.textContent.trim()) run(c); }), 1600);
  }

  // ---- FAQ accordion ----
  document.querySelectorAll(".faq-q").forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const a = item.querySelector(".faq-a");
      const open = item.classList.toggle("open");
      a.style.maxHeight = open ? a.scrollHeight + "px" : 0;
    });
  });

  // ---- gallery filter ----
  const chips = document.querySelectorAll(".chip");
  if (chips.length) {
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const cat = chip.dataset.cat;
        document.querySelectorAll(".masonry .art").forEach((art) => {
          art.style.display = cat === "all" || art.dataset.cat === cat ? "" : "none";
        });
      })
    );
  }

  // ---- lightbox (gallery + any [data-lightbox]) ----
  window.openLightbox = function (src) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<span class="x">&times;</span><img src="${src}" alt="Enlarged view" />`;
    const close = () => { box.classList.remove("on"); setTimeout(() => box.remove(), 250); };
    box.addEventListener("click", close);
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
    document.body.appendChild(box);
    void box.offsetWidth; // forced reflow so the fade runs (LAWS)
    box.classList.add("on");
  };
  document.querySelectorAll("[data-lightbox]").forEach((el) =>
    el.addEventListener("click", () => window.openLightbox(el.dataset.lightbox || el.querySelector("img")?.src))
  );

  // ---- demo forms (book) ----
  document.querySelectorAll("form[data-demo]").forEach((f) =>
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      f.reset();
      const note = f.querySelector(".book-note") || f.parentElement.querySelector(".book-note");
      if (note) note.hidden = false;
    })
  );
})();
