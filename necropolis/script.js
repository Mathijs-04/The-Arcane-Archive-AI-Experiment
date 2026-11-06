/*
 * The Buried Hymnary (desert necropolis)
 * A visual sibling to The Arcane Archive. Every backdrop element is drawn in code:
 * a seeded forest in three depths, fog woven between them, moonlight shafts,
 * fireflies, rune stones that wake when the music plays, and 1-bit dithered covers.
 */
(() => {
    'use strict';

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const OVERSCAN = 0.04;
    const TAU = Math.PI * 2;
    const UP = -Math.PI / 2;

    const $ = (sel) => document.querySelector(sel);
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    function mulberry32(a) {
        return function () {
            a |= 0;
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* ================================================================== */
    /* Shared shared drawing vocabulary: branches, pines, ferns, stones    */
    /* ================================================================== */

    function clump(ctx, r, x, y, size) {
        const n = 4 + ((r() * 4) | 0);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const cx = x + (r() - 0.5) * size * 1.8;
            const cy = y + (r() - 0.6) * size * 1.1;
            const rad = size * (0.3 + r() * 0.5);
            ctx.moveTo(cx + rad, cy);
            ctx.arc(cx, cy, rad, 0, TAU);
        }
        ctx.fill();
    }

    function mossStrand(ctx, r, x, y, len) {
        ctx.save();
        ctx.lineWidth = 0.7 + r() * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const steps = 10;
        const amp = 1.5 + r() * 3;
        const ph = r() * TAU;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            ctx.lineTo(x + Math.sin(ph + t * 7) * amp * t, y + len * t);
        }
        ctx.stroke();
        // ragged beard at the tip
        for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.moveTo(x + Math.sin(ph + 7) * amp, y + len * 0.7);
            ctx.lineTo(x + Math.sin(ph + 7) * amp + (r() - 0.5) * 6, y + len * (0.9 + r() * 0.3));
            ctx.stroke();
        }
        ctx.restore();
    }

    function branch(ctx, r, x, y, len, ang, w, depth, o) {
        const bend = (r() - 0.5) * o.gnarl;
        const ex = x + Math.cos(ang) * len;
        const ey = y + Math.sin(ang) * len;
        const mx = x + Math.cos(ang + bend) * len * 0.55;
        const my = y + Math.sin(ang + bend) * len * 0.55;
        ctx.lineWidth = Math.max(w, 0.45);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();

        if (o.mossy && w < o.mossy.maxW && w > o.mossy.minW && r() < o.mossy.chance) {
            mossStrand(ctx, r, (x + ex) / 2, (y + ey) / 2, o.mossy.len * (0.5 + r()));
        }

        if (depth <= 0 || w < o.minW) {
            if (o.leaf) clump(ctx, r, ex, ey, o.leaf * (0.7 + r() * 0.6));
            return;
        }
        const n = r() < (o.split3 ?? 0.3) ? 3 : 2;
        for (let i = 0; i < n; i++) {
            let a = ang + (i - (n - 1) / 2) * o.spread * (0.6 + r() * 0.8) + (r() - 0.5) * 0.35;
            a = lerp(a, o.towards ?? UP, o.lift ?? 0.08);
            branch(ctx, r, ex, ey, len * (o.decay ?? 0.72) * (0.88 + r() * 0.24), a, w * (0.6 + r() * 0.12), depth - 1, o);
        }
    }

    function roots(ctx, r, x, y, w, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y + w * 0.15, w * 1.6, w * 0.45, 0, Math.PI, TAU);
        ctx.fill();
        const n = 3 + ((r() * 3) | 0);
        for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1;
            const a = side > 0 ? 0.25 + r() * 0.5 : Math.PI - 0.25 - r() * 0.5;
            branch(ctx, r, x + side * w * 0.3, y - w * 0.2, w * (1 + r()), a, w * 0.42, 2, {
                gnarl: 1.2, spread: 0.5, minW: 0.8, lift: -0.15, towards: Math.PI / 2, decay: 0.7,
            });
        }
        ctx.restore();
    }

    function pine(ctx, r, x, y, h, w) {
        const tiers = 6 + ((r() * 5) | 0);
        const right = [];
        const left = [];
        for (let i = 1; i <= tiers; i++) {
            const t = i / tiers;
            const ty = y - h + h * 0.92 * t;
            const tw = w * t * (0.75 + r() * 0.5);
            right.push([x + tw, ty], [x + tw * 0.38, ty - h * 0.025]);
            left.push([x - tw * (0.85 + r() * 0.3), ty], [x - tw * 0.38, ty - h * 0.025]);
        }
        ctx.beginPath();
        ctx.moveTo(x, y - h - h * 0.03);
        right.forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.lineTo(x + w * 0.07, y + 2);
        ctx.lineTo(x - w * 0.07, y + 2);
        for (let i = left.length - 1; i >= 0; i--) ctx.lineTo(left[i][0], left[i][1]);
        ctx.closePath();
        ctx.fill();
    }

    function fern(ctx, r, x, y, len, ang, curl) {
        const steps = 22;
        const seg = len / steps;
        let px = x;
        let py = y;
        let a = ang;
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < steps; i++) {
            const nx = px + Math.cos(a) * seg;
            const ny = py + Math.sin(a) * seg;
            ctx.lineWidth = lerp(2.4, 0.6, i / steps);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            const leafLen = len * 0.2 * Math.sin(Math.PI * (0.15 + 0.85 * (i / steps))) * (0.8 + r() * 0.3);
            for (const side of [-1, 1]) {
                const la = a + side * (1.05 + r() * 0.2);
                ctx.lineWidth = lerp(1.6, 0.5, i / steps);
                ctx.beginPath();
                ctx.moveTo(nx, ny);
                ctx.quadraticCurveTo(
                    nx + Math.cos(la) * leafLen * 0.6,
                    ny + Math.sin(la) * leafLen * 0.6 - 1,
                    nx + Math.cos(la + side * 0.35) * leafLen,
                    ny + Math.sin(la + side * 0.35) * leafLen + leafLen * 0.25
                );
                ctx.stroke();
            }
            px = nx;
            py = ny;
            a += curl * (1 + i / steps * 2.2);
        }
        ctx.restore();
    }

    function grass(ctx, r, x0, x1, yAt, hMin, hMax, density) {
        ctx.beginPath();
        for (let x = x0; x < x1; x += 1 / density) {
            const gx = x + r() * 3;
            const gy = yAt(gx) + 2;
            const h = hMin + r() * (hMax - hMin);
            const lean = (r() - 0.5) * h * 0.6;
            const bw = 1 + r() * 1.6;
            ctx.moveTo(gx - bw, gy);
            ctx.quadraticCurveTo(gx + lean * 0.3, gy - h * 0.6, gx + lean, gy - h);
            ctx.quadraticCurveTo(gx + lean * 0.3 + bw * 0.5, gy - h * 0.6, gx + bw, gy);
        }
        ctx.fill();
    }

    function stone(ctx, x, y, w, h, tilt) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.lineTo(-w * 0.46, -h * 0.78);
        ctx.quadraticCurveTo(-w * 0.2, -h * 1.06, w * 0.08, -h);
        ctx.quadraticCurveTo(w * 0.42, -h * 0.94, w * 0.47, -h * 0.72);
        ctx.lineTo(w / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function mushroom(ctx, x, y, s, lean) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(lean);
        ctx.fillRect(-s * 0.12, -s, s * 0.24, s);
        ctx.beginPath();
        ctx.ellipse(0, -s, s * 0.55, s * 0.36, 0, Math.PI, TAU);
        ctx.fill();
        ctx.restore();
    }

    // Invented tomb glyphs (not a real script), unit square, line segments
    const RUNES = [
        [[0.1, 0.5, 0.5, 0.3], [0.5, 0.3, 0.9, 0.5], [0.9, 0.5, 0.5, 0.66], [0.5, 0.66, 0.1, 0.5], [0.5, 0.4, 0.5, 0.56], [0.36, 0.64, 0.3, 0.95]],
        [[0, 0.3, 0.2, 0.18], [0.2, 0.18, 0.4, 0.3], [0.4, 0.3, 0.6, 0.18], [0.6, 0.18, 0.8, 0.3], [0.8, 0.3, 1, 0.18], [0, 0.72, 0.2, 0.6], [0.2, 0.6, 0.4, 0.72], [0.4, 0.72, 0.6, 0.6], [0.6, 0.6, 0.8, 0.72], [0.8, 0.72, 1, 0.6]],
        [[0.2, 0.2, 0.5, 0.42], [0.5, 0.42, 0.85, 0.3], [0.5, 0.42, 0.5, 0.9], [0.3, 0.9, 0.7, 0.9]],
        [[0.5, 0.22, 0.78, 0.5], [0.78, 0.5, 0.5, 0.78], [0.5, 0.78, 0.22, 0.5], [0.22, 0.5, 0.5, 0.22], [0.5, 0, 0.5, 0.1], [0.5, 0.9, 0.5, 1], [0, 0.5, 0.1, 0.5], [0.9, 0.5, 1, 0.5]],
        [[0.5, 0, 0.5, 1], [0.5, 0, 0.82, 0.16], [0.3, 1, 0.7, 1]],
        [[0.5, 1, 0.5, 0.1], [0.5, 0.1, 0.72, 0.3], [0.5, 0.32, 0.72, 0.52], [0.5, 0.54, 0.72, 0.74]],
        [[0.1, 0.9, 0.1, 0.7], [0.1, 0.7, 0.4, 0.7], [0.4, 0.7, 0.4, 0.4], [0.4, 0.4, 0.7, 0.4], [0.7, 0.4, 0.7, 0.1], [0.7, 0.1, 0.9, 0.1]],
        [[0.1, 0.8, 0.3, 0.6], [0.3, 0.6, 0.5, 0.8], [0.5, 0.8, 0.7, 0.6], [0.7, 0.6, 0.86, 0.28], [0.86, 0.28, 0.96, 0.36]],
    ];
    const EYE = RUNES[0];

    /* ================================================================== */
    /* The forest layers                                                   */
    /* ================================================================== */

    const layers = {
        far: $('#layer-far'),
        mid: $('#layer-mid'),
        near: $('#layer-near'),
        fx: $('#layer-fx'),
    };

    const scene = { cw: 0, ch: 0, glows: [] };

    function sizeCanvas(cv, w, h) {
        cv.width = Math.round(w * DPR);
        cv.height = Math.round(h * DPR);
        const ctx = cv.getContext('2d');
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return ctx;
    }

    function wave(r, base, amps) {
        const ph = amps.map(() => r() * TAU);
        return (x) => base + amps.reduce((s, [amp, freq], i) => s + Math.sin(x * freq + ph[i]) * amp, 0);
    }

    function duneFill(ctx, cw, ch, f) {
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, f(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
    }

    function pyramid(ctx, x, y, w, h, lit) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x, y - h);
        ctx.lineTo(x + w / 2, y);
        ctx.closePath();
        ctx.fill();
        if (lit) {
            const keep = ctx.fillStyle;
            ctx.fillStyle = lit;
            ctx.beginPath();
            ctx.moveTo(x, y - h);
            ctx.lineTo(x - w / 2, y);
            ctx.lineTo(x - w * 0.06, y);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = keep;
        }
    }

    function obelisk(ctx, x, y, w, h) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x - w * 0.36, y - h * 0.92);
        ctx.lineTo(x, y - h);
        ctx.lineTo(x + w * 0.36, y - h * 0.92);
        ctx.lineTo(x + w / 2, y);
        ctx.closePath();
        ctx.fill();
    }

    function jackal(ctx, x, y, s) {
        ctx.fillRect(x - s * 0.95, y - s * 0.36, s * 1.9, s * 0.4);
        ctx.fillRect(x - s * 1.02, y - s * 0.4, s * 2.04, s * 0.06);
        ctx.beginPath();
        ctx.ellipse(x - s * 0.1, y - s * 0.52, s * 0.7, s * 0.2, 0, 0, TAU);
        ctx.fill();
        ctx.fillRect(x + s * 0.2, y - s * 0.46, s * 0.62, s * 0.1);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.22, y - s * 0.6);
        ctx.lineTo(x + s * 0.3, y - s * 1.08);
        ctx.lineTo(x + s * 0.33, y - s * 1.42);
        ctx.lineTo(x + s * 0.42, y - s * 1.12);
        ctx.lineTo(x + s * 0.5, y - s * 1.1);
        ctx.lineTo(x + s * 0.58, y - s * 1.4);
        ctx.lineTo(x + s * 0.6, y - s * 1.06);
        ctx.lineTo(x + s * 0.92, y - s * 0.93);
        ctx.lineTo(x + s * 0.6, y - s * 0.86);
        ctx.lineTo(x + s * 0.5, y - s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = s * 0.07;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.78, y - s * 0.5);
        ctx.quadraticCurveTo(x - s * 1.05, y - s * 0.45, x - s * 0.95, y - s * 0.38);
        ctx.stroke();
    }

    function ripples(ctx, r, f, cw, col, count, depth) {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        for (let i = 0; i < count; i++) {
            const x0 = r() * cw;
            const len = 40 + r() * 140;
            const dy = 6 + r() * depth;
            ctx.beginPath();
            for (let k = 0; k <= 12; k++) {
                const x = x0 + (k / 12) * len;
                const y = f(x) + dy + Math.sin(k / 12 * Math.PI) * -4;
                if (k === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(layers.far, cw, ch);
        const r = mulberry32(909);
        const col = '#2c2823';
        ctx.fillStyle = col;
        const f1 = wave(r, ch * 0.64, [[ch * 0.022, 0.003], [ch * 0.01, 0.009]]);
        pyramid(ctx, cw * 0.17, f1(cw * 0.17) + 10, ch * 0.36, ch * 0.19, '#37322b');
        pyramid(ctx, cw * 0.28, f1(cw * 0.28) + 8, ch * 0.2, ch * 0.1, '#37322b');
        pyramid(ctx, cw * 0.76, f1(cw * 0.76) + 10, ch * 0.28, ch * 0.14, '#37322b');
        pyramid(ctx, cw * 0.86, f1(cw * 0.86) + 8, ch * 0.12, ch * 0.06, '#37322b');
        duneFill(ctx, cw, ch, f1);
        // a far colonnade, mostly fallen
        for (let i = 0; i < 9; i++) {
            const x = cw * (0.42 + i * 0.022);
            const h = ch * (0.015 + (r() < 0.6 ? r() * 0.05 : 0));
            ctx.fillRect(x, f1(x) - h, 5, h + 4);
        }
        ctx.fillStyle = '#211e1a';
        const f2 = wave(r, ch * 0.71, [[ch * 0.02, 0.004], [ch * 0.008, 0.012]]);
        duneFill(ctx, cw, ch, f2);
        ripples(ctx, r, f2, cw, '#2a2621', 40, ch * 0.06);
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(layers.mid, cw, ch);
        const r = mulberry32(5150);
        const col = '#15120f';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        const g = wave(r, ch * 0.8, [[ch * 0.03, 0.004], [ch * 0.012, 0.013]]);

        // obelisks with glyph columns
        [[0.06, 0.34], [0.94, 0.3], [0.67, 0.17]].forEach(([fx, fh]) => {
            const x = cw * fx;
            const y = g(x) + ch * 0.03;
            const h = ch * fh;
            const w = h * 0.15;
            obelisk(ctx, x, y, w, h);
            const gs = w * 0.42;
            for (let k = 0; k < 5; k++) {
                scene.glows.push({
                    type: 'rune', x: x - gs / 2, y: y - h * 0.84 + k * gs * 1.45, w: gs, h: gs,
                    glyph: RUNES[(r() * RUNES.length) | 0], phase: r() * TAU, order: x,
                });
            }
        });

        // jackal guardian
        jackal(ctx, cw * 0.17, g(cw * 0.17) + 4, ch * 0.075);

        // tomb door cut into a dune bank
        const dx = cw * 0.29;
        const dy = g(dx) + 4;
        ctx.beginPath();
        ctx.ellipse(dx, dy + ch * 0.03, cw * 0.1, ch * 0.15, 0, Math.PI, TAU);
        ctx.fill();
        const dw = ch * 0.075;
        const dh = ch * 0.11;
        ctx.fillRect(dx - dw * 0.95, dy - dh * 1.32, dw * 1.9, dh * 0.2);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(dx - dw / 2, dy);
        ctx.lineTo(dx - dw * 0.42, dy - dh);
        ctx.lineTo(dx + dw * 0.42, dy - dh);
        ctx.lineTo(dx + dw / 2, dy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        scene.glows.push({ type: 'hollow', x: dx, y: dy - dh * 0.45, rx: dw * 0.44, ry: dh * 0.5, phase: 0 });
        for (let k = 0; k < 5; k++) {
            const gs = dh * 0.13;
            scene.glows.push({
                type: 'rune', x: dx - dw * 0.8 + k * dw * 0.34, y: dy - dh * 1.29, w: gs, h: gs,
                glyph: RUNES[(r() * RUNES.length) | 0], phase: r() * TAU, order: dx,
            });
        }

        // a colossal head, toppled and half-swallowed by the dune
        const hx = cw * 0.8;
        const hy = g(hx) + ch * 0.02;
        const hs = ch * 0.14;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(-0.14);
        ctx.beginPath();
        ctx.moveTo(-hs * 0.95, 0);
        ctx.lineTo(-hs * 0.6, -hs * 1.05);
        ctx.quadraticCurveTo(0, -hs * 1.4, hs * 0.6, -hs * 1.05);
        ctx.lineTo(hs * 0.95, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#211c17';
        ctx.lineWidth = 2;
        for (let k = 1; k < 7; k++) {
            ctx.beginPath();
            ctx.moveTo(-hs * (0.95 - k * 0.04), -k * hs * 0.13);
            ctx.lineTo(-hs * (0.7 - k * 0.02), -k * hs * 0.13 - 2);
            ctx.moveTo(hs * (0.95 - k * 0.04), -k * hs * 0.13);
            ctx.lineTo(hs * (0.7 - k * 0.02), -k * hs * 0.13 - 2);
            ctx.stroke();
        }
        ctx.restore();
        // its eyes wake when the music plays
        [-1, 1].forEach((side) => {
            const ew = hs * 0.24;
            scene.glows.push({
                type: 'rune', x: hx + side * hs * 0.22 - ew / 2 - hs * 0.06, y: hy - hs * 0.78 + side * hs * 0.03, w: ew, h: ew * 0.7,
                glyph: EYE, phase: 0, order: hx,
            });
        });
        ctx.fillStyle = col;
        // sand piled against it
        ctx.beginPath();
        ctx.ellipse(hx, hy + ch * 0.01, hs * 1.4, hs * 0.32, 0, Math.PI, TAU);
        ctx.fill();

        duneFill(ctx, cw, ch, g);
        ripples(ctx, r, g, cw, '#1f1b16', 60, ch * 0.12);
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(layers.near, cw, ch);
        const r = mulberry32(321);
        const col = '#060504';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        // broken column, left
        const cwid = Math.max(60, cw * 0.055);
        const lx = cw * 0.035;
        ctx.beginPath();
        ctx.moveTo(lx - cwid / 2, ch + 5);
        ctx.lineTo(lx - cwid / 2, ch * 0.34);
        for (let k = 0; k <= 6; k++) ctx.lineTo(lx - cwid / 2 + (k / 6) * cwid, ch * (0.3 + r() * 0.06));
        ctx.lineTo(lx + cwid / 2, ch + 5);
        ctx.fill();
        ctx.save();
        ctx.strokeStyle = '#100d0a';
        ctx.lineWidth = 2;
        for (let k = 1; k < 4; k++) {
            ctx.beginPath();
            ctx.moveTo(lx - cwid / 2 + (k / 4) * cwid, ch * 0.38);
            ctx.lineTo(lx - cwid / 2 + (k / 4) * cwid, ch);
            ctx.stroke();
        }
        ctx.restore();
        // fallen drum
        ctx.save();
        ctx.translate(cw * 0.12, ch * 0.95);
        ctx.rotate(0.08);
        ctx.fillRect(-cwid * 0.9, -cwid * 0.8, cwid * 1.8, cwid * 0.8);
        ctx.restore();

        // standing column with a lotus capital, right
        const rx = cw * 0.975;
        ctx.fillRect(rx - cwid * 0.42, ch * 0.16, cwid * 0.84, ch);
        ctx.beginPath();
        ctx.moveTo(rx - cwid * 0.42, ch * 0.17);
        ctx.quadraticCurveTo(rx - cwid * 0.9, ch * 0.1, rx - cwid * 0.8, ch * 0.05);
        ctx.lineTo(rx + cwid * 0.8, ch * 0.05);
        ctx.quadraticCurveTo(rx + cwid * 0.9, ch * 0.1, rx + cwid * 0.42, ch * 0.17);
        ctx.fill();
        // a lintel beam slumped from it
        ctx.save();
        ctx.translate(rx, ch * 0.06);
        ctx.rotate(Math.PI + 0.2);
        ctx.fillRect(-cwid * 0.2, -ch * 0.03, cw * 0.16, ch * 0.05);
        ctx.restore();

        // foreground dunes sweeping in from the corners
        ctx.beginPath();
        ctx.moveTo(0, ch * 0.76);
        ctx.bezierCurveTo(cw * 0.12, ch * 0.78, cw * 0.26, ch * 0.9, cw * 0.4, ch + 4);
        ctx.lineTo(0, ch + 4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cw, ch * 0.7);
        ctx.bezierCurveTo(cw * 0.86, ch * 0.74, cw * 0.72, ch * 0.9, cw * 0.58, ch + 4);
        ctx.lineTo(cw, ch + 4);
        ctx.fill();
        const floor = wave(r, ch * 0.975, [[ch * 0.008, 0.008]]);
        duneFill(ctx, cw, ch, floor);
        // dry tufts
        for (let i = 0; i < 18; i++) {
            const x = r() * cw;
            grass(ctx, r, x, x + 14, floor, 4, 18, 0.5);
        }
        // a scarab on the sand
        const sx = cw * 0.2;
        const sy = ch * 0.93;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 9, 6, 0.2, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 1.4;
        for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(sx + k * 4, sy);
            ctx.lineTo(sx + k * 7, sy - 9);
            ctx.moveTo(sx + k * 4, sy);
            ctx.lineTo(sx + k * 7, sy + 9);
            ctx.stroke();
        }
    }

    function drawForest() {
        const cw = window.innerWidth * (1 + OVERSCAN * 2);
        const ch = window.innerHeight * (1 + OVERSCAN * 2);
        scene.cw = cw;
        scene.ch = ch;
        scene.glows = [];
        drawFar(cw, ch);
        drawMid(cw, ch);
        drawNear(cw, ch);
        scene.glows = scene.glows.filter((g) => g.layer !== 'far');
        sizeCanvas(layers.fx, cw, ch);
        seedFireflies();
    }

    /* ================================================================== */
    /* Sky: stars, shooting stars, moonlight shafts                        */
    /* ================================================================== */

    function buildSky() {
        const stars = $('#stars');
        const r = mulberry32(99);
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 150; i++) {
            const s = document.createElement('span');
            s.className = r() < 0.08 ? 'star star--green' : 'star';
            const size = 0.8 + Math.pow(r(), 3) * 2.4;
            s.style.cssText = `--x:${(r() * 100).toFixed(2)}%;--y:${(Math.pow(r(), 1.3) * 100).toFixed(2)}%;--s:${size.toFixed(2)}px;` +
                `--min:${(0.1 + r() * 0.12).toFixed(2)};--max:${(0.3 + r() * 0.45).toFixed(2)};` +
                `--d:${(3 + r() * 7).toFixed(2)}s;--delay:${(-r() * 10).toFixed(2)}s`;
            frag.appendChild(s);
        }
        stars.appendChild(frag);

        const rays = $('#rays');
        const rr = mulberry32(5);
        for (let i = 0; i < 7; i++) {
            const ray = document.createElement('span');
            ray.className = 'ray';
            ray.style.cssText = `--a:${(14 + i * 6 + rr() * 5).toFixed(1)}deg;--w:${(30 + rr() * 110).toFixed(0)}px;` +
                `--o:${(0.05 + rr() * 0.07).toFixed(3)};--d:${(7 + rr() * 9).toFixed(1)}s;--delay:${(-rr() * 12).toFixed(1)}s`;
            rays.appendChild(ray);
        }

        if (reduceMotion) return;
        const sky = $('.sky__inner');
        const shoot = () => {
            const s = document.createElement('span');
            s.className = 'shooting-star';
            s.style.left = `${20 + Math.random() * 70}%`;
            s.style.top = `${4 + Math.random() * 22}%`;
            s.style.setProperty('--a', `${150 + Math.random() * 20}deg`);
            sky.appendChild(s);
            setTimeout(() => s.remove(), 1600);
            setTimeout(shoot, 9000 + Math.random() * 22000);
        };
        setTimeout(shoot, 5000);
    }

    /* ================================================================== */
    /* Fog: seamless turbulence tiles, generated as SVG                    */
    /* ================================================================== */

    function buildFog() {
        const tile = (seed, fx, fy, gain, cut) => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='520'>` +
                `<filter id='f' x='0' y='0' width='100%' height='100%'>` +
                `<feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='5' seed='${seed}' stitchTiles='stitch'/>` +
                `<feColorMatrix values='0 0 0 0 0.86  0 0 0 0 0.78  0 0 0 0 0.64  ${gain} 0 0 0 ${cut}'/>` +
                `</filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
            return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        };
        document.documentElement.style.setProperty('--fog-tex-1', tile(11, 0.0021, 0.0085, 2.8, -1.15));
        document.documentElement.style.setProperty('--fog-tex-2', tile(37, 0.0032, 0.011, 2.3, -0.88));
    }

    /* ================================================================== */
    /* Fireflies, runes and glows (the only animated canvas)               */
    /* ================================================================== */

    const fx = layers.fx.getContext('2d');
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    (() => {
        const s = sprite.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,240,205,1)');
        g.addColorStop(0.12, 'rgba(255,210,140,0.85)');
        g.addColorStop(0.35, 'rgba(240,170,90,0.22)');
        g.addColorStop(1, 'rgba(220,140,60,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 64, 64);
    })();

    const state = {
        playing: false,
        glowGain: 0.75,
        pointer: { x: -9999, y: -9999, active: false },
        parallax: { x: 0, y: 0, tx: 0, ty: 0 },
        beat: 0,
    };

    let flies = [];

    function makeFly(x, y, burst) {
        const { cw, ch } = scene;
        return {
            x: x ?? Math.random() * cw,
            y: y ?? ch * (0.42 + Math.random() * 0.58),
            v: 0.6 + Math.random() * 1.8,
            size: 1.2 + Math.random() * 2.6,
            phase: Math.random() * TAU,
            a: 0.18 + Math.random() * 0.4,
            life: burst ? 1 : Infinity,
            burst: !!burst,
            vx: burst ? (Math.random() - 0.5) * 10 : 0,
            vy: burst ? (Math.random() - 0.9) * 7 : 0,
        };
    }

    function seedFireflies() {
        flies = Array.from({ length: 200 }, () => makeFly());
    }

    function targetFlyCount() {
        return state.playing ? 360 : 200;
    }

    function updateFlies(dt, t) {
        const { cw, ch } = scene;
        const want = targetFlyCount();
        const resident = flies.filter((f) => !f.burst).length;
        if (resident < want) for (let k = 0; k < 3; k++) flies.push(makeFly(-10));
        if (resident > want && Math.random() < 0.3) {
            const i = flies.findIndex((f) => !f.burst);
            if (i >= 0) flies.splice(i, 1);
        }
        const p = state.pointer;
        const px = p.x + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const py = p.y + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;
        const gust = (0.55 + 0.45 * Math.sin(t * 0.00035) + 0.25 * Math.sin(t * 0.0019)) * (state.playing ? 1.7 : 1);

        fx.lineCap = 'round';
        for (let i = flies.length - 1; i >= 0; i--) {
            const f = flies[i];
            let vx = f.v * gust + f.vx;
            let vy = Math.sin(t * 0.002 + f.phase) * 0.25 + f.vy;
            f.vx *= 0.95;
            f.vy = f.vy * 0.95 + (f.burst ? 0.06 : 0);
            if (p.active) {
                const dx = px - f.x;
                const dy = py - f.y;
                const d = Math.hypot(dx, dy);
                if (d < 190 && d > 1) {
                    // the cursor stirs a little dust devil
                    const pull = (1 - d / 190);
                    vx += (-dy / d) * pull * 4 + (dx / d) * pull * 0.6;
                    vy += (dx / d) * pull * 4 + (dy / d) * pull * 0.6;
                }
            }
            if (f.y < ch * 0.36) vy += 0.2;
            if (f.y > ch) vy -= 0.4;
            f.x += vx * dt;
            f.y += vy * dt;
            if (f.x > cw + 20) {
                f.x = -20;
                f.y = ch * (0.42 + Math.random() * 0.58);
            }
            if (f.x < -40) f.x = cw + 20;
            if (f.burst) {
                f.life -= 0.006 * dt;
                if (f.life <= 0) {
                    flies.splice(i, 1);
                    continue;
                }
            }
            const alpha = clamp(f.a * (0.7 + 0.3 * Math.sin(t * 0.003 + f.phase)) * (f.burst ? f.life : 1) * (0.6 + state.glowGain * 0.5), 0, 1);
            fx.strokeStyle = `rgba(236,220,186,${alpha})`;
            fx.lineWidth = f.size;
            fx.beginPath();
            fx.moveTo(f.x, f.y);
            fx.lineTo(f.x - vx * 2.4, f.y - vy * 2.4);
            fx.stroke();
        }
    }

    function drawRune(g, t) {
        let a = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.0007 + g.phase));
        if (state.playing) {
            // a wave of light travels across the stones in time with the "beat"
            const wavePos = (t * 0.00035) % 1;
            const pos = g.order / scene.cw;
            const d = Math.abs(wavePos - pos);
            a += 0.35 + 0.5 * Math.max(0, 1 - d * 5) + state.beat * 0.25;
        }
        a *= state.glowGain;
        fx.save();
        fx.strokeStyle = `rgba(255,214,140,${clamp(a, 0, 1)})`;
        fx.shadowColor = 'rgba(255,170,70,0.95)';
        fx.shadowBlur = 8 + a * 10;
        fx.lineWidth = Math.max(1.2, g.w * 0.12);
        fx.lineCap = 'round';
        fx.beginPath();
        g.glyph.forEach(([x1, y1, x2, y2]) => {
            fx.moveTo(g.x + x1 * g.w, g.y + y1 * g.h);
            fx.lineTo(g.x + x2 * g.w, g.y + y2 * g.h);
        });
        fx.stroke();
        fx.restore();
    }

    function drawGlows(t) {
        fx.globalCompositeOperation = 'lighter';
        for (const g of scene.glows) {
            if (g.type === 'rune') continue;
            let a;
            let size;
            if (g.type === 'shroom') {
                a = (0.3 + 0.25 * Math.sin(t * 0.0012 + g.phase)) * (state.playing ? 1.5 : 1);
                size = g.r * 7;
            } else if (g.type === 'hollow') {
                a = (0.45 + 0.15 * Math.sin(t * 0.0009)) * (state.playing ? 1.5 + state.beat * 0.6 : 1);
                size = g.ry * 6;
                // inner ember of the hollow
                fx.save();
                const inner = fx.createRadialGradient(g.x, g.y + g.ry * 0.3, 0, g.x, g.y, g.ry);
                inner.addColorStop(0, `rgba(255,225,170,${clamp(a * state.glowGain, 0, 1)})`);
                inner.addColorStop(1, 'rgba(220,150,70,0)');
                fx.fillStyle = inner;
                fx.beginPath();
                fx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, TAU);
                fx.fill();
                fx.restore();
            }
            fx.globalAlpha = clamp(a * state.glowGain, 0, 1);
            fx.drawImage(sprite, g.x - size / 2, g.y - size / 2, size, size);
        }
        fx.globalAlpha = 1;
        fx.globalCompositeOperation = 'source-over';
        for (const g of scene.glows) if (g.type === 'rune') drawRune(g, t);
    }

    function burst(clientX, clientY) {
        const x = clientX + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const y = clientY + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;
        for (let i = 0; i < 46; i++) flies.push(makeFly(x, y, true));
    }

    /* ================================================================== */
    /* Parallax                                                            */
    /* ================================================================== */

    const depthNodes = [...document.querySelectorAll('[data-depth]')].map((el) => ({
        el,
        depth: parseFloat(el.dataset.depth),
    }));

    function applyParallax() {
        const P = state.parallax;
        P.x = lerp(P.x, P.tx, 0.05);
        P.y = lerp(P.y, P.ty, 0.05);
        for (const { el, depth } of depthNodes) {
            el.style.transform = `translate3d(${(-P.x * depth).toFixed(2)}px, ${(-P.y * depth).toFixed(2)}px, 0)`;
        }
    }

    /* ================================================================== */
    /* Main loop                                                           */
    /* ================================================================== */

    let last = performance.now();
    function frame(t) {
        const dt = clamp((t - last) / 16.67, 0, 3);
        last = t;
        state.beat = state.playing ? Math.pow(0.5 + 0.5 * Math.sin(t * 0.0042), 6) : 0;
        fx.clearRect(0, 0, scene.cw, scene.ch);
        drawGlows(t);
        updateFlies(dt, t);
        applyParallax();
        if (!reduceMotion) requestAnimationFrame(frame);
    }

    /* ================================================================== */
    /* The card: patina, vines, reeds                                      */
    /* ================================================================== */

    function drawPatina() {
        const cv = $('#card-patina');
        const rect = cv.getBoundingClientRect();
        if (!rect.width) return;
        const ctx = sizeCanvas(cv, rect.width, rect.height);
        const W = rect.width;
        const H = rect.height;
        const r = mulberry32(2024);
        // papyrus weave: long horizontal fibres over vertical ones
        for (let i = 0; i < 160; i++) {
            const horiz = i % 3 !== 0;
            ctx.strokeStyle = `rgba(${r() < 0.5 ? '60,45,25' : '255,245,220'},${0.04 + r() * 0.07})`;
            ctx.lineWidth = 0.6 + r() * 1.6;
            ctx.beginPath();
            if (horiz) {
                const y = r() * H;
                ctx.moveTo(0, y);
                ctx.lineTo(W, y + (r() - 0.5) * 6);
            } else {
                const x = r() * W;
                ctx.moveTo(x, 0);
                ctx.lineTo(x + (r() - 0.5) * 6, H);
            }
            ctx.stroke();
        }
        // water stains and sun-scorch at the edges
        const stain = (cx, cy, rad, a) => {
            const g = ctx.createRadialGradient(cx, cy, rad * 0.6, cx, cy, rad);
            g.addColorStop(0, 'rgba(90,60,25,0)');
            g.addColorStop(0.85, `rgba(90,60,25,${a})`);
            g.addColorStop(1, 'rgba(90,60,25,0)');
            ctx.fillStyle = g;
            ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        };
        stain(W * 0.86, H * 0.2, 46, 0.18);
        stain(W * 0.12, H * 0.82, 34, 0.14);
        const edge = ctx.createLinearGradient(0, 0, 0, H);
        edge.addColorStop(0, 'rgba(70,45,20,0.2)');
        edge.addColorStop(0.08, 'rgba(70,45,20,0)');
        edge.addColorStop(0.92, 'rgba(70,45,20,0)');
        edge.addColorStop(1, 'rgba(70,45,20,0.22)');
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, W, H);
    }

    function bezierPoint(p, t) {
        const u = 1 - t;
        return [
            u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
            u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7],
        ];
    }

    function vineSVG(seed) {
        const r = mulberry32(seed);
        let out = '<path d="M8 152V16M8 152H144" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"/>';
        out += '<path d="M18 142V70h10V58h10V46M18 142h72v-10h12v-10h12" fill="none" stroke="currentColor" stroke-width="1.6"/>';
        // lotus in the corner
        out += '<g transform="translate(38 122)"><path d="M0 0C-4-8-2-16 0-20 2-16 4-8 0 0ZM0 0C-9-3-14-10-14-15-8-12-3-7 0 0ZM0 0C9-3 14-10 14-15 8-12 3-7 0 0Z" fill="currentColor"/><path d="M-12 2H12" stroke="currentColor" stroke-width="1.6"/></g>';
        for (let y = 24; y < 140; y += 13) out += `<rect x="3" y="${y}" width="10" height="${(3 + r() * 3).toFixed(1)}" fill="currentColor"/>`;
        for (let x = 22; x < 144; x += 13) out += `<rect x="${x}" y="147" width="${(3 + r() * 3).toFixed(1)}" height="10" fill="currentColor"/>`;
        return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
    }

    function buildCardDecor() {
        ['.vine--tr', '.vine--bl', '.vine--br'].forEach((sel, i) => {
            $(sel).innerHTML = vineSVG(31 + i * 17);
        });
        const reeds = $('#reeds');
        const r = mulberry32(8);
        for (let i = 0; i < 26; i++) {
            const reed = document.createElement('span');
            reed.className = 'reed';
            reed.style.cssText = `--lean:${((r() - 0.5) * 10).toFixed(1)}deg;--rest:${(0.18 + r() * 0.3).toFixed(2)};` +
                `--sway:${(2.2 + r() * 2.5).toFixed(2)}s;--pulse:${(1.4 + r() * 1.3).toFixed(2)}s;--delay:${(-r() * 3).toFixed(2)}s`;
            reeds.appendChild(reed);
        }
    }

    /* ================================================================== */
    /* Cover art: painted in greys, then Atkinson-dithered to 1 bit         */
    /* ================================================================== */

    const TRACKS = [
        { title: 'Hymn of the Sealed Door', artist: 'Ashen Dynasty', scene: 'door', seed: 12, duration: 438 },
        { title: 'Under the Thousand Steps', artist: 'Vizier of Dust', scene: 'pyramid', seed: 29, duration: 391 },
        { title: 'The Jackal Keeps Watch', artist: 'Anubian Wake', scene: 'jackal', seed: 44, duration: 512 },
        { title: 'Needle of the Sun-Eater', artist: 'Sepulchre Choir', scene: 'obelisk', seed: 58, duration: 347 },
        { title: 'A Crown Beneath the Dunes', artist: 'Tomb of Embers', scene: 'colossus', seed: 77, duration: 466 },
    ];
    const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

    function paintCoverScene(x, S, track) {
        const r = mulberry32(track.seed);
        const sky = x.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, '#141414');
        sky.addColorStop(0.55, '#5c5c5c');
        sky.addColorStop(0.8, '#a4a4a4');
        sky.addColorStop(1, '#d0d0d0');
        x.fillStyle = sky;
        x.fillRect(0, 0, S, S);
        for (let i = 0; i < 120; i++) {
            x.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`;
            x.fillRect(r() * S, Math.pow(r(), 1.4) * S * 0.6, 1.4, 1.4);
        }
        // big low moon
        const mx = S * (0.3 + r() * 0.4);
        const my = S * (0.42 + r() * 0.1);
        const mr = S * (0.18 + r() * 0.06);
        const halo = x.createRadialGradient(mx, my, mr * 0.9, mx, my, mr * 2.4);
        halo.addColorStop(0, 'rgba(255,255,255,0.4)');
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = halo;
        x.fillRect(0, 0, S, S);
        x.fillStyle = '#efefef';
        x.beginPath();
        x.arc(mx, my, mr, 0, TAU);
        x.fill();
        const dune = (y, col) => {
            x.fillStyle = col;
            const f = wave(r, y, [[S * 0.03, 0.012], [S * 0.012, 0.03]]);
            x.beginPath();
            x.moveTo(0, S);
            for (let i = 0; i <= S; i += 4) x.lineTo(i, f(i));
            x.lineTo(S, S);
            x.fill();
            return f;
        };
        const ink = '#0a0a0a';
        const glyphs = (gx, gy, size, n, vertical) => {
            x.strokeStyle = 'rgba(255,255,255,0.85)';
            x.lineWidth = 1.6;
            for (let k = 0; k < n; k++) {
                const gl = RUNES[(r() * RUNES.length) | 0];
                const ox = gx + (vertical ? 0 : k * size * 1.4);
                const oy = gy + (vertical ? k * size * 1.4 : 0);
                x.beginPath();
                gl.forEach(([x1, y1, x2, y2]) => {
                    x.moveTo(ox + x1 * size, oy + y1 * size);
                    x.lineTo(ox + x2 * size, oy + y2 * size);
                });
                x.stroke();
            }
        };
        dune(S * 0.74, '#6a6a6a');
        switch (track.scene) {
            case 'pyramid': {
                x.fillStyle = '#1a1a1a';
                pyramid(x, S * 0.52, S * 0.86, S * 0.9, S * 0.5, '#8a8a8a');
                dune(S * 0.9, '#2a2a2a');
                break;
            }
            case 'jackal': {
                x.fillStyle = x.strokeStyle = ink;
                jackal(x, S * 0.46, S * 0.84, S * 0.24);
                dune(S * 0.9, ink);
                break;
            }
            case 'obelisk': {
                x.fillStyle = ink;
                obelisk(x, S * 0.5, S * 0.94, S * 0.12, S * 0.72);
                glyphs(S * 0.5 - S * 0.022, S * 0.34, S * 0.044, 8, true);
                dune(S * 0.92, '#1c1c1c');
                break;
            }
            case 'colossus': {
                x.fillStyle = ink;
                x.save();
                x.translate(S * 0.5, S * 0.88);
                x.rotate(-0.12);
                const hs = S * 0.36;
                x.beginPath();
                x.moveTo(-hs * 0.95, 0);
                x.lineTo(-hs * 0.6, -hs * 1.05);
                x.quadraticCurveTo(0, -hs * 1.4, hs * 0.6, -hs * 1.05);
                x.lineTo(hs * 0.95, 0);
                x.closePath();
                x.fill();
                x.strokeStyle = '#555';
                x.lineWidth = 3;
                for (let k = 1; k < 7; k++) {
                    x.beginPath();
                    x.moveTo(-hs * (0.95 - k * 0.04), -k * hs * 0.13);
                    x.lineTo(-hs * (0.68 - k * 0.02), -k * hs * 0.13 - 3);
                    x.moveTo(hs * (0.95 - k * 0.04), -k * hs * 0.13);
                    x.lineTo(hs * (0.68 - k * 0.02), -k * hs * 0.13 - 3);
                    x.stroke();
                }
                x.fillStyle = '#fff';
                [-1, 1].forEach((side) => {
                    x.beginPath();
                    x.ellipse(side * hs * 0.2, -hs * 0.72, hs * 0.08, hs * 0.035, 0, 0, TAU);
                    x.fill();
                });
                x.restore();
                dune(S * 0.9, '#262626');
                break;
            }
            case 'door':
            default: {
                x.fillStyle = '#161616';
                x.fillRect(S * 0.12, S * 0.3, S * 0.76, S * 0.7);
                x.fillStyle = ink;
                x.fillRect(S * 0.24, S * 0.36, S * 0.52, S * 0.07);
                const g = x.createLinearGradient(0, S * 0.45, 0, S);
                g.addColorStop(0, '#ffffff');
                g.addColorStop(1, '#7a7a7a');
                x.fillStyle = g;
                x.beginPath();
                x.moveTo(S * 0.34, S * 0.95);
                x.lineTo(S * 0.37, S * 0.46);
                x.lineTo(S * 0.63, S * 0.46);
                x.lineTo(S * 0.66, S * 0.95);
                x.fill();
                x.fillStyle = ink;
                for (let k = 0; k < 5; k++) x.fillRect(S * 0.3, S * (0.95 - k * 0.03), S * 0.4, S * 0.012);
                glyphs(S * 0.27, S * 0.375, S * 0.038, 9, false);
                break;
            }
        }
        // blowing sand haze
        for (let i = 0; i < 4; i++) {
            const y = S * (0.7 + i * 0.08);
            const g = x.createLinearGradient(0, y - 20, 0, y + 20);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(0, y - 20, S, 40);
        }
    }

    function drawCover(track) {
        const cv = $('#cover-art');
        const S = 360;
        const B = 22;
        const PIX = 2;
        const c = cv.getContext('2d');

        const scene2 = document.createElement('canvas');
        scene2.width = scene2.height = S;
        const sx = scene2.getContext('2d');
        paintCoverScene(sx, S, track);

        // downsample, dither, upsample nearest: the xerox look
        const small = document.createElement('canvas');
        const N = S / PIX;
        small.width = small.height = N;
        const smx = small.getContext('2d');
        smx.drawImage(scene2, 0, 0, N, N);
        const img = smx.getImageData(0, 0, N, N);
        const d = img.data;
        const L = new Float32Array(N * N);
        const r = mulberry32(track.seed + 1);
        for (let i = 0; i < N * N; i++) {
            const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
            L[i] = clamp((v - 128) * 1.15 + 128 + (r() - 0.5) * 22, 0, 255);
        }
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const i = y * N + x;
                const old = L[i];
                const nw = old < 128 ? 0 : 255;
                const err = (old - nw) / 8;
                L[i] = nw;
                if (x + 1 < N) L[i + 1] += err;
                if (x + 2 < N) L[i + 2] += err;
                if (y + 1 < N) {
                    if (x > 0) L[i + N - 1] += err;
                    L[i + N] += err;
                    if (x + 1 < N) L[i + N + 1] += err;
                }
                if (y + 2 < N) L[i + 2 * N] += err;
            }
        }
        for (let i = 0; i < N * N; i++) {
            const on = L[i] > 127;
            d[i * 4] = on ? 233 : 14;
            d[i * 4 + 1] = on ? 231 : 16;
            d[i * 4 + 2] = on ? 222 : 13;
            d[i * 4 + 3] = 255;
        }
        smx.putImageData(img, 0, 0);

        c.imageSmoothingEnabled = false;
        c.fillStyle = '#e9e7de';
        c.fillRect(0, 0, S, S);
        c.drawImage(small, 0, 0, N, N, 0, 0, S, S);

        // frame: a bramble border instead of knotwork
        c.fillStyle = '#e9e7de';
        c.fillRect(0, 0, S, B);
        c.fillRect(0, S - B, S, B);
        c.fillRect(0, 0, B, S);
        c.fillRect(S - B, 0, B, S);
        c.strokeStyle = '#0e100d';
        c.fillStyle = '#0e100d';
        c.lineWidth = 2;
        c.strokeRect(4, 4, S - 8, S - 8);
        c.strokeRect(B - 3, B - 3, S - 2 * B + 6, S - 2 * B + 6);
        // thorny vine running along the border
        const vr = mulberry32(track.seed + 9);
        const edge = (x0, y0, x1, y1) => {
            const len = Math.hypot(x1 - x0, y1 - y0);
            const ux = (x1 - x0) / len;
            const uy = (y1 - y0) / len;
            c.lineWidth = 1.4;
            c.beginPath();
            for (let s = 0; s <= len; s += 2) {
                const w = Math.sin(s * 0.16) * 3.2;
                const px = x0 + ux * s - uy * w;
                const py = y0 + uy * s + ux * w;
                if (s === 0) c.moveTo(px, py);
                else c.lineTo(px, py);
            }
            c.stroke();
            for (let s = 10; s < len - 6; s += 19.6) {
                const w = Math.sin(s * 0.16) * 3.2;
                const px = x0 + ux * s - uy * w;
                const py = y0 + uy * s + ux * w;
                const side = Math.sin(s * 0.16 + 1.57) > 0 ? 1 : -1;
                c.save();
                c.translate(px, py);
                c.rotate(Math.atan2(uy, ux) + side * 0.9);
                c.beginPath();
                c.moveTo(0, 0);
                c.quadraticCurveTo(3, -2.4, 6.5 + vr() * 1.5, 0);
                c.quadraticCurveTo(3, 2.4, 0, 0);
                c.fill();
                c.restore();
            }
        };
        const m = B / 2 + 1;
        edge(m + 10, m, S - m - 10, m);
        edge(m + 10, S - m, S - m - 10, S - m);
        edge(m, m + 10, m, S - m - 10);
        edge(S - m, m + 10, S - m, S - m - 10);
        [[m, m], [S - m, m], [m, S - m], [S - m, S - m]].forEach(([x, y]) => {
            c.beginPath();
            c.arc(x, y, 8, 0, TAU);
            c.fill();
            c.strokeStyle = '#e9e7de';
            c.lineWidth = 1.2;
            c.beginPath();
            c.arc(x, y, 4.5, 0, TAU);
            c.stroke();
            c.strokeStyle = '#0e100d';
        });

        // band name, in the Archive's blackletter, as on a demo tape
        c.save();
        c.font = `${Math.round(S * 0.07)}px font, serif`;
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.lineWidth = 5;
        c.strokeStyle = '#0e100d';
        c.strokeText(track.artist, S / 2, B + 12);
        c.fillStyle = '#e9e7de';
        c.fillText(track.artist, S / 2, B + 12);
        c.restore();
    }

    /* ================================================================== */
    /* Player behaviour (visual only, no audio)                            */
    /* ================================================================== */

    const ui = {
        card: $('.card'),
        title: $('#track-title'),
        artist: $('#track-artist'),
        kicker: $('#kicker'),
        reeds: $('#reeds'),
        play: $('#btn-play'),
        prev: $('#btn-prev'),
        next: $('#btn-next'),
        shuffle: $('#btn-shuffle'),
        loop: $('#btn-loop'),
        sound: $('#btn-sound'),
        volume: $('#volume'),
        volumeFill: $('#volume-fill'),
        progress: $('#progress'),
        progressFill: $('#progress-fill'),
        leaf: $('#progress-leaf'),
        cur: $('#time-current'),
        dur: $('#time-duration'),
        hint: $('.grove__hint'),
    };

    const player = { index: 0, elapsed: 0, shuffle: false, loop: false, muted: false, volume: 70 };

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    function renderTrack() {
        const t = TRACKS[player.index];
        ui.title.textContent = t.title;
        ui.artist.textContent = t.artist;
        ui.kicker.innerHTML = `Tablet ${ROMAN[player.index]} &middot; of ${ROMAN[TRACKS.length - 1]}`;
        ui.dur.textContent = fmt(t.duration);
        drawCover(t);
        renderProgress();
    }

    function renderProgress() {
        const t = TRACKS[player.index];
        const pct = clamp((player.elapsed / t.duration) * 100, 0, 100);
        ui.progressFill.style.width = `${pct}%`;
        ui.leaf.style.left = `${pct}%`;
        ui.progress.setAttribute('aria-valuenow', pct.toFixed(0));
        ui.cur.textContent = fmt(player.elapsed);
    }

    function turnTo(index) {
        ui.card.classList.add('is-turning');
        setTimeout(() => {
            player.index = (index + TRACKS.length) % TRACKS.length;
            player.elapsed = 0;
            renderTrack();
            ui.card.classList.remove('is-turning');
        }, 450);
    }

    function nextIndex(dir) {
        if (player.shuffle && dir > 0) {
            let n;
            do n = (Math.random() * TRACKS.length) | 0; while (n === player.index);
            return n;
        }
        return player.index + dir;
    }

    function setPlaying(on) {
        state.playing = on;
        ui.play.dataset.playback = on ? 'playing' : 'paused';
        ui.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
        ui.reeds.dataset.state = on ? 'playing' : 'idle';
        document.body.classList.toggle('is-playing', on);
    }

    function updateGlowGain() {
        const v = player.muted ? 0 : player.volume / 100;
        state.glowGain = 0.22 + v * 0.95;
        ui.volumeFill.style.width = `${player.muted ? 0 : player.volume}%`;
        ui.sound.dataset.sound = player.muted || player.volume === 0 ? 'off' : 'on';
        ui.sound.setAttribute('aria-label', player.muted ? 'Unmute' : 'Mute');
    }

    ui.play.addEventListener('click', () => setPlaying(!state.playing));
    ui.next.addEventListener('click', () => turnTo(nextIndex(1)));
    ui.prev.addEventListener('click', () => {
        if (player.elapsed > 4) {
            player.elapsed = 0;
            renderProgress();
        } else turnTo(nextIndex(-1));
    });
    ui.shuffle.addEventListener('click', () => {
        player.shuffle = !player.shuffle;
        ui.shuffle.setAttribute('aria-pressed', String(player.shuffle));
    });
    ui.loop.addEventListener('click', () => {
        player.loop = !player.loop;
        ui.loop.setAttribute('aria-pressed', String(player.loop));
    });
    ui.sound.addEventListener('click', () => {
        player.muted = !player.muted;
        updateGlowGain();
    });
    ui.volume.addEventListener('input', () => {
        player.volume = Number(ui.volume.value);
        player.muted = false;
        updateGlowGain();
    });

    const seek = (clientX) => {
        const rect = ui.progress.getBoundingClientRect();
        const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
        player.elapsed = pct * TRACKS[player.index].duration;
        renderProgress();
    };
    ui.progress.addEventListener('pointerdown', (e) => {
        seek(e.clientX);
        ui.progress.setPointerCapture(e.pointerId);
        const move = (ev) => seek(ev.clientX);
        ui.progress.addEventListener('pointermove', move);
        ui.progress.addEventListener('pointerup', () => ui.progress.removeEventListener('pointermove', move), { once: true });
    });
    ui.progress.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') player.elapsed = Math.min(TRACKS[player.index].duration, player.elapsed + 10);
        else if (e.key === 'ArrowLeft') player.elapsed = Math.max(0, player.elapsed - 10);
        else return;
        renderProgress();
    });

    setInterval(() => {
        if (!state.playing) return;
        player.elapsed += 0.25;
        if (player.elapsed >= TRACKS[player.index].duration) {
            if (player.loop) player.elapsed = 0;
            else return turnTo(nextIndex(1));
        }
        renderProgress();
    }, 250);

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && e.target !== ui.play) {
            e.preventDefault();
            setPlaying(!state.playing);
        }
    });

    /* ================================================================== */
    /* Pointer: parallax, firefly attraction, bursts                       */
    /* ================================================================== */

    window.addEventListener('pointermove', (e) => {
        state.pointer.x = e.clientX;
        state.pointer.y = e.clientY;
        state.pointer.active = true;
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        state.parallax.tx = nx * 36;
        state.parallax.ty = ny * 18;
    });
    document.addEventListener('pointerleave', () => {
        state.pointer.active = false;
        state.parallax.tx = 0;
        state.parallax.ty = 0;
    });
    window.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.card')) return;
        burst(e.clientX, e.clientY);
        ui.hint.classList.add('is-gone');
    });

    /* ================================================================== */
    /* Boot                                                                */
    /* ================================================================== */

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            drawForest();
            drawPatina();
        }, 150);
    });

    buildSky();
    buildFog();
    buildCardDecor();
    drawForest();
    updateGlowGain();
    renderTrack();
    requestAnimationFrame(frame);

    document.fonts.ready.then(() => {
        drawCover(TRACKS[player.index]);
        drawPatina();
    });
})();
