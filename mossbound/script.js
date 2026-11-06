/*
 * The Mossbound Codex
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

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(layers.far, cw, ch);
        const r = mulberry32(1307);
        const col = '#1d2723';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        const hill = wave(r, ch * 0.63, [[ch * 0.025, 0.004], [ch * 0.012, 0.011], [ch * 0.004, 0.03]]);
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, hill(x));
        ctx.lineTo(cw, ch);
        ctx.fill();

        // distant pine ridge
        for (let x = -10; x < cw + 10; x += 5 + r() * 9) {
            const h = ch * (0.035 + r() * 0.06);
            pine(ctx, r, x, hill(x) + 3, h, h * 0.3);
        }

        // a closer tree line, half-swallowed by mist
        const back = '#151d19';
        ctx.fillStyle = back;
        ctx.strokeStyle = back;
        const line = wave(r, ch * 0.72, [[ch * 0.012, 0.006], [ch * 0.006, 0.02]]);
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, line(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
        for (let x = -20; x < cw + 20; x += 18 + r() * 40) {
            const y = line(x) + 4;
            if (r() < 0.55) {
                const h = ch * (0.09 + r() * 0.12);
                pine(ctx, r, x, y, h, h * (0.22 + r() * 0.1));
            } else {
                branch(ctx, r, x, y, ch * (0.03 + r() * 0.03), UP + (r() - 0.5) * 0.2, 3 + r() * 3, 6, {
                    gnarl: 0.9, spread: 0.55, minW: 0.6, leaf: 4 + r() * 4, split3: 0.4, lift: 0.08, decay: 0.82,
                });
            }
        }
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        // the world tree, far away on the right
        const wx = cw * 0.785;
        const wy = hill(wx) + 4;
        branch(ctx, r, wx, wy, ch * 0.075, UP, ch * 0.016, 8, {
            gnarl: 0.7, spread: 0.62, minW: 0.6, leaf: ch * 0.009, split3: 0.4, lift: 0.04, decay: 0.78,
        });
        scene.glows.push({ type: 'tree', x: wx, y: wy - ch * 0.03, r: ch * 0.05, phase: 0, layer: 'far' });
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(layers.mid, cw, ch);
        const r = mulberry32(4242);
        const col = '#0d1310';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        const ground = wave(r, ch * 0.8, [[ch * 0.018, 0.005], [ch * 0.008, 0.017]]);

        // ground
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, ground(x));
        ctx.lineTo(cw, ch);
        ctx.fill();

        // stone circle on a mound (left)
        const sx = cw * 0.155;
        const sy = ground(sx) - ch * 0.012;
        ctx.beginPath();
        ctx.ellipse(sx, sy + ch * 0.02, cw * 0.12, ch * 0.05, 0, Math.PI, TAU);
        ctx.fill();
        const stones = [];
        const count = 9;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * TAU + 0.3;
            const depth = Math.sin(a); // -1 back, +1 front
            const scale = lerp(0.62, 1, (depth + 1) / 2);
            stones.push({
                x: sx + Math.cos(a) * cw * 0.075,
                y: sy + depth * ch * 0.018,
                h: ch * 0.085 * scale * (0.8 + r() * 0.4),
                w: ch * 0.034 * scale * (0.85 + r() * 0.3),
                tilt: (r() - 0.5) * 0.14,
                depth,
            });
        }
        // a taller capstone in the middle
        stones.push({ x: sx + cw * 0.004, y: sy - ch * 0.004, h: ch * 0.12, w: ch * 0.04, tilt: 0.03, depth: -0.05, center: true });
        stones.sort((a, b) => a.depth - b.depth).forEach((s) => {
            stone(ctx, s.x, s.y, s.w, s.h, s.tilt);
            if (s.depth > -0.1) {
                scene.glows.push({
                    type: 'rune',
                    x: s.x - s.w * 0.22,
                    y: s.y - s.h * 0.72,
                    w: s.w * 0.44,
                    h: s.h * 0.42,
                    glyph: RUNES[(r() * RUNES.length) | 0],
                    phase: r() * TAU,
                    order: s.x,
                });
            }
        });

        // a scatter of gnarled, half-bare trees
        const spots = [0.02, 0.07, 0.29, 0.36, 0.43, 0.58, 0.64, 0.72, 0.97];
        spots.forEach((fx) => {
            const x = cw * (fx + (r() - 0.5) * 0.02);
            const y = ground(x) + 4;
            const h = ch * (0.03 + r() * 0.06);
            const w = 4 + r() * 7;
            roots(ctx, r, x, y, w, col);
            branch(ctx, r, x, y, h, UP + (r() - 0.5) * 0.15, w, 7, {
                gnarl: 1.1, spread: 0.52, minW: 0.8, leaf: r() < 0.6 ? 4 + r() * 5 : 0, split3: 0.4, lift: 0.07, decay: 0.84,
                mossy: { chance: 0.25, minW: 1.2, maxW: 4, len: ch * 0.025 },
            });
        });

        // the ancient hollow tree (right)
        const ax = cw * 0.86;
        const ay = ground(ax) + 6;
        const aw = ch * 0.05;
        const ah = ch * 0.2;
        roots(ctx, r, ax, ay, aw * 0.9, col);
        ctx.beginPath();
        ctx.moveTo(ax - aw * 0.95, ay);
        ctx.bezierCurveTo(ax - aw * 0.45, ay - ah * 0.3, ax - aw * 0.75, ay - ah * 0.7, ax - aw * 0.35, ay - ah);
        ctx.lineTo(ax + aw * 0.4, ay - ah);
        ctx.bezierCurveTo(ax + aw * 0.7, ay - ah * 0.65, ax + aw * 0.4, ay - ah * 0.3, ax + aw * 1.05, ay);
        ctx.closePath();
        ctx.fill();
        // its crown
        const crown = {
            gnarl: 0.9, spread: 0.72, minW: 0.8, leaf: 7, split3: 0.45, lift: 0.0, decay: 0.76,
            mossy: { chance: 0.45, minW: 1.5, maxW: 9, len: ch * 0.05 },
        };
        branch(ctx, r, ax - aw * 0.1, ay - ah + 4, ch * 0.09, UP - 0.55, aw * 0.42, 7, crown);
        branch(ctx, r, ax + aw * 0.1, ay - ah + 4, ch * 0.1, UP + 0.45, aw * 0.42, 7, crown);
        branch(ctx, r, ax, ay - ah + 4, ch * 0.08, UP, aw * 0.36, 6, crown);
        // carve the hollow
        const hx = ax + aw * 0.05;
        const hy = ay - ah * 0.33;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.ellipse(hx, hy, aw * 0.22, aw * 0.42, 0.05, 0, TAU);
        ctx.fill();
        ctx.restore();
        scene.glows.push({ type: 'hollow', x: hx, y: hy, rx: aw * 0.22, ry: aw * 0.42, phase: 0 });

        // glowing mushrooms near its roots
        for (let i = 0; i < 7; i++) {
            const mx = ax + (r() - 0.5) * cw * 0.09;
            const my = ground(mx) + 3;
            const s = 6 + r() * 9;
            mushroom(ctx, mx, my, s, (r() - 0.5) * 0.4);
            scene.glows.push({ type: 'shroom', x: mx, y: my - s, r: s * 0.6, phase: r() * TAU });
        }

        grass(ctx, r, 0, cw, ground, 4, 14, 0.5);
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(layers.near, cw, ch);
        const r = mulberry32(777);
        const col = '#020403';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        // two giant trunks framing the clearing
        const trunk = (x, w, lean) => {
            ctx.beginPath();
            ctx.moveTo(x - w * 0.8, ch + 4);
            const steps = 14;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                ctx.lineTo(x - w / 2 + lean * t + Math.sin(t * 9 + x) * 4 + (r() - 0.5) * 3, ch - ch * 1.06 * t);
            }
            for (let i = steps; i >= 0; i--) {
                const t = i / steps;
                ctx.lineTo(x + w / 2 + lean * t + Math.sin(t * 7 + x) * 4 + (r() - 0.5) * 3, ch - ch * 1.06 * t);
            }
            ctx.lineTo(x + w * 0.9, ch + 4);
            ctx.closePath();
            ctx.fill();
            roots(ctx, r, x, ch - 6, w * 0.7, col);
        };
        const lw = Math.max(70, cw * 0.075);
        trunk(cw * 0.012, lw, cw * 0.02);
        trunk(cw * 0.99, lw * 0.75, -cw * 0.015);

        const canopy = {
            gnarl: 0.8, spread: 0.55, minW: 1, leaf: 13, split3: 0.35, lift: 0.1, decay: 0.74,
            mossy: { chance: 0.5, minW: 1.5, maxW: 14, len: ch * 0.07 },
        };
        const reach = Math.max(cw, ch * 1.4);
        branch(ctx, r, cw * 0.03, ch * 0.16, reach * 0.085, -0.42, lw * 0.4, 7, { ...canopy, decay: 0.8, towards: 0, lift: 0.04 });
        branch(ctx, r, cw * 0.03, ch * 0.05, reach * 0.09, -0.15, lw * 0.3, 7, { ...canopy, decay: 0.8, towards: 0, lift: 0.05 });
        branch(ctx, r, cw * 0.04, ch * 0.42, reach * 0.05, -0.12, lw * 0.22, 6, { ...canopy, leaf: 9, decay: 0.78 });
        branch(ctx, r, cw * 0.975, ch * 0.22, reach * 0.06, Math.PI + 0.35, lw * 0.28, 7, { ...canopy, leaf: 11, decay: 0.8, towards: Math.PI, lift: 0.04 });
        branch(ctx, r, cw * 0.98, ch * 0.04, reach * 0.06, Math.PI + 0.1, lw * 0.24, 6, { ...canopy, leaf: 11, decay: 0.8, towards: Math.PI, lift: 0.05 });

        // leaf mass hugging the top edge: a ragged arch, heavy left, lighter right
        for (let i = 0; i < 260; i++) {
            const t = Math.pow(r(), 1.5);
            const left = r() < 0.68;
            const x = left ? t * cw * 0.5 : cw - t * cw * 0.3;
            const y = r() * ch * 0.13 * Math.pow(1 - t, 1.4) - ch * 0.015;
            clump(ctx, r, x, y, 8 + r() * 18 * (1 - t * 0.5));
        }
        // hanging vines and moss
        for (let i = 0; i < 26; i++) {
            const x = r() < 0.7 ? r() * cw * 0.36 : cw - r() * cw * 0.16;
            const len = ch * (0.05 + r() * 0.2);
            mossStrand(ctx, r, x, ch * 0.03 + r() * ch * 0.04, len);
            // a few tiny leaves along the vine
            for (let k = 0; k < 5; k++) {
                const ly = ch * 0.05 + (k / 5) * len;
                ctx.beginPath();
                ctx.ellipse(x + (r() - 0.5) * 6, ly, 2.2, 4, r() * 2, 0, TAU);
                ctx.fill();
            }
        }

        // foreground ferns and grass, rising from the bottom
        const floor = wave(r, ch * 0.985, [[ch * 0.008, 0.01], [ch * 0.004, 0.04]]);
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 8) ctx.lineTo(x, floor(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
        grass(ctx, r, 0, cw, floor, 6, ch * 0.05, 0.35);
        for (let x = -20; x < cw + 20; x += 34 + r() * 60) {
            const n = 3 + ((r() * 3) | 0);
            const big = x < cw * 0.22 || x > cw * 0.8 ? 1.5 : 0.8;
            for (let k = 0; k < n; k++) {
                const side = k % 2 ? 1 : -1;
                fern(ctx, r, x, floor(x) + 4, ch * (0.07 + r() * 0.08) * big, UP + side * (0.35 + r() * 0.7), side * (0.035 + r() * 0.03));
            }
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
        g.addColorStop(0, 'rgba(245,255,215,1)');
        g.addColorStop(0.12, 'rgba(215,255,170,0.85)');
        g.addColorStop(0.35, 'rgba(160,240,150,0.22)');
        g.addColorStop(1, 'rgba(120,220,140,0)');
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
            y: y ?? ch * (0.38 + Math.random() * 0.55),
            a: Math.random() * TAU,
            v: 0.25 + Math.random() * 0.45,
            size: 14 + Math.random() * 20,
            blink: 0.6 + Math.random() * 1.6,
            phase: Math.random() * TAU,
            life: burst ? 1 : Infinity,
            burst: !!burst,
            vx: burst ? (Math.random() - 0.5) * 6 : 0,
            vy: burst ? (Math.random() - 0.8) * 6 : 0,
        };
    }

    function seedFireflies() {
        flies = Array.from({ length: 34 }, () => makeFly());
    }

    function targetFlyCount() {
        return state.playing ? 82 : 34;
    }

    function drawRune(g, t) {
        let a = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.0007 + g.phase));
        if (state.playing) {
            // a wave of light travels across the stones in time with the "beat"
            const wavePos = (t * 0.00035) % 1;
            const pos = (g.order - scene.cw * 0.08) / (scene.cw * 0.16);
            const d = Math.abs(wavePos - pos);
            a += 0.35 + 0.5 * Math.max(0, 1 - d * 5) + state.beat * 0.25;
        }
        a *= state.glowGain;
        fx.save();
        fx.strokeStyle = `rgba(190,255,210,${clamp(a, 0, 1)})`;
        fx.shadowColor = 'rgba(120,255,170,0.95)';
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
                inner.addColorStop(0, `rgba(230,255,200,${clamp(a * state.glowGain, 0, 1)})`);
                inner.addColorStop(1, 'rgba(120,220,150,0)');
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

    function updateFlies(dt, t) {
        const { cw, ch } = scene;
        const want = targetFlyCount();
        const resident = flies.filter((f) => !f.burst).length;
        if (resident < want && Math.random() < 0.3) flies.push(makeFly());
        if (resident > want && Math.random() < 0.05) {
            const i = flies.findIndex((f) => !f.burst);
            if (i >= 0) flies.splice(i, 1);
        }

        const p = state.pointer;
        // pointer in fx-canvas coordinates (canvas is overscanned and parallax-shifted)
        const px = p.x + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const py = p.y + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;

        fx.globalCompositeOperation = 'lighter';
        for (let i = flies.length - 1; i >= 0; i--) {
            const f = flies[i];
            f.a += (Math.sin(t * 0.0011 + f.phase * 3) * 0.06) + (Math.random() - 0.5) * 0.18;
            let vx = Math.cos(f.a) * f.v + f.vx;
            let vy = Math.sin(f.a) * f.v * 0.7 + f.vy;
            f.vx *= 0.94;
            f.vy *= 0.94;

            if (p.active) {
                const dx = px - f.x;
                const dy = py - f.y;
                const d = Math.hypot(dx, dy);
                if (d < 280 && d > 1) {
                    // drawn toward the cursor, but they orbit rather than land
                    const pull = (1 - d / 280) * 0.9;
                    vx += (dx / d) * pull - (dy / d) * pull * 0.8;
                    vy += (dy / d) * pull + (dx / d) * pull * 0.8;
                }
            }
            // keep them in the lower, misty part of the scene
            if (f.y < ch * 0.3) vy += 0.15;
            if (f.y > ch * 0.98) vy -= 0.2;

            f.x += vx * dt;
            f.y += vy * dt;
            if (f.x < -40) f.x = cw + 40;
            if (f.x > cw + 40) f.x = -40;

            if (f.burst) {
                f.life -= 0.0028 * dt;
                if (f.life <= 0) {
                    flies.splice(i, 1);
                    continue;
                }
            }

            const blink = Math.pow(Math.max(0, Math.sin(t * 0.001 * f.blink + f.phase)), 2.5);
            const alpha = clamp((0.12 + blink * 1.0) * state.glowGain * (f.burst ? Math.min(1, f.life * 2) : 1), 0, 1);
            const s = f.size * (0.6 + blink * 0.5);
            fx.globalAlpha = alpha;
            fx.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s);
        }
        fx.globalAlpha = 1;
        fx.globalCompositeOperation = 'source-over';
    }

    function burst(clientX, clientY) {
        const x = clientX + window.innerWidth * OVERSCAN - state.parallax.x * 0.5;
        const y = clientY + window.innerHeight * OVERSCAN - state.parallax.y * 0.5;
        for (let i = 0; i < 16; i++) flies.push(makeFly(x, y, true));
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

        // a pressed fern, faintly embossed into the page
        ctx.save();
        ctx.globalAlpha = 0.09;
        ctx.strokeStyle = '#000';
        fern(ctx, r, W * 0.97, H * 0.98, H * 0.9, UP - 0.55, -0.012);
        ctx.globalAlpha = 0.07;
        ctx.strokeStyle = '#fff';
        ctx.translate(-1, -1);
        fern(ctx, mulberry32(2024 + 1), W * 0.97, H * 0.98, H * 0.9, UP - 0.55, -0.012);
        ctx.restore();

        // lichen colonies creeping in from the edges
        const colony = (cx, cy, rad, tone) => {
            for (let i = 0; i < 90; i++) {
                const a = r() * TAU;
                const d = Math.pow(r(), 0.7) * rad;
                const s = (1 - d / rad) * (1.2 + r() * 2.8);
                ctx.fillStyle = tone(r());
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, s, 0, TAU);
                ctx.fill();
            }
        };
        const pale = (v) => `rgba(${200 + v * 30},${210 + v * 20},${150 + v * 30},${0.18 + v * 0.2})`;
        const dark = (v) => `rgba(${30 + v * 20},${45 + v * 20},${28},${0.12 + v * 0.18})`;
        colony(W * 0.97, H * 0.06, 34, pale);
        colony(W * 0.02, H * 0.6, 26, pale);
        colony(W * 0.55, H * 0.985, 30, dark);
        colony(W * 0.96, H * 0.7, 18, dark);
        colony(W * 0.3, H * 0.02, 16, pale);

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
        { title: 'Beneath the Elder Oak', artist: 'Wardens of the Fen', scene: 'oak', seed: 11, duration: 412 },
        { title: 'Lanterns in the Bracken', artist: 'Hollow Choir', scene: 'lanterns', seed: 23, duration: 356 },
        { title: 'The Ring of Nine Stones', artist: 'Moss & Ember', scene: 'stones', seed: 47, duration: 498 },
        { title: 'Where the Fungus Glows', artist: 'Old Thorn Circle', scene: 'shrooms', seed: 61, duration: 333 },
        { title: 'Owl-Light Procession', artist: 'The Barrow Lanterns', scene: 'owl', seed: 83, duration: 447 },
    ];
    const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

    function paintCoverScene(x, S, track) {
        const r = mulberry32(track.seed);
        const sky = x.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, '#141414');
        sky.addColorStop(0.5, '#5a5a5a');
        sky.addColorStop(0.75, '#a8a8a8');
        sky.addColorStop(1, '#cfcfcf');
        x.fillStyle = sky;
        x.fillRect(0, 0, S, S);

        for (let i = 0; i < 110; i++) {
            x.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`;
            const s = r() < 0.9 ? 1.2 : 2.4;
            x.fillRect(r() * S, Math.pow(r(), 1.4) * S * 0.55, s, s);
        }

        const mx = S * (0.3 + r() * 0.4);
        const my = S * (0.2 + r() * 0.08);
        const mr = S * (0.09 + r() * 0.05);
        const halo = x.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.4);
        halo.addColorStop(0, 'rgba(255,255,255,0.55)');
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = halo;
        x.fillRect(0, 0, S, S);
        x.fillStyle = '#f4f4f4';
        x.beginPath();
        x.arc(mx, my, mr, 0, TAU);
        x.fill();
        for (let i = 0; i < 7; i++) {
            x.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
            x.beginPath();
            x.arc(mx + (r() - 0.5) * mr * 1.2, my + (r() - 0.5) * mr * 1.2, mr * (0.08 + r() * 0.18), 0, TAU);
            x.fill();
        }

        const mist = (y, a) => {
            const g = x.createLinearGradient(0, y - S * 0.12, 0, y + S * 0.08);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.6, `rgba(255,255,255,${a})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(0, y - S * 0.12, S, S * 0.2);
        };

        const ridge = (y, col, hMin, hMax) => {
            x.fillStyle = col;
            const hill = wave(r, y, [[S * 0.02, 0.02], [S * 0.01, 0.05]]);
            x.beginPath();
            x.moveTo(0, S);
            for (let i = 0; i <= S; i += 4) x.lineTo(i, hill(i));
            x.lineTo(S, S);
            x.fill();
            for (let i = -5; i < S + 5; i += 4 + r() * 7) {
                const h = hMin + r() * (hMax - hMin);
                pine(x, r, i, hill(i) + 2, h, h * 0.32);
            }
            return hill;
        };

        const ink = '#0a0a0a';
        switch (track.scene) {
            case 'oak': {
                ridge(S * 0.72, '#6e6e6e', S * 0.04, S * 0.08);
                mist(S * 0.74, 0.5);
                const ground = ridge(S * 0.86, '#2a2a2a', S * 0.03, S * 0.06);
                mist(S * 0.88, 0.35);
                x.fillStyle = x.strokeStyle = ink;
                x.lineCap = 'round';
                x.beginPath();
                x.ellipse(S * 0.5, S * 0.93, S * 0.5, S * 0.06, 0, Math.PI, TAU);
                x.fill();
                x.fillRect(0, S * 0.92, S, S * 0.1);
                roots(x, r, S * 0.5, S * 0.9, S * 0.04, ink);
                branch(x, r, S * 0.5, S * 0.91, S * 0.19, UP, S * 0.06, 8, {
                    gnarl: 0.9, spread: 0.7, minW: 0.7, leaf: S * 0.018, split3: 0.4, lift: 0.0, decay: 0.73,
                    mossy: { chance: 0.4, minW: 1, maxW: 8, len: S * 0.05 },
                });
                void ground;
                break;
            }
            case 'lanterns': {
                ridge(S * 0.7, '#7a7a7a', S * 0.05, S * 0.1);
                mist(S * 0.72, 0.55);
                // an avenue of trees converging on a path
                x.fillStyle = x.strokeStyle = ink;
                x.lineCap = 'round';
                for (let k = 0; k < 6; k++) {
                    const t = k / 5;
                    const yy = lerp(S * 0.74, S * 1.02, t);
                    const spread = lerp(S * 0.1, S * 0.5, t);
                    const h = lerp(S * 0.12, S * 0.55, t);
                    for (const side of [-1, 1]) {
                        const xx = S / 2 + side * spread;
                        x.fillStyle = x.strokeStyle = `rgb(${lerp(90, 10, t)},${lerp(90, 10, t)},${lerp(90, 10, t)})`;
                        pine(x, r, xx, yy, h, h * 0.3);
                    }
                }
                x.fillStyle = '#1a1a1a';
                x.beginPath();
                x.moveTo(S * 0.47, S * 0.74);
                x.lineTo(S * 0.53, S * 0.74);
                x.lineTo(S * 0.85, S);
                x.lineTo(S * 0.15, S);
                x.closePath();
                x.fill();
                for (let k = 0; k < 7; k++) {
                    const t = k / 6;
                    const yy = lerp(S * 0.76, S * 0.95, t * t);
                    const xx = S / 2 + (k % 2 ? 1 : -1) * lerp(S * 0.03, S * 0.26, t * t);
                    const g = x.createRadialGradient(xx, yy, 0, xx, yy, lerp(8, 30, t));
                    g.addColorStop(0, 'rgba(255,255,255,1)');
                    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    x.fillStyle = g;
                    x.fillRect(xx - 40, yy - 40, 80, 80);
                }
                break;
            }
            case 'stones': {
                ridge(S * 0.7, '#6a6a6a', S * 0.04, S * 0.09);
                mist(S * 0.75, 0.6);
                x.fillStyle = '#1c1c1c';
                x.beginPath();
                x.ellipse(S * 0.5, S * 1.02, S * 0.7, S * 0.2, 0, Math.PI, TAU);
                x.fill();
                const n = 9;
                const list = [];
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * TAU + 0.2;
                    const d = Math.sin(a);
                    const sc = lerp(0.55, 1.15, (d + 1) / 2);
                    list.push({ x: S * 0.5 + Math.cos(a) * S * 0.36, y: S * 0.86 + d * S * 0.06, s: sc, d });
                }
                list.sort((a, b) => a.d - b.d).forEach((st) => {
                    const v = Math.round(lerp(60, 8, (st.d + 1) / 2));
                    x.fillStyle = `rgb(${v},${v},${v})`;
                    stone(x, st.x, st.y, S * 0.08 * st.s, S * 0.2 * st.s, (r() - 0.5) * 0.12);
                    if (st.d > 0.2) {
                        x.strokeStyle = 'rgba(255,255,255,0.9)';
                        x.lineWidth = 2;
                        const gl = RUNES[(r() * RUNES.length) | 0];
                        const gw = S * 0.03 * st.s;
                        const gh = S * 0.07 * st.s;
                        const gx = st.x - gw / 2;
                        const gy = st.y - S * 0.16 * st.s;
                        x.beginPath();
                        gl.forEach(([x1, y1, x2, y2]) => {
                            x.moveTo(gx + x1 * gw, gy + y1 * gh);
                            x.lineTo(gx + x2 * gw, gy + y2 * gh);
                        });
                        x.stroke();
                    }
                });
                mist(S * 0.98, 0.3);
                break;
            }
            case 'shrooms': {
                ridge(S * 0.66, '#5e5e5e', S * 0.05, S * 0.1);
                mist(S * 0.7, 0.5);
                x.fillStyle = '#111';
                x.fillRect(0, S * 0.9, S, S * 0.1);
                const caps = [[0.3, 0.92, 0.32], [0.62, 0.93, 0.44], [0.82, 0.94, 0.2], [0.14, 0.95, 0.16], [0.47, 0.96, 0.14]];
                caps.forEach(([cx, cy, s]) => {
                    const px = S * cx;
                    const py = S * cy;
                    const sz = S * s;
                    x.fillStyle = '#0c0c0c';
                    x.beginPath();
                    x.moveTo(px - sz * 0.08, py);
                    x.quadraticCurveTo(px - sz * 0.02, py - sz * 0.5, px - sz * 0.06, py - sz * 0.9);
                    x.lineTo(px + sz * 0.06, py - sz * 0.9);
                    x.quadraticCurveTo(px + sz * 0.02, py - sz * 0.5, px + sz * 0.1, py);
                    x.fill();
                    const g = x.createRadialGradient(px, py - sz * 0.95, 0, px, py - sz * 0.95, sz * 0.9);
                    g.addColorStop(0, 'rgba(255,255,255,0.35)');
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    x.fillStyle = g;
                    x.fillRect(px - sz, py - sz * 1.9, sz * 2, sz * 2);
                    x.fillStyle = '#1a1a1a';
                    x.beginPath();
                    x.ellipse(px, py - sz * 0.9, sz * 0.48, sz * 0.32, 0, Math.PI, TAU);
                    x.fill();
                    x.fillStyle = '#eee';
                    for (let k = 0; k < 7; k++) {
                        const a = Math.PI + r() * Math.PI;
                        const d = r() * 0.8;
                        x.beginPath();
                        x.arc(px + Math.cos(a) * sz * 0.42 * d, py - sz * 0.9 + Math.sin(a) * sz * 0.26 * d, sz * (0.025 + r() * 0.03), 0, TAU);
                        x.fill();
                    }
                });
                for (let i = 0; i < 30; i++) {
                    const fx2 = r() * S;
                    const fy2 = S * (0.45 + r() * 0.45);
                    const g = x.createRadialGradient(fx2, fy2, 0, fx2, fy2, 7);
                    g.addColorStop(0, 'rgba(255,255,255,1)');
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    x.fillStyle = g;
                    x.fillRect(fx2 - 8, fy2 - 8, 16, 16);
                }
                break;
            }
            case 'owl':
            default: {
                ridge(S * 0.74, '#707070', S * 0.04, S * 0.09);
                mist(S * 0.78, 0.55);
                x.fillStyle = x.strokeStyle = ink;
                x.lineCap = 'round';
                x.fillRect(0, S * 0.94, S, S * 0.1);
                // dead branch reaching in from the left
                branch(x, r, -S * 0.05, S * 0.66, S * 0.36, -0.12, S * 0.05, 5, {
                    gnarl: 0.8, spread: 0.6, minW: 0.8, leaf: 0, split3: 0.3, lift: 0.12, decay: 0.68,
                });
                // the owl
                const ox = S * 0.36;
                const oy = S * 0.6;
                const os = S * 0.11;
                x.beginPath();
                x.ellipse(ox, oy, os * 0.62, os, 0, 0, TAU);
                x.fill();
                x.beginPath();
                x.ellipse(ox, oy - os * 1.05, os * 0.55, os * 0.5, 0, 0, TAU);
                x.fill();
                x.beginPath();
                x.moveTo(ox - os * 0.5, oy - os * 1.2);
                x.lineTo(ox - os * 0.42, oy - os * 1.75);
                x.lineTo(ox - os * 0.18, oy - os * 1.35);
                x.moveTo(ox + os * 0.5, oy - os * 1.2);
                x.lineTo(ox + os * 0.42, oy - os * 1.75);
                x.lineTo(ox + os * 0.18, oy - os * 1.35);
                x.fill();
                x.fillStyle = '#fff';
                [-1, 1].forEach((side) => {
                    x.beginPath();
                    x.arc(ox + side * os * 0.22, oy - os * 1.05, os * 0.15, 0, TAU);
                    x.fill();
                });
                x.fillStyle = ink;
                [-1, 1].forEach((side) => {
                    x.beginPath();
                    x.arc(ox + side * os * 0.22, oy - os * 1.03, os * 0.06, 0, TAU);
                    x.fill();
                });
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
        ui.kicker.innerHTML = `Leaf ${ROMAN[player.index]} &middot; of ${ROMAN[TRACKS.length - 1]}`;
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
