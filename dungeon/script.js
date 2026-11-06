/*
 * The Undercroft Ledger
 * A third sibling to The Arcane Archive: an endless vaulted corridor beneath a chapel.
 * Everything is drawn in code. A layer of darkness sits over the stone, and every
 * flame (and the visitor's own torch, the cursor) burns a hole through it.
 */
(() => {
    'use strict';

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const OVERSCAN = 0.04;
    const TAU = Math.PI * 2;

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

    function bezierPoint(p, t) {
        const u = 1 - t;
        return [
            u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
            u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7],
        ];
    }

    const stoneCol = (l, a = 1) => `rgba(${Math.round(l)},${Math.round(l * 0.95)},${Math.round(l * 0.87)},${a})`;

    /* ================================================================== */
    /* Masonry vocabulary: pointed arches, blocks, chains, bones           */
    /* ================================================================== */

    // a pointed (gothic) arch, closed along the floor
    function archShape(ctx, cx, floorY, springY, hw, peak) {
        ctx.moveTo(cx - hw, floorY);
        ctx.lineTo(cx - hw, springY);
        ctx.bezierCurveTo(cx - hw, springY - hw * 0.75 * peak, cx - hw * 0.3, springY - hw * 1.05 * peak, cx, springY - hw * 1.25 * peak);
        ctx.bezierCurveTo(cx + hw * 0.3, springY - hw * 1.05 * peak, cx + hw, springY - hw * 0.75 * peak, cx + hw, springY);
        ctx.lineTo(cx + hw, floorY);
        ctx.closePath();
    }

    function archPt(cx, springY, hw, peak, t) {
        const left = t <= 0.5;
        const u = left ? t * 2 : (1 - t) * 2;
        const P = [cx - hw, springY, cx - hw, springY - hw * 0.75 * peak, cx - hw * 0.3, springY - hw * 1.05 * peak, cx, springY - hw * 1.25 * peak];
        let [x, y] = bezierPoint(P, u);
        if (!left) x = 2 * cx - x;
        return [x, y];
    }

    // y of an arch's intrados above a given x (sampled)
    function archYAt(cx, springY, hw, peak, x) {
        if (x <= cx - hw || x >= cx + hw) return null;
        let best = null;
        let bd = Infinity;
        for (let i = 0; i <= 200; i++) {
            const [px, py] = archPt(cx, springY, hw, peak, i / 200);
            const d = Math.abs(px - x);
            if (d < bd) {
                bd = d;
                best = py;
            }
        }
        return best;
    }

    // a ring of voussoirs, with pier joints
    function archRing(ctx, r, g, fill, line, opts = {}) {
        const { cx, floorY, springY, hw, t, peak } = g;
        ctx.fillStyle = fill;
        ctx.beginPath();
        archShape(ctx, cx, floorY, springY, hw + t, peak);
        archShape(ctx, cx, floorY, springY, hw, peak);
        ctx.fill('evenodd');

        ctx.strokeStyle = line;
        ctx.lineWidth = Math.max(0.6, t * 0.05);
        ctx.beginPath();
        const n = Math.max(9, Math.round(hw / Math.max(t * 0.55, 4)));
        for (let i = 1; i < n; i++) {
            const k = i / n;
            const [x1, y1] = archPt(cx, springY, hw, peak, k);
            const [x2, y2] = archPt(cx, springY, hw + t, peak, k);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        // the intrados and extrados edges
        for (const w of [hw, hw + t]) {
            for (let i = 0; i <= 60; i++) {
                const [x, y] = archPt(cx, springY, w, peak, i / 60);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        }
        // pier courses
        const course = Math.max(4, t * 0.55);
        let row = 0;
        for (let y = floorY - course; y > springY; y -= course) {
            ctx.moveTo(cx - hw - t, y);
            ctx.lineTo(cx - hw, y);
            ctx.moveTo(cx + hw, y);
            ctx.lineTo(cx + hw + t, y);
            const off = row++ % 2 ? 0.35 : 0.7;
            ctx.moveTo(cx - hw - t * off, y);
            ctx.lineTo(cx - hw - t * off, y + course);
            ctx.moveTo(cx + hw + t * off, y);
            ctx.lineTo(cx + hw + t * off, y + course);
        }
        ctx.stroke();

        // a lit edge along the inner curve: stone catching the light
        if (opts.edge) {
            ctx.strokeStyle = opts.edge;
            ctx.lineWidth = Math.max(0.8, t * 0.04);
            ctx.beginPath();
            for (let i = 0; i <= 60; i++) {
                const [x, y] = archPt(cx, springY, hw, peak, i / 60);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.lineTo(cx + hw, floorY);
            ctx.moveTo(cx - hw, springY);
            ctx.lineTo(cx - hw, floorY);
            ctx.stroke();
        }
    }

    function speckle(ctx, r, x, y, w, h, count, light, dark) {
        for (let i = 0; i < count; i++) {
            ctx.fillStyle = r() < 0.5 ? light : dark;
            const s = 0.6 + r() * 1.8;
            ctx.fillRect(x + r() * w, y + r() * h, s, s);
        }
    }

    function chain(ctx, x1, y1, x2, y2, link, color) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const step = link * 0.78;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        for (let i = 0, d = link / 2; d < len; i++, d += step) {
            const cx = x1 + Math.cos(ang) * d;
            const cy = y1 + Math.sin(ang) * d;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang);
            if (i % 2) {
                ctx.lineWidth = link * 0.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, link * 0.55, link * 0.32, 0, 0, TAU);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.roundRect(-link * 0.55, -link * 0.11, link * 1.1, link * 0.22, link * 0.11);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();
    }

    function skull(ctx, x, y, s, bone, hole, tilt = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        ctx.fillStyle = bone;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.58, s * 0.5, s * 0.46, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.42, -s * 0.5);
        ctx.quadraticCurveTo(-s * 0.4, -s * 0.12, -s * 0.24, -s * 0.12);
        ctx.lineTo(-s * 0.22, s * 0.02);
        ctx.lineTo(s * 0.22, s * 0.02);
        ctx.lineTo(s * 0.24, -s * 0.12);
        ctx.quadraticCurveTo(s * 0.4, -s * 0.12, s * 0.42, -s * 0.5);
        ctx.fill();
        ctx.fillStyle = hole;
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(side * s * 0.19, -s * 0.44, s * 0.13, s * 0.15, side * 0.2, 0, TAU);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.33);
        ctx.lineTo(-s * 0.06, -s * 0.2);
        ctx.lineTo(s * 0.06, -s * 0.2);
        ctx.fill();
        ctx.strokeStyle = hole;
        ctx.lineWidth = Math.max(0.6, s * 0.03);
        ctx.beginPath();
        for (let i = -3; i <= 3; i++) {
            ctx.moveTo(i * s * 0.06, -s * 0.1);
            ctx.lineTo(i * s * 0.06, s * 0.01);
        }
        ctx.moveTo(-s * 0.22, -s * 0.05);
        ctx.lineTo(s * 0.22, -s * 0.05);
        ctx.stroke();
        ctx.restore();
    }

    function bone(ctx, x, y, len, ang, w, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-len / 2, -w * 0.3, len, w * 0.6, w * 0.3);
        ctx.fill();
        for (const e of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(e * len / 2, -w * 0.32, w * 0.42, 0, TAU);
            ctx.arc(e * len / 2, w * 0.32, w * 0.42, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    }

    /* ================================================================== */
    /* The endless corridor (also reused for a cover)                      */
    /* ================================================================== */

    function corridor(ctx, w, h, o) {
        const r = o.r;
        const geom = (s) => ({
            cx: o.vpx,
            hw: o.spread * s,
            floorY: o.vpy + o.drop * s,
            springY: o.vpy - o.rise * s,
            t: o.spread * s * 0.17,
            peak: o.peak,
        });
        const depths = o.depths;
        const gN = geom(depths[0] * 1.8);
        const gF = geom(depths[depths.length - 1]);

        ctx.fillStyle = o.bg;
        ctx.fillRect(0, 0, w, h);

        // side walls, receding
        for (const side of [-1, 1]) {
            const xn = gN.cx + side * gN.hw;
            const xf = gF.cx + side * gF.hw;
            const grad = ctx.createLinearGradient(xn, 0, xf, 0);
            grad.addColorStop(0, o.wallNear);
            grad.addColorStop(1, o.wallFar);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(xn, gN.floorY);
            ctx.lineTo(xn, gN.springY - gN.hw * 0.4);
            ctx.lineTo(xf, gF.springY - gF.hw * 0.4);
            ctx.lineTo(xf, gF.floorY);
            ctx.closePath();
            ctx.fill();
            // coursing lines converging on the vanishing point
            ctx.strokeStyle = o.wallLine;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (let f = 0; f <= 1.0001; f += 1 / 9) {
                ctx.moveTo(xn, lerp(gN.floorY, gN.springY - gN.hw * 0.4, f));
                ctx.lineTo(xf, lerp(gF.floorY, gF.springY - gF.hw * 0.4, f));
            }
            ctx.stroke();
        }

        // floor of worn flagstones
        const fg = ctx.createLinearGradient(0, gF.floorY, 0, h);
        fg.addColorStop(0, o.floorFar);
        fg.addColorStop(1, o.floorNear);
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(gF.cx - gF.hw, gF.floorY);
        ctx.lineTo(gF.cx + gF.hw, gF.floorY);
        ctx.lineTo(w + w, h + h * 0.2);
        ctx.lineTo(-w, h + h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = o.floorLine;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let f = -1.4; f <= 2.4; f += 0.2) {
            const xf = lerp(gF.cx - gF.hw, gF.cx + gF.hw, f);
            const xb = lerp(o.vpx - o.spread * 3, o.vpx + o.spread * 3, f);
            ctx.moveTo(xf, gF.floorY);
            ctx.lineTo(xb, o.vpy + o.drop * 3);
        }
        for (let s = depths[depths.length - 1]; s < 3; s *= 1.18) {
            const g = geom(s);
            ctx.moveTo(g.cx - g.hw * 4, g.floorY);
            ctx.lineTo(g.cx + g.hw * 4, g.floorY);
        }
        ctx.stroke();

        // the ribs, far to near, each a shade brighter
        const rev = [...depths].reverse();
        const ribs = [];
        rev.forEach((s, i) => {
            const g = geom(s);
            const k = i / (rev.length - 1);
            archRing(ctx, r, g, o.ribFill(k), o.ribLine(k), { edge: o.ribEdge ? o.ribEdge(k) : null });
            ribs.push({ ...g, s, k });
        });
        return { far: gF, ribs, geom };
    }

    /* ================================================================== */
    /* Scene layers                                                        */
    /* ================================================================== */

    const layers = {
        far: $('#layer-far'),
        farFx: $('#layer-far-fx'),
        mid: $('#layer-mid'),
        near: $('#layer-near'),
        nearFx: $('#layer-near-fx'),
    };
    const darkCv = $('#darkness');
    const glowCv = $('#glow');

    const scene = { cw: 0, ch: 0, torches: [], end: null, censer: null, drips: [], floorY: 0 };

    function sizeCanvas(cv, w, h, dpr = DPR) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return ctx;
    }

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(layers.far, cw, ch);
        sizeCanvas(layers.farFx, cw, ch);
        const r = mulberry32(606);
        const vpx = cw * 0.5;
        const vpy = ch * 0.47;
        const unit = Math.min(cw, ch * 1.5);
        const res = corridor(ctx, cw, ch, {
            r,
            vpx,
            vpy,
            spread: unit * 0.4,
            drop: ch * 0.52,
            rise: ch * 0.06,
            peak: 1,
            depths: [0.62, 0.48, 0.37, 0.285, 0.22, 0.17, 0.13, 0.1, 0.077],
            bg: '#070605',
            wallNear: stoneCol(30),
            wallFar: stoneCol(9),
            wallLine: 'rgba(0,0,0,0.45)',
            floorFar: stoneCol(12),
            floorNear: stoneCol(50),
            floorLine: 'rgba(0,0,0,0.5)',
            ribFill: (k) => stoneCol(lerp(12, 46, k * k)),
            ribLine: () => 'rgba(0,0,0,0.55)',
            ribEdge: (k) => stoneCol(lerp(20, 70, k * k), 0.6),
        });
        scene.end = { ...res.far, layer: 'far' };

        // torches on alternate piers, receding
        res.ribs.forEach((g, i) => {
            if (g.s > 0.5 || g.s < 0.12 || i % 2) return;
            for (const side of [-1, 1]) {
                const x = g.cx + side * (g.hw + g.t * 0.5);
                const y = lerp(g.floorY, g.springY, 0.55);
                ctx.fillStyle = '#060505';
                ctx.fillRect(x - g.t * 0.06, y, g.t * 0.12, g.t * 0.5);
                scene.torches.push({ x, y, size: g.t * 0.55, layer: 'far', depth: 0.18, phase: r() * TAU, reach: g.t * 5 });
            }
        });

        speckle(ctx, r, 0, 0, cw, ch, 2500, 'rgba(255,240,220,0.035)', 'rgba(0,0,0,0.2)');
    }

    function pillar(ctx, r, x, w, top, bottom, side) {
        // shaft, block by block
        const course = Math.max(22, w * 0.42);
        let row = 0;
        for (let y = bottom - course * 1.6; y > top - course; y -= course) {
            const off = row++ % 2 ? 0.38 : 0.62;
            const l1 = 28 + r() * 10;
            const l2 = 28 + r() * 10;
            ctx.fillStyle = stoneCol(l1);
            ctx.fillRect(x - w / 2, y, w * off, course);
            ctx.fillStyle = stoneCol(l2);
            ctx.fillRect(x - w / 2 + w * off, y, w * (1 - off), course);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(x - w / 2, y, w, 1.2);
            ctx.fillRect(x - w / 2 + w * off, y, 1.2, course);
            // chipped corners
            if (r() < 0.3) {
                ctx.fillStyle = '#070605';
                ctx.beginPath();
                const cx = r() < 0.5 ? x - w / 2 : x + w / 2;
                ctx.arc(cx, y + r() * course, 2 + r() * 5, 0, TAU);
                ctx.fill();
            }
        }
        // shading: lit on the side facing the corridor
        const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, side > 0 ? 'rgba(255,230,200,0.06)' : 'rgba(0,0,0,0.55)');
        g.addColorStop(1, side > 0 ? 'rgba(0,0,0,0.55)' : 'rgba(255,230,200,0.06)');
        ctx.fillStyle = g;
        ctx.fillRect(x - w / 2, top - course, w, bottom - top + course);
        // plinth
        ctx.fillStyle = stoneCol(24);
        ctx.fillRect(x - w * 0.68, bottom - course * 1.6, w * 1.36, course * 0.9);
        ctx.fillStyle = stoneCol(18);
        ctx.fillRect(x - w * 0.78, bottom - course * 0.7, w * 1.56, course * 0.9);
        speckle(ctx, r, x - w * 0.8, top, w * 1.6, bottom - top, 900, 'rgba(255,240,220,0.05)', 'rgba(0,0,0,0.3)');
    }

    function torchBracket(ctx, x, y, side, s) {
        ctx.save();
        ctx.fillStyle = '#0a0908';
        ctx.strokeStyle = '#0a0908';
        ctx.fillRect(x - s * 0.2, y + s * 0.6, s * 0.4, s * 1.1);
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 1.2);
        ctx.lineTo(x + side * s * 0.9, y + s * 0.6);
        ctx.stroke();
        // cup
        ctx.beginPath();
        ctx.moveTo(x + side * s * 0.55, y + s * 0.3);
        ctx.lineTo(x + side * s * 1.25, y + s * 0.3);
        ctx.lineTo(x + side * s * 1.05, y + s * 0.75);
        ctx.lineTo(x + side * s * 0.75, y + s * 0.75);
        ctx.closePath();
        ctx.fill();
        // the torch, wrapped in pitch-soaked rag
        ctx.lineWidth = s * 0.22;
        ctx.beginPath();
        ctx.moveTo(x + side * s * 0.9, y + s * 0.5);
        ctx.lineTo(x + side * s * 1.0, y - s * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x + side * s * 1.0, y - s * 0.55, s * 0.22, s * 0.32, side * 0.1, 0, TAU);
        ctx.fill();
        ctx.restore();
        return { x: x + side * s * 1.0, y: y - s * 0.8 };
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(layers.mid, cw, ch);
        const r = mulberry32(919);
        const floor = ch * 0.97;
        const w = Math.max(64, cw * 0.075);
        const capY = ch * 0.13;

        for (const [fx, side] of [[0.15, 1], [0.85, -1]]) {
            const x = cw * fx;
            pillar(ctx, r, x, w, capY, floor, side);
            // capital
            ctx.fillStyle = stoneCol(26);
            ctx.beginPath();
            ctx.moveTo(x - w * 0.5, capY + w * 0.5);
            ctx.lineTo(x - w * 0.85, capY);
            ctx.lineTo(x + w * 0.85, capY);
            ctx.lineTo(x + w * 0.5, capY + w * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = stoneCol(20);
            ctx.fillRect(x - w * 0.95, capY - w * 0.22, w * 1.9, w * 0.24);
            // vault ribs springing from the capital
            ctx.strokeStyle = stoneCol(22);
            ctx.lineWidth = w * 0.42;
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(x, capY - w * 0.1);
            ctx.quadraticCurveTo(x + side * w * 0.2, -ch * 0.05, x + side * cw * 0.32, -ch * 0.12);
            ctx.moveTo(x, capY - w * 0.1);
            ctx.quadraticCurveTo(x - side * w * 0.1, -ch * 0.02, x - side * w * 1.2, -ch * 0.14);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, capY - w * 0.1);
            ctx.quadraticCurveTo(x + side * w * 0.2, -ch * 0.05, x + side * cw * 0.32, -ch * 0.12);
            ctx.stroke();
            ctx.lineCap = 'round';

            const flame = torchBracket(ctx, x + side * w * 0.5, ch * (ch > cw ? 0.2 : 0.42), side, Math.max(14, w * 0.3));
            scene.torches.push({ x: flame.x, y: flame.y, size: Math.max(16, w * 0.34), layer: 'mid', depth: 0.5, phase: r() * TAU, reach: ch * 0.36 });
        }

        // hanging chains with shackles
        [[0.32, 0.36], [0.27, 0.22], [0.69, 0.3], [0.74, 0.18]].forEach(([fx, fl]) => {
            const x = cw * fx;
            const len = ch * fl;
            chain(ctx, x, -10, x + (r() - 0.5) * 6, len, Math.max(9, ch * 0.014), '#0c0b0a');
            ctx.strokeStyle = '#0c0b0a';
            ctx.lineWidth = Math.max(3, ch * 0.005);
            ctx.beginPath();
            ctx.arc(x, len + ch * 0.018, ch * 0.016, -0.3, Math.PI + 0.3);
            ctx.stroke();
        });

        // a heap of bones at the left pillar's foot
        const bx = cw * 0.22;
        const by = floor - 4;
        const boneCol = stoneCol(54);
        for (let i = 0; i < 9; i++) {
            bone(ctx, bx + (r() - 0.5) * 70, by - r() * 14, 22 + r() * 26, (r() - 0.5) * 2.4, 5 + r() * 3, stoneCol(40 + r() * 16));
        }
        skull(ctx, bx - 12, by - 6, 26, boneCol, '#090807', -0.25);
        skull(ctx, bx + 22, by + 2, 20, stoneCol(44), '#090807', 0.35);
        // and a guttering stub of candle on the right
        ctx.fillStyle = stoneCol(50);
        ctx.fillRect(cw * 0.8, floor - 26, 9, 22);
        scene.torches.push({ x: cw * 0.8 + 4.5, y: floor - 32, size: 9, layer: 'mid', depth: 0.5, phase: 1, reach: ch * 0.12, candle: true });
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(layers.near, cw, ch);
        sizeCanvas(layers.nearFx, cw, ch);
        const r = mulberry32(313);
        const hw = cw * 0.43;
        const springY = ch * 0.4;
        const crownY = ch * 0.045;
        const peak = (springY - crownY) / (1.25 * hw);
        const cx = cw * 0.5;
        const floor = ch * 1.02;
        const T = Math.max(ch * 0.11, 70);
        const g = { cx, floorY: floor, springY, hw, t: T, peak };

        // everything outside the opening is solid stone
        ctx.fillStyle = stoneCol(15);
        ctx.beginPath();
        ctx.rect(0, 0, cw, ch);
        archShape(ctx, cx, floor, springY, hw, peak);
        ctx.fill('evenodd');
        archRing(ctx, r, g, stoneCol(19), 'rgba(0,0,0,0.6)', { edge: stoneCol(48, 0.7) });
        // wall blocks beyond the ring
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, cw, ch);
        archShape(ctx, cx, floor, springY, hw + T, peak);
        ctx.clip('evenodd');
        const course = T * 0.42;
        let row = 0;
        for (let y = 0; y < ch; y += course) {
            const off = row++ % 2 ? 0 : course * 1.1;
            for (let x = -off; x < cw; x += course * 2.2) {
                ctx.fillStyle = stoneCol(12 + r() * 6);
                ctx.fillRect(x + 1, y + 1, course * 2.2 - 2, course - 2);
            }
        }
        ctx.restore();

        // keystone with a carved eye
        const ky = crownY - T * 0.2;
        ctx.fillStyle = stoneCol(24);
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.36, ky - T * 0.9);
        ctx.lineTo(cx + T * 0.36, ky - T * 0.9);
        ctx.lineTo(cx + T * 0.26, ky + T * 0.35);
        ctx.lineTo(cx - T * 0.26, ky + T * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.2, ky - T * 0.25);
        ctx.quadraticCurveTo(cx, ky - T * 0.5, cx + T * 0.2, ky - T * 0.25);
        ctx.quadraticCurveTo(cx, ky, cx - T * 0.2, ky - T * 0.25);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath();
        ctx.arc(cx, ky - T * 0.25, T * 0.06, 0, TAU);
        ctx.fill();

        // cobweb in the upper left of the opening
        const wx = cx - hw + 4;
        const wy = archYAt(cx, springY, hw, peak, cx - hw * 0.72) ?? springY;
        ctx.strokeStyle = 'rgba(190,180,165,0.16)';
        ctx.lineWidth = 0.7;
        const spokes = [];
        for (let i = 0; i < 7; i++) {
            const a = -0.15 + (i / 6) * 1.25;
            const L = hw * (0.17 + r() * 0.06);
            spokes.push([Math.cos(a) * L, Math.sin(a) * L]);
        }
        const ox = wx;
        const oy = wy - hw * 0.05;
        ctx.beginPath();
        spokes.forEach(([dx, dy]) => {
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + dx, oy + dy);
        });
        for (let k = 0.2; k < 1; k += 0.13) {
            spokes.forEach(([dx, dy], i) => {
                const [nx, ny] = spokes[i + 1] || [];
                if (nx === undefined) return;
                ctx.moveTo(ox + dx * k, oy + dy * k);
                ctx.quadraticCurveTo(ox + (dx + nx) * k * 0.42, oy + (dy + ny) * k * 0.42, ox + nx * k, oy + ny * k);
            });
        }
        ctx.stroke();

        // a step and worn flagstones at the threshold
        ctx.fillStyle = stoneCol(24);
        ctx.fillRect(0, ch * 0.94, cw, ch * 0.08);
        ctx.fillStyle = stoneCol(30, 0.8);
        ctx.fillRect(0, ch * 0.94, cw, 1.5);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        for (let x = r() * 80; x < cw; x += 90 + r() * 120) {
            ctx.moveTo(x, ch * 0.94);
            ctx.lineTo(x - 6, ch);
        }
        ctx.stroke();
        scene.floorY = ch * 0.94;

        speckle(ctx, r, 0, 0, cw, ch, 4000, 'rgba(255,240,220,0.035)', 'rgba(0,0,0,0.3)');

        // the censer hangs from the arch, left of centre
        const px = cx - hw * 0.5;
        const py = archYAt(cx, springY, hw, peak, px) ?? ch * 0.1;
        scene.censer = { px, py: py - 4, len: ch * 0.36, angle: 0, vel: 0 };

        // where water seeps through the vault
        scene.drips = [0.38, 0.47, 0.6, 0.66].map((f) => {
            const x = cw * f;
            return { x, y0: (archYAt(cx, springY, hw, peak, x) ?? ch * 0.05) + 2, timer: 1 + Math.random() * 4, y: -1, v: 0, splash: 0 };
        });
    }

    function drawScene() {
        const cw = window.innerWidth * (1 + OVERSCAN * 2);
        const ch = window.innerHeight * (1 + OVERSCAN * 2);
        scene.cw = cw;
        scene.ch = ch;
        scene.torches = [];
        drawFar(cw, ch);
        drawMid(cw, ch);
        drawNear(cw, ch);
        sizeCanvas(darkCv, window.innerWidth, window.innerHeight, 1);
        sizeCanvas(glowCv, window.innerWidth, window.innerHeight, Math.min(DPR, 1.5));
        setupRats();
    }

    /* ================================================================== */
    /* Smoke textures                                                      */
    /* ================================================================== */

    function buildSmoke() {
        const tile = (seed, fx, fy, gain, cut) => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='520'>` +
                `<filter id='f' x='0' y='0' width='100%' height='100%'>` +
                `<feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='5' seed='${seed}' stitchTiles='stitch'/>` +
                `<feColorMatrix values='0 0 0 0 0.8  0 0 0 0 0.76  0 0 0 0 0.7  ${gain} 0 0 0 ${cut}'/>` +
                `</filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
            return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        };
        document.documentElement.style.setProperty('--smoke-tex-1', tile(5, 0.0026, 0.007, 2.6, -1.05));
        document.documentElement.style.setProperty('--smoke-tex-2', tile(29, 0.004, 0.012, 2.3, -0.9));
    }

    /* ================================================================== */
    /* Light: darkness, flames, embers, censer, drips, rats                */
    /* ================================================================== */

    const dark = darkCv.getContext('2d');
    const glow = glowCv.getContext('2d');
    const nearFx = layers.nearFx.getContext('2d');
    const farFx = layers.farFx.getContext('2d');

    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    (() => {
        const s = sprite.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,240,205,1)');
        g.addColorStop(0.15, 'rgba(255,190,110,0.8)');
        g.addColorStop(0.4, 'rgba(255,140,60,0.22)');
        g.addColorStop(1, 'rgba(255,110,40,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 64, 64);
    })();

    const smokeSprite = document.createElement('canvas');
    smokeSprite.width = smokeSprite.height = 64;
    (() => {
        const s = smokeSprite.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(150,142,130,0.5)');
        g.addColorStop(1, 'rgba(150,142,130,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 64, 64);
    })();

    const state = {
        playing: false,
        lightGain: 0.8,
        wake: 0, // eases 0 -> 1 when playing
        beat: 0,
        pointer: { x: -9999, y: -9999, active: false },
        parallax: { x: 0, y: 0, tx: 0, ty: 0 },
    };

    let embers = [];
    let puffs = [];
    let flares = [];
    let rats = [];

    const toView = (x, y, depth) => [
        x - window.innerWidth * OVERSCAN - state.parallax.x * depth,
        y - window.innerHeight * OVERSCAN - state.parallax.y * depth,
    ];

    function flicker(t, ph) {
        return 0.82 + 0.1 * Math.sin(t * 0.011 + ph) + 0.06 * Math.sin(t * 0.027 + ph * 2.3) + Math.random() * 0.05;
    }

    function hole(x, y, radius, strength) {
        const g = dark.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, `rgba(0,0,0,${strength})`);
        g.addColorStop(0.45, `rgba(0,0,0,${strength * 0.6})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dark.fillStyle = g;
        dark.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    function drawFlame(x, y, size, t, ph) {
        const sway = Math.sin(t * 0.009 + ph) * size * 0.18 + (Math.random() - 0.5) * size * 0.08;
        const h = size * (1.6 + 0.35 * Math.sin(t * 0.017 + ph * 1.7) + Math.random() * 0.2);
        const w = size * 0.42;
        for (const [scale, col] of [[1, 'rgba(255,140,50,0.75)'], [0.62, 'rgba(255,205,120,0.9)'], [0.32, 'rgba(255,248,225,1)']]) {
            glow.fillStyle = col;
            glow.beginPath();
            glow.moveTo(x - w * scale, y);
            glow.bezierCurveTo(x - w * scale, y - h * scale * 0.5, x + sway * scale, y - h * scale * 0.7, x + sway * 1.3 * scale, y - h * scale);
            glow.bezierCurveTo(x + sway * scale, y - h * scale * 0.6, x + w * scale, y - h * scale * 0.4, x + w * scale, y);
            glow.quadraticCurveTo(x, y + w * scale * 0.7, x - w * scale, y);
            glow.fill();
        }
    }

    function updateCenser(dt, t) {
        const c = scene.censer;
        if (!c) return null;
        const amp = lerp(0.1, 0.24, state.wake);
        const target = Math.sin(t * 0.0011) * amp;
        c.angle = lerp(c.angle, target, 0.08);
        const ex = c.px + Math.sin(c.angle) * c.len;
        const ey = c.py + Math.cos(c.angle) * c.len;
        const ch = scene.ch;
        const s = Math.max(14, ch * 0.024);

        nearFx.clearRect(0, 0, scene.cw, scene.ch);
        chain(nearFx, c.px, c.py, ex, ey - s * 0.9, Math.max(7, ch * 0.011), '#0d0c0a');
        // censer: domed, pierced lid over a round bowl
        nearFx.save();
        nearFx.translate(ex, ey);
        nearFx.rotate(-c.angle);
        nearFx.fillStyle = '#0f0d0b';
        nearFx.beginPath();
        nearFx.moveTo(-s * 0.15, -s * 1.15);
        nearFx.lineTo(s * 0.15, -s * 1.15);
        nearFx.quadraticCurveTo(s * 0.75, -s * 0.6, s * 0.7, -s * 0.05);
        nearFx.lineTo(-s * 0.7, -s * 0.05);
        nearFx.quadraticCurveTo(-s * 0.75, -s * 0.6, -s * 0.15, -s * 1.15);
        nearFx.fill();
        nearFx.beginPath();
        nearFx.ellipse(0, s * 0.1, s * 0.75, s * 0.5, 0, 0, Math.PI);
        nearFx.fill();
        nearFx.fillRect(-s * 0.8, -s * 0.08, s * 1.6, s * 0.2);
        nearFx.fillRect(-s * 0.2, s * 0.55, s * 0.4, s * 0.25);
        nearFx.strokeStyle = 'rgba(255,230,200,0.12)';
        nearFx.lineWidth = 1;
        nearFx.beginPath();
        nearFx.arc(0, s * 0.1, s * 0.62, 0.3, Math.PI - 0.3);
        nearFx.stroke();
        nearFx.restore();

        // incense smoke
        if (!reduceMotion && Math.random() < 0.35 * dt) {
            puffs.push({ x: ex + (Math.random() - 0.5) * s, y: ey - s * 0.8, r: s * 0.8, life: 1, vx: (Math.random() - 0.5) * 0.3, vy: -0.45 - Math.random() * 0.3 });
        }
        for (let i = puffs.length - 1; i >= 0; i--) {
            const p = puffs[i];
            p.x += (p.vx + Math.sin(t * 0.001 + i) * 0.15) * dt;
            p.y += p.vy * dt;
            p.r += 0.35 * dt;
            p.life -= 0.004 * dt;
            if (p.life <= 0) {
                puffs.splice(i, 1);
                continue;
            }
            nearFx.globalAlpha = p.life * 0.13;
            nearFx.drawImage(smokeSprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
        nearFx.globalAlpha = 1;

        // coals glinting through the lid
        const [vx, vy] = toView(ex, ey - s * 0.55, 1);
        return { x: vx, y: vy, s };
    }

    function drawEnd(t) {
        const e = scene.end;
        if (!e) return;
        farFx.clearRect(0, 0, scene.cw, scene.ch);
        farFx.save();
        farFx.beginPath();
        archShape(farFx, e.cx, e.floorY, e.springY, e.hw, e.peak);
        farFx.clip();
        // whatever burns at the end of the corridor
        const pulse = 0.35 + 0.15 * Math.sin(t * 0.0009) + state.wake * (0.35 + state.beat * 0.25);
        const g = farFx.createRadialGradient(e.cx, e.floorY - e.hw * 0.6, 0, e.cx, e.floorY - e.hw * 0.6, e.hw * 2.4);
        g.addColorStop(0, `rgba(255,190,120,${pulse})`);
        g.addColorStop(0.5, `rgba(160,90,40,${pulse * 0.45})`);
        g.addColorStop(1, 'rgba(40,20,10,0)');
        farFx.fillStyle = '#050404';
        farFx.fillRect(e.cx - e.hw, e.springY - e.hw * 1.4, e.hw * 2, e.floorY - e.springY + e.hw * 1.4);
        farFx.fillStyle = g;
        farFx.fillRect(e.cx - e.hw, e.springY - e.hw * 1.4, e.hw * 2, e.floorY - e.springY + e.hw * 1.4);
        // the portcullis: it rises while the music plays
        const top = e.springY - e.hw * 1.3;
        const span = e.floorY - top;
        const lift = state.wake * span * 0.72;
        farFx.strokeStyle = '#060505';
        farFx.fillStyle = '#060505';
        const bar = Math.max(1, e.hw * 0.07);
        farFx.lineWidth = bar;
        farFx.beginPath();
        for (let x = e.cx - e.hw + e.hw * 0.18; x < e.cx + e.hw; x += e.hw * 0.28) {
            farFx.moveTo(x, top - lift);
            farFx.lineTo(x, e.floorY - lift - bar);
        }
        for (let y = top + span * 0.1; y < e.floorY - span * 0.05; y += span * 0.17) {
            farFx.moveTo(e.cx - e.hw, y - lift);
            farFx.lineTo(e.cx + e.hw, y - lift);
        }
        farFx.stroke();
        for (let x = e.cx - e.hw + e.hw * 0.18; x < e.cx + e.hw; x += e.hw * 0.28) {
            farFx.beginPath();
            farFx.moveTo(x - bar, e.floorY - lift - bar);
            farFx.lineTo(x + bar, e.floorY - lift - bar);
            farFx.lineTo(x, e.floorY - lift + bar * 2.5);
            farFx.fill();
        }
        farFx.restore();
    }

    function setupRats() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        rats = [[0.07, 0.9], [0.95, 0.86], [0.33, 0.95], [0.7, 0.955], [0.58, 0.62], [0.42, 0.63]].map(([fx, fy], i) => ({
            x: W * fx,
            y: H * fy,
            gap: fy < 0.7 ? 2.4 : 4.5,
            on: 0,
            target: 0,
            timer: 2 + i * 2.7 + Math.random() * 4,
            blink: 0,
        }));
    }

    function updateRats(dt) {
        const p = state.pointer;
        for (const rat of rats) {
            rat.timer -= dt / 60;
            if (rat.timer <= 0) {
                rat.target = rat.target ? 0 : 1;
                rat.timer = rat.target ? 3 + Math.random() * 5 : 4 + Math.random() * 10;
            }
            // they scatter from the torch
            if (p.active && Math.hypot(p.x - rat.x, p.y - rat.y) < 190 * state.lightGain + 60) {
                rat.target = 0;
                rat.timer = Math.max(rat.timer, 3);
            }
            rat.on = lerp(rat.on, rat.target, rat.target ? 0.03 : 0.25);
            if (Math.random() < 0.006) rat.blink = 8;
            if (rat.blink > 0) rat.blink -= dt;
            const a = rat.on * (rat.blink > 0 ? 0.05 : 1);
            if (a < 0.02) continue;
            for (const side of [-1, 1]) {
                glow.globalAlpha = a * 0.9;
                glow.drawImage(sprite, rat.x + side * rat.gap - 5, rat.y - 5, 10, 10);
                glow.fillStyle = `rgba(255,190,120,${a})`;
                glow.fillRect(rat.x + side * rat.gap - 0.8, rat.y - 0.6, 1.6, 1.2);
            }
            glow.globalAlpha = 1;
        }
    }

    function updateDrips(dt) {
        const g = 0.25;
        for (const d of scene.drips) {
            const [vx, vy0] = toView(d.x, d.y0, 1);
            const [, vFloor] = toView(0, scene.floorY, 1);
            if (d.y < 0) {
                d.timer -= dt / 60;
                // a bead swelling before it lets go
                glow.fillStyle = 'rgba(200,205,210,0.35)';
                glow.beginPath();
                glow.arc(vx, vy0 + 2, 1.4 * (1 - clamp(d.timer / 3, 0, 1)) + 0.4, 0, TAU);
                glow.fill();
                if (d.timer <= 0) {
                    d.y = 0;
                    d.v = 0;
                }
            } else {
                d.v += g * dt;
                d.y += d.v * dt;
                const y = vy0 + d.y;
                glow.strokeStyle = 'rgba(210,215,220,0.5)';
                glow.lineWidth = 1.2;
                glow.beginPath();
                glow.moveTo(vx, y - Math.min(10, d.v * 1.5));
                glow.lineTo(vx, y);
                glow.stroke();
                if (y >= vFloor) {
                    d.y = -1;
                    d.timer = 2 + Math.random() * 6;
                    d.splash = 1;
                }
            }
            if (d.splash > 0) {
                d.splash -= 0.03 * dt;
                const s = 1 - d.splash;
                glow.strokeStyle = `rgba(210,215,220,${d.splash * 0.5})`;
                glow.lineWidth = 1;
                glow.beginPath();
                glow.ellipse(vx, vFloor, 3 + s * 16, 1 + s * 3, 0, 0, TAU);
                glow.stroke();
            }
        }
    }

    function frame(t) {
        const dt = clamp((t - last) / 16.67, 0, 3);
        last = t;
        const W = window.innerWidth;
        const H = window.innerHeight;
        state.wake = lerp(state.wake, state.playing ? 1 : 0, 0.02 * dt);
        state.beat = state.playing ? Math.pow(0.5 + 0.5 * Math.sin(t * 0.0042), 6) : 0;
        applyParallax();

        drawEnd(t);
        const coal = updateCenser(dt, t);
        const gain = state.lightGain * (1 + state.wake * 0.25);

        // darkness, then burn the holes
        dark.globalCompositeOperation = 'source-over';
        dark.clearRect(0, 0, W, H);
        dark.fillStyle = `rgba(0,0,0,${lerp(0.58, 0.44, state.wake)})`;
        dark.fillRect(0, 0, W, H);
        dark.globalCompositeOperation = 'destination-out';

        glow.clearRect(0, 0, W, H);
        glow.globalCompositeOperation = 'lighter';

        const e = scene.end;
        if (e) {
            const [ex, ey] = toView(e.cx, e.floorY - e.hw * 0.7, 0.18);
            hole(ex, ey, e.hw * (3 + state.wake * 2), 0.5 + state.wake * 0.3);
        }

        for (const tc of scene.torches) {
            const [x, y] = toView(tc.x, tc.y, tc.depth);
            const f = flicker(t * (1 + state.wake * 0.4), tc.phase);
            hole(x, y, tc.reach * f * gain, 0.95);
            // warm wash on the stone
            glow.globalAlpha = clamp(0.16 * f * gain, 0, 1);
            const R = tc.reach * 1.1 * gain;
            glow.drawImage(sprite, x - R, y - R, R * 2, R * 2);
            glow.globalAlpha = clamp(0.9 * f * Math.min(1, gain + 0.3), 0, 1);
            const halo = tc.size * 4;
            glow.drawImage(sprite, x - halo / 2, y - tc.size * 0.6 - halo / 2, halo, halo);
            glow.globalAlpha = clamp(0.4 + gain * 0.6, 0, 1);
            drawFlame(x, y + tc.size * 0.2, tc.size * (0.7 + 0.3 * Math.min(gain, 1.2)), t, tc.phase);
            glow.globalAlpha = 1;

            // embers spiral up from the bigger flames
            if (!tc.candle && !reduceMotion && Math.random() < (0.08 + state.wake * 0.25) * dt * (tc.layer === 'mid' ? 1 : 0.35)) {
                embers.push({ x, y: y - tc.size, vx: (Math.random() - 0.5) * 0.8, vy: -0.6 - Math.random() * 1.2, life: 1, size: 2 + Math.random() * 4, ph: Math.random() * TAU });
            }
        }

        if (coal) {
            const cf = flicker(t, 3);
            hole(coal.x, coal.y, coal.s * 7 * gain, 0.8);
            glow.globalAlpha = clamp(0.55 * cf + state.wake * 0.3, 0, 1);
            glow.drawImage(sprite, coal.x - coal.s * 2, coal.y - coal.s * 2, coal.s * 4, coal.s * 4);
            glow.globalAlpha = 1;
        }

        // the visitor's own torch
        const p = state.pointer;
        if (p.active) {
            const R = (150 + 140 * state.lightGain) * flicker(t, 7);
            hole(p.x, p.y, R, 0.9);
            glow.globalAlpha = 0.28 * state.lightGain + 0.06;
            glow.drawImage(sprite, p.x - R, p.y - R, R * 2, R * 2);
            glow.globalAlpha = 1;
        }

        for (let i = flares.length - 1; i >= 0; i--) {
            const f = flares[i];
            f.life -= 0.02 * dt;
            if (f.life <= 0) {
                flares.splice(i, 1);
                continue;
            }
            hole(f.x, f.y, 260 * f.life, f.life);
            glow.globalAlpha = f.life * 0.85;
            glow.drawImage(sprite, f.x - 120 * f.life, f.y - 120 * f.life, 240 * f.life, 240 * f.life);
            glow.globalAlpha = 1;
        }

        // embers
        for (let i = embers.length - 1; i >= 0; i--) {
            const m = embers[i];
            m.vx += Math.sin(t * 0.004 + m.ph) * 0.03;
            m.vy -= 0.004 * dt;
            m.vx *= 0.99;
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.life -= 0.006 * dt;
            if (m.life <= 0 || m.y < -20) {
                embers.splice(i, 1);
                continue;
            }
            const tw = 0.6 + 0.4 * Math.sin(t * 0.03 + m.ph);
            glow.globalAlpha = clamp(m.life * tw * Math.min(1, gain + 0.2), 0, 1);
            const s = m.size * (0.6 + m.life * 0.6);
            glow.drawImage(sprite, m.x - s, m.y - s, s * 2, s * 2);
        }
        if (embers.length > 400) embers.splice(0, embers.length - 400);
        glow.globalAlpha = 1;

        glow.globalCompositeOperation = 'source-over';
        updateDrips(dt);
        glow.globalCompositeOperation = 'lighter';
        updateRats(dt);
        glow.globalCompositeOperation = 'source-over';

        if (!reduceMotion) requestAnimationFrame(frame);
    }

    function sparks(x, y) {
        flares.push({ x, y, life: 1 });
        for (let i = 0; i < 26; i++) {
            const a = Math.random() * TAU;
            const v = 1 + Math.random() * 4;
            embers.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 0.8 + Math.random() * 0.4, size: 3 + Math.random() * 5, ph: Math.random() * TAU });
        }
    }

    /* ================================================================== */
    /* Parallax                                                            */
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

    /* ================================================================== */
    /* The page: scorched vellum, iron brackets, candles                   */
    /* ================================================================== */

    function drawPatina() {
        const cv = $('#card-patina');
        const rect = cv.getBoundingClientRect();
        if (!rect.width) return;
        const ctx = sizeCanvas(cv, rect.width, rect.height);
        const W = rect.width;
        const H = rect.height;
        const r = mulberry32(1666);

        // faint ledger rules and a margin line
        ctx.strokeStyle = 'rgba(30,22,14,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = H * 0.08; y < H; y += H * 0.055) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y + (r() - 0.5) * 2);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(30,22,14,0.12)';
        ctx.beginPath();
        ctx.moveTo(W * 0.465, 0);
        ctx.lineTo(W * 0.468, H);
        ctx.moveTo(W * 0.475, 0);
        ctx.lineTo(W * 0.478, H);
        ctx.stroke();

        // scorching creeping in from the edges
        const burn = (x, y, rad, a) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, `rgba(18,10,4,${a})`);
            g.addColorStop(0.5, `rgba(70,40,15,${a * 0.5})`);
            g.addColorStop(1, 'rgba(90,55,20,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        };
        for (let i = 0; i < 70; i++) {
            const edge = (r() * 4) | 0;
            const along = r();
            const x = edge === 0 ? along * W : edge === 1 ? W : edge === 2 ? along * W : 0;
            const y = edge === 0 ? 0 : edge === 1 ? along * H : edge === 2 ? H : along * H;
            burn(x, y, 8 + r() * 34, 0.25 + r() * 0.4);
        }
        // a burn hole
        burn(W * 0.9, H * 0.58, 16, 0.9);
        ctx.fillStyle = 'rgba(8,5,2,0.9)';
        ctx.beginPath();
        ctx.ellipse(W * 0.9, H * 0.58, 4, 3, 0.4, 0, TAU);
        ctx.fill();
        // a cup ring and drops of wax
        ctx.strokeStyle = 'rgba(60,40,20,0.12)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W * 0.7, H * 0.18, H * 0.09, 0.4, TAU - 0.3);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = `rgba(240,230,205,${0.2 + r() * 0.2})`;
            ctx.beginPath();
            ctx.ellipse(W * (0.55 + r() * 0.35), H * (0.3 + r() * 0.3), 2 + r() * 3, 1.5 + r() * 2.5, r() * 3, 0, TAU);
            ctx.fill();
        }
        // foxing
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(70,45,20,${0.04 + r() * 0.08})`;
            ctx.beginPath();
            ctx.arc(r() * W, r() * H, 0.5 + r() * 2.5, 0, TAU);
            ctx.fill();
        }
    }

    function bracketSVG(seed) {
        const r = mulberry32(seed);
        const j = () => ((r() - 0.5) * 1.6).toFixed(1);
        // a hand-forged L strap with spade ends, rivets, and a corner plate
        const strap = (horizontal) => {
            const pts = [];
            const n = 9;
            for (let i = 0; i <= n; i++) {
                const k = 6 + (i / n) * 118;
                pts.push(horizontal ? `${k} ${(146 + Number(j())).toFixed(1)}` : `${(14 + Number(j())).toFixed(1)} ${154 - k}`);
            }
            for (let i = n; i >= 0; i--) {
                const k = 6 + (i / n) * 118;
                pts.push(horizontal ? `${k} ${(160 + Number(j())).toFixed(1)}` : `${(0 + Number(j())).toFixed(1)} ${154 - k}`);
            }
            return `<path d="M${pts.join('L')}Z" fill="currentColor"/>`;
        };
        const spadeH = `<path d="M122 144 L138 153 L122 162 Q126 153 122 144Z" fill="currentColor"/><circle cx="141" cy="153" r="3.2" fill="currentColor"/>`;
        const spadeV = `<path d="M-2 36 L7 20 L16 36 Q7 32 -2 36Z" fill="currentColor"/><circle cx="7" cy="17" r="3.2" fill="currentColor"/>`;
        let out = strap(true) + strap(false) + spadeH + spadeV;
        out += `<rect x="-3" y="129" width="30" height="34" rx="2" fill="currentColor"/>`;
        const rivet = (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="#2c2722"/><circle cx="${x - 0.8}" cy="${y - 0.9}" r="1.1" fill="#6d655a"/>`;
        [[5, 136], [20, 136], [5, 156], [20, 156], [48, 153], [78, 153], [108, 153], [7, 110], [7, 80], [7, 50]].forEach(([x, y]) => {
            out += rivet(x, y);
        });
        // a hanging ring
        out += `<circle cx="34" cy="120" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><rect x="28" y="127" width="7" height="5" fill="currentColor"/>`;
        return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
    }

    function buildCardDecor() {
        ['.bracket--tr', '.bracket--bl', '.bracket--br'].forEach((sel, i) => {
            $(sel).innerHTML = bracketSVG(71 + i * 13);
        });
        const candles = $('#candles');
        const r = mulberry32(12);
        const count = 9;
        for (let i = 0; i < count; i++) {
            const c = document.createElement('span');
            c.className = 'candle';
            const h = 2.2 + r() * 5;
            c.style.cssText = `--h:${h.toFixed(2)}cqw;--w:${(1.25 + r() * 0.7).toFixed(2)}cqw;` +
                `--drip:${(h * (0.25 + r() * 0.4)).toFixed(2)}cqw;--drip-x:${(r() * 60).toFixed(0)}%;` +
                `--flick:${(0.35 + r() * 0.4).toFixed(2)}s;--light-delay:${(i * 0.09).toFixed(2)}s`;
            c.innerHTML = '<span class="candle__wick"></span><span class="candle__flame"></span><span class="candle__smoke"></span>';
            candles.appendChild(c);
        }
    }

    /* ================================================================== */
    /* Covers: painted in greys, Atkinson-dithered, iron-riveted frame      */
    /* ================================================================== */

    const TRACKS = [
        { title: 'Hymn of the Lower Vaults', artist: 'Candlewarden', scene: 'vaults', seed: 14, duration: 431 },
        { title: 'The Key Beneath the Ossuary', artist: 'Grey Abbot', scene: 'key', seed: 27, duration: 367 },
        { title: 'Portcullis at Vespers', artist: 'Iron Litany', scene: 'gate', seed: 39, duration: 512 },
        { title: 'Gibbet Lullaby', artist: 'The Drowned Sexton', scene: 'cage', seed: 52, duration: 298 },
        { title: 'Ninety-Nine Steps Down', artist: 'Lantern & Lock', scene: 'stairs', seed: 68, duration: 465 },
    ];
    const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
    const grey = (v) => `rgb(${v},${v},${v})`;

    function stoneWall(x, S, r, base) {
        const course = S * 0.065;
        let row = 0;
        for (let y = 0; y < S; y += course) {
            const off = row++ % 2 ? 0 : course;
            for (let xx = -off; xx < S; xx += course * 2) {
                x.fillStyle = grey(base + Math.round((r() - 0.5) * 18));
                x.fillRect(xx + 1, y + 1, course * 2 - 2, course - 2);
            }
        }
    }

    function paintCover(x, S, track) {
        const r = mulberry32(track.seed);
        x.fillStyle = '#000';
        x.fillRect(0, 0, S, S);

        const lightFrom = (lx, ly, rad, a) => {
            const g = x.createRadialGradient(lx, ly, 0, lx, ly, rad);
            g.addColorStop(0, `rgba(255,255,255,${a})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(0, 0, S, S);
        };
        const darkEdges = (a) => {
            const g = x.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S * 0.75);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(0,0,0,${a})`);
            x.fillStyle = g;
            x.fillRect(0, 0, S, S);
        };

        switch (track.scene) {
            case 'vaults': {
                const res = corridor(x, S, S, {
                    r, vpx: S * 0.5, vpy: S * 0.52, spread: S * 0.42, drop: S * 0.5, rise: S * 0.05, peak: 1,
                    depths: [0.95, 0.7, 0.52, 0.39, 0.29, 0.22, 0.165, 0.125],
                    bg: '#000', wallNear: grey(110), wallFar: grey(20), wallLine: 'rgba(0,0,0,0.6)',
                    floorFar: grey(30), floorNear: grey(120), floorLine: 'rgba(0,0,0,0.6)',
                    ribFill: (k) => grey(Math.round(lerp(40, 175, k * k))), ribLine: () => 'rgba(0,0,0,0.6)',
                    ribEdge: (k) => `rgba(255,255,255,${0.2 + k * 0.4})`,
                });
                const e = res.far;
                x.save();
                x.beginPath();
                archShape(x, e.cx, e.floorY, e.springY, e.hw, e.peak);
                x.clip();
                x.fillStyle = '#fff';
                x.fillRect(0, 0, S, S);
                x.restore();
                lightFrom(e.cx, e.floorY - e.hw, S * 0.35, 0.55);
                x.fillStyle = '#000';
                x.beginPath();
                x.ellipse(e.cx, e.floorY - 1, e.hw * 0.12, e.hw * 0.05, 0, 0, TAU);
                x.fill();
                x.fillRect(e.cx - e.hw * 0.07, e.floorY - e.hw * 0.6, e.hw * 0.14, e.hw * 0.58);
                x.beginPath();
                x.arc(e.cx, e.floorY - e.hw * 0.66, e.hw * 0.08, 0, TAU);
                x.fill();
                break;
            }
            case 'key': {
                stoneWall(x, S, r, 85);
                lightFrom(S * 0.5, S * 0.35, S * 0.6, 0.75);
                darkEdges(0.85);
                const kx = S * 0.5;
                chain(x, kx, -5, kx, S * 0.3, S * 0.035, '#111');
                // shadow, then key
                const drawKey = (dx, dy, col) => {
                    x.save();
                    x.translate(kx + dx, S * 0.3 + dy);
                    x.strokeStyle = col;
                    x.fillStyle = col;
                    x.lineWidth = S * 0.035;
                    x.beginPath();
                    x.arc(0, S * 0.1, S * 0.085, 0, TAU);
                    x.stroke();
                    for (let i = 0; i < 4; i++) {
                        x.beginPath();
                        x.arc(Math.cos(i * Math.PI / 2) * S * 0.04, S * 0.1 + Math.sin(i * Math.PI / 2) * S * 0.04, S * 0.028, 0, TAU);
                        x.fill();
                    }
                    x.fillRect(-S * 0.018, S * 0.18, S * 0.036, S * 0.42);
                    x.fillRect(-S * 0.045, S * 0.24, S * 0.09, S * 0.025);
                    x.fillRect(S * 0.018, S * 0.5, S * 0.08, S * 0.035);
                    x.fillRect(S * 0.018, S * 0.56, S * 0.06, S * 0.035);
                    x.fillRect(S * 0.05, S * 0.535, S * 0.03, S * 0.03);
                    x.restore();
                };
                drawKey(S * 0.03, S * 0.03, 'rgba(0,0,0,0.6)');
                drawKey(0, 0, '#141414');
                x.strokeStyle = 'rgba(255,255,255,0.5)';
                x.lineWidth = 1.5;
                x.beginPath();
                x.moveTo(kx - S * 0.018, S * 0.48);
                x.lineTo(kx - S * 0.018, S * 0.88);
                x.stroke();
                break;
            }
            case 'gate': {
                stoneWall(x, S, r, 55);
                darkEdges(0.8);
                const g = { cx: S * 0.5, floorY: S * 0.92, springY: S * 0.45, hw: S * 0.28, t: S * 0.07, peak: 1 };
                x.save();
                x.beginPath();
                archShape(x, g.cx, g.floorY, g.springY, g.hw, g.peak);
                x.clip();
                x.fillStyle = '#fff';
                x.fillRect(0, 0, S, S);
                // portcullis, half raised
                x.strokeStyle = '#0c0c0c';
                x.lineWidth = S * 0.018;
                x.beginPath();
                for (let bx = g.cx - g.hw + S * 0.04; bx < g.cx + g.hw; bx += S * 0.07) {
                    x.moveTo(bx, 0);
                    x.lineTo(bx, S * 0.62);
                }
                for (let by = S * 0.2; by < S * 0.62; by += S * 0.08) {
                    x.moveTo(g.cx - g.hw, by);
                    x.lineTo(g.cx + g.hw, by);
                }
                x.stroke();
                x.restore();
                archRing(x, r, g, grey(90), 'rgba(0,0,0,0.6)', { edge: 'rgba(255,255,255,0.6)' });
                x.fillStyle = grey(25);
                x.fillRect(0, S * 0.92, S, S * 0.1);
                // a hooded figure, and a long shadow toward us
                x.fillStyle = '#080808';
                const fx = S * 0.5;
                const fy = S * 0.92;
                x.beginPath();
                x.moveTo(fx - S * 0.07, fy);
                x.quadraticCurveTo(fx - S * 0.06, fy - S * 0.16, fx - S * 0.035, fy - S * 0.22);
                x.quadraticCurveTo(fx, fy - S * 0.27, fx + S * 0.035, fy - S * 0.22);
                x.quadraticCurveTo(fx + S * 0.06, fy - S * 0.16, fx + S * 0.07, fy);
                x.fill();
                x.fillStyle = 'rgba(0,0,0,0.85)';
                x.beginPath();
                x.moveTo(fx - S * 0.07, fy);
                x.lineTo(fx + S * 0.07, fy);
                x.lineTo(fx + S * 0.16, S);
                x.lineTo(fx - S * 0.16, S);
                x.fill();
                break;
            }
            case 'cage': {
                stoneWall(x, S, r, 40);
                // a shaft of light from a grate above
                x.fillStyle = 'rgba(255,255,255,0.35)';
                x.beginPath();
                x.moveTo(S * 0.42, 0);
                x.lineTo(S * 0.58, 0);
                x.lineTo(S * 0.8, S);
                x.lineTo(S * 0.3, S);
                x.fill();
                lightFrom(S * 0.52, S * 0.45, S * 0.4, 0.45);
                darkEdges(0.9);
                const cx = S * 0.52;
                chain(x, cx, -5, cx, S * 0.24, S * 0.03, '#111');
                x.strokeStyle = '#0d0d0d';
                x.fillStyle = '#0d0d0d';
                x.lineWidth = S * 0.012;
                x.beginPath();
                x.arc(cx, S * 0.36, S * 0.14, Math.PI, TAU);
                x.stroke();
                for (let i = 0; i <= 8; i++) {
                    const k = i / 8;
                    const bx = cx + Math.cos(Math.PI - k * Math.PI) * S * 0.14;
                    x.beginPath();
                    x.moveTo(bx, S * 0.36);
                    x.lineTo(bx, S * 0.78);
                    x.stroke();
                    x.beginPath();
                    x.moveTo(cx, S * 0.22);
                    x.quadraticCurveTo(bx, S * 0.24, bx, S * 0.36);
                    x.stroke();
                }
                for (const yy of [0.36, 0.57, 0.78]) {
                    x.beginPath();
                    x.ellipse(cx, S * yy, S * 0.14, S * 0.03, 0, 0, TAU);
                    x.stroke();
                }
                skull(x, cx - S * 0.02, S * 0.77, S * 0.08, grey(200), '#000', 0.3);
                // crows on the cage
                for (const [bx, by, sc] of [[cx - S * 0.1, S * 0.255, 1], [cx + S * 0.08, S * 0.25, -1]]) {
                    x.save();
                    x.translate(bx, by);
                    x.scale(sc, 1);
                    x.fillStyle = '#050505';
                    x.beginPath();
                    x.ellipse(0, 0, S * 0.035, S * 0.022, -0.3, 0, TAU);
                    x.fill();
                    x.beginPath();
                    x.arc(S * 0.028, -S * 0.02, S * 0.014, 0, TAU);
                    x.fill();
                    x.beginPath();
                    x.moveTo(S * 0.038, -S * 0.022);
                    x.lineTo(S * 0.06, -S * 0.015);
                    x.lineTo(S * 0.038, -S * 0.012);
                    x.fill();
                    x.beginPath();
                    x.moveTo(-S * 0.03, S * 0.005);
                    x.lineTo(-S * 0.065, S * 0.03);
                    x.lineTo(-S * 0.025, S * 0.018);
                    x.fill();
                    x.restore();
                }
                break;
            }
            case 'stairs':
            default: {
                x.fillStyle = '#000';
                x.fillRect(0, 0, S, S);
                const vpx = S * 0.5;
                const vpy = S * 0.3;
                // walls
                stoneWall(x, S, r, 45);
                // stair treads receding upward, each a tread and a riser
                for (let k = 0; k < 24; k++) {
                    const s0 = Math.pow(0.88, k);
                    const s1 = Math.pow(0.88, k + 1);
                    const y0 = vpy + S * 0.75 * s0;
                    const y1 = vpy + S * 0.75 * s1;
                    const w0 = S * 0.42 * s0;
                    const w1 = S * 0.42 * s1;
                    const l = Math.round(lerp(150, 10, k / 24));
                    x.fillStyle = grey(l);
                    x.beginPath();
                    x.moveTo(vpx - w0, y0);
                    x.lineTo(vpx + w0, y0);
                    x.lineTo(vpx + w1, (y0 + y1) / 2);
                    x.lineTo(vpx - w1, (y0 + y1) / 2);
                    x.fill();
                    x.fillStyle = grey(Math.round(l * 0.45));
                    x.beginPath();
                    x.moveTo(vpx - w1, (y0 + y1) / 2);
                    x.lineTo(vpx + w1, (y0 + y1) / 2);
                    x.lineTo(vpx + w1, y1);
                    x.lineTo(vpx - w1, y1);
                    x.fill();
                }
                // side walls framing the stair
                for (const side of [-1, 1]) {
                    x.fillStyle = grey(18);
                    x.beginPath();
                    x.moveTo(vpx + side * S * 0.42, S * 1.05);
                    x.lineTo(vpx + side * S * 0.42 * 0.05, vpy);
                    x.lineTo(vpx + side * S * 0.42 * 0.05, 0);
                    x.lineTo(vpx + side * S, 0);
                    x.lineTo(vpx + side * S, S * 1.05);
                    x.fill();
                }
                // a torch on the left wall
                const tx = S * 0.18;
                const ty = S * 0.45;
                lightFrom(tx, ty, S * 0.45, 0.6);
                x.fillStyle = '#fff';
                x.beginPath();
                x.moveTo(tx - S * 0.02, ty);
                x.quadraticCurveTo(tx - S * 0.02, ty - S * 0.05, tx + S * 0.005, ty - S * 0.08);
                x.quadraticCurveTo(tx + S * 0.02, ty - S * 0.04, tx + S * 0.02, ty);
                x.fill();
                x.fillStyle = '#0a0a0a';
                x.fillRect(tx - S * 0.008, ty, S * 0.016, S * 0.08);
                darkEdges(0.6);
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

        const sc = document.createElement('canvas');
        sc.width = sc.height = S;
        paintCover(sc.getContext('2d'), S, track);

        const small = document.createElement('canvas');
        const N = S / PIX;
        small.width = small.height = N;
        const smx = small.getContext('2d');
        smx.drawImage(sc, 0, 0, N, N);
        const img = smx.getImageData(0, 0, N, N);
        const d = img.data;
        const L = new Float32Array(N * N);
        const r = mulberry32(track.seed + 1);
        for (let i = 0; i < N * N; i++) {
            const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
            L[i] = clamp((v - 128) * 1.2 + 128 + (r() - 0.5) * 24, 0, 255);
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
            d[i * 4] = on ? 233 : 16;
            d[i * 4 + 1] = on ? 228 : 14;
            d[i * 4 + 2] = on ? 216 : 12;
            d[i * 4 + 3] = 255;
        }
        smx.putImageData(img, 0, 0);

        c.imageSmoothingEnabled = false;
        c.drawImage(small, 0, 0, N, N, 0, 0, S, S);

        // riveted iron frame
        c.fillStyle = '#e9e4d8';
        c.fillRect(0, 0, S, B);
        c.fillRect(0, S - B, S, B);
        c.fillRect(0, 0, B, S);
        c.fillRect(S - B, 0, B, S);
        c.fillStyle = '#100e0c';
        c.fillRect(5, 5, S - 10, B - 10);
        c.fillRect(5, S - B + 5, S - 10, B - 10);
        c.fillRect(5, 5, B - 10, S - 10);
        c.fillRect(S - B + 5, 5, B - 10, S - 10);
        c.strokeStyle = '#100e0c';
        c.lineWidth = 2;
        c.strokeRect(B - 3, B - 3, S - 2 * B + 6, S - 2 * B + 6);
        c.fillStyle = '#e9e4d8';
        const m = B / 2;
        for (let s = m + 18; s < S - m - 10; s += 22) {
            for (const [x, y] of [[s, m], [s, S - m], [m, s], [S - m, s]]) {
                c.beginPath();
                c.arc(x, y, 2.2, 0, TAU);
                c.fill();
            }
        }
        for (const [x, y] of [[m, m], [S - m, m], [m, S - m], [S - m, S - m]]) {
            c.fillStyle = '#e9e4d8';
            c.beginPath();
            c.arc(x, y, 8.5, 0, TAU);
            c.fill();
            c.fillStyle = '#100e0c';
            c.beginPath();
            c.arc(x, y, 5.5, 0, TAU);
            c.fill();
            c.fillStyle = '#e9e4d8';
            c.fillRect(x - 4, y - 0.8, 8, 1.6);
        }

        c.save();
        c.font = `${Math.round(S * 0.07)}px font, serif`;
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.lineWidth = 5;
        c.strokeStyle = '#100e0c';
        c.strokeText(track.artist, S / 2, B + 12);
        c.fillStyle = '#e9e4d8';
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
        hint: $('.psalter__hint'),
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
        ui.key.style.left = `${pct}%`;
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

    let snuffTimer;
    function setPlaying(on) {
        const was = state.playing;
        state.playing = on;
        ui.play.dataset.playback = on ? 'playing' : 'paused';
        ui.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
        ui.candles.dataset.state = on ? 'playing' : 'idle';
        clearTimeout(snuffTimer);
        ui.candles.classList.remove('is-snuffed');
        if (was && !on) {
            void ui.candles.offsetWidth;
            ui.candles.classList.add('is-snuffed');
            snuffTimer = setTimeout(() => ui.candles.classList.remove('is-snuffed'), 3200);
        }
    }

    function updateLight() {
        const v = player.muted ? 0 : player.volume / 100;
        state.lightGain = 0.25 + v * 0.95;
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
        updateLight();
    });
    ui.volume.addEventListener('input', () => {
        player.volume = Number(ui.volume.value);
        player.muted = false;
        updateLight();
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
    /* Pointer                                                             */
    /* ================================================================== */

    window.addEventListener('pointermove', (e) => {
        state.pointer.x = e.clientX;
        state.pointer.y = e.clientY;
        state.pointer.active = !e.target.closest('.card');
        state.parallax.tx = (e.clientX / window.innerWidth - 0.5) * 34;
        state.parallax.ty = (e.clientY / window.innerHeight - 0.5) * 16;
        if (state.pointer.active) ui.hint.classList.add('is-gone');
    });
    document.addEventListener('pointerleave', () => {
        state.pointer.active = false;
        state.parallax.tx = 0;
        state.parallax.ty = 0;
    });
    window.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.card')) return;
        sparks(e.clientX, e.clientY);
    });

    /* ================================================================== */
    /* Boot                                                                */
    /* ================================================================== */

    let last = performance.now();
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            drawScene();
            drawPatina();
        }, 150);
    });

    buildSmoke();
    buildCardDecor();
    drawScene();
    updateLight();
    renderTrack();
    requestAnimationFrame(frame);

    document.fonts.ready.then(() => {
        drawCover(TRACKS[player.index]);
        drawPatina();
    });
})();
