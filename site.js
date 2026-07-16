/* ============================================================
   KAIWEN LI — PORTFOLIO INTERACTIONS
   constellation canvas · cursor parallax · reveals · magnetics
   ============================================================ */

(function () {
    "use strict";

    // Motion is a core part of this site's design — intentionally not gated
    // behind the OS "reduce motion" setting.
    const reduceMotion = false;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    /* ---------- Theme: light "paper" is the default, dark is the alternate ---------- */
    const root = document.documentElement;
    try {
        if (localStorage.getItem("kl-theme") === "dark") root.setAttribute("data-theme", "dark");
    } catch (e) { /* storage may be blocked */ }
    const isLight = () => root.getAttribute("data-theme") !== "dark";

    /* ---------- Motion → colour ------------------------------------------------
       The page is monochrome at rest; colour is earned by movement. `energy`
       rises with cursor speed and decays every frame; `hue` tracks the pointer's
       x position (cool on the left → warm on the right). Shared with
       signature.js through window.__klMotion. */
    const motion = { energy: 0, hue: 210 };
    window.__klMotion = motion;
    let lastMX = null, lastMY = null;

    /* ---------- Cursor state (shared, lerped) ---------- */
    const mouse = { px: -9999, py: -9999, active: false };
    let targetNX = 0, targetNY = 0;
    let nx = 0, ny = 0;

    window.addEventListener("pointermove", (e) => {
        mouse.px = e.clientX;
        mouse.py = e.clientY;
        mouse.active = true;
        targetNX = e.clientX / window.innerWidth - 0.5;
        targetNY = e.clientY / window.innerHeight - 0.5;
        if (lastMX !== null) {
            const sp = Math.hypot(e.clientX - lastMX, e.clientY - lastMY);
            motion.energy = Math.min(1, motion.energy + sp / 210);
        }
        lastMX = e.clientX;
        lastMY = e.clientY;
        motion.hue = 205 - (e.clientX / window.innerWidth) * 190;
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
        mouse.active = false;
    });

    /* ---------- Cursor-reactive typography ---------- */
    // Big headings are split into per-character spans that repel from the
    // cursor. Gradient words (em, .shine, .serif-accent, .hl) move as one
    // unit so their background-clip gradients stay intact.
    const movers = [];
    const WORD_RADIUS = 150;
    const WORD_FORCE = 26;

    if (finePointer && !reduceMotion) {
        const isUnit = (el) =>
            el.tagName === "EM" ||
            el.classList.contains("shine") ||
            el.classList.contains("serif-accent") ||
            el.classList.contains("hl");

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

        document.querySelectorAll(".hero-name, .display, .section-title")
            .forEach((el) => Array.from(el.childNodes).forEach(splitNode));
    }

    function moveWords() {
        if (!movers.length) return;
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
            if (Math.abs(m.ox) > 0.05 || Math.abs(m.oy) > 0.05) {
                m.el.style.transform =
                    `translate(${m.ox}px, ${m.oy}px) rotate(${m.ox * 0.25}deg)`;
            } else if (m.el.style.transform) {
                m.el.style.transform = "";
            }
        }
    }

    /* ---------- Constellation canvas ---------- */
    const ambient = document.querySelector(".ambient");
    let ctx = null, pts = [], ripples = [], vw = 0, vh = 0;

    if (ambient && !reduceMotion) {
        const canvas = document.createElement("canvas");
        ambient.appendChild(canvas);
        ctx = canvas.getContext("2d");

        const build = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            vw = window.innerWidth;
            vh = window.innerHeight;
            canvas.width = vw * dpr;
            canvas.height = vh * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const count = Math.max(30, Math.min(110, Math.round(vw * vh / 16000)));
            pts = Array.from({ length: count }, () => ({
                x: Math.random() * vw,
                y: Math.random() * vh,
                vx: (Math.random() - 0.5) * 0.28,
                vy: (Math.random() - 0.5) * 0.28,
                r: 0.8 + Math.random() * 1.4,
            }));
        };

        build();
        let resizeTimer;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(build, 150);
        });

        // Click ripples — expanding rings from the pointer
        window.addEventListener("pointerdown", (e) => {
            // a click is deliberate interaction — burst energy so the ring is colourful
            motion.energy = Math.min(1, motion.energy + 0.6);
            const hue = 205 - (e.clientX / window.innerWidth) * 190;
            ripples.push({ x: e.clientX, y: e.clientY, r: 6, a: 0.45, hue });
            // give nearby particles a gentle shove outward
            for (const p of pts) {
                const dx = p.x - e.clientX, dy = p.y - e.clientY;
                const d = Math.hypot(dx, dy);
                if (d > 0 && d < 220) {
                    const f = (1 - d / 220) * 2.2;
                    p.vx += (dx / d) * f;
                    p.vy += (dy / d) * f;
                }
            }
        }, { passive: true });
    }

    const LINK_DIST = 110;
    const CURSOR_DIST = 230;
    const REPEL_DIST = 150;

    // resting marks are pure ink (dark on paper / light on black)
    const inkRGB = () => (isLight() ? "20, 18, 12" : "236, 234, 228");
    // interaction marks gain hue with motion.energy; fall back to grey when still
    const liveColor = (alpha, boost) => {
        const s = Math.round(Math.min(1, motion.energy * (boost || 1)) * 92);
        const l = isLight() ? 46 : 62;
        return `hsla(${motion.hue.toFixed(0)}, ${s}%, ${l}%, ${alpha})`;
    };

    function drawNet() {
        if (!ctx) return;
        ctx.clearRect(0, 0, vw, vh);

        // update + draw particles
        for (const p of pts) {
            // cursor repulsion — the field bends around the pointer
            if (finePointer && mouse.active) {
                const dx = p.x - mouse.px, dy = p.y - mouse.py;
                const d = Math.hypot(dx, dy);
                if (d > 0 && d < REPEL_DIST) {
                    const f = (1 - d / REPEL_DIST) * 0.55;
                    p.vx += (dx / d) * f;
                    p.vy += (dy / d) * f;
                }
            }

            // damping toward a calm base drift
            p.vx *= 0.985;
            p.vy *= 0.985;
            p.x += p.vx;
            p.y += p.vy;

            // wrap edges
            if (p.x < -20) p.x = vw + 20;
            if (p.x > vw + 20) p.x = -20;
            if (p.y < -20) p.y = vh + 20;
            if (p.y > vh + 20) p.y = -20;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${inkRGB()}, 0.42)`;
            ctx.fill();
        }

        // links between neighbors
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const dx = pts[i].x - pts[j].x;
                const dy = pts[i].y - pts[j].y;
                if (Math.abs(dx) > LINK_DIST || Math.abs(dy) > LINK_DIST) continue;
                const d = Math.hypot(dx, dy);
                if (d < LINK_DIST) {
                    ctx.beginPath();
                    ctx.moveTo(pts[i].x, pts[i].y);
                    ctx.lineTo(pts[j].x, pts[j].y);
                    ctx.strokeStyle = `rgba(${inkRGB()}, ${0.16 * (1 - d / LINK_DIST)})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        // bright links from the cursor to nearby particles
        if (finePointer && mouse.active) {
            for (const p of pts) {
                const d = Math.hypot(p.x - mouse.px, p.y - mouse.py);
                if (d < CURSOR_DIST) {
                    ctx.beginPath();
                    ctx.moveTo(mouse.px, mouse.py);
                    ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = liveColor(0.5 * (1 - d / CURSOR_DIST), 1.5);
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        // click ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
            const rp = ripples[i];
            rp.r += 5.5;
            rp.a *= 0.955;
            if (rp.a < 0.02) {
                ripples.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${rp.hue.toFixed(0)}, 82%, ${isLight() ? 48 : 62}%, ${rp.a})`;
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }
    }

    /* ---------- Ambient orb parallax + cursor glow ---------- */
    const orbs = Array.from(document.querySelectorAll(".orb"));
    const orbDepths = [70, -52, 44, -32];       // cursor travel, px
    const orbScroll = [0.05, -0.035, 0.07, -0.05]; // scroll travel, ratio
    const watermark = document.querySelector(".hero-watermark");
    const heroInner = document.querySelector(".hero-inner");

    let glow = null;
    if (finePointer && !reduceMotion) {
        glow = document.createElement("div");
        glow.id = "cursor-glow";
        document.body.appendChild(glow);
    }
    let gx = window.innerWidth / 2, gy = window.innerHeight / 2;

    /* ---------- Theme toggle (paper ⇄ dark) ---------- */
    const themeBtn = document.createElement("button");
    themeBtn.className = "theme-toggle";
    themeBtn.setAttribute("aria-label", "Toggle light or dark theme");
    const paintThemeBtn = () => { themeBtn.textContent = isLight() ? "☾" : "☀"; };
    paintThemeBtn();
    themeBtn.addEventListener("click", () => {
        const goDark = isLight();
        if (goDark) root.setAttribute("data-theme", "dark");
        else root.removeAttribute("data-theme");
        try { localStorage.setItem("kl-theme", goDark ? "dark" : "light"); } catch (e) { /* ignore */ }
        paintThemeBtn();
    });
    document.body.appendChild(themeBtn);

    function frame() {
        nx += (targetNX - nx) * 0.06;
        ny += (targetNY - ny) * 0.06;
        motion.energy *= 0.94;              // colour fades back to mono when you stop
        const sy = window.scrollY;

        orbs.forEach((orb, i) => {
            const d = orbDepths[i % orbDepths.length];
            const s = orbScroll[i % orbScroll.length];
            orb.style.translate = `${nx * d}px ${ny * d + sy * s}px`;
        });

        if (watermark) {
            watermark.style.transform =
                `translate(calc(-50% + ${nx * -60}px), calc(-50% + ${ny * -44}px))`;
        }
        if (heroInner) {
            heroInner.style.transform = `translate(${nx * 18}px, ${ny * 13}px)`;
        }

        if (glow) {
            gx += (mouse.px - gx) * 0.12;
            gy += (mouse.py - gy) * 0.12;
            glow.style.transform = `translate(${gx}px, ${gy}px)`;
            // the glow is invisible at rest and blooms into colour as you move
            const a = (motion.energy * 0.34).toFixed(3);
            const s = Math.round(40 + motion.energy * 55);
            glow.style.background =
                `radial-gradient(circle, hsla(${motion.hue.toFixed(0)}, ${s}%, ${isLight() ? 52 : 60}%, ${a}), transparent 70%)`;
        }

        moveWords();
        drawNet();
        requestAnimationFrame(frame);
    }

    if (!reduceMotion) requestAnimationFrame(frame);

    /* ---------- Nav: scrolled state ---------- */
    const nav = document.querySelector(".site-nav");
    if (nav) {
        const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    /* ---------- Overlay menu ---------- */
    const overlay = document.querySelector(".overlay-menu");
    const menuBtn = document.querySelector(".menu-btn");
    const closeBtn = document.querySelector(".overlay-close");

    function setMenu(open) {
        if (!overlay) return;
        overlay.classList.toggle("open", open);
        document.body.style.overflow = open ? "hidden" : "";
        if (open) {
            overlay.querySelectorAll("a").forEach((a, i) => {
                a.style.transitionDelay = `${0.06 + i * 0.05}s`;
            });
        } else {
            overlay.querySelectorAll("a").forEach((a) => {
                a.style.transitionDelay = "0s";
            });
        }
    }

    if (menuBtn) menuBtn.addEventListener("click", () => setMenu(true));
    if (closeBtn) closeBtn.addEventListener("click", () => setMenu(false));
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target.tagName === "A" || e.target === overlay) setMenu(false);
        });
    }
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") setMenu(false);
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
        }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
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
