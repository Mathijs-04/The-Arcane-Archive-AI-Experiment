/*
 * The Drowned Hymnal
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

    // Elder-futhark-like glyphs, unit square, line segments
    const RUNES = [
        [[0.4, 0, 0.4, 1], [0.4, 0.22, 0.85, 0], [0.4, 0.46, 0.85, 0.24]],
        [[0.3, 0, 0.3, 1], [0.3, 0, 0.75, 0.32], [0.75, 0.32, 0.75, 1]],
        [[0.35, 0, 0.35, 1], [0.35, 0.22, 0.8, 0.45], [0.8, 0.45, 0.35, 0.68]],
        [[0.15, 0.05, 0.85, 0.95], [0.85, 0.05, 0.15, 0.95]],
        [[0.5, 0, 0.5, 1], [0.5, 0.36, 0.12, 0], [0.5, 0.36, 0.88, 0]],
        [[0.25, 0, 0.25, 1], [0.75, 0, 0.75, 1], [0.25, 0.32, 0.75, 0.62]],
        [[0.5, 0, 0.5, 1], [0.5, 0, 0.14, 0.32], [0.5, 0, 0.86, 0.32]],
        [[0.3, 0, 0.3, 1], [0.3, 0, 0.72, 0.26], [0.72, 0.26, 0.3, 0.5], [0.3, 0.5, 0.72, 0.76], [0.72, 0.76, 0.3, 1]],
        [[0.5, 0, 0.15, 0.5], [0.15, 0.5, 0.5, 1], [0.5, 1, 0.85, 0.5], [0.85, 0.5, 0.5, 0]],
    ];

    /* ================================================================== */
    /* The drowned cathedral: three layers + swaying kelp                  */
    /* ================================================================== */

    const layers = {
        far: $('#layer-far'),
        mid: $('#layer-mid'),
        near: $('#layer-near'),
        fx: $('#layer-fx'),
        kelp: $('#layer-kelp'),
    };

    const scene = { cw: 0, ch: 0, glows: [], kelp: [], vents: [] };
    let kctx = null;

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

    function pointed(ctx, x, y, w, h) {
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x - w / 2, y - h * 0.55);
        ctx.quadraticCurveTo(x - w / 2, y - h * 0.92, x, y - h);
        ctx.quadraticCurveTo(x + w / 2, y - h * 0.92, x + w / 2, y - h * 0.55);
        ctx.lineTo(x + w / 2, y);
        ctx.closePath();
    }

    function column(ctx, r, x, yBase, w, h, broken) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2, yBase);
        ctx.lineTo(x - w * 0.45, yBase - h);
        if (broken) {
            for (let i = 1; i <= 6; i++) {
                ctx.lineTo(x - w * 0.45 + w * 0.9 * (i / 6), yBase - h + (i % 2 ? r() * w * 0.7 : -r() * w * 0.3));
            }
        } else {
            ctx.lineTo(x + w * 0.45, yBase - h);
        }
        ctx.lineTo(x + w / 2, yBase);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(x - w * 0.75, yBase - w * 0.4, w * 1.5, w * 0.4 + 6);
        if (!broken) ctx.fillRect(x - w * 0.8, yBase - h - w * 0.32, w * 1.6, w * 0.34);
    }

    function lumps(ctx, r, x, y, spread, n, size) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const cx = x + (r() - 0.5) * spread;
            const cy = y + (r() - 0.5) * spread * 0.4;
            const rad = size * (0.4 + r() * 0.8);
            ctx.moveTo(cx + rad, cy);
            ctx.arc(cx, cy, rad, 0, TAU);
        }
        ctx.fill();
    }

    function arcade(ctx, r, x0, x1, yBase, h, w, ruin) {
        const n = Math.max(3, Math.round((x1 - x0) / (h * 0.55)));
        const step = (x1 - x0) / (n - 1);
        const tops = [];
        for (let i = 0; i < n; i++) {
            const x = x0 + i * step;
            const broken = ruin && r() < 0.35;
            const hh = broken ? h * (0.4 + r() * 0.45) : h;
            column(ctx, r, x, yBase, w, hh, broken);
            tops.push({ x, broken });
        }
        ctx.lineWidth = w * 0.85;
        for (let i = 0; i < n - 1; i++) {
            if (tops[i].broken || tops[i + 1].broken) continue;
            const xa = tops[i].x;
            const xb = tops[i + 1].x;
            const y = yBase - h - w * 0.2;
            ctx.beginPath();
            ctx.moveTo(xa, y);
            ctx.quadraticCurveTo(xa, y - step * 0.6, (xa + xb) / 2, y - step * 0.78);
            ctx.quadraticCurveTo(xb, y - step * 0.6, xb, y);
            ctx.stroke();
        }
    }

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(layers.far, cw, ch);
        const r = mulberry32(1307);
        const col = '#0d1f23';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        const dunes = wave(r, ch * 0.74, [[ch * 0.02, 0.003], [ch * 0.008, 0.011]]);
        arcade(ctx, r, cw * 0.04, cw * 0.5, ch * 0.73, ch * 0.11, ch * 0.012, true);
        // a distant toppled bell tower and spires
        [[0.58, 0.2, 0], [0.64, 0.27, 0.08], [0.9, 0.17, -0.22]].forEach(([fx, fh, tilt]) => {
            ctx.save();
            ctx.translate(cw * fx, ch * 0.74);
            ctx.rotate(tilt);
            const w = ch * 0.03;
            ctx.fillRect(-w / 2, -ch * fh, w, ch * fh);
            ctx.beginPath();
            ctx.moveTo(-w * 0.6, -ch * fh);
            ctx.lineTo(0, -ch * fh - ch * 0.09);
            ctx.lineTo(w * 0.6, -ch * fh);
            ctx.fill();
            ctx.restore();
        });
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, dunes(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(layers.mid, cw, ch);
        const r = mulberry32(4242);
        const col = '#061214';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        const bed = wave(r, ch * 0.84, [[ch * 0.014, 0.004], [ch * 0.006, 0.02]]);

        // ruined cloister on the left
        const cwid = Math.max(10, ch * 0.028);
        arcade(ctx, r, cw * 0.03, cw * 0.3, bed(cw * 0.16) + 6, ch * 0.22, cwid, true);
        lumps(ctx, r, cw * 0.16, bed(cw * 0.16) + 4, cw * 0.28, 40, 9);

        // the cathedral facade on the right
        const f0 = cw * 0.69;
        const f1 = cw * 0.95;
        const fw = f1 - f0;
        const tw = fw * 0.22;
        const base = bed(cw * 0.82) + 8;
        const fh = ch * 0.48;
        const cx = (f0 + f1) / 2;
        ctx.fillRect(f0, base - fh, tw, fh);
        ctx.beginPath();
        ctx.moveTo(f0 - 4, base - fh);
        ctx.lineTo(f0 + tw / 2, base - fh - ch * 0.17);
        ctx.lineTo(f0 + tw + 4, base - fh);
        ctx.fill();
        // right tower, its spire snapped off
        ctx.fillRect(f1 - tw, base - fh * 0.92, tw, fh * 0.92);
        ctx.beginPath();
        ctx.moveTo(f1 - tw - 4, base - fh * 0.92);
        ctx.lineTo(f1 - tw * 0.7, base - fh * 0.92 - ch * 0.05);
        ctx.lineTo(f1 - tw * 0.5, base - fh * 0.92 - ch * 0.02);
        ctx.lineTo(f1 - tw * 0.25, base - fh * 0.92 - ch * 0.04);
        ctx.lineTo(f1 + 4, base - fh * 0.92);
        ctx.fill();
        // nave & gable
        ctx.fillRect(f0 + tw, base - fh * 0.74, fw - 2 * tw, fh * 0.74);
        ctx.beginPath();
        ctx.moveTo(f0 + tw, base - fh * 0.74);
        ctx.lineTo(cx, base - fh * 1.02);
        ctx.lineTo(f1 - tw, base - fh * 0.74);
        ctx.fill();
        // the fallen spire lying on the sea floor
        ctx.save();
        ctx.translate(f1 + cw * 0.01, base - 4);
        ctx.rotate(-0.12);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(ch * 0.16, -tw * 0.25);
        ctx.lineTo(0, -tw * 0.55);
        ctx.fill();
        ctx.restore();

        // holes: door, lancets, rose window
        const roseY = base - fh * 0.56;
        const R = (fw - 2 * tw) * 0.38;
        const petals = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            petals.push({ x: cx + Math.cos(a) * R * 0.62, y: roseY + Math.sin(a) * R * 0.62, r: R * 0.27 });
        }
        petals.push({ x: cx, y: roseY, r: R * 0.24 });
        const lancets = [
            { x: cx, y: base, w: fw * 0.14, h: fh * 0.3 },
            { x: f0 + tw / 2, y: base - fh * 0.38, w: tw * 0.32, h: fh * 0.2 },
            { x: f0 + tw / 2, y: base - fh * 0.72, w: tw * 0.28, h: fh * 0.16 },
            { x: f1 - tw / 2, y: base - fh * 0.38, w: tw * 0.32, h: fh * 0.2 },
        ];
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        petals.forEach((p) => {
            ctx.moveTo(p.x + p.r, p.y);
            ctx.arc(p.x, p.y, p.r, 0, TAU);
        });
        lancets.forEach((l) => pointed(ctx, l.x, l.y, l.w, l.h));
        ctx.fill();
        ctx.restore();
        // the rose's stone ring
        ctx.lineWidth = Math.max(3, R * 0.07);
        ctx.beginPath();
        ctx.arc(cx, roseY, R, 0, TAU);
        ctx.stroke();
        scene.glows.push({ type: 'rose', x: cx, y: roseY, R, petals });
        lancets.forEach((l) => scene.glows.push({ type: 'lancet', ...l }));
        scene.vents.push({ x: cx, y: base - 10 });

        // barnacles and coral crusting the stone
        lumps(ctx, r, cx, base, fw * 1.2, 60, 10);
        lumps(ctx, r, f0 + tw / 2, base - fh * 0.2, tw, 14, 6);

        // an anglerfish idling near the floor
        const ax = cw * 0.58;
        const ay = bed(ax) - ch * 0.05;
        const as = ch * 0.035;
        ctx.beginPath();
        ctx.ellipse(ax, ay, as * 1.4, as, 0.1, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ax + as * 1.2, ay);
        ctx.lineTo(ax + as * 2.3, ay - as * 0.7);
        ctx.lineTo(ax + as * 2.2, ay + as * 0.8);
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ax - as * 0.6, ay - as * 0.8);
        ctx.quadraticCurveTo(ax - as * 1.2, ay - as * 2.4, ax - as * 2.1, ay - as * 1.5);
        ctx.stroke();
        scene.glows.push({ type: 'lure', x: ax - as * 2.1, y: ay - as * 1.4, phase: 0 });

        // the sea floor
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, bed(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
        grass(ctx, r, 0, cw, bed, 3, 12, 0.35);
        for (let i = 0; i < 4; i++) scene.vents.push({ x: r() * cw, y: bed(0) });
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(layers.near, cw, ch);
        const r = mulberry32(777);
        const col = '#010405';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        // a huge broken column on the left, crusted with barnacles
        const w = Math.max(64, cw * 0.075);
        column(ctx, r, cw * 0.035, ch + 4, w, ch * 0.78, true);
        for (let i = 0; i < 9; i++) lumps(ctx, r, cw * 0.035 + w * 0.45, ch * (0.3 + r() * 0.65), 18, 6, 5);

        // a collapsed vault rib hanging in from the top right
        ctx.lineWidth = Math.max(26, ch * 0.05);
        ctx.beginPath();
        ctx.moveTo(cw * 1.03, ch * 0.5);
        ctx.quadraticCurveTo(cw * 0.95, ch * 0.05, cw * 0.74, -ch * 0.03);
        ctx.stroke();
        lumps(ctx, r, cw * 0.86, ch * 0.06, cw * 0.2, 30, 9);
        // a chain dangling from the rib
        ctx.lineWidth = 2.2;
        const chx = cw * 0.885;
        for (let y = ch * 0.1; y < ch * 0.42; y += 12) {
            ctx.beginPath();
            ctx.ellipse(chx + Math.sin(y * 0.02) * 3, y, 4, 7, (y / 12) % 2 ? 0 : Math.PI / 2, 0, TAU);
            ctx.stroke();
        }

        // rubble on the floor
        const floor = wave(r, ch * 0.985, [[ch * 0.008, 0.01], [ch * 0.004, 0.04]]);
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 8) ctx.lineTo(x, floor(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
        for (let i = 0; i < 14; i++) {
            const x = r() * cw;
            ctx.save();
            ctx.translate(x, floor(x));
            ctx.rotate((r() - 0.5) * 0.8);
            ctx.fillRect(-14 - r() * 20, -12 - r() * 16, 28 + r() * 40, 24 + r() * 20);
            ctx.restore();
        }

        // kelp roots (animated separately)
        scene.kelp = [];
        const add = (x, big) => scene.kelp.push({
            x, base: floor(x) + 6,
            len: ch * (big ? 0.35 + r() * 0.45 : 0.12 + r() * 0.15),
            w: big ? 7 + r() * 6 : 4 + r() * 3,
            amp: 14 + r() * 26,
            speed: 0.7 + r() * 0.6,
            phase: r() * TAU,
        });
        for (let i = 0; i < 12; i++) add(r() * cw * 0.24, true);
        for (let i = 0; i < 9; i++) add(cw * (0.8 + r() * 0.2), true);
        for (let i = 0; i < 10; i++) add(cw * (0.25 + r() * 0.55), false);
    }

    function drawKelp(t) {
        const { cw, ch } = scene;
        kctx.clearRect(0, 0, cw, ch);
        kctx.fillStyle = '#020607';
        const segs = 18;
        for (const s of scene.kelp) {
            const pts = [];
            for (let i = 0; i <= segs; i++) {
                const k = i / segs;
                const sway = reduceMotion ? 0 : Math.sin(t * 0.0006 * s.speed + i * 0.32 + s.phase);
                pts.push([s.x + sway * Math.pow(k, 1.3) * s.amp, s.base - s.len * k, s.w * (1 - k * 0.75)]);
            }
            kctx.beginPath();
            pts.forEach(([x, y, w], i) => (i ? kctx.lineTo(x - w / 2, y) : kctx.moveTo(x - w / 2, y)));
            for (let i = pts.length - 1; i >= 0; i--) kctx.lineTo(pts[i][0] + pts[i][2] / 2, pts[i][1]);
            kctx.fill();
            for (let i = 3; i < segs; i += 3) {
                const [x, y, w] = pts[i];
                const side = i % 2 ? 1 : -1;
                kctx.beginPath();
                kctx.ellipse(x + side * w * 1.6, y, w * 1.8, w * 0.55, side * 0.6, 0, TAU);
                kctx.fill();
            }
        }
    }

    function drawForest() {
        const cw = window.innerWidth * (1 + OVERSCAN * 2);
        const ch = window.innerHeight * (1 + OVERSCAN * 2);
        scene.cw = cw;
        scene.ch = ch;
        scene.glows = [];
        scene.vents = [];
        drawFar(cw, ch);
        drawMid(cw, ch);
        drawNear(cw, ch);
        kctx = sizeCanvas(layers.kelp, cw, ch);
        sizeCanvas(layers.fx, cw, ch);
        seedFireflies();
    }

    /* ================================================================== */
    /* Light from the surface                                              */
    /* ================================================================== */

    function buildSky() {
        const rays = $('#rays');
        const rr = mulberry32(5);
        for (let i = 0; i < 11; i++) {
            const ray = document.createElement('span');
            ray.className = 'ray';
            ray.style.cssText = `--a:${(-38 + i * 7.5 + rr() * 4).toFixed(1)}deg;--w:${(40 + rr() * 140).toFixed(0)}px;` +
                `--o:${(0.05 + rr() * 0.08).toFixed(3)};--d:${(6 + rr() * 9).toFixed(1)}s;--delay:${(-rr() * 12).toFixed(1)}s`;
            rays.appendChild(ray);
        }
    }

    function buildFog() {
        const tile = (seed, fx, fy, gain, cut) => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='520'>` +
                `<filter id='f' x='0' y='0' width='100%' height='100%'>` +
                `<feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='5' seed='${seed}' stitchTiles='stitch'/>` +
                `<feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.78  0 0 0 0 0.82  ${gain} 0 0 0 ${cut}'/>` +
                `</filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
            return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        };
        const caustic = (seed, f) => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='520' height='520'>` +
                `<filter id='c' x='0' y='0' width='100%' height='100%'>` +
                `<feTurbulence type='turbulence' baseFrequency='${f}' numOctaves='2' seed='${seed}' stitchTiles='stitch'/>` +
                `<feColorMatrix values='0 0 0 0 0.8  0 0 0 0 0.95  0 0 0 0 1  -6 0 0 0 1.25'/>` +
                `</filter><rect width='100%' height='100%' filter='url(#c)'/></svg>`;
            return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        };
        const root = document.documentElement.style;
        root.setProperty('--fog-tex-1', tile(11, 0.0021, 0.0085, 2.8, -1.15));
        root.setProperty('--fog-tex-2', tile(37, 0.0032, 0.011, 2.3, -0.88));
        root.setProperty('--caustic-1', caustic(5, 0.012));
        root.setProperty('--caustic-2', caustic(19, 0.016));
    }
    /* ================================================================== */
    /* Jellyfish, bubbles, marine snow, the rose window and the lure       */
    /* ================================================================== */

    const fx = layers.fx.getContext('2d');
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    (() => {
        const s = sprite.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(230,255,255,1)');
        g.addColorStop(0.14, 'rgba(160,240,255,0.8)');
        g.addColorStop(0.4, 'rgba(90,200,230,0.2)');
        g.addColorStop(1, 'rgba(60,160,210,0)');
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

    let jellies = [];
    let bubbles = [];
    let snow = [];

    function makeJelly(x, y, small) {
        const { cw, ch } = scene;
        return {
            x: x ?? Math.random() * cw,
            y: y ?? ch * (0.2 + Math.random() * 0.75),
            size: small ? 6 + Math.random() * 8 : 12 + Math.random() * 22,
            speed: 0.7 + Math.random() * 0.8,
            phase: Math.random() * TAU,
        };
    }

    function makeBubble(x, y) {
        return { x, y, r: 1 + Math.random() * 3.5, v: 0.6 + Math.random() * 1.2, p: Math.random() * TAU };
    }

    function seedFireflies() {
        const { cw, ch } = scene;
        jellies = Array.from({ length: 7 }, () => makeJelly());
        bubbles = [];
        snow = Array.from({ length: 160 }, () => ({
            x: Math.random() * cw, y: Math.random() * ch, s: 0.6 + Math.random() * 1.8, v: 0.1 + Math.random() * 0.35, p: Math.random() * TAU,
        }));
    }

    function drawGlows(t) {
        if (kctx) drawKelp(t);
        fx.globalCompositeOperation = 'lighter';
        const gain = state.glowGain;
        for (const g of scene.glows) {
            if (g.type === 'rose') {
                let a = 0.22 + 0.08 * Math.sin(t * 0.0008);
                if (state.playing) a = 0.65 + state.beat * 0.35;
                a *= gain;
                fx.globalAlpha = clamp(a * 0.7, 0, 1);
                fx.drawImage(sprite, g.x - g.R * 3, g.y - g.R * 3, g.R * 6, g.R * 6);
                fx.globalAlpha = 1;
                g.petals.forEach((p, i) => {
                    const pa = state.playing ? a * (0.7 + 0.3 * Math.sin(t * 0.004 + i * 0.8)) : a;
                    const grad = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
                    grad.addColorStop(0, `rgba(220,255,255,${clamp(pa, 0, 1)})`);
                    grad.addColorStop(1, `rgba(100,210,235,${clamp(pa * 0.5, 0, 1)})`);
                    fx.fillStyle = grad;
                    fx.beginPath();
                    fx.arc(p.x, p.y, p.r, 0, TAU);
                    fx.fill();
                });
            } else if (g.type === 'lancet') {
                const a = (state.playing ? 0.35 + state.beat * 0.2 : 0.1) * gain;
                fx.fillStyle = `rgba(140,225,245,${clamp(a, 0, 1)})`;
                fx.beginPath();
                pointed(fx, g.x, g.y, g.w, g.h);
                fx.fill();
            } else if (g.type === 'lure') {
                const lx = g.x + Math.sin(t * 0.0013) * 3;
                const ly = g.y + Math.cos(t * 0.0011) * 2;
                const a = (0.55 + 0.45 * Math.pow(Math.max(0, Math.sin(t * 0.0025)), 2)) * gain;
                fx.globalAlpha = clamp(a, 0, 1);
                fx.drawImage(sprite, lx - 22, ly - 22, 44, 44);
                fx.globalAlpha = 1;
            }
        }
        fx.globalCompositeOperation = 'source-over';
    }

    function updateFlies(dt, t) {
        const { cw, ch } = scene;
        const p = state.pointer;
        const px = p.x + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const py = p.y + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;

        // marine snow, sinking
        fx.fillStyle = 'rgba(200,228,230,0.32)';
        for (const s of snow) {
            s.y += s.v * dt;
            s.x += Math.sin(t * 0.0005 + s.p) * 0.12 * dt;
            if (s.y > ch) {
                s.y = -4;
                s.x = Math.random() * cw;
            }
            fx.fillRect(s.x, s.y, s.s, s.s);
        }

        // bubbles from vents (and more while playing)
        const rate = state.playing ? 0.35 : 0.1;
        for (const v of scene.vents) if (Math.random() < rate * 0.4) bubbles.push(makeBubble(v.x + (Math.random() - 0.5) * 8, v.y));
        fx.strokeStyle = 'rgba(200,240,255,0.45)';
        fx.lineWidth = 0.8;
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            b.y -= b.v * dt;
            b.x += Math.sin(t * 0.004 + b.p) * 0.4;
            if (b.y < -10) {
                bubbles.splice(i, 1);
                continue;
            }
            fx.beginPath();
            fx.arc(b.x, b.y, b.r, 0, TAU);
            fx.stroke();
        }

        // jellyfish
        const want = state.playing ? 12 : 7;
        if (jellies.length < want && Math.random() < 0.01) jellies.push(makeJelly(Math.random() * cw, ch + 40));
        if (jellies.length > want + 4) jellies.shift();
        fx.globalCompositeOperation = 'lighter';
        for (const j of jellies) {
            const tempo = state.playing ? 1.8 : 1;
            const pulse = (Math.sin(t * 0.0019 * j.speed * tempo + j.phase) + 1) / 2;
            j.y -= (0.08 + Math.pow(pulse, 4) * 0.55) * dt * j.speed;
            j.x += Math.sin(t * 0.0003 + j.phase) * 0.18 * dt;
            if (p.active) {
                const dx = px - j.x;
                const dy = py - j.y;
                const d = Math.hypot(dx, dy);
                if (d < 300 && d > 1) {
                    j.x += (dx / d) * 0.35 * dt;
                    j.y += (dy / d) * 0.2 * dt;
                }
            }
            if (j.y < -80) {
                j.y = ch + 60;
                j.x = Math.random() * cw;
            }
            const a = clamp(gainFor(pulse), 0, 1);
            const bw = j.size * (1 - pulse * 0.2);
            const bh = j.size * 0.7 * (1 + pulse * 0.12);
            fx.globalAlpha = a * 0.45;
            fx.drawImage(sprite, j.x - j.size * 1.6, j.y - j.size * 1.4, j.size * 3.2, j.size * 3.2);
            fx.globalAlpha = 1;
            fx.fillStyle = `rgba(150,230,250,${(a * 0.18).toFixed(3)})`;
            fx.strokeStyle = `rgba(190,245,255,${(a * 0.7).toFixed(3)})`;
            fx.lineWidth = 1.1;
            fx.beginPath();
            fx.ellipse(j.x, j.y, bw, bh, 0, Math.PI, TAU);
            fx.quadraticCurveTo(j.x, j.y + bh * 0.25, j.x - bw, j.y);
            fx.fill();
            fx.stroke();
            fx.strokeStyle = `rgba(170,235,255,${(a * 0.35).toFixed(3)})`;
            fx.lineWidth = 0.8;
            for (let k = 0; k < 5; k++) {
                const sx = j.x - bw * 0.7 + (bw * 1.4 * k) / 4;
                fx.beginPath();
                fx.moveTo(sx, j.y);
                for (let s = 1; s <= 8; s++) {
                    fx.lineTo(sx + Math.sin(t * 0.003 + k + s * 0.7 + j.phase) * 3, j.y + (s / 8) * j.size * 2.6);
                }
                fx.stroke();
            }
        }
        fx.globalCompositeOperation = 'source-over';
    }

    function gainFor(pulse) {
        return (0.45 + 0.55 * pulse) * state.glowGain * (state.playing ? 1.15 : 0.85);
    }

    function burst(clientX, clientY) {
        const x = clientX + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const y = clientY + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;
        for (let i = 0; i < 26; i++) bubbles.push(makeBubble(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20));
        jellies.push(makeJelly(x, y, true));
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

        // tide lines: the page has been underwater for a very long time
        for (let i = 0; i < 4; i++) {
            const y = H * (0.2 + i * 0.22 + r() * 0.05);
            ctx.strokeStyle = `rgba(20,40,45,${0.08 + r() * 0.08})`;
            ctx.lineWidth = 1 + r() * 2;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 3 + Math.sin(x * 0.11) * 1.5);
            ctx.stroke();
        }

        // barnacle colonies on the edges
        const colony = (cx, cy, n, spread) => {
            for (let i = 0; i < n; i++) {
                const a = r() * TAU;
                const d = Math.pow(r(), 0.7) * spread;
                const bx = cx + Math.cos(a) * d;
                const by = cy + Math.sin(a) * d * 0.8;
                const br = 1.5 + r() * 4.5;
                ctx.fillStyle = `rgba(222,226,214,${0.45 + r() * 0.3})`;
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(20,30,30,0.5)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.fillStyle = 'rgba(15,22,22,0.75)';
                ctx.beginPath();
                ctx.arc(bx, by, br * 0.35, 0, TAU);
                ctx.fill();
            }
        };
        colony(W * 0.98, H * 0.05, 22, 30);
        colony(W * 0.02, H * 0.62, 14, 22);
        colony(W * 0.6, H * 0.99, 18, 26);
        colony(W * 0.35, H * 0.01, 8, 14);

        // green algae bloom in the corners
        [[0, H], [W, H * 0.4]].forEach(([x, y]) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.25);
            g.addColorStop(0, 'rgba(40,70,55,0.28)');
            g.addColorStop(1, 'rgba(40,70,55,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        });
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
        const stems = [
            [8, 152, 2, 110, 16, 70, 9, 14],
            [8, 152, 52, 158, 100, 144, 150, 151],
        ];
        let out = '';
        for (const s of stems) {
            out += `<path d="M${s[0]} ${s[1]}C${s[2]} ${s[3]} ${s[4]} ${s[5]} ${s[6]} ${s[7]}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`;
            let side = 1;
            for (let t = 0.16; t < 0.95; t += 0.11 + r() * 0.05) {
                const [x, y] = bezierPoint(s, t);
                const [x2, y2] = bezierPoint(s, Math.min(1, t + 0.01));
                const tangent = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
                const size = lerp(15, 7, t) * (0.85 + r() * 0.3);
                const rot = tangent + side * (48 + r() * 18);
                out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})">` +
                    `<path d="M0 0Q${size * 0.5} ${-size * 0.42} ${size} 0Q${size * 0.5} ${size * 0.42} 0 0Z" fill="currentColor"/>` +
                    `<path d="M1 0H${size * 0.82}" stroke="#7b8073" stroke-width=".7" opacity=".55"/></g>`;
                if (r() < 0.35) {
                    // a curling tendril
                    const tx = x + side * 4;
                    const ty = y;
                    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
                    for (let k = 0; k <= 14; k++) {
                        const a = k * 0.55 + (side > 0 ? 0 : Math.PI);
                        const rad = 7 * (1 - k / 16);
                        d += `L${(tx + Math.cos(a) * rad).toFixed(1)} ${(ty - 6 + Math.sin(a) * rad).toFixed(1)}`;
                    }
                    out += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>`;
                }
                side *= -1;
            }
        }
        // the corner spiral
        let spiral = 'M8 152';
        for (let k = 0; k <= 40; k++) {
            const a = Math.PI * 0.75 - k * 0.24;
            const rad = 16 * (1 - k / 46);
            spiral += `L${(30 + Math.cos(a) * rad).toFixed(1)} ${(130 + Math.sin(a) * rad).toFixed(1)}`;
        }
        out += `<path d="${spiral}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
        // berries
        [[46, 140], [52, 135], [49, 129], [20, 104], [26, 100]].forEach(([x, y]) => {
            out += `<circle cx="${x}" cy="${y}" r="${(2.3 + r()).toFixed(1)}" fill="currentColor"/>`;
        });
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
        { title: 'Vespers Beneath the Tide', artist: 'Choir of the Drowned', scene: 'rose', seed: 11, duration: 438 },
        { title: 'Bells of the Sunken Nave', artist: 'Brine Abbey', scene: 'bell', seed: 23, duration: 371 },
        { title: 'The Pale Procession', artist: 'Medusae', scene: 'jelly', seed: 47, duration: 402 },
        { title: 'Spire of Salt', artist: 'Fathom Cantors', scene: 'spire', seed: 61, duration: 355 },
        { title: 'A Hymn for the Angler', artist: 'Benthic Rite', scene: 'angler', seed: 83, duration: 467 },
    ];
    const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

    function paintCoverScene(x, S, track) {
        const r = mulberry32(track.seed);
        const water = x.createLinearGradient(0, 0, 0, S);
        water.addColorStop(0, '#d4d4d4');
        water.addColorStop(0.35, '#7c7c7c');
        water.addColorStop(1, '#0c0c0c');
        x.fillStyle = water;
        x.fillRect(0, 0, S, S);

        // shafts from the surface
        x.save();
        x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
            const sx = S * (0.2 + r() * 0.6);
            const spread = S * (0.05 + r() * 0.1);
            const lean = (r() - 0.5) * S * 0.5;
            x.fillStyle = 'rgba(255,255,255,0.09)';
            x.beginPath();
            x.moveTo(sx - spread * 0.3, 0);
            x.lineTo(sx + spread * 0.3, 0);
            x.lineTo(sx + lean + spread, S);
            x.lineTo(sx + lean - spread, S);
            x.fill();
        }
        x.restore();
        for (let i = 0; i < 140; i++) {
            x.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
            x.fillRect(r() * S, r() * S, 1.4, 1.4);
        }

        const ink = '#0a0a0a';
        const bed = (y) => {
            const w = wave(r, y, [[S * 0.015, 0.02], [S * 0.008, 0.06]]);
            x.fillStyle = ink;
            x.beginPath();
            x.moveTo(0, S);
            for (let i = 0; i <= S; i += 4) x.lineTo(i, w(i));
            x.lineTo(S, S);
            x.fill();
        };
        const bubble = (bx, by, br) => {
            x.strokeStyle = 'rgba(255,255,255,0.9)';
            x.lineWidth = 1.5;
            x.beginPath();
            x.arc(bx, by, br, 0, TAU);
            x.stroke();
        };

        switch (track.scene) {
            case 'rose': {
                x.fillStyle = ink;
                x.fillRect(S * 0.12, S * 0.3, S * 0.76, S * 0.7);
                x.beginPath();
                x.moveTo(S * 0.12, S * 0.3);
                x.lineTo(S * 0.5, S * 0.08);
                x.lineTo(S * 0.88, S * 0.3);
                x.fill();
                const cx = S * 0.5;
                const cy = S * 0.5;
                const R = S * 0.22;
                x.fillStyle = '#e8e8e8';
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU;
                    x.beginPath();
                    x.arc(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66, R * 0.2, 0, TAU);
                    x.fill();
                }
                x.beginPath();
                x.arc(cx, cy, R * 0.28, 0, TAU);
                x.fill();
                x.beginPath();
                pointed(x, cx, S, S * 0.16, S * 0.2);
                x.fill();
                break;
            }
            case 'bell': {
                bed(S * 0.84);
                const cx = S * 0.5;
                const by = S * 0.86;
                const w = S * 0.46;
                const h = S * 0.42;
                x.save();
                x.translate(cx, by);
                x.rotate(0.22);
                x.fillStyle = ink;
                x.beginPath();
                x.moveTo(-w * 0.5, 0);
                x.quadraticCurveTo(-w * 0.42, -h * 0.3, -w * 0.3, -h * 0.75);
                x.quadraticCurveTo(0, -h * 1.05, w * 0.3, -h * 0.75);
                x.quadraticCurveTo(w * 0.42, -h * 0.3, w * 0.5, 0);
                x.lineTo(w * 0.56, h * 0.06);
                x.lineTo(-w * 0.56, h * 0.06);
                x.fill();
                x.restore();
                for (let i = 0; i < 14; i++) bubble(S * (0.55 + r() * 0.15), S * (0.1 + r() * 0.5), 2 + r() * 6);
                break;
            }
            case 'jelly': {
                for (let i = 0; i < 7; i++) {
                    const jx = S * (0.15 + r() * 0.7);
                    const jy = S * (0.25 + r() * 0.5);
                    const js = S * (0.04 + r() * 0.08);
                    x.fillStyle = 'rgba(255,255,255,0.85)';
                    x.beginPath();
                    x.ellipse(jx, jy, js, js * 0.7, 0, Math.PI, TAU);
                    x.fill();
                    x.strokeStyle = 'rgba(255,255,255,0.7)';
                    x.lineWidth = 1.2;
                    for (let k = 0; k < 5; k++) {
                        const sx = jx - js * 0.7 + (js * 1.4 * k) / 4;
                        x.beginPath();
                        x.moveTo(sx, jy);
                        for (let s = 1; s <= 10; s++) x.lineTo(sx + Math.sin(s + k) * 3, jy + (s / 10) * js * 3);
                        x.stroke();
                    }
                }
                bed(S * 0.92);
                break;
            }
            case 'spire': {
                bed(S * 0.86);
                x.save();
                x.translate(S * 0.42, S * 0.9);
                x.rotate(0.28);
                x.fillStyle = ink;
                x.fillRect(-S * 0.08, -S * 0.42, S * 0.16, S * 0.42);
                x.beginPath();
                x.moveTo(-S * 0.1, -S * 0.42);
                x.lineTo(0, -S * 0.8);
                x.lineTo(S * 0.1, -S * 0.42);
                x.fill();
                x.fillStyle = '#ddd';
                x.beginPath();
                pointed(x, 0, -S * 0.2, S * 0.06, S * 0.14);
                x.fill();
                x.restore();
                x.fillStyle = ink;
                for (let i = 0; i < 9; i++) {
                    const fxp = S * (0.5 + r() * 0.4);
                    const fyp = S * (0.2 + r() * 0.4);
                    const fs = S * (0.015 + r() * 0.015);
                    x.beginPath();
                    x.ellipse(fxp, fyp, fs * 2, fs, 0, 0, TAU);
                    x.moveTo(fxp + fs * 1.8, fyp);
                    x.lineTo(fxp + fs * 3, fyp - fs);
                    x.lineTo(fxp + fs * 3, fyp + fs);
                    x.fill();
                }
                break;
            }
            case 'angler':
            default: {
                x.fillStyle = 'rgba(0,0,0,0.78)';
                x.fillRect(0, 0, S, S);
                const ax = S * 0.56;
                const ay = S * 0.62;
                const as = S * 0.2;
                const lx = S * 0.24;
                const ly = S * 0.34;
                const glow = x.createRadialGradient(lx, ly, 0, lx, ly, S * 0.3);
                glow.addColorStop(0, 'rgba(255,255,255,1)');
                glow.addColorStop(0.12, 'rgba(255,255,255,0.6)');
                glow.addColorStop(1, 'rgba(255,255,255,0)');
                x.fillStyle = glow;
                x.fillRect(0, 0, S, S);
                x.fillStyle = '#050505';
                x.beginPath();
                x.ellipse(ax, ay, as * 1.3, as, 0, 0, TAU);
                x.fill();
                x.strokeStyle = '#050505';
                x.lineWidth = 3;
                x.beginPath();
                x.moveTo(ax - as * 0.4, ay - as * 0.9);
                x.quadraticCurveTo(ax - as * 0.9, ay - as * 2, lx, ly);
                x.stroke();
                x.fillStyle = '#eee';
                for (let i = 0; i < 9; i++) {
                    const tx = ax - as * 1.2 + i * as * 0.16;
                    x.beginPath();
                    x.moveTo(tx, ay + as * 0.1);
                    x.lineTo(tx + as * 0.06, ay + as * 0.32);
                    x.lineTo(tx + as * 0.12, ay + as * 0.1);
                    x.fill();
                }
                x.beginPath();
                x.arc(ax - as * 0.5, ay - as * 0.35, as * 0.12, 0, TAU);
                x.fill();
                break;
            }
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
        ui.kicker.innerHTML = `Verse ${ROMAN[player.index]} &middot; of ${ROMAN[TRACKS.length - 1]}`;
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
