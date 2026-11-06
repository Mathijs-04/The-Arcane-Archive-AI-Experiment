/*
 * The Belfry Almanac
 * A winter hill town at night, drawn entirely in code: a cathedral on the crest, crooked
 * timber-framed rows below, chimney smoke, snowfall, crows, and windows that are lit and
 * snuffed by the townsfolk. Playing tolls the bell; each toll ripples light through the town.
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

    function wave(r, base, amps) {
        const ph = amps.map(() => r() * TAU);
        return (x) => base + amps.reduce((s, [amp, freq], i) => s + Math.sin(x * freq + ph[i]) * amp, 0);
    }

    function sizeCanvas(cv, w, h) {
        cv.width = Math.round(w * DPR);
        cv.height = Math.round(h * DPR);
        const ctx = cv.getContext('2d');
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return ctx;
    }

    /* ================================================================== */
    /* Drawing vocabulary                                                  */
    /* ================================================================== */

    function branch(ctx, r, x, y, len, ang, w, depth, o) {
        const bend = (r() - 0.5) * o.gnarl;
        const ex = x + Math.cos(ang) * len;
        const ey = y + Math.sin(ang) * len;
        ctx.lineWidth = Math.max(w, 0.45);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(ang + bend) * len * 0.55, y + Math.sin(ang + bend) * len * 0.55, ex, ey);
        ctx.stroke();
        if (depth <= 0 || w < o.minW) return;
        const n = r() < 0.3 ? 3 : 2;
        for (let i = 0; i < n; i++) {
            let a = ang + (i - (n - 1) / 2) * o.spread * (0.6 + r() * 0.8) + (r() - 0.5) * 0.35;
            a = lerp(a, UP, 0.08);
            branch(ctx, r, ex, ey, len * 0.72 * (0.88 + r() * 0.24), a, w * 0.64, depth - 1, o);
        }
    }

    /**
     * A crooked, jettied, timber-framed house. Returns nothing; pushes lit-able windows
     * and chimney tops into `o.windows` / `o.chimneys` in canvas coordinates.
     */
    function house(ctx, r, x, baseY, w, h, o) {
        const lean = o.lean ?? (r() - 0.5) * 0.06;
        const P = (px, py) => [x + px - lean * py, baseY + py];
        const floors = o.floors ?? (h / w > 1.3 ? 3 : 2);
        const fh = h / floors;
        const jetty = w * (o.jetty ?? 0.05);
        const W = w + jetty * 2;
        const roofH = o.roofH ?? W * (0.7 + r() * 0.45);
        const gable = o.gable ?? r() < 0.7;
        const eave = W * 0.06;

        // body
        const body = [
            [-w / 2, 2], [w / 2, 2], [w / 2, -fh], [W / 2, -fh], [W / 2, -h], [-W / 2, -h], [-W / 2, -fh], [-w / 2, -fh],
        ];
        ctx.fillStyle = o.col;
        ctx.beginPath();
        body.forEach(([px, py], i) => (i ? ctx.lineTo(...P(px, py)) : ctx.moveTo(...P(px, py))));
        ctx.closePath();
        ctx.fill();

        // roof
        let roof;
        if (gable) {
            roof = [[-W / 2 - eave, -h + 1], [0, -h - roofH], [W / 2 + eave, -h + 1]];
        } else {
            const inset = Math.min(W * 0.32, roofH * 0.5);
            roof = [[-W / 2 - eave, -h + 1], [-W / 2 + inset, -h - roofH * 0.62], [W / 2 - inset, -h - roofH * 0.62], [W / 2 + eave, -h + 1]];
        }
        ctx.beginPath();
        roof.forEach(([px, py], i) => (i ? ctx.lineTo(...P(px, py)) : ctx.moveTo(...P(px, py))));
        ctx.closePath();
        ctx.fill();

        // chimney
        if (o.chimney !== false && r() < (o.chimneyChance ?? 0.75)) {
            const cxr = (r() < 0.5 ? -1 : 1) * W * (0.18 + r() * 0.14);
            const roofYAt = gable
                ? -h - roofH * (1 - Math.abs(cxr) / (W / 2 + eave))
                : -h - roofH * 0.62;
            const cw2 = Math.max(2, W * 0.09);
            const top = roofYAt - roofH * (0.25 + r() * 0.25);
            ctx.beginPath();
            [[cxr - cw2 / 2, roofYAt + 6], [cxr - cw2 / 2, top], [cxr - cw2 * 0.7, top], [cxr - cw2 * 0.7, top - cw2 * 0.3],
                [cxr + cw2 * 0.7, top - cw2 * 0.3], [cxr + cw2 * 0.7, top], [cxr + cw2 / 2, top], [cxr + cw2 / 2, roofYAt + 6]]
                .forEach(([px, py], i) => (i ? ctx.lineTo(...P(px, py)) : ctx.moveTo(...P(px, py))));
            ctx.closePath();
            ctx.fill();
            if (o.chimneys && r() < 0.7) {
                const [tx, ty] = P(cxr, top - cw2 * 0.3);
                o.chimneys.push({ x: tx, y: ty, s: cw2 });
            }
        }

        // timber framing, a shade lighter than the plaster-dark body
        if (o.frame) {
            ctx.save();
            ctx.strokeStyle = o.frame;
            ctx.lineWidth = Math.max(0.8, w * 0.022);
            ctx.lineCap = 'butt';
            const line = (a, b) => {
                ctx.beginPath();
                ctx.moveTo(...P(...a));
                ctx.lineTo(...P(...b));
                ctx.stroke();
            };
            for (let f = 1; f < floors; f++) {
                const y = -fh * f;
                line([-W / 2, y], [W / 2, y]);
                // braces in the upper floors
                if (r() < 0.8) {
                    line([-W / 2 + 1, y], [-W / 2 + W * 0.2, y - fh]);
                    line([W / 2 - 1, y], [W / 2 - W * 0.2, y - fh]);
                }
                const posts = 2 + ((r() * 2) | 0);
                for (let k = 1; k <= posts; k++) line([-W / 2 + (W * k) / (posts + 1), y], [-W / 2 + (W * k) / (posts + 1), y - fh]);
            }
            line([-W / 2, -h], [W / 2, -h]);
            if (gable) {
                line([-W / 2, -h], [0, -h - roofH * 0.55]);
                line([W / 2, -h], [0, -h - roofH * 0.55]);
                line([0, -h], [0, -h - roofH * 0.7]);
            }
            ctx.restore();
        }

        // windows
        const pane = o.pane;
        const pushWin = (cxp, cyp, ww, wh, round) => {
            const [wx, wy] = P(cxp, cyp);
            if (pane) {
                ctx.fillStyle = pane;
                if (round) {
                    ctx.beginPath();
                    ctx.arc(wx, wy, ww / 2, 0, TAU);
                    ctx.fill();
                } else ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
            }
            if (o.windows) o.windows.push(makeWindow(wx, wy, ww, wh, round, r));
        };
        for (let f = 0; f < floors; f++) {
            const fw = f === 0 ? w : W;
            const count = clamp(Math.round(fw / (w * 0.42)) + ((r() * 2) | 0) - 1, 1, 3);
            const ww = w * (0.13 + r() * 0.04);
            const wh = fh * (0.38 + r() * 0.1);
            const doorAt = f === 0 ? (r() * count) | 0 : -1;
            for (let k = 0; k < count; k++) {
                const cxp = -fw / 2 + (fw * (k + 0.5)) / count + (r() - 0.5) * w * 0.04;
                if (k === doorAt && o.door !== false) {
                    if (pane) {
                        const dw = w * 0.18;
                        const dh = fh * 0.72;
                        ctx.fillStyle = pane;
                        ctx.beginPath();
                        const [dx, dy] = P(cxp, 0);
                        ctx.moveTo(dx - dw / 2, dy);
                        ctx.lineTo(dx - dw / 2, dy - dh * 0.8);
                        ctx.quadraticCurveTo(dx, dy - dh * 1.1, dx + dw / 2, dy - dh * 0.8);
                        ctx.lineTo(dx + dw / 2, dy);
                        ctx.fill();
                    }
                    continue;
                }
                pushWin(cxp, -fh * f - fh * 0.52, ww, wh, false);
            }
        }
        if (gable && roofH > w * 0.5 && r() < 0.6) pushWin(0, -h - roofH * 0.32, w * 0.11, w * 0.11, true);

        // snow lying on the roof slopes
        if (o.snow) {
            ctx.save();
            ctx.strokeStyle = o.snow;
            ctx.lineWidth = Math.max(1, W * 0.035);
            ctx.beginPath();
            roof.forEach(([px, py], i) => (i ? ctx.lineTo(...P(px, py - 0.5)) : ctx.moveTo(...P(px, py - 0.5))));
            ctx.stroke();
            ctx.lineWidth = Math.max(0.8, W * 0.02);
            ctx.beginPath();
            ctx.moveTo(...P(W / 2, -fh - 0.5));
            ctx.lineTo(...P(W / 2 + 0.1, -fh - 0.5));
            ctx.stroke();
            ctx.restore();
        }

        // icicles under the eaves
        if (o.icicles) {
            ctx.fillStyle = o.col;
            for (let px = -W / 2 - eave; px < W / 2 + eave; px += 3 + r() * 6) {
                const len = 2 + r() * o.icicles;
                const [ix, iy] = P(px, -h + 1);
                ctx.beginPath();
                ctx.moveTo(ix - 1.4, iy);
                ctx.lineTo(ix, iy + len);
                ctx.lineTo(ix + 1.4, iy);
                ctx.fill();
            }
        }
    }

    function makeWindow(x, y, w, h, round, r) {
        const lit = r() < 0.3 ? 1 : 0;
        return {
            x, y, w, h, round,
            lit,
            target: lit,
            hold: 0,
            tint: r(),
            flick: r() * TAU,
            next: 2000 + r() * 20000,
        };
    }

    /* ================================================================== */
    /* The town                                                            */
    /* ================================================================== */

    const cv = {
        far: $('#layer-far'),
        mid: $('#layer-mid'),
        near: $('#layer-near'),
        fxFar: $('#fx-far'),
        fxMid: $('#fx-mid'),
        fxNear: $('#fx-near'),
    };

    const town = {
        cw: 0,
        ch: 0,
        far: { windows: [], chimneys: [], depth: 0.22 },
        mid: { windows: [], chimneys: [], lamps: [], depth: 0.5 },
        near: { windows: [], chimneys: [], lamps: [], depth: 1 },
        belfry: null,
    };

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(cv.far, cw, ch);
        const r = mulberry32(2101);
        const L = town.far;
        L.windows = [];
        L.chimneys = [];
        const col = '#191b20';
        const peakX = cw * 0.79;

        // the hill rises towards the cathedral
        const hill = (x) => {
            const d = (x - peakX) / cw;
            return ch * 0.5 + Math.pow(Math.abs(d), 1.25) * ch * 0.52 + Math.sin(x * 0.012) * ch * 0.006;
        };
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, hill(x));
        ctx.lineTo(cw, ch);
        ctx.fill();

        // a few winter trees on the slopes
        ctx.strokeStyle = col;
        for (let i = 0; i < 9; i++) {
            const x = r() * cw;
            if (Math.abs(x - peakX) < cw * 0.12) continue;
            branch(ctx, r, x, hill(x) + 2, ch * (0.015 + r() * 0.02), UP, 2 + r() * 2, 5, { gnarl: 0.9, spread: 0.6, minW: 0.5 });
        }

        // the cathedral on the crest
        const cy = hill(peakX) + 4;
        const nW = ch * 0.16;
        const nH = ch * 0.06;
        house(ctx, r, peakX + nW * 0.25, cy, nW, nH, {
            col, floors: 1, roofH: ch * 0.05, gable: false, chimney: false, door: false, lean: 0, jetty: 0,
            windows: L.windows,
        });
        // tower
        const tx = peakX - nW * 0.3;
        const tW = ch * 0.042;
        const tH = ch * 0.19;
        ctx.fillStyle = col;
        ctx.fillRect(tx - tW / 2, cy - tH, tW, tH);
        // buttress steps
        ctx.fillRect(tx - tW * 0.7, cy - tH * 0.35, tW * 1.4, tH * 0.35);
        // belfry, a cut arch
        const bW = tW * 0.42;
        const bH = tH * 0.17;
        const bY = cy - tH * 0.82;
        // spire with corner pinnacles
        ctx.beginPath();
        ctx.moveTo(tx - tW * 0.58, cy - tH);
        ctx.lineTo(tx, cy - tH - ch * 0.13);
        ctx.lineTo(tx + tW * 0.58, cy - tH);
        ctx.fill();
        [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.moveTo(tx + s * tW * 0.5 - 2.5, cy - tH);
            ctx.lineTo(tx + s * tW * 0.5, cy - tH - ch * 0.03);
            ctx.lineTo(tx + s * tW * 0.5 + 2.5, cy - tH);
            ctx.fill();
        });
        // finial cross
        ctx.fillRect(tx - 0.8, cy - tH - ch * 0.155, 1.6, ch * 0.03);
        ctx.fillRect(tx - 4, cy - tH - ch * 0.147, 8, 1.6);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(tx - bW / 2, bY + bH / 2);
        ctx.lineTo(tx - bW / 2, bY - bH * 0.2);
        ctx.arc(tx, bY - bH * 0.2, bW / 2, Math.PI, TAU);
        ctx.lineTo(tx + bW / 2, bY + bH / 2);
        ctx.fill();
        ctx.restore();
        // the bell hangs in the opening
        ctx.beginPath();
        ctx.moveTo(tx - bW * 0.3, bY + bH * 0.25);
        ctx.quadraticCurveTo(tx - bW * 0.24, bY - bH * 0.28, tx, bY - bH * 0.3);
        ctx.quadraticCurveTo(tx + bW * 0.24, bY - bH * 0.28, tx + bW * 0.3, bY + bH * 0.25);
        ctx.fill();
        town.belfry = { x: tx, y: bY, w: bW, h: bH };
        // rose window
        L.windows.push({ ...makeWindow(peakX + nW * 0.62, cy - nH * 0.55, nH * 0.42, nH * 0.42, true, r), lit: 1, target: 1, rose: true });

        // houses climbing the hill in staggered rows
        for (let row = 0; row < 3; row++) {
            for (let x = -10; x < cw + 10;) {
                const w = ch * (0.016 + r() * 0.014) * (1 + row * 0.25);
                const gap = r() * w * 0.4;
                const cx = x + w / 2;
                if (Math.abs(cx - peakX) > nW * 0.75 || row > 0) {
                    const y = hill(cx) + 3 + row * ch * 0.035;
                    house(ctx, r, cx, y, w, w * (0.8 + r() * 0.7), {
                        col, floors: 2, frame: null, windows: L.windows, chimneys: L.chimneys, chimneyChance: 0.6,
                        snow: 'rgba(205,210,220,0.16)', door: false,
                    });
                }
                x += w + gap;
            }
        }
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(cv.mid, cw, ch);
        const r = mulberry32(4441);
        const L = town.mid;
        L.windows = [];
        L.chimneys = [];
        L.lamps = [];

        // a back row on rising ground
        const backCol = '#121419';
        for (let x = -30; x < cw + 30;) {
            const w = ch * (0.06 + r() * 0.05);
            const y = ch * 0.79 + Math.sin(x * 0.004) * ch * 0.01;
            house(ctx, r, x + w / 2, y, w, w * (1.1 + r() * 0.8), {
                col: backCol, frame: '#181a20', pane: '#0c0d10', windows: L.windows, chimneys: L.chimneys,
                snow: 'rgba(210,214,224,0.22)',
            });
            x += w + r() * 4;
        }

        // the street row, over a continuous ground-floor wall so no gaps show under the jetties
        const col = '#0b0c0f';
        const baseY = ch * 0.865;
        ctx.fillStyle = col;
        ctx.fillRect(0, baseY - ch * 0.075, cw, ch * 0.08);
        for (let x = -40; x < cw + 40;) {
            const alley = r() < 0.16;
            if (alley) {
                // an alley mouth with a little street lamp
                const aw = ch * 0.05;
                const lx = x + aw / 2;
                ctx.fillStyle = col;
                ctx.fillRect(lx - 1.5, baseY - ch * 0.1, 3, ch * 0.1);
                ctx.fillRect(lx - 5, baseY - ch * 0.1 - 9, 10, 9);
                ctx.beginPath();
                ctx.moveTo(lx - 7, baseY - ch * 0.1 - 9);
                ctx.lineTo(lx, baseY - ch * 0.1 - 16);
                ctx.lineTo(lx + 7, baseY - ch * 0.1 - 9);
                ctx.fill();
                L.lamps.push({ x: lx, y: baseY - ch * 0.1 - 4.5, r: 5 });
                x += aw;
                continue;
            }
            const w = ch * (0.085 + r() * 0.07);
            const h = w * (1.05 + r() * 0.9);
            house(ctx, r, x + w / 2, baseY, w, h, {
                col, frame: '#16181d', pane: '#14161a', windows: L.windows, chimneys: L.chimneys,
                snow: 'rgba(220,224,232,0.32)', icicles: 6,
            });
            x += w * 1.1 + r() * 3;
        }
        // street
        ctx.fillStyle = col;
        ctx.fillRect(0, baseY, cw, ch - baseY);
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(cv.near, cw, ch);
        const r = mulberry32(9001);
        const L = town.near;
        L.windows = [];
        L.chimneys = [];
        L.lamps = [];
        const col = '#030304';

        // cobbled street
        const streetY = ch * 0.925;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 10) ctx.lineTo(x, streetY + Math.sin(x * 0.01) * 3);
        ctx.lineTo(cw, ch);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,42,48,0.9)';
        ctx.lineWidth = 1;
        for (let row = 0; row < 6; row++) {
            const y = streetY + 6 + row * row * 2.4 + row * 6;
            const s = 8 + row * 5;
            for (let x = (row % 2) * s * 0.5; x < cw; x += s * (0.9 + r() * 0.3)) {
                ctx.beginPath();
                ctx.ellipse(x, y, s * 0.42, 2 + row * 1.2, 0, Math.PI * 1.05, Math.PI * 1.95);
                ctx.stroke();
            }
        }
        // drifted snow along the gutter
        ctx.fillStyle = 'rgba(210,214,222,0.12)';
        for (let x = 0; x < cw; x += 3) {
            ctx.fillRect(x, streetY - 1 + Math.sin(x * 0.03) * 1.5, 3, 2 + r() * 1.5);
        }

        // a towering house corner, left
        const hw = clamp(cw * 0.19, 130, 280);
        house(ctx, r, hw * 0.16, streetY + 2, hw, ch * 0.7, {
            col, frame: '#0e0f12', pane: '#0a0b0d', floors: 3, gable: true, roofH: ch * 0.4, lean: -0.015,
            windows: L.windows, chimney: false, snow: 'rgba(220,224,232,0.4)', icicles: 16, door: false, jetty: 0.07,
        });

        // the hanging sign
        const bx = hw * 0.16 + hw * 0.57;
        const by = ch * 0.44;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(bx - 6, by);
        ctx.lineTo(bx + cw * 0.07, by);
        ctx.stroke();
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(bx - 6, by + 30);
        ctx.quadraticCurveTo(bx + 12, by + 26, bx + 24, by + 2);
        ctx.stroke();
        // scroll on the bracket
        ctx.beginPath();
        for (let k = 0; k <= 30; k++) {
            const a = k * 0.32;
            const rad = 11 * (1 - k / 34);
            const px = bx + 22 + Math.cos(a + Math.PI) * rad;
            const py = by + 13 + Math.sin(a + Math.PI) * rad;
            if (k) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
        }
        ctx.stroke();
        const sx = bx + cw * 0.04;
        const sW = Math.max(54, cw * 0.045);
        const sH = sW * 1.15;
        ctx.lineWidth = 1.5;
        [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.moveTo(sx + s * sW * 0.35, by);
            ctx.lineTo(sx + s * sW * 0.35, by + 16);
            ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(sx - sW / 2, by + 16);
        ctx.lineTo(sx + sW / 2, by + 16);
        ctx.lineTo(sx + sW / 2, by + 16 + sH * 0.82);
        ctx.quadraticCurveTo(sx, by + 16 + sH * 1.08, sx - sW / 2, by + 16 + sH * 0.82);
        ctx.closePath();
        ctx.fill();
        // a bell, cut out of the sign
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        const cyb = by + 16 + sH * 0.45;
        const bs = sW * 0.26;
        ctx.beginPath();
        ctx.moveTo(sx - bs, cyb + bs * 0.7);
        ctx.quadraticCurveTo(sx - bs * 0.8, cyb - bs * 0.9, sx, cyb - bs);
        ctx.quadraticCurveTo(sx + bs * 0.8, cyb - bs * 0.9, sx + bs, cyb + bs * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, cyb + bs * 0.9, bs * 0.18, 0, TAU);
        ctx.fill();
        ctx.restore();

        // the lamp post, right
        const lx = cw * 0.935;
        const top = ch * 0.5;
        ctx.fillStyle = col;
        ctx.fillRect(lx - 4, top, 8, streetY - top + 4);
        ctx.fillRect(lx - 10, streetY - 26, 20, 28);
        ctx.fillRect(lx - 7, streetY - 40, 14, 14);
        ctx.fillRect(lx - 14, top - 4, 28, 5);
        // lantern cage
        const lH = 40;
        const lW = 26;
        ctx.beginPath();
        ctx.moveTo(lx - lW * 0.38, top - 4);
        ctx.lineTo(lx - lW / 2, top - 4 - lH);
        ctx.lineTo(lx + lW / 2, top - 4 - lH);
        ctx.lineTo(lx + lW * 0.38, top - 4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(lx - lW * 0.62, top - 4 - lH);
        ctx.lineTo(lx, top - 4 - lH - 18);
        ctx.lineTo(lx + lW * 0.62, top - 4 - lH);
        ctx.fill();
        ctx.fillRect(lx - 2, top - lH - 30, 4, 10);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.moveTo(lx + s * 2, top - 8);
            ctx.lineTo(lx + s * lW * 0.3, top - 8);
            ctx.lineTo(lx + s * lW * 0.4, top - lH);
            ctx.lineTo(lx + s * 2, top - lH);
            ctx.fill();
        });
        ctx.restore();
        L.lamps.push({ x: lx, y: top - 4 - lH * 0.5, r: 16, big: true });
        // a snow cap on the lantern
        ctx.strokeStyle = 'rgba(220,224,232,0.45)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(lx - lW * 0.6, top - 5 - lH);
        ctx.lineTo(lx, top - 4 - lH - 17);
        ctx.lineTo(lx + lW * 0.6, top - 5 - lH);
        ctx.stroke();

        // the edge of a house, far right
        const rw = clamp(cw * 0.12, 90, 200);
        house(ctx, r, cw + rw * 0.36, streetY + 2, rw, ch * 0.58, {
            col, frame: '#0e0f12', pane: '#0a0b0d', floors: 3, gable: true, roofH: ch * 0.3, lean: 0.02,
            windows: L.windows, chimney: false, snow: 'rgba(220,224,232,0.4)', icicles: 14, door: false,
        });
    }

    function drawTown() {
        const cw = window.innerWidth * (1 + OVERSCAN * 2);
        const ch = window.innerHeight * (1 + OVERSCAN * 2);
        town.cw = cw;
        town.ch = ch;
        drawFar(cw, ch);
        drawMid(cw, ch);
        drawNear(cw, ch);
        fx.far = sizeCanvas(cv.fxFar, cw, ch);
        fx.mid = sizeCanvas(cv.fxMid, cw, ch);
        fx.near = sizeCanvas(cv.fxNear, cw, ch);
        smoke.length = 0;
    }

    /* ================================================================== */
    /* Light: windows, lamps, the belfry and its tolls                     */
    /* ================================================================== */

    const fx = { far: null, mid: null, near: null };

    const glowSprite = document.createElement('canvas');
    glowSprite.width = glowSprite.height = 64;
    (() => {
        const s = glowSprite.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,215,150,1)');
        g.addColorStop(0.18, 'rgba(255,180,100,0.55)');
        g.addColorStop(0.5, 'rgba(230,140,70,0.14)');
        g.addColorStop(1, 'rgba(200,110,50,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 64, 64);
    })();

    const smokeSprite = document.createElement('canvas');
    smokeSprite.width = smokeSprite.height = 64;
    (() => {
        const s = smokeSprite.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(190,190,195,0.55)');
        g.addColorStop(0.6, 'rgba(160,160,168,0.18)');
        g.addColorStop(1, 'rgba(150,150,160,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 64, 64);
    })();

    const state = {
        playing: false,
        warmth: 0.75,
        pointer: { x: -9999, y: -9999, active: false },
        parallax: { x: 0, y: 0, tx: 0, ty: 0 },
        tolls: [],
        nextAutoToll: 0,
    };

    function toLayer(clientX, clientY, depth) {
        return [
            clientX + window.innerWidth * OVERSCAN + state.parallax.x * depth,
            clientY + window.innerHeight * OVERSCAN + state.parallax.y * depth,
        ];
    }

    function toll(now) {
        state.tolls.push({ t0: now, last: 0 });
        if (state.tolls.length > 4) state.tolls.shift();
    }

    function updateWindows(L, now, dt) {
        const baseline = state.playing ? 0.72 : 0.32;
        const p = state.pointer;
        const [px, py] = p.active ? toLayer(p.x, p.y, L.depth) : [-1e5, -1e5];
        const reach = 70 + 90 * L.depth;
        for (const w of L.windows) {
            if (w.rose) {
                w.target = 1;
            } else if (now > w.hold) {
                // townsfolk light and snuff their candles at their own pace
                w.next -= dt * 16.67;
                if (w.next <= 0) {
                    w.target = Math.random() < baseline ? 1 : 0;
                    w.next = 3000 + Math.random() * (state.playing ? 9000 : 22000);
                }
            }
            if (p.active && Math.hypot(w.x - px, w.y - py) < reach) {
                w.target = 1;
                w.hold = now + 3500 + Math.random() * 2500;
            }
            const speed = w.target > w.lit ? 0.06 : 0.012;
            w.lit = clamp(w.lit + Math.sign(w.target - w.lit) * speed * dt, 0, 1);
            if (Math.abs(w.target - w.lit) < speed) w.lit = w.target;
        }
    }

    function ringLights(now) {
        const B = town.belfry;
        if (!B) return;
        const speed = town.cw / 2400;
        for (const t of state.tolls) {
            const radius = (now - t.t0) * speed;
            for (const L of [town.far, town.mid, town.near]) {
                for (const w of L.windows) {
                    const d = Math.hypot(w.x - B.x, w.y - B.y);
                    if (d > t.last && d <= radius) {
                        if (Math.random() < 0.85) {
                            w.target = 1;
                            w.hold = now + 5000 + Math.random() * 6000;
                        }
                    }
                }
            }
            t.last = radius;
        }
        state.tolls = state.tolls.filter((t) => (now - t.t0) * speed < town.cw * 1.3);
    }

    function drawWindows(ctx, L, t) {
        ctx.globalCompositeOperation = 'lighter';
        for (const w of L.windows) {
            if (w.lit <= 0.01) continue;
            const flick = 0.82 + 0.12 * Math.sin(t * 0.009 + w.flick) + 0.06 * Math.sin(t * 0.023 + w.flick * 2);
            const a = clamp(w.lit * flick * state.warmth, 0, 1);
            const g = Math.round(lerp(160, 205, w.tint));
            const b = Math.round(lerp(80, 130, w.tint));
            ctx.fillStyle = `rgba(255,${g},${b},${a})`;
            if (w.round) {
                ctx.beginPath();
                ctx.arc(w.x, w.y, w.w / 2, 0, TAU);
                ctx.fill();
            } else if (w.w > 7) {
                // four panes with a mullion cross
                const gap = Math.max(1, w.w * 0.1);
                const pw = (w.w - gap) / 2;
                const ph = (w.h - gap) / 2;
                const x0 = w.x - w.w / 2;
                const y0 = w.y - w.h / 2;
                ctx.fillRect(x0, y0, pw, ph);
                ctx.fillRect(x0 + pw + gap, y0, pw, ph);
                ctx.fillRect(x0, y0 + ph + gap, pw, ph);
                ctx.fillRect(x0 + pw + gap, y0 + ph + gap, pw, ph);
            } else {
                ctx.fillRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
            }
            const s = Math.max(w.w, w.h) * 4;
            ctx.globalAlpha = a * 0.45;
            ctx.drawImage(glowSprite, w.x - s / 2, w.y - s / 2, s, s);
            ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawLamps(ctx, L, t) {
        ctx.globalCompositeOperation = 'lighter';
        for (const l of L.lamps) {
            const flick = 0.85 + 0.1 * Math.sin(t * 0.011 + l.x) + 0.05 * Math.sin(t * 0.031 + l.y);
            const a = clamp(flick * state.warmth * (state.playing ? 1.15 : 1), 0, 1);
            const s = l.r * (l.big ? 16 : 10);
            ctx.globalAlpha = a * 0.7;
            ctx.drawImage(glowSprite, l.x - s / 2, l.y - s / 2, s, s);
            ctx.globalAlpha = a;
            const core = l.r * 2.4;
            ctx.drawImage(glowSprite, l.x - core / 2, l.y - core / 2, core, core);
            if (l.big) {
                // a pool of light on the snowy cobbles
                const gy = town.ch * 0.94;
                ctx.globalAlpha = a * 0.35;
                ctx.save();
                ctx.translate(l.x, gy);
                ctx.scale(1, 0.18);
                ctx.drawImage(glowSprite, -l.r * 9, -l.r * 9, l.r * 18, l.r * 18);
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawBelfry(ctx, now) {
        const B = town.belfry;
        if (!B) return;
        let flare = 0;
        for (const t of state.tolls) flare = Math.max(flare, Math.exp(-(now - t.t0) / 900));
        const base = state.playing ? 0.55 : 0.28;
        const a = clamp((base + flare * 0.9) * state.warmth, 0, 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        const s = B.w * (5 + flare * 6);
        ctx.drawImage(glowSprite, B.x - s / 2, B.y - s / 2, s, s);
        ctx.globalAlpha = 1;
        // the sound, made visible: rings rolling down over the roofs
        const speed = town.cw / 2400;
        for (const t of state.tolls) {
            const age = now - t.t0;
            const radius = age * speed;
            const fade = clamp(1 - radius / (town.cw * 1.1), 0, 1);
            for (let k = 0; k < 2; k++) {
                const rr = radius - k * 14;
                if (rr <= 0) continue;
                ctx.strokeStyle = `rgba(255,205,150,${0.16 * fade * fade * state.warmth * (k ? 0.5 : 1)})`;
                ctx.lineWidth = k ? 1 : 2;
                ctx.beginPath();
                ctx.arc(B.x, B.y, rr, 0, TAU);
                ctx.stroke();
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    /* ================================================================== */
    /* Chimney smoke                                                       */
    /* ================================================================== */

    const smoke = [];

    function updateSmoke(dt) {
        const wind = 0.18 + (state.pointer.active ? (state.pointer.x / window.innerWidth - 0.5) * 0.3 : 0);
        for (const [key, L] of [['far', town.far], ['mid', town.mid]]) {
            for (const c of L.chimneys) {
                if (Math.random() < 0.05 * dt) {
                    smoke.push({
                        layer: key,
                        x: c.x + (Math.random() - 0.5) * c.s,
                        y: c.y,
                        vx: wind * (0.6 + Math.random() * 0.6),
                        vy: -(0.25 + Math.random() * 0.3) * (key === 'far' ? 0.6 : 1),
                        s: c.s * 1.6,
                        grow: key === 'far' ? 0.05 : 0.12,
                        life: 1,
                    });
                }
            }
        }
        if (smoke.length > 420) smoke.splice(0, smoke.length - 420);
        for (let i = smoke.length - 1; i >= 0; i--) {
            const p = smoke[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx += 0.002 * dt;
            p.s += p.grow * dt;
            p.life -= 0.0045 * dt;
            if (p.life <= 0) {
                smoke.splice(i, 1);
                continue;
            }
            const ctx = fx[p.layer];
            ctx.globalAlpha = p.life * p.life * 0.22;
            ctx.drawImage(smokeSprite, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
        }
        fx.far.globalAlpha = 1;
        fx.mid.globalAlpha = 1;
    }

    /* ================================================================== */
    /* Snow                                                                */
    /* ================================================================== */

    const snowBack = $('#snow-back');
    const snowFront = $('#snow-front');
    let sb;
    let sf;
    let flakes = [];
    let bigFlakes = [];

    const flakeSprite = document.createElement('canvas');
    flakeSprite.width = flakeSprite.height = 32;
    (() => {
        const s = flakeSprite.getContext('2d');
        const g = s.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, 'rgba(240,242,248,0.9)');
        g.addColorStop(0.4, 'rgba(230,234,242,0.35)');
        g.addColorStop(1, 'rgba(230,234,242,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 32, 32);
    })();

    function setupSnow() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        sb = sizeCanvas(snowBack, W, H);
        sf = sizeCanvas(snowFront, W, H);
        const count = Math.round(clamp((W * H) / 5200, 90, 320));
        flakes = Array.from({ length: count }, () => newFlake(true));
        bigFlakes = Array.from({ length: 14 }, () => newBig(true));
    }

    function newFlake(anywhere) {
        const z = 0.3 + Math.random() * 0.7;
        return {
            x: Math.random() * window.innerWidth,
            y: anywhere ? Math.random() * window.innerHeight : -10,
            z,
            r: 0.5 + z * 1.6,
            v: 0.35 + z * 0.9,
            ph: Math.random() * TAU,
        };
    }

    function newBig(anywhere) {
        return {
            x: Math.random() * window.innerWidth,
            y: anywhere ? Math.random() * window.innerHeight : -40,
            r: 6 + Math.random() * 10,
            v: 1.1 + Math.random() * 0.9,
            ph: Math.random() * TAU,
        };
    }

    function updateSnow(dt, t) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const wind = 0.25 + (state.pointer.active ? (state.pointer.x / W - 0.5) * 0.8 : 0);
        sb.clearRect(0, 0, W, H);
        sb.fillStyle = 'rgba(232,236,244,1)';
        for (const f of flakes) {
            f.y += f.v * dt;
            f.x += (wind * f.z + Math.sin(t * 0.0012 + f.ph) * 0.35) * dt;
            if (f.y > H + 6) Object.assign(f, newFlake(false));
            if (f.x > W + 6) f.x = -6;
            if (f.x < -6) f.x = W + 6;
            sb.globalAlpha = 0.25 + f.z * 0.5;
            sb.beginPath();
            sb.arc(f.x - state.parallax.x * f.z * 0.6, f.y, f.r, 0, TAU);
            sb.fill();
        }
        sb.globalAlpha = 1;
        sf.clearRect(0, 0, W, H);
        for (const f of bigFlakes) {
            f.y += f.v * dt;
            f.x += (wind * 1.4 + Math.sin(t * 0.0009 + f.ph) * 0.5) * dt;
            if (f.y > H + 40) Object.assign(f, newBig(false));
            if (f.x > W + 40) f.x = -40;
            if (f.x < -40) f.x = W + 40;
            sf.globalAlpha = 0.22;
            const s = f.r * 2;
            sf.drawImage(flakeSprite, f.x - state.parallax.x * 1.4 - f.r, f.y - f.r, s, s);
        }
        sf.globalAlpha = 1;
    }

    /* ================================================================== */
    /* Sky: stars, crows                                                   */
    /* ================================================================== */

    const birdsCv = $('#birds');
    let bx;
    let flock = [];
    let nextFlock = 4000;

    function buildSky() {
        const stars = $('#stars');
        const r = mulberry32(77);
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 170; i++) {
            const s = document.createElement('span');
            s.className = 'star';
            const size = 0.7 + Math.pow(r(), 3) * 2.2;
            s.style.cssText = `--x:${(r() * 100).toFixed(2)}%;--y:${(Math.pow(r(), 1.2) * 100).toFixed(2)}%;--s:${size.toFixed(2)}px;` +
                `--min:${(0.08 + r() * 0.12).toFixed(2)};--max:${(0.3 + r() * 0.45).toFixed(2)};` +
                `--d:${(3 + r() * 7).toFixed(2)}s;--delay:${(-r() * 10).toFixed(2)}s`;
            frag.appendChild(s);
        }
        stars.appendChild(frag);
    }

    function setupBirds() {
        const host = birdsCv.parentElement;
        bx = sizeCanvas(birdsCv, host.offsetWidth, host.offsetHeight);
    }

    function updateBirds(dt, t) {
        const W = birdsCv.parentElement.offsetWidth;
        const H = birdsCv.parentElement.offsetHeight;
        bx.clearRect(0, 0, W, H);
        nextFlock -= dt * 16.67;
        if (nextFlock <= 0 && flock.length === 0) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const y0 = H * (0.12 + Math.random() * 0.25);
            const n = 3 + ((Math.random() * 5) | 0);
            for (let i = 0; i < n; i++) {
                flock.push({
                    x: dir > 0 ? -40 - i * 26 - Math.random() * 30 : W + 40 + i * 26 + Math.random() * 30,
                    y: y0 + (Math.random() - 0.5) * 50,
                    v: (1.3 + Math.random() * 0.5) * dir,
                    s: 5 + Math.random() * 4,
                    ph: Math.random() * TAU,
                    rate: 0.011 + Math.random() * 0.006,
                });
            }
            nextFlock = 14000 + Math.random() * 20000;
        }
        bx.fillStyle = '#050506';
        bx.strokeStyle = '#050506';
        bx.lineWidth = 1.6;
        for (let i = flock.length - 1; i >= 0; i--) {
            const b = flock[i];
            b.x += b.v * dt;
            b.y += Math.sin(t * 0.002 + b.ph) * 0.15 * dt;
            if (b.x < -120 || b.x > W + 120) {
                flock.splice(i, 1);
                continue;
            }
            const flap = Math.sin(t * b.rate + b.ph);
            const s = b.s;
            bx.beginPath();
            bx.moveTo(b.x - s, b.y - flap * s * 0.7);
            bx.quadraticCurveTo(b.x - s * 0.4, b.y - s * 0.1, b.x, b.y);
            bx.quadraticCurveTo(b.x + s * 0.4, b.y - s * 0.1, b.x + s, b.y - flap * s * 0.7);
            bx.stroke();
            bx.beginPath();
            bx.ellipse(b.x, b.y + 0.5, s * 0.22, s * 0.14, 0, 0, TAU);
            bx.fill();
        }
    }

    /* ================================================================== */
    /* Fog                                                                 */
    /* ================================================================== */

    function buildFog() {
        const tile = (seed, fx2, fy, gain, cut) => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='520'>` +
                `<filter id='f' x='0' y='0' width='100%' height='100%'>` +
                `<feTurbulence type='fractalNoise' baseFrequency='${fx2} ${fy}' numOctaves='5' seed='${seed}' stitchTiles='stitch'/>` +
                `<feColorMatrix values='0 0 0 0 0.86  0 0 0 0 0.85  0 0 0 0 0.84  ${gain} 0 0 0 ${cut}'/>` +
                `</filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
            return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        };
        document.documentElement.style.setProperty('--fog-tex-1', tile(7, 0.0022, 0.009, 2.8, -1.15));
        document.documentElement.style.setProperty('--fog-tex-2', tile(53, 0.0034, 0.012, 2.3, -0.9));
    }

    /* ================================================================== */
    /* Parallax + main loop                                                */
    /* ================================================================== */

    const depthNodes = [...document.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: parseFloat(el.dataset.depth) }));

    function applyParallax() {
        const P = state.parallax;
        P.x = lerp(P.x, P.tx, 0.05);
        P.y = lerp(P.y, P.ty, 0.05);
        for (const { el, depth } of depthNodes) {
            el.style.transform = `translate3d(${(-P.x * depth).toFixed(2)}px, ${(-P.y * depth).toFixed(2)}px, 0)`;
        }
    }

    let last = performance.now();
    function frame(now) {
        const dt = clamp((now - last) / 16.67, 0, 3);
        last = now;

        if (state.playing && now > state.nextAutoToll) {
            toll(now);
            state.nextAutoToll = now + 5200;
        }
        ringLights(now);
        for (const L of [town.far, town.mid, town.near]) updateWindows(L, now, dt);

        const { cw, ch } = town;
        fx.far.clearRect(0, 0, cw, ch);
        fx.mid.clearRect(0, 0, cw, ch);
        fx.near.clearRect(0, 0, cw, ch);
        drawWindows(fx.far, town.far, now);
        drawBelfry(fx.far, now);
        drawWindows(fx.mid, town.mid, now);
        drawLamps(fx.mid, town.mid, now);
        drawWindows(fx.near, town.near, now);
        drawLamps(fx.near, town.near, now);
        updateSmoke(dt);
        updateSnow(dt, now);
        updateBirds(dt, now);
        applyParallax();
        if (!reduceMotion) requestAnimationFrame(frame);
    }

    /* ================================================================== */
    /* The notice sheet: patina, iron, candles                             */
    /* ================================================================== */

    function drawPatina() {
        const c = $('#sheet-patina');
        const rect = c.getBoundingClientRect();
        if (!rect.width) return;
        const ctx = sizeCanvas(c, rect.width, rect.height);
        const W = rect.width;
        const H = rect.height;
        const r = mulberry32(1666);

        // the printed double rule of an old broadsheet
        ctx.strokeStyle = 'rgba(13,12,11,0.22)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(W * 0.022, H * 0.03, W * 0.956, H * 0.94);
        ctx.lineWidth = 0.6;
        ctx.strokeRect(W * 0.03, H * 0.042, W * 0.94, H * 0.916);

        // fold creases
        const crease = (x0, y0, x1, y1) => {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.09)';
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,250,235,0.09)';
            ctx.beginPath();
            ctx.moveTo(x0 + 1, y0 + 1);
            ctx.lineTo(x1 + 1, y1 + 1);
            ctx.stroke();
        };
        crease(0, H * 0.52, W, H * 0.5);
        crease(W * 0.49, 0, W * 0.505, H);

        // rust weeping from the nails
        [[W * 0.5, H * 0.03], [W * 0.52, H * 0.97]].forEach(([x, y], i) => {
            const g = ctx.createLinearGradient(x, y, x, y + (i ? -H * 0.08 : H * 0.14));
            g.addColorStop(0, 'rgba(90,45,15,0.35)');
            g.addColorStop(1, 'rgba(90,45,15,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y + (i ? -H * 0.03 : H * 0.06), W * 0.012, H * 0.07, 0, 0, TAU);
            ctx.fill();
        });

        // soot along the top, from the lamp below the eaves
        for (let i = 0; i < 40; i++) {
            const x = r() * W;
            const g = ctx.createRadialGradient(x, 0, 0, x, 0, 30 + r() * 50);
            g.addColorStop(0, `rgba(15,12,10,${0.05 + r() * 0.06})`);
            g.addColorStop(1, 'rgba(15,12,10,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 80, 0, 160, 80);
        }

        // water-stain rings
        const ring = (x, y, rad) => {
            ctx.strokeStyle = 'rgba(70,50,25,0.16)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            for (let a = 0; a <= TAU + 0.01; a += 0.1) {
                const rr = rad * (1 + Math.sin(a * 3 + x) * 0.05 + (r() - 0.5) * 0.03);
                const px = x + Math.cos(a) * rr;
                const py = y + Math.sin(a) * rr * 0.9;
                if (a) ctx.lineTo(px, py);
                else ctx.moveTo(px, py);
            }
            ctx.stroke();
            ctx.fillStyle = 'rgba(80,60,30,0.05)';
            ctx.fill();
        };
        ring(W * 0.83, H * 0.36, W * 0.07);
        ring(W * 0.88, H * 0.42, W * 0.045);
        ring(W * 0.15, H * 0.82, W * 0.05);

        for (let i = 0; i < 30; i++) {
            ctx.fillStyle = `rgba(60,45,20,${0.05 + r() * 0.08})`;
            ctx.beginPath();
            ctx.arc(r() * W, r() * H, 0.5 + r() * 2.2, 0, TAU);
            ctx.fill();
        }
    }

    function spiral(cx, cy, r0, a0, turns, dir) {
        let d = '';
        const N = Math.round(turns * 28);
        for (let k = 0; k <= N; k++) {
            const a = a0 + dir * (k / 28) * TAU;
            const rad = r0 * (1 - (k / N) * 0.82);
            const px = cx + Math.cos(a) * rad;
            const py = cy + Math.sin(a) * rad;
            d += `${k ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
        }
        return d;
    }

    function ironSVG() {
        const s = (d, w = 3.4) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
        let out = '';
        // the bracket bars
        out += s('M10 150V24M10 150H136', 4.4);
        // spear tips
        out += '<path d="M10 8l5 12-5 6-5-6z" fill="currentColor"/>';
        out += '<path d="M152 150l-12 5-6-5 6-5z" fill="currentColor"/>';
        // corner brace sweeping into a big scroll
        out += s('M10 150C26 134 40 122 52 112');
        out += s(spiral(62, 100, 15, Math.PI * 0.78, 1.6, 1));
        // C-scrolls along each arm
        out += s(spiral(24, 74, 13, Math.PI, 1.35, -1), 2.8);
        out += s(spiral(24, 46, 9, Math.PI, 1.3, 1), 2.4);
        out += s(spiral(80, 136, 13, Math.PI / 2, 1.35, 1), 2.8);
        out += s(spiral(108, 136, 9, Math.PI / 2, 1.3, -1), 2.4);
        // collars where scrolls meet the bars
        [[10, 74], [10, 46], [80, 150], [108, 150], [10, 112], [46, 150]].forEach(([x, y]) => {
            out += `<rect x="${x - 4}" y="${y - 2.5}" width="8" height="5" rx="1" fill="currentColor" transform="rotate(${x === 10 ? 0 : 90} ${x} ${y})"/>`;
        });
        // rivet in the corner
        out += '<circle cx="10" cy="150" r="5.5" fill="currentColor"/>';
        return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
    }

    function buildSheetDecor() {
        const svg = ironSVG();
        ['.iron--tr', '.iron--bl', '.iron--br'].forEach((sel) => ($(sel).innerHTML = svg));
        const candles = $('#candles');
        const r = mulberry32(12);
        for (let i = 0; i < 14; i++) {
            const c = document.createElement('span');
            c.className = 'candle';
            c.style.cssText = `--h:${(18 + r() * 46).toFixed(0)}%;--f:${(0.5 + r() * 0.25).toFixed(2)};` +
                `--flick:${(0.35 + r() * 0.5).toFixed(2)}s;--pulse:${(1.1 + r() * 1.2).toFixed(2)}s;--delay:${(-r() * 2).toFixed(2)}s`;
            const flame = document.createElement('i');
            flame.className = 'candle__flame';
            c.appendChild(flame);
            candles.appendChild(c);
        }
    }

    /* ================================================================== */
    /* Covers: painted in greys, Atkinson-dithered to 1 bit                */
    /* ================================================================== */

    const TRACKS = [
        { title: 'Vespers from the Belfry', artist: 'Guild of Hollow Bells', scene: 'belfry', seed: 14, duration: 431 },
        { title: "The Lamplighter's Round", artist: 'Cobble & Tallow', scene: 'lamp', seed: 29, duration: 362 },
        { title: 'Snow on the Gable Roofs', artist: 'The Night Watch', scene: 'gables', seed: 41, duration: 389 },
        { title: 'Ashes from the Chimney Row', artist: 'Brothers of the Hearth', scene: 'chimneys', seed: 58, duration: 455 },
        { title: 'Curfew at the Old Gate', artist: 'Ninth Hour Wardens', scene: 'gate', seed: 73, duration: 340 },
    ];
    const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

    function paintCover(x, S, track) {
        const r = mulberry32(track.seed);
        const sky = x.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, '#121212');
        sky.addColorStop(0.55, '#4e4e4e');
        sky.addColorStop(0.8, '#9a9a9a');
        sky.addColorStop(1, '#c4c4c4');
        x.fillStyle = sky;
        x.fillRect(0, 0, S, S);
        for (let i = 0; i < 120; i++) {
            x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
            const s = r() < 0.9 ? 1.2 : 2.4;
            x.fillRect(r() * S, Math.pow(r(), 1.4) * S * 0.6, s, s);
        }
        const moon = (mx, my, mr) => {
            const halo = x.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.2);
            halo.addColorStop(0, 'rgba(255,255,255,0.5)');
            halo.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = halo;
            x.fillRect(0, 0, S, S);
            x.fillStyle = '#f2f2f2';
            x.beginPath();
            x.arc(mx, my, mr, 0, TAU);
            x.fill();
        };
        const glow = (gx, gy, rad, a = 1) => {
            const g = x.createRadialGradient(gx, gy, 0, gx, gy, rad);
            g.addColorStop(0, `rgba(255,255,255,${a})`);
            g.addColorStop(0.3, `rgba(255,255,255,${a * 0.5})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
        };
        const snowfall = (n) => {
            for (let i = 0; i < n; i++) {
                x.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
                x.beginPath();
                x.arc(r() * S, r() * S, 0.8 + r() * 2.2, 0, TAU);
                x.fill();
            }
        };
        const ink = '#0a0a0a';
        const rowOfHouses = (baseY, col, scale, wins) => {
            for (let hx = -10; hx < S + 10;) {
                const w = S * (0.08 + r() * 0.06) * scale;
                const list = [];
                house(x, r, hx + w / 2, baseY, w, w * (1 + r() * 0.8), {
                    col, frame: null, windows: list, snow: 'rgba(255,255,255,0.75)', door: false, chimneyChance: 0.6,
                });
                if (wins) {
                    list.forEach((wn) => {
                        if (r() < 0.55) {
                            x.fillStyle = '#fff';
                            x.fillRect(wn.x - wn.w / 2, wn.y - wn.h / 2, wn.w, wn.h);
                            glow(wn.x, wn.y, wn.w * 2.5, 0.35);
                        }
                    });
                }
                hx += w * 1.12;
            }
        };

        switch (track.scene) {
            case 'belfry': {
                moon(S * 0.72, S * 0.24, S * 0.1);
                rowOfHouses(S * 1.0, '#2a2a2a', 0.9, true);
                // a great arch with a bell, close up
                x.fillStyle = ink;
                const ax = S * 0.38;
                x.fillRect(ax - S * 0.22, S * 0.18, S * 0.44, S * 0.62);
                x.beginPath();
                x.moveTo(ax - S * 0.25, S * 0.2);
                x.lineTo(ax, S * 0.06);
                x.lineTo(ax + S * 0.25, S * 0.2);
                x.fill();
                x.save();
                x.globalCompositeOperation = 'destination-out';
                x.beginPath();
                x.moveTo(ax - S * 0.13, S * 0.62);
                x.lineTo(ax - S * 0.13, S * 0.36);
                x.arc(ax, S * 0.36, S * 0.13, Math.PI, TAU);
                x.lineTo(ax + S * 0.13, S * 0.62);
                x.fill();
                x.restore();
                // fill the opening with lit sky behind
                x.save();
                x.globalCompositeOperation = 'destination-over';
                x.fillStyle = '#a0a0a0';
                x.fillRect(0, 0, S, S);
                x.restore();
                glow(ax, S * 0.47, S * 0.18, 0.55);
                x.fillStyle = ink;
                x.beginPath();
                x.moveTo(ax - S * 0.1, S * 0.56);
                x.quadraticCurveTo(ax - S * 0.08, S * 0.33, ax, S * 0.32);
                x.quadraticCurveTo(ax + S * 0.08, S * 0.33, ax + S * 0.1, S * 0.56);
                x.closePath();
                x.fill();
                x.fillRect(ax - S * 0.12, S * 0.3, S * 0.24, S * 0.02);
                x.beginPath();
                x.arc(ax, S * 0.58, S * 0.02, 0, TAU);
                x.fill();
                snowfall(60);
                break;
            }
            case 'lamp': {
                moon(S * 0.5, S * 0.16, S * 0.07);
                // a narrow lane; houses lean in from both sides
                for (const side of [-1, 1]) {
                    for (let k = 0; k < 5; k++) {
                        const t = k / 4;
                        const v = Math.round(lerp(80, 10, t));
                        const col = `rgb(${v},${v},${v})`;
                        const w = lerp(S * 0.1, S * 0.36, t);
                        const hx = S / 2 + side * lerp(S * 0.08, S * 0.42, t);
                        const list = [];
                        house(x, r, hx, lerp(S * 0.7, S * 1.08, t), w, w * 1.5, {
                            col, frame: null, windows: list, door: false, chimneyChance: 0.5, lean: side * 0.08,
                            snow: 'rgba(255,255,255,0.6)', gable: true,
                        });
                        list.forEach((wn) => {
                            if (r() < 0.4) {
                                x.fillStyle = '#fff';
                                x.fillRect(wn.x - wn.w / 2, wn.y - wn.h / 2, wn.w, wn.h);
                            }
                        });
                    }
                }
                x.fillStyle = '#1a1a1a';
                x.beginPath();
                x.moveTo(S * 0.45, S * 0.7);
                x.lineTo(S * 0.55, S * 0.7);
                x.lineTo(S * 0.9, S);
                x.lineTo(S * 0.1, S);
                x.fill();
                // the lamplighter, pole raised to a lantern
                const fx2 = S * 0.42;
                const fy = S * 0.93;
                x.fillStyle = ink;
                x.strokeStyle = ink;
                x.beginPath();
                x.moveTo(fx2 - S * 0.04, fy);
                x.lineTo(fx2 - S * 0.025, fy - S * 0.13);
                x.lineTo(fx2 + S * 0.025, fy - S * 0.13);
                x.lineTo(fx2 + S * 0.04, fy);
                x.fill();
                x.beginPath();
                x.arc(fx2, fy - S * 0.15, S * 0.022, 0, TAU);
                x.fill();
                x.beginPath();
                x.moveTo(fx2 - S * 0.03, fy - S * 0.16);
                x.lineTo(fx2, fy - S * 0.2);
                x.lineTo(fx2 + S * 0.03, fy - S * 0.16);
                x.fill();
                x.lineWidth = 2.5;
                x.beginPath();
                x.moveTo(fx2 + S * 0.02, fy - S * 0.1);
                x.lineTo(fx2 + S * 0.15, fy - S * 0.36);
                x.stroke();
                x.fillRect(S * 0.6, S * 0.5, 4, S * 0.5);
                x.fillRect(S * 0.585, S * 0.42, S * 0.05, S * 0.08);
                glow(S * 0.61, S * 0.46, S * 0.16, 0.9);
                glow(fx2 + S * 0.15, fy - S * 0.37, S * 0.04, 1);
                snowfall(50);
                break;
            }
            case 'gables': {
                moon(S * 0.3, S * 0.2, S * 0.08);
                rowOfHouses(S * 0.72, '#6a6a6a', 0.6, false);
                rowOfHouses(S * 0.86, '#333', 0.85, true);
                rowOfHouses(S * 1.04, ink, 1.3, true);
                snowfall(160);
                break;
            }
            case 'chimneys': {
                moon(S * 0.66, S * 0.22, S * 0.11);
                const list = [];
                for (let hx = -10; hx < S + 10;) {
                    const w = S * (0.12 + r() * 0.06);
                    house(x, r, hx + w / 2, S * 1.02, w, w * (1.2 + r() * 0.8), {
                        col: '#141414', frame: null, windows: list, chimneys: list.chim ??= [], snow: 'rgba(255,255,255,0.6)',
                        door: false, chimneyChance: 1,
                    });
                    hx += w * 1.05;
                }
                (list.chim || []).forEach((c) => {
                    for (let k = 0; k < 9; k++) {
                        const t = k / 8;
                        const g = x.createRadialGradient(c.x + t * S * 0.12, c.y - t * S * 0.22, 0, c.x + t * S * 0.12, c.y - t * S * 0.22, 6 + t * 22);
                        g.addColorStop(0, `rgba(230,230,230,${0.35 * (1 - t)})`);
                        g.addColorStop(1, 'rgba(230,230,230,0)');
                        x.fillStyle = g;
                        x.fillRect(0, 0, S, S);
                    }
                });
                list.forEach((wn) => {
                    if (r() < 0.5) {
                        x.fillStyle = '#fff';
                        x.fillRect(wn.x - wn.w / 2, wn.y - wn.h / 2, wn.w, wn.h);
                    }
                });
                x.strokeStyle = ink;
                x.lineWidth = 1.8;
                for (let i = 0; i < 6; i++) {
                    const bx2 = S * (0.15 + r() * 0.5);
                    const by2 = S * (0.12 + r() * 0.25);
                    const s = 5 + r() * 5;
                    x.beginPath();
                    x.moveTo(bx2 - s, by2 - s * 0.5);
                    x.quadraticCurveTo(bx2 - s * 0.4, by2, bx2, by2);
                    x.quadraticCurveTo(bx2 + s * 0.4, by2, bx2 + s, by2 - s * 0.5);
                    x.stroke();
                }
                break;
            }
            case 'gate':
            default: {
                moon(S * 0.5, S * 0.2, S * 0.09);
                rowOfHouses(S * 0.66, '#666', 0.5, false);
                x.fillStyle = ink;
                // wall, two round towers with conical caps, and the gate arch
                x.fillRect(0, S * 0.5, S, S * 0.5);
                for (const tx of [S * 0.2, S * 0.8]) {
                    x.fillRect(tx - S * 0.11, S * 0.32, S * 0.22, S * 0.68);
                    x.beginPath();
                    x.moveTo(tx - S * 0.14, S * 0.33);
                    x.lineTo(tx, S * 0.08);
                    x.lineTo(tx + S * 0.14, S * 0.33);
                    x.fill();
                    x.save();
                    x.globalCompositeOperation = 'destination-out';
                    x.fillRect(tx - S * 0.012, S * 0.44, S * 0.024, S * 0.06);
                    x.restore();
                }
                for (let cx2 = S * 0.31; cx2 < S * 0.7; cx2 += S * 0.06) x.fillRect(cx2, S * 0.46, S * 0.035, S * 0.05);
                x.save();
                x.globalCompositeOperation = 'destination-out';
                x.beginPath();
                x.moveTo(S * 0.38, S);
                x.lineTo(S * 0.38, S * 0.7);
                x.arc(S * 0.5, S * 0.7, S * 0.12, Math.PI, TAU);
                x.lineTo(S * 0.62, S);
                x.fill();
                x.restore();
                x.save();
                x.globalCompositeOperation = 'destination-over';
                x.fillStyle = '#8a8a8a';
                x.fillRect(0, 0, S, S);
                x.restore();
                glow(S * 0.5, S * 0.86, S * 0.2, 0.8);
                // portcullis, half lowered
                x.fillStyle = ink;
                for (let gx = S * 0.39; gx < S * 0.62; gx += S * 0.03) x.fillRect(gx, S * 0.58, S * 0.008, S * 0.24);
                for (let gy = S * 0.62; gy < S * 0.82; gy += S * 0.045) x.fillRect(S * 0.38, gy, S * 0.24, S * 0.008);
                for (let gx = S * 0.39; gx < S * 0.62; gx += S * 0.03) {
                    x.beginPath();
                    x.moveTo(gx - 2, S * 0.82);
                    x.lineTo(gx + S * 0.004, S * 0.85);
                    x.lineTo(gx + S * 0.008 + 2, S * 0.82);
                    x.fill();
                }
                snowfall(70);
                break;
            }
        }
    }

    function drawCover(track) {
        const c = $('#cover-art').getContext('2d');
        const S = 360;
        const B = 22;
        const N = S / 2;
        const big = document.createElement('canvas');
        big.width = big.height = S;
        paintCover(big.getContext('2d'), S, track);

        const small = document.createElement('canvas');
        small.width = small.height = N;
        const sx = small.getContext('2d');
        sx.drawImage(big, 0, 0, N, N);
        const img = sx.getImageData(0, 0, N, N);
        const d = img.data;
        const L = new Float32Array(N * N);
        const r = mulberry32(track.seed + 3);
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
            d[i * 4] = on ? 236 : 14;
            d[i * 4 + 1] = on ? 230 : 13;
            d[i * 4 + 2] = on ? 216 : 11;
            d[i * 4 + 3] = 255;
        }
        sx.putImageData(img, 0, 0);
        c.imageSmoothingEnabled = false;
        c.drawImage(small, 0, 0, N, N, 0, 0, S, S);

        // almanac border: double rule, a chain of diamonds, star corners
        const paper = '#ece6d8';
        const inkC = '#0e0d0b';
        c.fillStyle = paper;
        c.fillRect(0, 0, S, B);
        c.fillRect(0, S - B, S, B);
        c.fillRect(0, 0, B, S);
        c.fillRect(S - B, 0, B, S);
        c.strokeStyle = inkC;
        c.lineWidth = 2;
        c.strokeRect(4, 4, S - 8, S - 8);
        c.strokeRect(B - 3, B - 3, S - 2 * B + 6, S - 2 * B + 6);
        c.fillStyle = inkC;
        const m = B / 2 + 0.5;
        const diamond = (x, y, s) => {
            c.beginPath();
            c.moveTo(x, y - s);
            c.lineTo(x + s * 0.7, y);
            c.lineTo(x, y + s);
            c.lineTo(x - s * 0.7, y);
            c.fill();
        };
        for (let p = B + 10; p < S - B - 6; p += 14) {
            diamond(p, m, 3.6);
            diamond(p, S - m, 3.6);
            diamond(m, p, 3.6);
            diamond(S - m, p, 3.6);
        }
        [[m, m], [S - m, m], [m, S - m], [S - m, S - m]].forEach(([x, y]) => {
            c.beginPath();
            for (let k = 0; k < 8; k++) {
                const a = (k / 8) * TAU - Math.PI / 2;
                const rad = k % 2 ? 2.6 : 8.5;
                c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
            }
            c.closePath();
            c.fill();
        });

        c.save();
        c.font = `${Math.round(S * 0.066)}px font, serif`;
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.lineWidth = 5;
        c.strokeStyle = inkC;
        c.strokeText(track.artist, S / 2, B + 12);
        c.fillStyle = paper;
        c.fillText(track.artist, S / 2, B + 12);
        c.restore();
    }

    /* ================================================================== */
    /* Player behaviour (visual only)                                      */
    /* ================================================================== */

    const ui = {
        sheet: $('.sheet'),
        title: $('#track-title'),
        artist: $('#track-artist'),
        kicker: $('#kicker'),
        candles: $('#candles'),
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
        key: $('#progress-key'),
        cur: $('#time-current'),
        dur: $('#time-duration'),
        hint: $('.almanac__hint'),
    };

    const player = { index: 0, elapsed: 0, shuffle: false, loop: false, muted: false, volume: 70 };
    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    function renderTrack() {
        const t = TRACKS[player.index];
        ui.title.textContent = t.title;
        ui.artist.textContent = t.artist;
        ui.kicker.innerHTML = `The ${ORDINAL[player.index]} Hour &middot; of V`;
        ui.dur.textContent = fmt(t.duration);
        drawCover(t);
        renderProgress();
    }

    function renderProgress() {
        const t = TRACKS[player.index];
        const pct = clamp((player.elapsed / t.duration) * 100, 0, 100);
        ui.progressFill.style.width = `${pct}%`;
        ui.key.style.left = `${pct}%`;
        ui.progress.setAttribute('aria-valuenow', pct.toFixed(0));
        ui.cur.textContent = fmt(player.elapsed);
    }

    function turnTo(index) {
        ui.sheet.classList.add('is-turning');
        setTimeout(() => {
            player.index = (index + TRACKS.length) % TRACKS.length;
            player.elapsed = 0;
            renderTrack();
            ui.sheet.classList.remove('is-turning');
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
        ui.candles.dataset.state = on ? 'playing' : 'idle';
        if (on) {
            toll(performance.now());
            state.nextAutoToll = performance.now() + 5200;
        }
    }

    function updateWarmth() {
        const v = player.muted ? 0 : player.volume / 100;
        state.warmth = 0.25 + v * 0.9;
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
        updateWarmth();
    });
    ui.volume.addEventListener('input', () => {
        player.volume = Number(ui.volume.value);
        player.muted = false;
        updateWarmth();
    });

    const seek = (clientX) => {
        const rect = ui.progress.getBoundingClientRect();
        player.elapsed = clamp((clientX - rect.left) / rect.width, 0, 1) * TRACKS[player.index].duration;
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

    window.addEventListener('pointermove', (e) => {
        state.pointer.x = e.clientX;
        state.pointer.y = e.clientY;
        state.pointer.active = true;
        state.parallax.tx = (e.clientX / window.innerWidth - 0.5) * 36;
        state.parallax.ty = (e.clientY / window.innerHeight - 0.5) * 16;
    });
    document.addEventListener('pointerleave', () => {
        state.pointer.active = false;
        state.parallax.tx = 0;
        state.parallax.ty = 0;
    });
    window.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.sheet')) return;
        toll(performance.now());
        ui.hint.classList.add('is-gone');
    });

    /* ================================================================== */
    /* Boot                                                                */
    /* ================================================================== */

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            drawTown();
            setupSnow();
            setupBirds();
            drawPatina();
        }, 150);
    });

    buildSky();
    buildFog();
    buildSheetDecor();
    drawTown();
    setupSnow();
    setupBirds();
    updateWarmth();
    renderTrack();
    requestAnimationFrame(frame);

    document.fonts.ready.then(() => {
        drawCover(TRACKS[player.index]);
        drawPatina();
    });
})();
