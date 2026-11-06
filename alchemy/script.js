/*
 * The Athanor Grimoire
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

    const ACC = '255,120,215';

    function books(ctx, r, x0, x1, yBase, hMax, palette) {
        let x = x0;
        while (x < x1) {
            const w = 4 + r() * 9;
            if (x + w > x1) break;
            const h = hMax * (0.55 + r() * 0.43);
            ctx.fillStyle = palette[(r() * palette.length) | 0];
            if (r() < 0.07) {
                ctx.save();
                ctx.translate(x, yBase);
                ctx.rotate(-0.28);
                ctx.fillRect(0, -h, w, h);
                ctx.restore();
                x += w + h * 0.3;
                continue;
            }
            ctx.fillRect(x, yBase - h, w, h);
            if (r() < 0.45) {
                ctx.fillStyle = 'rgba(255,240,255,0.035)';
                ctx.fillRect(x + 1, yBase - h * 0.82, w - 2, 1.5);
                ctx.fillRect(x + 1, yBase - h * 0.22, w - 2, 1.5);
            }
            x += w + (r() < 0.1 ? 6 + r() * 16 : 0.7);
        }
    }

    function bookshelf(ctx, r, x0, x1, y0, y1, rows, frameCol, palette) {
        ctx.fillStyle = frameCol;
        ctx.fillRect(x0 - 7, y0 - 10, x1 - x0 + 14, y1 - y0 + 10);
        const rh = (y1 - y0) / rows;
        for (let i = 0; i < rows; i++) {
            const yb = y0 + rh * (i + 1);
            ctx.fillStyle = '#060407';
            ctx.fillRect(x0, yb - rh + 4, x1 - x0, rh - 4);
            books(ctx, r, x0 + 2, x1 - 2, yb - 3, rh - 10, palette);
            ctx.fillStyle = frameCol;
            ctx.fillRect(x0 - 7, yb - 4, x1 - x0 + 14, 5);
        }
        ctx.fillRect(x0 - 14, y0 - 20, x1 - x0 + 28, 11);
    }

    function archPath(ctx, x0, x1, top, bottom) {
        const rad = (x1 - x0) / 2;
        ctx.beginPath();
        ctx.moveTo(x0, bottom);
        ctx.lineTo(x0, top + rad);
        ctx.quadraticCurveTo(x0, top + rad * 0.12, (x0 + x1) / 2, top);
        ctx.quadraticCurveTo(x1, top + rad * 0.12, x1, top + rad);
        ctx.lineTo(x1, bottom);
        ctx.closePath();
    }

    function flask(ctx, kind, x, y, s) {
        ctx.beginPath();
        if (kind === 'round') {
            ctx.moveTo(x + s * 0.55, y - s * 0.55);
            ctx.arc(x, y - s * 0.55, s * 0.55, 0, TAU);
            ctx.rect(x - s * 0.12, y - s * 1.6, s * 0.24, s * 0.75);
        } else if (kind === 'cone') {
            ctx.moveTo(x - s * 0.55, y);
            ctx.lineTo(x - s * 0.13, y - s * 0.9);
            ctx.lineTo(x - s * 0.13, y - s * 1.4);
            ctx.lineTo(x + s * 0.13, y - s * 1.4);
            ctx.lineTo(x + s * 0.13, y - s * 0.9);
            ctx.lineTo(x + s * 0.55, y);
            ctx.closePath();
        } else if (kind === 'tube') {
            ctx.rect(x - s * 0.13, y - s * 1.5, s * 0.26, s * 1.5);
        } else {
            ctx.moveTo(x + s * 0.7, y - s * 0.6);
            ctx.ellipse(x, y - s * 0.6, s * 0.7, s * 0.6, 0, 0, TAU);
            ctx.rect(x - s * 0.15, y - s * 1.55, s * 0.3, s * 0.6);
            ctx.moveTo(x + s * 0.35, y - s * 1.6);
            ctx.ellipse(x, y - s * 1.6, s * 0.35, s * 0.24, 0, 0, TAU);
            ctx.moveTo(x + s * 0.2, y - s * 1.68);
            ctx.lineTo(x + s * 1.7, y - s * 0.95);
            ctx.lineTo(x + s * 1.7, y - s * 0.86);
            ctx.lineTo(x + s * 0.2, y - s * 1.48);
            ctx.closePath();
        }
        ctx.fill();
    }

    function table(ctx, x0, x1, y, ch) {
        ctx.fillRect(x0, y, x1 - x0, 10);
        ctx.fillRect(x0 + 10, y + 10, 9, ch - y);
        ctx.fillRect(x1 - 19, y + 10, 9, ch - y);
        ctx.fillRect(x0 + 10, y + (ch - y) * 0.6, x1 - x0 - 20, 6);
    }

    const WIN = { x0: 0.6, x1: 0.8, top: 0.08, bottom: 0.52 };

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(layers.far, cw, ch);
        const r = mulberry32(1307);
        ctx.fillStyle = '#110c13';
        ctx.fillRect(0, 0, cw, ch);

        // ashlar courses
        ctx.strokeStyle = 'rgba(255,240,255,0.03)';
        ctx.lineWidth = 1;
        const course = ch * 0.045;
        for (let y = 0, row = 0; y < ch * 0.82; y += course, row++) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(cw, y);
            for (let x = (row % 2) * course * 1.1; x < cw; x += course * 2.2) {
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + course);
            }
            ctx.stroke();
        }

        // tall lancet window, cut through so the sky shows
        const x0 = cw * WIN.x0;
        const x1 = cw * WIN.x1;
        const top = ch * WIN.top;
        const bottom = ch * WIN.bottom;
        ctx.fillStyle = '#070508';
        archPath(ctx, x0 - 16, x1 + 16, top - 16, bottom + 10);
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        archPath(ctx, x0, x1, top, bottom);
        ctx.fill();
        ctx.restore();
        ctx.save();
        archPath(ctx, x0, x1, top, bottom);
        ctx.clip();
        ctx.strokeStyle = '#070508';
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 0.7;
        const step = (x1 - x0) / 6;
        ctx.beginPath();
        for (let k = -14; k < 26; k++) {
            ctx.moveTo(x0 + k * step, top);
            ctx.lineTo(x0 + k * step + (bottom - top), bottom);
            ctx.moveTo(x0 + k * step, top);
            ctx.lineTo(x0 + k * step - (bottom - top), bottom);
        }
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = '#070508';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo((x0 + x1) / 2, top);
        ctx.lineTo((x0 + x1) / 2, bottom);
        ctx.moveTo(x0, top + (bottom - top) * 0.45);
        ctx.lineTo(x1, top + (bottom - top) * 0.45);
        ctx.stroke();
        ctx.fillStyle = '#1b141d';
        ctx.fillRect(x0 - 26, bottom + 4, x1 - x0 + 52, 10);

        // towering shelves
        const pal = ['#1d1620', '#171119', '#231a27', '#130e15', '#1f1722'];
        bookshelf(ctx, r, cw * 0.035, cw * 0.4, ch * 0.13, ch * 0.8, 7, '#1a131c', pal);
        bookshelf(ctx, r, cw * 0.85, cw * 1.03, ch * 0.16, ch * 0.8, 6, '#1a131c', pal);
        // jars on the window sill
        ctx.fillStyle = '#140f16';
        for (let i = 0; i < 4; i++) {
            const jx = x0 + 10 + i * (x1 - x0) / 4 + r() * 10;
            ctx.fillRect(jx, bottom - 18 - r() * 10, 12 + r() * 6, 30);
        }

        // floor boards in perspective
        const fy = ch * 0.8;
        const g = ctx.createLinearGradient(0, fy, 0, ch);
        g.addColorStop(0, '#0e0a0f');
        g.addColorStop(1, '#050306');
        ctx.fillStyle = g;
        ctx.fillRect(0, fy, cw, ch - fy);
        ctx.strokeStyle = 'rgba(255,240,255,0.035)';
        ctx.lineWidth = 1;
        for (let k = -24; k <= 24; k++) {
            ctx.beginPath();
            ctx.moveTo(cw / 2 + k * cw * 0.03, fy);
            ctx.lineTo(cw / 2 + k * cw * 0.12, ch);
            ctx.stroke();
        }
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(layers.mid, cw, ch);
        const r = mulberry32(4242);
        const col = '#09060a';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        const k = ch / 900;

        // left workbench: orrery, tomes, skull, candles
        const ly = ch * 0.72;
        table(ctx, cw * 0.03, cw * 0.33, ly, ch);
        for (let i = 0; i < 5; i++) ctx.fillRect(cw * 0.245 + (r() - 0.5) * 8, ly - (i + 1) * 9 * k - 2, cw * 0.06 - i * 4, 8 * k + 1);
        const sx = cw * 0.29;
        const sy = ly - 46 * k - 4;
        ctx.beginPath();
        ctx.arc(sx, sy - 12 * k, 14 * k + 2, 0, TAU);
        ctx.fill();
        ctx.fillRect(sx - 8 * k, sy - 4 * k, 16 * k, 10 * k);
        const ox = cw * 0.15;
        const oy = ly - ch * 0.17;
        ctx.beginPath();
        ctx.moveTo(ox - 32, ly);
        ctx.lineTo(ox + 32, ly);
        ctx.lineTo(ox + 7, ly - 16);
        ctx.lineTo(ox - 7, ly - 16);
        ctx.fill();
        ctx.fillRect(ox - 3, oy, 6, ly - oy);
        scene.orrery = { x: ox, y: oy, R: ch * 0.12 };
        [[0.06, 34], [0.075, 54], [0.32, 26]].forEach(([fx, h]) => {
            const x = cw * fx;
            const hh = h * k + 6;
            ctx.fillRect(x - 4, ly - hh, 8, hh);
            scene.glows.push({ type: 'candle', x, y: ly - hh - 7, phase: r() * TAU, s: 1 });
        });

        // right bench: alembic and flasks with glowing tinctures
        const ry = ch * 0.74;
        table(ctx, cw * 0.67, cw * 0.99, ry, ch);
        [['alembic', 0.71, 34], ['round', 0.8, 24], ['cone', 0.85, 26], ['tube', 0.885, 20], ['tube', 0.9, 24], ['round', 0.94, 18], ['cone', 0.965, 16]]
            .forEach(([kind, fx, s]) => {
                const x = cw * fx;
                const S = s * k + 6;
                flask(ctx, kind, x, ry, S);
                scene.glows.push({ type: 'flask', kind, x, y: ry, s: S, phase: r() * TAU });
            });

        // floor candles, big and dripping
        const fy = ch * 0.97;
        [[0.86, 0.15], [0.885, 0.1], [0.905, 0.065], [0.06, 0.08], [0.08, 0.12]].forEach(([fx, h]) => {
            const x = cw * fx;
            const hh = ch * h;
            ctx.fillRect(x - 9, fy - hh, 18, hh);
            ctx.beginPath();
            ctx.ellipse(x, fy - hh, 9, 3, 0, 0, TAU);
            ctx.fill();
            scene.glows.push({ type: 'candle', x, y: fy - hh - 11, phase: r() * TAU, s: 1.6 });
        });

        scene.circle = { x: cw * 0.5, y: ch * 0.9, rx: cw * 0.34, ry: ch * 0.075 };
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(layers.near, cw, ch);
        const r = mulberry32(777);
        const col = '#030204';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        const beam = ch * 0.045;
        ctx.fillRect(0, 0, cw, beam);
        ctx.fillRect(0, beam, cw, 6);
        ctx.fillRect(0, 0, cw * 0.035, ch);
        ctx.fillRect(cw * 0.972, 0, cw * 0.04, ch);
        // corbels
        for (const x of [cw * 0.035, cw * 0.972]) {
            ctx.beginPath();
            ctx.moveTo(x, beam);
            ctx.lineTo(x + (x < cw / 2 ? 40 : -40), beam);
            ctx.lineTo(x, beam + 60);
            ctx.fill();
        }

        // drying herbs
        for (let i = 0; i < 15; i++) {
            const x = r() < 0.6 ? cw * (0.06 + r() * 0.3) : cw * (0.82 + r() * 0.13);
            const len = ch * (0.03 + r() * 0.08);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, beam);
            ctx.lineTo(x, beam + len);
            ctx.stroke();
            const by = beam + len;
            for (let n = 0; n < 14; n++) {
                const a = Math.PI / 2 + (r() - 0.5) * 0.9;
                const l = 18 + r() * 30;
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.moveTo(x, by);
                ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5, by + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, by + Math.sin(a) * l);
                ctx.stroke();
                clump(ctx, r, x + Math.cos(a) * l, by + Math.sin(a) * l, 2.4);
            }
            ctx.fillRect(x - 3, by - 3, 6, 7);
        }

        // the stuffed crocodile, hung on two chains
        const cx = cw * 0.2;
        const cy = ch * 0.19;
        const L = Math.max(170, cw * 0.17);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(cx - L * 0.15, beam);
        ctx.lineTo(cx - L * 0.15, cy - L * 0.04);
        ctx.moveTo(cx + L * 0.15, beam);
        ctx.lineTo(cx + L * 0.15, cy - L * 0.04);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, L * 0.28, L * 0.06, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + L * 0.22, cy - L * 0.045);
        ctx.quadraticCurveTo(cx + L * 0.32, cy - L * 0.055, cx + L * 0.52, cy - L * 0.012);
        ctx.lineTo(cx + L * 0.52, cy + L * 0.012);
        ctx.lineTo(cx + L * 0.22, cy + L * 0.045);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - L * 0.22, cy - L * 0.045);
        ctx.quadraticCurveTo(cx - L * 0.45, cy - L * 0.02, cx - L * 0.62, cy + L * 0.06);
        ctx.quadraticCurveTo(cx - L * 0.42, cy + L * 0.02, cx - L * 0.22, cy + L * 0.05);
        ctx.fill();
        for (let i = -6; i < 8; i++) {
            const px = cx + i * L * 0.04;
            ctx.beginPath();
            ctx.moveTo(px - 4, cy - L * 0.05);
            ctx.lineTo(px, cy - L * 0.075);
            ctx.lineTo(px + 4, cy - L * 0.05);
            ctx.fill();
        }
        ctx.lineWidth = 4;
        [[-0.16, -1], [0.14, 1]].forEach(([dx, s]) => {
            for (const off of [-0.03, 0.03]) {
                ctx.beginPath();
                ctx.moveTo(cx + L * (dx + off), cy + L * 0.04);
                ctx.lineTo(cx + L * (dx + off) + s * 8, cy + L * 0.1);
                ctx.lineTo(cx + L * (dx + off) + s * 14, cy + L * 0.1);
                ctx.stroke();
            }
        });

        // a hanging censer-lamp, right
        const lx = cw * 0.9;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx, beam);
        ctx.lineTo(lx, ch * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lx - 16, ch * 0.2);
        ctx.lineTo(lx + 16, ch * 0.2);
        ctx.lineTo(lx + 10, ch * 0.25);
        ctx.lineTo(lx - 10, ch * 0.25);
        ctx.fill();

        // foreground clutter
        const fy = ch * 0.988;
        ctx.fillRect(0, fy, cw, ch - fy);
        for (let i = 0; i < 3; i++) ctx.fillRect(cw * 0.12 + i * 5, fy - (i + 1) * 15, cw * 0.08 - i * 12, 14);
        ctx.beginPath();
        ctx.ellipse(cw * 0.78, fy, cw * 0.05, 14, 0, Math.PI, TAU);
        ctx.fill();
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
                `<feColorMatrix values='0 0 0 0 0.9  0 0 0 0 0.84  0 0 0 0 0.92  ${gain} 0 0 0 ${cut}'/>` +
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
        g.addColorStop(0, 'rgba(255,245,252,1)');
        g.addColorStop(0.12, 'rgba(255,160,230,0.85)');
        g.addColorStop(0.35, 'rgba(235,90,200,0.22)');
        g.addColorStop(1, 'rgba(200,60,180,0)');
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
            y: y ?? ch * (0.1 + Math.random() * 0.85),
            a: Math.random() * TAU,
            v: 0.25 + Math.random() * 0.45,
            size: 7 + Math.random() * 12,
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
        return state.playing ? 90 : 45;
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

    const flame = document.createElement('canvas');
    flame.width = flame.height = 64;
    (() => {
        const s = flame.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,248,235,1)');
        g.addColorStop(0.15, 'rgba(255,225,200,0.6)');
        g.addColorStop(0.45, 'rgba(255,190,200,0.12)');
        g.addColorStop(1, 'rgba(255,170,200,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 64, 64);
    })();

    function drawCircle(t) {
        const c = scene.circle;
        if (!c) return;
        const P = state.playing;
        const spin = t * (P ? 0.00032 : 0.00006);
        const a = clamp((0.16 + 0.07 * Math.sin(t * 0.001) + (P ? 0.3 + state.beat * 0.4 : 0)) * state.glowGain, 0, 1);
        fx.save();
        fx.translate(c.x, c.y);
        fx.scale(1, c.ry / c.rx);
        fx.strokeStyle = `rgba(${ACC},${a})`;
        fx.shadowColor = `rgba(${ACC},0.9)`;
        fx.shadowBlur = 14;
        fx.lineWidth = 3;
        const R = c.rx;
        fx.beginPath();
        fx.arc(0, 0, R, 0, TAU);
        fx.moveTo(R * 0.86, 0);
        fx.arc(0, 0, R * 0.86, 0, TAU);
        fx.moveTo(R * 0.32, 0);
        fx.arc(0, 0, R * 0.32, 0, TAU);
        fx.stroke();
        // pentagram
        fx.beginPath();
        for (let i = 0; i <= 5; i++) {
            const ang = -spin + (i * 2 * TAU) / 5 - Math.PI / 2;
            const px = Math.cos(ang) * R * 0.84;
            const py = Math.sin(ang) * R * 0.84;
            if (i === 0) fx.moveTo(px, py);
            else fx.lineTo(px, py);
        }
        fx.stroke();
        // rune ring
        fx.lineWidth = 2.4;
        const n = 22;
        for (let i = 0; i < n; i++) {
            const ang = spin + (i / n) * TAU;
            const g = RUNES[i % RUNES.length];
            const gw = R * 0.05;
            const gh = R * 0.1;
            fx.save();
            fx.rotate(ang);
            fx.translate(R * 0.93, 0);
            fx.rotate(Math.PI / 2);
            fx.beginPath();
            g.forEach(([x1, y1, x2, y2]) => {
                fx.moveTo((x1 - 0.5) * gw, (y1 - 0.5) * gh);
                fx.lineTo((x2 - 0.5) * gw, (y2 - 0.5) * gh);
            });
            fx.stroke();
            fx.restore();
        }
        fx.restore();
    }

    function drawOrrery(t) {
        const o = scene.orrery;
        if (!o) return;
        const P = state.playing;
        const sp = t * (P ? 0.0014 : 0.00022);
        const tilt = -0.28;
        fx.save();
        fx.translate(o.x, o.y);
        fx.lineWidth = 1.1;
        const orbits = [0.32, 0.52, 0.74, 1];
        orbits.forEach((kk, i) => {
            fx.strokeStyle = 'rgba(220,205,225,0.32)';
            fx.beginPath();
            fx.ellipse(0, 0, o.R * kk, o.R * kk * 0.34, tilt, 0, TAU);
            fx.stroke();
            const ang = sp * (1.8 / (i + 1)) + i * 1.9;
            const px = Math.cos(ang) * o.R * kk;
            const py = Math.sin(ang) * o.R * kk * 0.34;
            const rx = px * Math.cos(tilt) - py * Math.sin(tilt);
            const ry = px * Math.sin(tilt) + py * Math.cos(tilt);
            fx.fillStyle = 'rgba(230,215,235,0.85)';
            fx.beginPath();
            fx.arc(rx, ry, 2.4 + i * 0.8, 0, TAU);
            fx.fill();
            if (i === 2) {
                fx.beginPath();
                fx.ellipse(rx, ry, 8, 2.5, tilt, 0, TAU);
                fx.stroke();
            }
        });
        // armillary bands
        fx.strokeStyle = 'rgba(220,205,225,0.18)';
        fx.beginPath();
        fx.ellipse(0, 0, o.R * 0.2, o.R * 1.05, sp * 0.3, 0, TAU);
        fx.stroke();
        fx.globalCompositeOperation = 'lighter';
        const sun = o.R * (0.7 + (P ? state.beat * 0.5 : 0));
        fx.globalAlpha = clamp((0.55 + (P ? 0.35 : 0)) * state.glowGain, 0, 1);
        fx.drawImage(sprite, -sun / 2, -sun / 2, sun, sun);
        fx.restore();
        fx.globalAlpha = 1;
    }

    function drawFlask(g, t) {
        const P = state.playing;
        const s = g.s;
        const lvl = 0.5 + 0.04 * Math.sin(t * 0.002 + g.phase);
        const a = clamp((0.45 + 0.15 * Math.sin(t * 0.0013 + g.phase) + (P ? 0.35 + state.beat * 0.3 : 0)) * state.glowGain, 0, 1);
        fx.save();
        fx.globalCompositeOperation = 'lighter';
        fx.fillStyle = `rgba(${ACC},${a * 0.75})`;
        fx.beginPath();
        if (g.kind === 'round') fx.arc(g.x, g.y - s * 0.55, s * 0.47, 0.15, Math.PI - 0.15);
        else if (g.kind === 'cone') {
            fx.moveTo(g.x - s * 0.5, g.y - 2);
            fx.lineTo(g.x - s * 0.3, g.y - s * lvl);
            fx.lineTo(g.x + s * 0.3, g.y - s * lvl);
            fx.lineTo(g.x + s * 0.5, g.y - 2);
        } else if (g.kind === 'tube') fx.rect(g.x - s * 0.09, g.y - s * lvl * 1.4, s * 0.18, s * lvl * 1.4 - 2);
        else fx.ellipse(g.x, g.y - s * 0.5, s * 0.62, s * 0.42, 0, 0.1, Math.PI - 0.1);
        fx.fill();
        const glow = s * (3.4 + (P ? state.beat * 1.5 : 0));
        fx.globalAlpha = a * 0.6;
        fx.drawImage(sprite, g.x - glow / 2, g.y - s * 0.5 - glow / 2, glow, glow);
        fx.globalAlpha = 1;
        // bubbles
        fx.strokeStyle = `rgba(255,200,240,${a * 0.8})`;
        fx.lineWidth = 1;
        const nb = P ? 4 : 2;
        for (let i = 0; i < nb; i++) {
            const span = s * (g.kind === 'tube' ? 1.4 : 1.1);
            const prog = ((t * 0.00045 * (1 + i * 0.4) + g.phase + i * 0.37) % 1);
            const by = g.y - s * 0.2 - prog * span;
            const bx = g.x + Math.sin(prog * 9 + i) * s * 0.06;
            fx.beginPath();
            fx.arc(bx, by, 1 + i * 0.5, 0, TAU);
            fx.stroke();
        }
        fx.restore();
    }

    function drawGlows(t) {
        drawCircle(t);
        drawOrrery(t);
        for (const g of scene.glows) {
            if (g.type === 'flask') drawFlask(g, t);
            else if (g.type === 'candle') {
                const fl = 0.85 + 0.15 * Math.sin(t * 0.013 + g.phase) * Math.sin(t * 0.007 + g.phase * 2);
                fx.save();
                fx.globalCompositeOperation = 'lighter';
                fx.fillStyle = 'rgba(255,245,230,0.9)';
                fx.beginPath();
                fx.ellipse(g.x, g.y, 2.4 * g.s, 6 * g.s * fl, 0, 0, TAU);
                fx.fill();
                const sz = 70 * g.s * fl;
                fx.globalAlpha = clamp(0.55 * fl * (0.5 + state.glowGain * 0.5), 0, 1);
                fx.drawImage(flame, g.x - sz / 2, g.y - sz / 2, sz, sz);
                fx.restore();
            }
        }
        fx.globalAlpha = 1;
        fx.globalCompositeOperation = 'source-over';
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
            if (f.y < ch * 0.08) vy += 0.15;
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

        // faded marginalia: rows of cramped, illegible script
        ctx.strokeStyle = 'rgba(25,15,10,0.13)';
        ctx.lineWidth = 0.8;
        const block = (x0, y0, w, rows) => {
            for (let i = 0; i < rows; i++) {
                let x = x0;
                const y = y0 + i * 7;
                while (x < x0 + w * (0.7 + r() * 0.3)) {
                    const wl = 4 + r() * 14;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    for (let k = 0; k < wl; k += 2) ctx.lineTo(x + k, y + (k % 4 ? -2 : 0.5));
                    ctx.stroke();
                    x += wl + 3;
                }
            }
        };
        block(W * 0.62, H * 0.06, W * 0.2, 4);
        block(W * 0.06, H * 0.83, W * 0.3, 3);
        block(W * 0.42, H * 0.9, W * 0.3, 2);

        // wax drips and ink blots
        const blot = (x, y, rad, col) => {
            ctx.fillStyle = col;
            ctx.beginPath();
            for (let i = 0; i < 14; i++) {
                const a = r() * TAU;
                const d = r() * rad;
                ctx.moveTo(x + Math.cos(a) * d + rad * 0.4, y + Math.sin(a) * d);
                ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rad * (0.2 + r() * 0.4), 0, TAU);
            }
            ctx.fill();
        };
        blot(W * 0.93, H * 0.5, 9, 'rgba(15,8,12,0.35)');
        blot(W * 0.04, H * 0.3, 6, 'rgba(15,8,12,0.28)');
        blot(W * 0.7, H * 0.97, 14, 'rgba(120,40,80,0.18)');
        // a ring left by a hot flask
        ctx.strokeStyle = 'rgba(70,40,20,0.16)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W * 0.78, H * 0.58, H * 0.12, 0.3, TAU - 0.6);
        ctx.stroke();

        for (let i = 0; i < 30; i++) {
            ctx.fillStyle = `rgba(70,45,20,${0.04 + r() * 0.08})`;
            ctx.beginPath();
            ctx.arc(r() * W, r() * H, 0.5 + r() * 2.5, 0, TAU);
            ctx.fill();
        }
    }

    // marginal diagrams: squared circles, planetary sigils, alembic sketches
    // marginal diagrams: squared circles, planetary sigils, alembic sketches
    function vineSVG(seed) {
        const r = mulberry32(seed);
        const n = 3 + ((r() * 4) | 0);
        const C = 80;
        const R = 50;
        let out = '';
        const s = 'stroke="currentColor" fill="none"';
        out += `<circle cx="${C}" cy="${C}" r="${R + 8}" ${s} stroke-width="1.8"/>`;
        out += `<circle cx="${C}" cy="${C}" r="${R + 3}" ${s} stroke-width=".8" stroke-dasharray="2 3"/>`;
        let poly = '';
        const pts = [];
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i / n) * TAU;
            const p = [C + Math.cos(a) * R, C + Math.sin(a) * R];
            pts.push(p);
            poly += `${p[0].toFixed(1)},${p[1].toFixed(1)} `;
        }
        out += `<polygon points="${poly}" ${s} stroke-width="1.4"/>`;
        out += `<circle cx="${C}" cy="${C}" r="${(R * Math.cos(Math.PI / n)).toFixed(1)}" ${s} stroke-width="1"/>`;
        pts.forEach(([x, y]) => {
            out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" ${s} stroke-width="1.3"/>`;
            out += `<path d="M${x.toFixed(1)} ${(y + 5).toFixed(1)}v6m-3-3h6" ${s} stroke-width="1.1"/>`;
        });
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * TAU;
            out += `<path d="M${(C + Math.cos(a) * (R + 8)).toFixed(1)} ${(C + Math.sin(a) * (R + 8)).toFixed(1)}L${(C + Math.cos(a) * (R + 14 + (i % 2) * 5)).toFixed(1)} ${(C + Math.sin(a) * (R + 14 + (i % 2) * 5)).toFixed(1)}" ${s} stroke-width="1"/>`;
        }
        out += `<circle cx="${C}" cy="${C}" r="7" ${s} stroke-width="1.4"/><circle cx="${C}" cy="${C}" r="1.8" fill="currentColor"/>`;
        // a leader line off to a tiny note
        const la = r() * TAU;
        out += `<path d="M${C + Math.cos(la) * 7} ${C + Math.sin(la) * 7}L${C + Math.cos(la) * 76} ${C + Math.sin(la) * 76}" ${s} stroke-width=".7" stroke-dasharray="1 2"/>`;
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
        { title: 'Solve et Coagula', artist: 'Order of the Retort', scene: 'flask', seed: 11, duration: 402 },
        { title: 'The Brass Heavens', artist: 'Seventh Sphere', scene: 'orrery', seed: 23, duration: 366 },
        { title: 'Circle of Binding', artist: 'Hermetic Vigil', scene: 'circle', seed: 47, duration: 488 },
        { title: 'Nigredo', artist: 'Black Sun Athanor', scene: 'skull', seed: 61, duration: 343 },
        { title: 'Tower Above the Mere', artist: 'Magister Umbra', scene: 'tower', seed: 83, duration: 437 },
    ];
    const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

    function paintCoverScene(x, S, track) {
        const r = mulberry32(track.seed);
        const ink = '#0a0a0a';
        const glowAt = (gx, gy, rad, a) => {
            const g = x.createRadialGradient(gx, gy, 0, gx, gy, rad);
            g.addColorStop(0, `rgba(255,255,255,${a})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
        };
        const bg = x.createRadialGradient(S / 2, S * 0.5, S * 0.05, S / 2, S / 2, S * 0.75);
        bg.addColorStop(0, '#6a6a6a');
        bg.addColorStop(1, '#101010');
        x.fillStyle = bg;
        x.fillRect(0, 0, S, S);
        x.lineCap = 'round';

        switch (track.scene) {
            case 'flask': {
                glowAt(S * 0.45, S * 0.66, S * 0.42, 0.9);
                x.fillStyle = ink;
                x.fillRect(0, S * 0.88, S, S * 0.12);
                flask(x, 'alembic', S * 0.4, S * 0.88, S * 0.26);
                x.fillStyle = '#eee';
                x.beginPath();
                x.ellipse(S * 0.4, S * 0.88 - S * 0.12, S * 0.15, S * 0.08, 0, 0, Math.PI);
                x.fill();
                for (let i = 0; i < 9; i++) {
                    x.strokeStyle = '#ddd';
                    x.lineWidth = 1.5;
                    x.beginPath();
                    x.arc(S * 0.4 + (r() - 0.5) * S * 0.12, S * (0.45 + r() * 0.25), 2 + r() * 4, 0, TAU);
                    x.stroke();
                }
                x.fillStyle = ink;
                flask(x, 'round', S * 0.82, S * 0.88, S * 0.1);
                flask(x, 'tube', S * 0.12, S * 0.88, S * 0.12);
                break;
            }
            case 'orrery': {
                x.fillStyle = ink;
                x.fillRect(S * 0.48, S * 0.55, S * 0.04, S * 0.4);
                x.fillRect(S * 0.3, S * 0.92, S * 0.4, S * 0.08);
                glowAt(S / 2, S * 0.45, S * 0.25, 1);
                x.strokeStyle = '#e6e6e6';
                x.lineWidth = 2;
                [0.12, 0.2, 0.28, 0.36].forEach((k, i) => {
                    x.beginPath();
                    x.ellipse(S / 2, S * 0.45, S * k, S * k * 0.35, -0.3, 0, TAU);
                    x.stroke();
                    const a = r() * TAU;
                    const px = Math.cos(a) * S * k;
                    const py = Math.sin(a) * S * k * 0.35;
                    x.fillStyle = '#f0f0f0';
                    x.beginPath();
                    x.arc(S / 2 + px * Math.cos(-0.3) - py * Math.sin(-0.3), S * 0.45 + px * Math.sin(-0.3) + py * Math.cos(-0.3), 4 + i * 2, 0, TAU);
                    x.fill();
                });
                x.fillStyle = '#fff';
                x.beginPath();
                x.arc(S / 2, S * 0.45, S * 0.05, 0, TAU);
                x.fill();
                break;
            }
            case 'circle': {
                x.fillStyle = '#222';
                x.fillRect(0, S * 0.55, S, S * 0.45);
                x.save();
                x.translate(S / 2, S * 0.78);
                x.scale(1, 0.32);
                x.strokeStyle = '#eee';
                x.lineWidth = 3;
                x.beginPath();
                x.arc(0, 0, S * 0.4, 0, TAU);
                x.moveTo(S * 0.34, 0);
                x.arc(0, 0, S * 0.34, 0, TAU);
                x.stroke();
                x.beginPath();
                for (let i = 0; i <= 5; i++) {
                    const a = (i * 2 * TAU) / 5 - Math.PI / 2;
                    if (i === 0) x.moveTo(Math.cos(a) * S * 0.33, Math.sin(a) * S * 0.33);
                    else x.lineTo(Math.cos(a) * S * 0.33, Math.sin(a) * S * 0.33);
                }
                x.stroke();
                x.restore();
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * TAU - Math.PI / 2;
                    const cx = S / 2 + Math.cos(a) * S * 0.4;
                    const cy = S * 0.78 + Math.sin(a) * S * 0.4 * 0.32;
                    glowAt(cx, cy - 16, 22, 0.9);
                    x.fillStyle = '#ddd';
                    x.fillRect(cx - 3, cy - 14, 6, 14);
                }
                x.fillStyle = ink;
                x.beginPath();
                x.moveTo(S / 2, S * 0.3);
                x.lineTo(S * 0.6, S * 0.76);
                x.lineTo(S * 0.4, S * 0.76);
                x.closePath();
                x.fill();
                x.beginPath();
                x.arc(S / 2, S * 0.33, S * 0.05, 0, TAU);
                x.fill();
                break;
            }
            case 'skull': {
                x.fillStyle = ink;
                x.fillRect(S * 0.15, S * 0.78, S * 0.7, S * 0.08);
                x.fillRect(S * 0.18, S * 0.7, S * 0.62, S * 0.08);
                glowAt(S * 0.74, S * 0.4, S * 0.4, 0.8);
                x.fillStyle = '#dcdcdc';
                x.beginPath();
                x.arc(S * 0.45, S * 0.5, S * 0.15, 0, TAU);
                x.fill();
                x.fillRect(S * 0.37, S * 0.56, S * 0.16, S * 0.13);
                x.fillStyle = ink;
                x.beginPath();
                x.ellipse(S * 0.4, S * 0.53, S * 0.035, S * 0.045, 0, 0, TAU);
                x.ellipse(S * 0.5, S * 0.53, S * 0.035, S * 0.045, 0, 0, TAU);
                x.fill();
                x.beginPath();
                x.moveTo(S * 0.45, S * 0.58);
                x.lineTo(S * 0.43, S * 0.62);
                x.lineTo(S * 0.47, S * 0.62);
                x.fill();
                x.lineWidth = 1.5;
                x.strokeStyle = ink;
                for (let i = 0; i < 5; i++) {
                    x.beginPath();
                    x.moveTo(S * (0.39 + i * 0.03), S * 0.65);
                    x.lineTo(S * (0.39 + i * 0.03), S * 0.69);
                    x.stroke();
                }
                x.fillStyle = '#cfcfcf';
                x.fillRect(S * 0.71, S * 0.42, S * 0.06, S * 0.28);
                x.fillStyle = '#fff';
                x.beginPath();
                x.ellipse(S * 0.74, S * 0.38, 5, 13, 0, 0, TAU);
                x.fill();
                break;
            }
            case 'tower':
            default: {
                const sky = x.createLinearGradient(0, 0, 0, S);
                sky.addColorStop(0, '#111');
                sky.addColorStop(1, '#9a9a9a');
                x.fillStyle = sky;
                x.fillRect(0, 0, S, S);
                for (let i = 0; i < 90; i++) {
                    x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
                    x.fillRect(r() * S, r() * S * 0.5, 1.4, 1.4);
                }
                glowAt(S * 0.62, S * 0.36, S * 0.3, 0.6);
                x.fillStyle = '#f2f2f2';
                x.beginPath();
                x.arc(S * 0.62, S * 0.36, S * 0.14, 0, TAU);
                x.fill();
                x.fillStyle = ink;
                x.beginPath();
                x.moveTo(0, S);
                x.lineTo(0, S * 0.82);
                x.quadraticCurveTo(S * 0.3, S * 0.7, S * 0.55, S * 0.78);
                x.quadraticCurveTo(S * 0.8, S * 0.84, S, S * 0.8);
                x.lineTo(S, S);
                x.fill();
                x.fillRect(S * 0.36, S * 0.3, S * 0.13, S * 0.48);
                x.beginPath();
                x.moveTo(S * 0.33, S * 0.31);
                x.lineTo(S * 0.425, S * 0.12);
                x.lineTo(S * 0.52, S * 0.31);
                x.fill();
                glowAt(S * 0.425, S * 0.4, 22, 1);
                x.fillStyle = '#fff';
                x.fillRect(S * 0.41, S * 0.38, 9, 14);
                x.fillStyle = '#e8e8e8';
                x.fillRect(0, S * 0.9, S, S * 0.02);
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
        ui.kicker.innerHTML = `Folio ${ROMAN[player.index]} &middot; of ${ROMAN[TRACKS.length - 1]}`;
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
