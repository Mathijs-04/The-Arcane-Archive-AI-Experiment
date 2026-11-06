/*
 * The Hoarfrost Saga
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

    function iceRidge(ctx, r, cw, ch, base, amp, step, col, lit) {
        const pts = [];
        let x = -20;
        while (x < cw + 40) {
            pts.push([x, base - amp * (0.35 + r() * 0.65)]);
            x += step * (0.5 + r());
            pts.push([x, base - amp * r() * 0.25]);
            x += step * (0.4 + r() * 0.8);
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(-20, ch);
        pts.forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.lineTo(cw + 40, ch);
        ctx.fill();
        ctx.fillStyle = lit;
        for (let i = 0; i < pts.length - 1; i += 2) {
            const [px, py] = pts[i];
            const [vx, vy] = pts[i + 1];
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(vx, vy);
            ctx.lineTo(px + (vx - px) * 0.3, base + 6);
            ctx.closePath();
            ctx.fill();
        }
        return pts;
    }

    function longship(ctx, x, y, L, col, edge) {
        const H = L * 0.25;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.07);
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        // hull, half swallowed by the ice
        ctx.beginPath();
        ctx.moveTo(-L * 0.5, 2);
        ctx.lineTo(-L * 0.46, -H * 0.2);
        ctx.quadraticCurveTo(0, -H * 0.05, L * 0.44, -H * 0.26);
        ctx.lineTo(L * 0.5, 2);
        ctx.closePath();
        ctx.fill();
        // dragon prow and curled stern
        ctx.lineWidth = Math.max(2, L * 0.025);
        ctx.beginPath();
        ctx.moveTo(L * 0.44, -H * 0.24);
        ctx.quadraticCurveTo(L * 0.58, -H * 0.7, L * 0.5, -H * 1.05);
        ctx.quadraticCurveTo(L * 0.47, -H * 1.25, L * 0.55, -H * 1.22);
        ctx.moveTo(-L * 0.46, -H * 0.2);
        ctx.quadraticCurveTo(-L * 0.58, -H * 0.55, -L * 0.52, -H * 0.85);
        ctx.quadraticCurveTo(-L * 0.47, -H * 0.98, -L * 0.45, -H * 0.82);
        ctx.stroke();
        // mast, yard and a torn sail
        ctx.lineWidth = Math.max(1.5, L * 0.016);
        ctx.beginPath();
        ctx.moveTo(-L * 0.05, -H * 0.15);
        ctx.lineTo(-L * 0.02, -H * 2.6);
        ctx.moveTo(-L * 0.26, -H * 2.3);
        ctx.lineTo(L * 0.2, -H * 2.42);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-L * 0.24, -H * 2.28);
        ctx.lineTo(L * 0.18, -H * 2.4);
        ctx.lineTo(L * 0.15, -H * 1.5);
        ctx.lineTo(L * 0.08, -H * 1.75);
        ctx.lineTo(L * 0.02, -H * 1.3);
        ctx.lineTo(-L * 0.08, -H * 1.6);
        ctx.lineTo(-L * 0.2, -H * 1.35);
        ctx.closePath();
        ctx.fill();
        // rigging
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-L * 0.02, -H * 2.6);
        ctx.lineTo(L * 0.45, -H * 0.3);
        ctx.moveTo(-L * 0.02, -H * 2.6);
        ctx.lineTo(-L * 0.44, -H * 0.24);
        ctx.stroke();
        // shields along the gunwale, rimmed with frost
        for (let i = 0; i < 9; i++) {
            const t = i / 8;
            const sx = lerp(-L * 0.38, L * 0.36, t);
            const sy = lerp(-H * 0.2, -H * 0.27, t) - Math.sin(t * Math.PI) * -H * 0.12;
            ctx.beginPath();
            ctx.arc(sx, sy, L * 0.028, 0, TAU);
            ctx.fill();
            if (edge) {
                ctx.strokeStyle = edge;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(sx, sy, L * 0.028, Math.PI * 1.1, Math.PI * 1.9);
                ctx.stroke();
                ctx.strokeStyle = col;
            }
        }
        ctx.restore();
    }

    function cairn(ctx, r, x, y, h, col) {
        ctx.fillStyle = col;
        let cy = y;
        const n = 4 + ((r() * 3) | 0);
        let big = null;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            const w = h * lerp(0.42, 0.16, t) * (0.85 + r() * 0.3);
            const sh = h / n * (0.9 + r() * 0.3);
            const ox = (r() - 0.5) * w * 0.3;
            ctx.beginPath();
            ctx.ellipse(x + ox, cy - sh / 2, w, sh / 2 + 1, (r() - 0.5) * 0.2, 0, TAU);
            ctx.fill();
            if (i === 1) big = { x: x + ox - w * 0.3, y: cy - sh * 0.85, w: w * 0.6, h: sh * 0.7 };
            cy -= sh * 0.9;
        }
        return big;
    }

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(layers.far, cw, ch);
        const r = mulberry32(1307);
        iceRidge(ctx, r, cw, ch, ch * 0.6, ch * 0.24, cw * 0.05, '#141c22', 'rgba(150,190,210,0.11)');
        iceRidge(ctx, r, cw, ch, ch * 0.7, ch * 0.12, cw * 0.032, '#0f161b', 'rgba(150,190,210,0.08)');
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(layers.mid, cw, ch);
        const r = mulberry32(4242);
        const col = '#0a1014';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        const ground = wave(r, ch * 0.8, [[ch * 0.01, 0.004], [ch * 0.005, 0.013]]);
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, ground(x));
        ctx.lineTo(cw, ch);
        ctx.fill();

        // pressure ridges: slabs of ice pushed up through the plain
        for (let x = 0; x < cw; x += 20 + r() * 70) {
            const h = ch * (0.01 + r() * 0.04);
            const w = 10 + r() * 40;
            const y = ground(x) + 3;
            ctx.beginPath();
            ctx.moveTo(x - w / 2, y);
            ctx.lineTo(x - w * 0.2 + (r() - 0.5) * 10, y - h);
            ctx.lineTo(x + w * 0.15, y - h * (0.6 + r() * 0.5));
            ctx.lineTo(x + w / 2, y);
            ctx.fill();
        }

        // ice cliffs at both edges
        const cliff = (x0, x1, top) => {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(x0, ground(x0) + 5);
            ctx.lineTo(x0, top + r() * ch * 0.05);
            let x = x0;
            while (x < x1) {
                x += 10 + r() * 30;
                ctx.lineTo(Math.min(x, x1), top + r() * ch * 0.07);
            }
            ctx.lineTo(x1, ground(x1) + 5);
            ctx.fill();
            ctx.save();
            ctx.strokeStyle = 'rgba(160,205,225,0.09)';
            ctx.lineWidth = 1;
            for (let k = 0; k < 16; k++) {
                const lx = x0 + r() * (x1 - x0);
                ctx.beginPath();
                ctx.moveTo(lx, top + ch * 0.07);
                ctx.lineTo(lx + (r() - 0.5) * 10, ground(lx));
                ctx.stroke();
            }
            ctx.restore();
        };
        cliff(-10, cw * 0.075, ch * 0.48);
        cliff(cw * 0.94, cw + 10, ch * 0.53);

        // a longship locked in the ice
        longship(ctx, cw * 0.2, ground(cw * 0.2) + 3, Math.max(150, cw * 0.15), col, 'rgba(170,215,235,0.25)');

        // a ring of rune cairns on the right
        const cx = cw * 0.8;
        const cy = ground(cx) - 2;
        const stones = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.4;
            const d = Math.sin(a);
            stones.push({ x: cx + Math.cos(a) * cw * 0.065, y: cy + d * ch * 0.016, s: lerp(0.6, 1, (d + 1) / 2), d });
        }
        stones.push({ x: cx, y: cy, s: 1.5, d: 0 });
        let idx = 0;
        stones.sort((a, b) => a.d - b.d).forEach((s) => {
            const box = cairn(ctx, r, s.x, s.y, ch * 0.08 * s.s, col);
            if (s.d > -0.2 && box) {
                scene.glows.push({ type: 'rune', ...box, glyph: RUNES[(r() * RUNES.length) | 0], phase: r() * TAU, idx: idx++ });
            }
        });
        scene.runeCount = idx;
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(layers.near, cw, ch);
        const r = mulberry32(777);
        const col = '#03060a';
        ctx.fillStyle = col;

        // a frozen overhang with icicles along the top
        const top = wave(r, ch * 0.025, [[ch * 0.015, 0.006], [ch * 0.008, 0.021]]);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, top(x));
        ctx.lineTo(cw, -5);
        ctx.fill();
        for (let x = 0; x < cw; x += 4 + r() * 14) {
            const heavy = x < cw * 0.3 || x > cw * 0.75 ? 1.5 : 0.55;
            const l = ch * (0.01 + Math.pow(r(), 2.5) * 0.13) * heavy;
            const w = 3 + r() * 9;
            const y = top(x) - 2;
            ctx.beginPath();
            ctx.moveTo(x - w / 2, y);
            ctx.lineTo(x + (r() - 0.5) * 2, y + l);
            ctx.lineTo(x + w / 2, y);
            ctx.fill();
        }

        // great ice shards rising from the bottom corners
        const shard = (x, y, h, w, ang) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(-w / 2, 0);
            ctx.lineTo(-w * 0.1, -h);
            ctx.lineTo(w * 0.15, -h * 0.92);
            ctx.lineTo(w / 2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(170,215,235,0.07)';
            ctx.beginPath();
            ctx.moveTo(-w * 0.1, -h);
            ctx.lineTo(w * 0.15, -h * 0.92);
            ctx.lineTo(w * 0.04, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        };
        for (let i = 0; i < 8; i++) shard(cw * r() * 0.13, ch + 10, ch * (0.12 + r() * 0.38), 30 + r() * 60, -0.45 + r() * 0.6);
        for (let i = 0; i < 7; i++) shard(cw * (0.88 + r() * 0.13), ch + 10, ch * (0.1 + r() * 0.32), 26 + r() * 50, -0.2 + r() * 0.6);

        // snowdrift along the bottom
        const drift = wave(r, ch * 0.975, [[ch * 0.01, 0.008], [ch * 0.004, 0.03]]);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 8) ctx.lineTo(x, drift(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
    }

    function drawFrost() {
        const cv = $('#frost');
        const W = window.innerWidth;
        const H = window.innerHeight;
        const ctx = sizeCanvas(cv, W, H);
        const r = mulberry32(606);
        ctx.strokeStyle = 'rgba(225,240,255,0.22)';
        const grow = (x, y, ang, len, depth) => {
            const ex = x + Math.cos(ang) * len;
            const ey = y + Math.sin(ang) * len;
            ctx.lineWidth = Math.max(0.4, depth * 0.35);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            if (depth <= 0) return;
            const steps = 3;
            for (let k = 1; k <= steps; k++) {
                const px = x + (ex - x) * (k / (steps + 0.5));
                const py = y + (ey - y) * (k / (steps + 0.5));
                for (const side of [-1, 1]) {
                    if (r() < 0.75) grow(px, py, ang + side * Math.PI / 3, len * (0.32 + r() * 0.2), depth - 1);
                }
            }
        };
        const corners = [[0, 0, 0, Math.PI / 2], [W, 0, Math.PI / 2, Math.PI], [0, H, -Math.PI / 2, 0], [W, H, Math.PI, Math.PI * 1.5]];
        const reach = Math.min(W, H) * 0.32;
        corners.forEach(([x, y, a0, a1]) => {
            for (let i = 0; i < 9; i++) {
                const a = lerp(a0, a1, (i + 0.5) / 9) + (r() - 0.5) * 0.15;
                grow(x, y, a, reach * (0.4 + r() * 0.6), 3);
            }
        });
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
        sizeAurora();
        drawFrost();
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
                `<feColorMatrix values='0 0 0 0 0.85  0 0 0 0 0.92  0 0 0 0 0.88  ${gain} 0 0 0 ${cut}'/>` +
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
        g.addColorStop(0, 'rgba(235,255,250,1)');
        g.addColorStop(0.14, 'rgba(160,255,230,0.8)');
        g.addColorStop(0.4, 'rgba(150,140,255,0.18)');
        g.addColorStop(1, 'rgba(120,120,255,0)');
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

    /* ---------------- aurora: curtains of light, drawn at 1/3 scale and blurred */

    const auroraCv = $('#aurora');
    const actx = auroraCv.getContext('2d');
    let aw = 0;
    let ah = 0;
    let auroraT = 0;
    function sizeAurora() {
        aw = Math.ceil(window.innerWidth / 3);
        ah = Math.ceil((window.innerHeight * 0.72) / 3);
        auroraCv.width = aw;
        auroraCv.height = ah;
    }
    const strip = document.createElement('canvas');
    strip.width = 1;
    strip.height = 128;
    (() => {
        const s = strip.getContext('2d');
        const g = s.createLinearGradient(0, 0, 0, 128);
        g.addColorStop(0, 'rgba(170,120,255,0)');
        g.addColorStop(0.4, 'rgba(160,125,255,0.22)');
        g.addColorStop(0.78, 'rgba(110,255,215,0.7)');
        g.addColorStop(0.93, 'rgba(210,255,240,1)');
        g.addColorStop(1, 'rgba(110,255,215,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 1, 128);
    })();
    const CURTAINS = [
        { y: 0.5, amp: 0.13, h: 0.42, k: 0.0035, sp: 0.00016, off: 0, a: 0.75 },
        { y: 0.68, amp: 0.08, h: 0.3, k: 0.006, sp: -0.00011, off: 2.1, a: 0.5 },
        { y: 0.36, amp: 0.1, h: 0.3, k: 0.0028, sp: 0.00009, off: 4.4, a: 0.4 },
    ];
    function drawAurora(t) {
        actx.clearRect(0, 0, aw, ah);
        actx.globalCompositeOperation = 'lighter';
        const surge = state.playing ? 1.15 + state.beat * 0.7 : 0.6;
        for (const c of CURTAINS) {
            for (let x = 0; x < aw; x++) {
                const px = x * 3;
                const y = ah * (c.y + c.amp * Math.sin(px * c.k + t * c.sp + c.off) + c.amp * 0.45 * Math.sin(px * c.k * 2.7 - t * c.sp * 1.7));
                const h = ah * c.h * (0.6 + 0.4 * Math.sin(px * 0.011 + t * 0.0006 + c.off));
                let b = 0.5 + 0.5 * Math.sin(px * 0.019 - t * 0.0009 + c.off);
                b = b * b;
                if (state.playing) b += 0.35 * Math.max(0, Math.sin(px * 0.04 - t * 0.006));
                actx.globalAlpha = clamp(c.a * surge * b * state.glowGain, 0, 1);
                actx.drawImage(strip, x, y - h, 1, h);
            }
        }
        actx.globalAlpha = 1;
        actx.globalCompositeOperation = 'source-over';
    }

    /* ---------------- blowing snow (replaces the fireflies) */

    let flies = [];

    function makeFly(x, y, burst) {
        const { cw, ch } = scene;
        return {
            x: x ?? Math.random() * cw,
            y: y ?? Math.random() * ch,
            z: 0.25 + Math.random() * 0.75,
            ph: Math.random() * TAU,
            vx: burst ? (Math.random() - 0.5) * 9 : 0,
            vy: burst ? (Math.random() - 0.75) * 9 : 0,
            life: burst ? 1 : Infinity,
            burst: !!burst,
        };
    }

    function seedFireflies() {
        flies = Array.from({ length: 280 }, () => makeFly());
    }

    function drawRune(g, t) {
        let a = 0.14 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.0007 + g.phase));
        if (state.playing) {
            const wavePos = (t * 0.0004) % 1;
            const pos = g.idx / Math.max(1, scene.runeCount);
            const d = Math.min(Math.abs(wavePos - pos), 1 - Math.abs(wavePos - pos));
            a += 0.3 + 0.55 * Math.max(0, 1 - d * 5) + state.beat * 0.25;
        }
        a *= state.glowGain;
        fx.save();
        fx.strokeStyle = `rgba(175,255,235,${clamp(a, 0, 1)})`;
        fx.shadowColor = 'rgba(120,240,225,0.95)';
        fx.shadowBlur = 8 + a * 10;
        fx.lineWidth = Math.max(1.1, g.w * 0.12);
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
        for (const g of scene.glows) if (g.type === 'rune') drawRune(g, t);
    }

    function updateFlies(dt, t) {
        const { cw, ch } = scene;
        const p = state.pointer;
        const px = p.x + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const py = p.y + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;
        const wind = 1.1 + Math.sin(t * 0.00031) * 0.8 + (state.playing ? 1.3 + state.beat * 1.5 : 0);

        for (let i = flies.length - 1; i >= 0; i--) {
            const f = flies[i];
            let vx = wind * f.z * 1.7 + f.vx;
            let vy = 0.55 * f.z + Math.sin(t * 0.002 + f.ph) * 0.35 + f.vy;
            f.vx *= 0.95;
            f.vy *= 0.95;
            if (p.active) {
                const dx = f.x - px;
                const dy = f.y - py;
                const d = Math.hypot(dx, dy);
                if (d < 150 && d > 1) {
                    const push = (1 - d / 150) * 3.2;
                    vx += (dx / d) * push;
                    vy += (dy / d) * push;
                }
            }
            f.x += vx * dt;
            f.y += vy * dt;
            if (f.x > cw + 10) f.x = -10;
            if (f.x < -10) f.x = cw + 10;
            if (f.y > ch + 10) f.y = -10;
            if (f.y < -10) f.y = ch + 10;

            if (f.burst) {
                f.life -= 0.006 * dt;
                if (f.life <= 0) {
                    flies.splice(i, 1);
                    continue;
                }
                const s = 8 + f.z * 14;
                fx.globalCompositeOperation = 'lighter';
                fx.globalAlpha = clamp(f.life * state.glowGain, 0, 1);
                fx.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s);
                fx.globalCompositeOperation = 'source-over';
            } else {
                fx.globalAlpha = 0.18 + 0.6 * f.z * f.z;
                fx.fillStyle = '#eef6ff';
                const s = 0.6 + f.z * 2;
                fx.fillRect(f.x, f.y, s, s);
            }
        }
        fx.globalAlpha = 1;
    }

    function burst(clientX, clientY) {
        const x = clientX + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const y = clientY + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;
        for (let i = 0; i < 22; i++) flies.push(makeFly(x, y, true));
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
        auroraT += dt * 16.67 * (state.playing ? 2.4 : 1);
        drawAurora(auroraT);
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

        // cracks running through the slate
        const crack = (x, y, ang, len) => {
            let px = x;
            let py = y;
            const pts = [[px, py]];
            for (let i = 0; i < 18; i++) {
                ang += (r() - 0.5) * 0.7;
                px += Math.cos(ang) * len / 18;
                py += Math.sin(ang) * len / 18;
                pts.push([px, py]);
            }
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(10,15,20,0.4)';
            ctx.beginPath();
            pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
            ctx.stroke();
            ctx.strokeStyle = 'rgba(230,245,255,0.25)';
            ctx.beginPath();
            pts.forEach(([a, b], i) => (i ? ctx.lineTo(a + 1, b + 1) : ctx.moveTo(a + 1, b + 1)));
            ctx.stroke();
        };
        crack(W * 0.98, H * 0.2, Math.PI * 0.85, W * 0.3);
        crack(W * 0.45, H, -Math.PI * 0.4, H * 0.5);
        crack(0, H * 0.75, -0.2, W * 0.2);

        // hoarfrost rime crusting the edges
        for (let i = 0; i < 1400; i++) {
            const edge = (r() * 4) | 0;
            const depth = Math.pow(r(), 3) * Math.min(W, H) * 0.12;
            let x = r() * W;
            let y = r() * H;
            if (edge === 0) y = depth;
            if (edge === 1) y = H - depth;
            if (edge === 2) x = depth;
            if (edge === 3) x = W - depth;
            ctx.fillStyle = `rgba(235,245,255,${0.08 + r() * 0.3})`;
            ctx.fillRect(x, y, 0.8 + r() * 1.8, 0.8 + r() * 1.8);
        }

        // foxing spots
        for (let i = 0; i < 26; i++) {
            ctx.fillStyle = `rgba(60,50,25,${0.04 + r() * 0.08})`;
            ctx.beginPath();
            ctx.arc(r() * W, r() * H, 0.5 + r() * 2.5, 0, TAU);
            ctx.fill();
        }
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
        let d = '';
        const grow = (x, y, ang, len, depth) => {
            const ex = x + Math.cos(ang) * len;
            const ey = y + Math.sin(ang) * len;
            d += `M${x.toFixed(1)} ${y.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`;
            if (depth <= 0) return;
            for (let k = 1; k <= 3; k++) {
                const px = x + (ex - x) * (k / 3.6);
                const py = y + (ey - y) * (k / 3.6);
                for (const side of [-1, 1]) {
                    if (r() < 0.8) grow(px, py, ang + side * Math.PI / 3, len * (0.3 + r() * 0.15), depth - 1);
                }
            }
        };
        grow(8, 152, -Math.PI / 2, 105, 2);
        grow(8, 152, 0, 105, 2);
        grow(8, 152, -Math.PI / 4, 45, 1);
        let flake = '';
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const ex = 30 + Math.cos(a) * 15;
            const ey = 130 + Math.sin(a) * 15;
            flake += `M30 130L${ex.toFixed(1)} ${ey.toFixed(1)}`;
            for (const side of [-1, 1]) {
                const mx = 30 + Math.cos(a) * 9;
                const my = 130 + Math.sin(a) * 9;
                flake += `M${mx.toFixed(1)} ${my.toFixed(1)}L${(mx + Math.cos(a + side * 0.9) * 5).toFixed(1)} ${(my + Math.sin(a + side * 0.9) * 5).toFixed(1)}`;
            }
        }
        return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>` +
            `<path d="${flake}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>` +
            `<circle cx="30" cy="130" r="3" fill="currentColor"/></svg>`;
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
        { title: 'Keel Beneath the Rime', artist: 'Drowned Jarls', scene: 'ship', seed: 11, duration: 431 },
        { title: 'Nine Cairns of Hrimfell', artist: 'Wardens of the Thaw', scene: 'cairns', seed: 23, duration: 377 },
        { title: 'The Sky-Fire Wakes', artist: 'Skaldic Hoar', scene: 'aurora', seed: 47, duration: 512 },
        { title: 'Teeth of the Glacier', artist: 'Frostwold', scene: 'peaks', seed: 61, duration: 344 },
        { title: 'Wall of the Unmelting', artist: 'Old Winter Choir', scene: 'icewall', seed: 83, duration: 468 },
    ];
    const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

    function paintCoverScene(x, S, track) {
        const r = mulberry32(track.seed);
        const sky = x.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, '#101010');
        sky.addColorStop(0.55, '#4a4a4a');
        sky.addColorStop(0.8, '#9a9a9a');
        sky.addColorStop(1, '#d0d0d0');
        x.fillStyle = sky;
        x.fillRect(0, 0, S, S);
        for (let i = 0; i < 120; i++) {
            x.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`;
            const s = r() < 0.9 ? 1.2 : 2.4;
            x.fillRect(r() * S, Math.pow(r(), 1.4) * S * 0.6, s, s);
        }
        // aurora curtains in white
        const curtains = track.scene === 'aurora' ? 3 : 1 + ((r() * 2) | 0);
        for (let c = 0; c < curtains; c++) {
            const base = S * (0.28 + r() * 0.18);
            const amp = S * (0.04 + r() * 0.06);
            const k = 0.01 + r() * 0.02;
            const ph = r() * TAU;
            const hh = S * (0.14 + r() * 0.16);
            for (let i = 0; i < S; i += 2) {
                const y = base + Math.sin(i * k + ph) * amp + Math.sin(i * k * 2.6) * amp * 0.4;
                const b = Math.pow(0.5 + 0.5 * Math.sin(i * 0.05 + ph), 2) * (track.scene === 'aurora' ? 0.85 : 0.55);
                const g = x.createLinearGradient(0, y - hh, 0, y);
                g.addColorStop(0, 'rgba(255,255,255,0)');
                g.addColorStop(0.85, `rgba(255,255,255,${b})`);
                g.addColorStop(1, 'rgba(255,255,255,0)');
                x.fillStyle = g;
                x.fillRect(i, y - hh, 2, hh);
            }
        }
        const mist = (y, a) => {
            const g = x.createLinearGradient(0, y - S * 0.1, 0, y + S * 0.08);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.6, `rgba(255,255,255,${a})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(0, y - S * 0.1, S, S * 0.18);
        };
        const plain = (y, col) => {
            x.fillStyle = col;
            x.fillRect(0, y, S, S - y);
        };
        const ink = '#0a0a0a';
        switch (track.scene) {
            case 'ship':
                iceRidge(x, r, S, S, S * 0.7, S * 0.14, S * 0.07, '#5a5a5a', 'rgba(255,255,255,0.25)');
                mist(S * 0.72, 0.5);
                plain(S * 0.82, '#bdbdbd');
                longship(x, S * 0.5, S * 0.86, S * 0.62, ink, 'rgba(255,255,255,0.8)');
                mist(S * 0.95, 0.3);
                break;
            case 'cairns': {
                iceRidge(x, r, S, S, S * 0.72, S * 0.12, S * 0.06, '#606060', 'rgba(255,255,255,0.25)');
                mist(S * 0.74, 0.5);
                plain(S * 0.8, '#b8b8b8');
                const list = [];
                for (let i = 0; i < 7; i++) {
                    const a = (i / 7) * TAU + 0.3;
                    const d = Math.sin(a);
                    list.push({ x: S * 0.5 + Math.cos(a) * S * 0.34, y: S * 0.86 + d * S * 0.06, s: lerp(0.5, 1.2, (d + 1) / 2), d });
                }
                list.sort((a, b) => a.d - b.d).forEach((c) => {
                    const v = Math.round(lerp(70, 8, (c.d + 1) / 2));
                    const box = cairn(x, r, c.x, c.y, S * 0.2 * c.s, `rgb(${v},${v},${v})`);
                    if (c.d > 0.2 && box) {
                        x.strokeStyle = 'rgba(255,255,255,0.9)';
                        x.lineWidth = 2;
                        const gl = RUNES[(r() * RUNES.length) | 0];
                        x.beginPath();
                        gl.forEach(([x1, y1, x2, y2]) => {
                            x.moveTo(box.x + x1 * box.w, box.y + y1 * box.h);
                            x.lineTo(box.x + x2 * box.w, box.y + y2 * box.h);
                        });
                        x.stroke();
                    }
                });
                break;
            }
            case 'aurora': {
                iceRidge(x, r, S, S, S * 0.76, S * 0.08, S * 0.05, '#3a3a3a', 'rgba(255,255,255,0.2)');
                plain(S * 0.8, '#a0a0a0');
                mist(S * 0.82, 0.4);
                // a lone figure with a spear
                x.fillStyle = x.strokeStyle = ink;
                const fx2 = S * 0.62;
                const fy = S * 0.9;
                x.beginPath();
                x.moveTo(fx2 - S * 0.03, fy);
                x.lineTo(fx2 - S * 0.022, fy - S * 0.1);
                x.lineTo(fx2 + S * 0.022, fy - S * 0.1);
                x.lineTo(fx2 + S * 0.035, fy);
                x.fill();
                x.beginPath();
                x.arc(fx2, fy - S * 0.115, S * 0.018, 0, TAU);
                x.fill();
                x.lineWidth = 2;
                x.beginPath();
                x.moveTo(fx2 + S * 0.04, fy + 2);
                x.lineTo(fx2 + S * 0.05, fy - S * 0.19);
                x.stroke();
                break;
            }
            case 'peaks':
                iceRidge(x, r, S, S, S * 0.66, S * 0.2, S * 0.08, '#6a6a6a', 'rgba(255,255,255,0.3)');
                mist(S * 0.68, 0.45);
                iceRidge(x, r, S, S, S * 0.95, S * 0.45, S * 0.14, '#121212', 'rgba(255,255,255,0.32)');
                break;
            case 'icewall':
            default: {
                plain(S * 0.84, '#c4c4c4');
                x.fillStyle = '#1c1c1c';
                x.beginPath();
                x.moveTo(-5, S * 0.86);
                let px = -5;
                x.lineTo(-5, S * 0.32);
                while (px < S + 5) {
                    px += 8 + r() * 20;
                    x.lineTo(px, S * (0.3 + r() * 0.06));
                }
                x.lineTo(S + 5, S * 0.86);
                x.fill();
                x.strokeStyle = 'rgba(255,255,255,0.35)';
                for (let i = 0; i < 26; i++) {
                    const lx = r() * S;
                    x.lineWidth = 0.6 + r() * 1.6;
                    x.beginPath();
                    x.moveTo(lx, S * 0.36);
                    x.lineTo(lx + (r() - 0.5) * 12, S * 0.86);
                    x.stroke();
                }
                mist(S * 0.86, 0.6);
                x.fillStyle = ink;
                x.fillRect(S * 0.49, S * 0.88, S * 0.012, S * 0.04);
                x.beginPath();
                x.arc(S * 0.496, S * 0.875, S * 0.008, 0, TAU);
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
