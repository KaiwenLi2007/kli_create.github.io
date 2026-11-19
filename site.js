/* ============================================================
   KAIWEN LI — PORTFOLIO INTERACTIONS
   theme · cursor-reactive type · nav · reveals · magnetics
   ============================================================ */

(function () {
    "use strict";

    // Motion is a core part of this site's design — intentionally not gated
    // behind the OS "reduce motion" setting.
    const reduceMotion = false;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    /* ---------- Theme: light "paper" is the default, dark is the alternate ----------
       Each page's <head> applies a saved dark theme before first paint; this
       repeats it in case that inline script is ever missing. */
    const root = document.documentElement;
    try {
        if (localStorage.getItem("kl-theme") === "dark") root.setAttribute("data-theme", "dark");
    } catch (e) { /* storage may be blocked */ }
    const isLight = () => root.getAttribute("data-theme") !== "dark";

    /* ---------- Cursor state ---------- */
    const mouse = { px: -9999, py: -9999, active: false };

    window.addEventListener("pointermove", (e) => {
        mouse.px = e.clientX;
        mouse.py = e.clientY;
        mouse.active = true;
        wakeWords();
    }, { passive: true });

    root.addEventListener("mouseleave", () => {
        mouse.active = false;
        wakeWords();
    });
    // scrolling moves headings under a still cursor
    window.addEventListener("scroll", () => wakeWords(), { passive: true });

    /* ---------- Cursor-reactive typography ---------- */
    // Big headings are split into per-character spans that repel from the
    // cursor. Gradient words (em, .serif-accent) move as one unit so their
    // background-clip gradients stay intact.
    const movers = [];
    const WORD_RADIUS = 150;
    const WORD_FORCE = 26;

    if (finePointer && !reduceMotion) {
        const isUnit = (el) =>
            el.tagName === "EM" ||
            el.classList.contains("serif-accent");

        const splitNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (!node.textContent.trim()) return;
                const frag = document.createDocumentFragment();
                for (const ch of node.textContent) {
                    if (/\s/.test(ch)) {
                        frag.appendChild(document.createTextNode(ch));
                    } else {
                        const s = document.createElement("span");
                        s.className = "ch";
                        s.textContent = ch;
                        frag.appendChild(s);
                        movers.push({ el: s, ox: 0, oy: 0 });
                    }
                }
                node.replaceWith(frag);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (isUnit(node)) {
                    node.classList.add("ch-unit");
                    movers.push({ el: node, ox: 0, oy: 0 });
                } else {
                    Array.from(node.childNodes).forEach(splitNode);
                }
            }
        };

        document.querySelectorAll(".display, .section-title")
            .forEach((el) => Array.from(el.childNodes).forEach(splitNode));
    }

    // returns true while any letter is still away from its rest position
    function moveWords() {
        if (!movers.length) return false;
        let busy = false;
        const vh2 = window.innerHeight;
        // Pass 1 — read all layout up front. Keeping every getBoundingClientRect
        // together (before any transform write) avoids the read-after-write that
        // forces a synchronous reflow per character while the page is scrolling.
        const rects = new Array(movers.length);
        for (let i = 0; i < movers.length; i++) {
            rects[i] = movers[i].el.getBoundingClientRect();
        }
        // Pass 2 — compute offsets and write transforms.
        for (let i = 0; i < movers.length; i++) {
            const m = movers[i];
            const r = rects[i];
            // skip off-screen text, gently settle any leftover offset
            if (r.bottom < -80 || r.top > vh2 + 80) {
                if (m.ox || m.oy) {
                    m.ox *= 0.8;
                    m.oy *= 0.8;
                    m.el.style.transform = "";
                }
                continue;
            }
            // untransformed center = current rect center minus our offset
            const cx = r.left + r.width / 2 - m.ox;
            const cy = r.top + r.height / 2 - m.oy;
            let tx = 0, ty = 0;
            if (mouse.active) {
                const dx = cx - mouse.px;
                const dy = cy - mouse.py;
                const d = Math.hypot(dx, dy);
                if (d > 0 && d < WORD_RADIUS) {
                    const f = 1 - d / WORD_RADIUS;
                    tx = (dx / d) * f * WORD_FORCE;
                    ty = (dy / d) * f * WORD_FORCE * 0.85;
                }
            }
            m.ox += (tx - m.ox) * 0.14;
            m.oy += (ty - m.oy) * 0.14;
            // busy only while still easing — a letter held still beside a resting
            // cursor keeps its pose without keeping the loop alive
            if (Math.abs(tx - m.ox) > 0.05 || Math.abs(ty - m.oy) > 0.05) busy = true;
            if (Math.abs(m.ox) > 0.05 || Math.abs(m.oy) > 0.05) {
                m.el.style.transform =
                    `translate(${m.ox}px, ${m.oy}px) rotate(${m.ox * 0.25}deg)`;
            } else {
                m.ox = 0;
                m.oy = 0;
                if (m.el.style.transform) m.el.style.transform = "";
            }
        }
        return busy;
    }

    // the loop only runs while the pointer/scroll is active or letters are settling
    let wordsRaf = 0, lastWake = 0;
    function frame() {
        wordsRaf = 0;
        const busy = moveWords();
        if (busy || performance.now() - lastWake < 300) wordsRaf = requestAnimationFrame(frame);
    }
    function wakeWords() {
        lastWake = performance.now();
        if (movers.length && !wordsRaf) wordsRaf = requestAnimationFrame(frame);
    }

    /* ---------- Theme toggle (paper ⇄ dark) — lives in the nav bar ---------- */
    const nav = document.querySelector(".site-nav");
    const menuBtn = document.querySelector(".menu-btn");

    const themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.className = "theme-toggle";
    const paintThemeBtn = () => {
        const light = isLight();
        themeBtn.textContent = light ? "☾" : "☀︎";
        themeBtn.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    };
    paintThemeBtn();
    themeBtn.addEventListener("click", () => {
        const goDark = isLight();
        if (goDark) root.setAttribute("data-theme", "dark");
        else root.removeAttribute("data-theme");
        try { localStorage.setItem("kl-theme", goDark ? "dark" : "light"); } catch (e) { /* ignore */ }
        paintThemeBtn();
    });
    if (nav) nav.insertBefore(themeBtn, menuBtn && menuBtn.parentNode === nav ? menuBtn : null);
    else document.body.appendChild(themeBtn);

    /* ---------- Nav: scrolled state ---------- */
    if (nav) {
        const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    /* ---------- Overlay menu ---------- */
    const overlay = document.querySelector(".overlay-menu");
    const closeBtn = document.querySelector(".overlay-close");

    if (overlay) {
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Site menu");
    }

    function setMenu(open) {
        if (!overlay) return;
        const wasOpen = overlay.classList.contains("open");
        overlay.classList.toggle("open", open);
        document.body.style.overflow = open ? "hidden" : "";
        if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
        overlay.querySelectorAll("a").forEach((a, i) => {
            a.style.transitionDelay = open ? `${0.06 + i * 0.05}s` : "0s";
        });
        // .overlay-menu.open flips visibility instantly (styles.css), so focus can land now
        if (open && closeBtn) closeBtn.focus();
        else if (!open && wasOpen && menuBtn) {
            const a = document.activeElement;
            if (!a || a === document.body || overlay.contains(a)) menuBtn.focus();
        }
    }

    if (menuBtn) {
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.addEventListener("click", () => setMenu(true));
    }
    if (closeBtn) closeBtn.addEventListener("click", () => setMenu(false));
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target.closest("a") || e.target === overlay) setMenu(false);
        });
    }
    window.addEventListener("keydown", (e) => {
        if (!overlay || !overlay.classList.contains("open")) return;
        if (e.key === "Escape") {
            setMenu(false);
        } else if (e.key === "Tab") {
            // keep keyboard focus inside the open menu
            const items = Array.from(overlay.querySelectorAll("a[href], button"));
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    /* ---------- Scroll reveals ---------- */
    const revealEls = document.querySelectorAll("[data-reveal]");
    if (revealEls.length && "IntersectionObserver" in window && !reduceMotion) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("revealed");
                    io.unobserve(entry.target);
                }
            });
        // threshold 0: a 5000px-tall article can never be 12% visible on a short phone
        }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
        revealEls.forEach((el) => io.observe(el));
    } else {
        revealEls.forEach((el) => el.classList.add("revealed"));
    }

    /* ---------- Card pointer glow ---------- */
    if (finePointer) {
        document.querySelectorAll(".glass-card").forEach((card) => {
            card.addEventListener("pointermove", (e) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty("--mx", `${e.clientX - r.left}px`);
                card.style.setProperty("--my", `${e.clientY - r.top}px`);
            });
        });
    }

    /* ---------- Magnetic buttons ---------- */
    if (finePointer && !reduceMotion) {
        document.querySelectorAll(".btn").forEach((btn) => {
            btn.addEventListener("pointermove", (e) => {
                const r = btn.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2);
                const dy = e.clientY - (r.top + r.height / 2);
                btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
            });
            btn.addEventListener("pointerleave", () => {
                btn.style.transform = "";
            });
        });
    }

    /* ---------- Subtle 3D tilt ---------- */
    if (finePointer && !reduceMotion) {
        document.querySelectorAll("[data-tilt]").forEach((el) => {
            el.addEventListener("pointermove", (e) => {
                const r = el.getBoundingClientRect();
                const rx = ((e.clientY - r.top) / r.height - 0.5) * -7;
                const ry = ((e.clientX - r.left) / r.width - 0.5) * 7;
                el.style.transform =
                    `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
            });
            el.addEventListener("pointerleave", () => {
                el.style.transform = "";
            });
        });
    }
})();
