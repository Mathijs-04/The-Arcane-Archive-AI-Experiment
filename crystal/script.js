/*
 * The Geode Psalter
 * A sibling to The Arcane Archive, set deep underground: a cavern lit by one crack of
 * daylight, faceted crystal clusters that hum with a cold light, dripstone, and a black
 * lake that mirrors it all. Strike the dark and the stone answers.
 */
(() => {
    'use strict';

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const OVERSCAN = 0.04;
    const TAU = Math.PI * 2;
    const UP = -Math.PI / 2;
    const APERTURE = 0.54; // viewport fraction, mirrors --aperture-x
    const GLOW = '204,192,255';

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

    /* ================================================================== */
    /* Drawing vocabulary: dripstone, crystals, rock                       */
    /* ================================================================== */

    function poly(ctx, pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
    }

    // stalactite (dir = 1, hangs down) or stalagmite (dir = -1, grows up)
    function spike(ctx, r, x, y, len, w, dir) {
        const steps = 9;
        const left = [];
        const right = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const width = w * Math.pow(1 - t, 1.15) * (0.85 + r() * 0.3) + (t < 0.15 ? w * 0.25 * (1 - t / 0.15) : 0);
            const py = y + dir * len * t;
            const wob = (r() - 0.5) * w * 0.07;
            left.push([x - width / 2 + wob, py]);
            right.push([x + width / 2 + wob, py]);
        }
        const tip = [x + (r() - 0.5) * w * 0.12, y + dir * len * 1.02];
        poly(ctx, [...left, tip, ...right.reverse()]);
        ctx.fill();
        return tip;
    }

    function column(ctx, r, x, top, bottom, w) {
        const steps = 18;
        const left = [];
        const right = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pinch = 1 - 0.55 * Math.sin(Math.PI * t);
            const width = w * pinch * (0.9 + r() * 0.2);
            const py = lerp(top, bottom, t);
            left.push([x - width / 2, py]);
            right.push([x + width / 2, py]);
        }
        poly(ctx, [...left, ...right.reverse()]);
        ctx.fill();
    }

    function rockMass(ctx, r, x0, x1, base, h) {
        const pts = [[x0, base + 40]];
        const n = 26;
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const bump = Math.pow(Math.sin(Math.PI * t), 0.6) * (0.75 + r() * 0.35);
            pts.push([lerp(x0, x1, t), base - h * bump]);
        }
        pts.push([x1, base + 40]);
        poly(ctx, pts);
        ctx.fill();
        return (x) => base - h * Math.pow(Math.sin(Math.PI * clamp((x - x0) / (x1 - x0), 0, 1)), 0.6) * 0.9;
    }

    // a hexagonal prism seen side-on: body, a lit half, and facet lines
    function crystal(ctx, r, x, y, len, ang, w, tones, rec) {
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        const nx = -uy;
        const ny = ux;
        const tipLen = w * (0.7 + r() * 0.5);
        const body = Math.max(len - tipLen, len * 0.3);
        const skew = (r() - 0.5) * w * 0.35;
        const BL = [x - nx * w / 2, y - ny * w / 2];
        const BR = [x + nx * w / 2, y + ny * w / 2];
        const bl = body * (0.95 + r() * 0.1);
        const br = body * (0.95 + r() * 0.1);
        const SL = [BL[0] + ux * bl, BL[1] + uy * bl];
        const SR = [BR[0] + ux * br, BR[1] + uy * br];
        const T = [x + ux * len + nx * skew, y + uy * len + ny * skew];
        const k = (r() - 0.5) * 0.4;
        const RB = [x + nx * w * k, y + ny * w * k];
        const rs = (bl + br) / 2;
        const RS = [RB[0] + ux * rs, RB[1] + uy * rs];

        ctx.fillStyle = tones.base;
        poly(ctx, [BL, SL, T, SR, BR]);
        ctx.fill();
        const lit = [BL, SL, T, RS, RB];
        ctx.fillStyle = tones.light;
        poly(ctx, lit);
        ctx.fill();
        const facets = [[RB, RS], [RS, T], [SL, RS], [RS, SR]];
        ctx.strokeStyle = tones.edge;
        ctx.lineWidth = Math.max(0.6, w * 0.035);
        ctx.beginPath();
        facets.forEach(([a, b]) => {
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
        });
        ctx.stroke();

        if (rec) {
            rec.push({
                poly: [BL, SL, T, SR, BR],
                lit,
                facets,
                tip: T,
                cx: (x + T[0]) / 2,
                cy: (y + T[1]) / 2,
                len,
                phase: r() * TAU,
                flash: 0,
                order: x + (r() - 0.5) * 4,
            });
        }
    }

    function cluster(ctx, r, x, y, size, n, baseAng, spread, tones, rec) {
        const list = [];
        for (let i = 0; i < n; i++) {
            const off = (r() + r() - 1);
            const len = size * (0.3 + r() * 0.7) * (1 - Math.abs(off) * 0.45);
            list.push({
                x: x + off * size * 0.22,
                y: y + r() * size * 0.04,
                len,
                ang: baseAng + off * spread,
                w: len * (0.17 + r() * 0.11),
            });
        }
        list.sort((a, b) => b.len - a.len).forEach((c) => crystal(ctx, r, c.x, c.y, c.len, c.ang, c.w, tones, rec));
        // the matrix rock they grow from
        ctx.fillStyle = tones.rock;
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.03, size * 0.3, size * 0.07, 0, 0, TAU);
        ctx.fill();
    }

    /* ================================================================== */
    /* The cave                                                            */
    /* ================================================================== */

    const layers = {
        far: $('#layer-far'),
        mid: $('#layer-mid'),
        near: $('#layer-near'),
        fx: $('#layer-fx'),
    };

    const scene = { cw: 0, ch: 0, lakeY: 0, apX: 0, crystals: [], drips: [] };

    function sizeCanvas(cv, w, h) {
        cv.width = Math.round(w * DPR);
        cv.height = Math.round(h * DPR);
        const ctx = cv.getContext('2d');
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return ctx;
    }

    function drawFar(cw, ch) {
        const ctx = sizeCanvas(layers.far, cw, ch);
        const r = mulberry32(2718);
        const rock = '#15161d';
        const ax = scene.apX;

        // ceiling, torn open where the daylight gets in
        const ceilBase = wave(r, ch * 0.13, [[ch * 0.03, 0.006], [ch * 0.012, 0.02]]);
        const ceil = (x) => {
            const d = Math.abs(x - ax) / (cw * 0.075);
            const open = d < 0.45 ? 0 : clamp((d - 0.45) / 0.8, 0, 1);
            return ceilBase(x) * (open * open * (3 - 2 * open));
        };
        ctx.fillStyle = rock;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let x = 0; x <= cw; x += 5) ctx.lineTo(x, ceil(x) - 2);
        ctx.lineTo(cw, -5);
        ctx.fill();
        for (let x = 0; x < cw; x += 6 + r() * 22) {
            if (Math.abs(x - ax) < cw * 0.05) continue;
            const len = ch * (0.02 + Math.pow(r(), 2) * 0.13);
            spike(ctx, r, x, ceil(x) - 3, len, len * (0.2 + r() * 0.12), 1);
        }

        // back wall and floor with dripstone
        const floor = wave(r, ch * 0.69, [[ch * 0.02, 0.005], [ch * 0.008, 0.018]]);
        ctx.beginPath();
        ctx.moveTo(0, ch);
        for (let x = 0; x <= cw; x += 5) ctx.lineTo(x, floor(x));
        ctx.lineTo(cw, ch);
        ctx.fill();
        for (let x = 0; x < cw; x += 8 + r() * 26) {
            const len = ch * (0.02 + Math.pow(r(), 2.2) * 0.12);
            spike(ctx, r, x, floor(x) + 3, len, len * (0.28 + r() * 0.15), -1);
        }
        // pillars where drip met drip, over ten thousand years
        [0.08, 0.31, 0.71, 0.93].forEach((fx) => {
            const x = cw * (fx + (r() - 0.5) * 0.03);
            column(ctx, r, x, ceil(x) - 5, floor(x) + 5, cw * (0.018 + r() * 0.02));
        });

        // distant crystal growths, no glow, just facets catching what little light there is
        const tones = { base: '#17181f', light: '#1f2029', edge: '#2a2c38', rock };
        [[0.2, 0.06], [0.45, 0.045], [0.62, 0.05], [0.83, 0.07]].forEach(([fx, s]) => {
            const x = cw * fx;
            cluster(ctx, r, x, floor(x) + 2, ch * s, 6, UP + (r() - 0.5) * 0.4, 0.6, tones, null);
        });
    }

    function drawMid(cw, ch) {
        const ctx = sizeCanvas(layers.mid, cw, ch);
        const r = mulberry32(9001);
        const rock = '#0b0c10';
        const lakeY = scene.lakeY;
        const tones = { base: '#0d0e14', light: '#161824', edge: '#262938', rock };

        // a ragged band of nearer ceiling with long stalactites; they feed the drips
        ctx.fillStyle = rock;
        const band = wave(r, ch * 0.035, [[ch * 0.015, 0.008], [ch * 0.008, 0.03]]);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let x = 0; x <= cw; x += 5) ctx.lineTo(x, band(x));
        ctx.lineTo(cw, -5);
        ctx.fill();
        for (let x = 0; x < cw; x += 10 + r() * 34) {
            if (Math.abs(x - scene.apX) < cw * 0.04) continue;
            const len = ch * (0.03 + Math.pow(r(), 1.6) * 0.2);
            const tip = spike(ctx, r, x, band(x) - 2, len, len * (0.13 + r() * 0.08), 1);
            if (len > ch * 0.07) scene.drips.push(tip);
        }

        // ledges either side of the lake
        const left = rockMass(ctx, r, -cw * 0.06, cw * 0.34, lakeY + 4, ch * 0.13);
        const right = rockMass(ctx, r, cw * 0.66, cw * 1.06, lakeY + 4, ch * 0.16);
        rockMass(ctx, r, cw * 0.36, cw * 0.47, lakeY + 4, ch * 0.025);
        rockMass(ctx, r, cw * 0.55, cw * 0.62, lakeY + 4, ch * 0.02);
        for (let i = 0; i < 9; i++) {
            const onLeft = i % 2 === 0;
            const x = onLeft ? cw * (0.02 + r() * 0.28) : cw * (0.7 + r() * 0.28);
            const top = onLeft ? left(x) : right(x);
            const len = ch * (0.03 + r() * 0.08);
            ctx.fillStyle = rock;
            spike(ctx, r, x, top + 4, len, len * (0.3 + r() * 0.15), -1);
        }

        // the great clusters
        cluster(ctx, r, cw * 0.13, left(cw * 0.13) + 6, ch * 0.3, 13, UP - 0.22, 0.75, tones, scene.crystals);
        cluster(ctx, r, cw * 0.87, right(cw * 0.87) + 6, ch * 0.36, 15, UP + 0.18, 0.8, tones, scene.crystals);
        cluster(ctx, r, cw * 0.26, left(cw * 0.26) + 4, ch * 0.13, 8, UP + 0.25, 0.6, tones, scene.crystals);
        cluster(ctx, r, cw * 0.75, right(cw * 0.75) + 4, ch * 0.15, 8, UP - 0.3, 0.6, tones, scene.crystals);
        cluster(ctx, r, cw * 0.035, left(cw * 0.035) + 4, ch * 0.1, 6, UP + 0.15, 0.5, tones, scene.crystals);
        cluster(ctx, r, cw * 0.42, lakeY - ch * 0.012, ch * 0.06, 5, UP - 0.1, 0.6, tones, scene.crystals);
        cluster(ctx, r, cw * 0.585, lakeY - ch * 0.01, ch * 0.05, 5, UP + 0.15, 0.6, tones, scene.crystals);
        // a few shards hanging upside-down from the ceiling band
        cluster(ctx, r, cw * 0.3, band(cw * 0.3) - 2, ch * 0.08, 5, Math.PI / 2 + 0.1, 0.5, tones, scene.crystals);
        cluster(ctx, r, cw * 0.69, band(cw * 0.69) - 2, ch * 0.07, 5, Math.PI / 2 - 0.15, 0.5, tones, scene.crystals);

        reflectLake(ctx, cw, ch);
    }

    // mirror the air, the far wall and everything above into the black lake
    function reflectLake(ctx, cw, ch) {
        const W = layers.mid.width;
        const H = layers.mid.height;
        const Ly = Math.round(scene.lakeY * DPR);

        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const o = off.getContext('2d');
        const air = o.createLinearGradient(0, 0, 0, H);
        air.addColorStop(0, '#0a0b10');
        air.addColorStop(0.5, '#141620');
        air.addColorStop(0.78, '#1d1f2b');
        o.fillStyle = air;
        o.fillRect(0, 0, W, H);
        const ax = scene.apX * DPR;
        const glow = o.createRadialGradient(ax, 0, 0, ax, 0, H * 0.7);
        glow.addColorStop(0, 'rgba(190,196,225,0.45)');
        glow.addColorStop(1, 'rgba(190,196,225,0)');
        o.fillStyle = glow;
        o.fillRect(0, 0, W, H);
        const col = o.createLinearGradient(ax - W * 0.05, 0, ax + W * 0.05, 0);
        col.addColorStop(0, 'rgba(200,205,235,0)');
        col.addColorStop(0.5, 'rgba(200,205,235,0.22)');
        col.addColorStop(1, 'rgba(200,205,235,0)');
        o.fillStyle = col;
        o.fillRect(0, 0, W, H);
        o.drawImage(layers.far, 0, 0);
        o.drawImage(layers.mid, 0, 0);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#05060a';
        ctx.fillRect(0, Ly, W, H - Ly);
        const depth = H - Ly;
        for (let y = Ly; y < H; y += 2) {
            const dy = y - Ly;
            const src = Ly - dy * 1.15 - 2;
            if (src < 0) break;
            const amp = (0.6 + dy * 0.035) * DPR;
            const dx = Math.sin(dy * 0.11 / DPR) * amp + Math.sin(dy * 0.027 / DPR + 1.3) * amp * 1.6;
            ctx.globalAlpha = 0.8 * (1 - dy / depth) + 0.15;
            ctx.drawImage(off, 0, src, W, 2, dx, y, W, 2);
        }
        ctx.globalAlpha = 1;
        const dim = ctx.createLinearGradient(0, Ly, 0, H);
        dim.addColorStop(0, 'rgba(3,3,6,0.1)');
        dim.addColorStop(1, 'rgba(3,3,6,0.85)');
        ctx.fillStyle = dim;
        ctx.fillRect(0, Ly, W, H - Ly);
        // the waterline
        ctx.fillStyle = 'rgba(170,170,200,0.18)';
        ctx.fillRect(0, Ly, W, Math.max(1, DPR * 0.8));
        ctx.restore();
    }

    function drawNear(cw, ch) {
        const ctx = sizeCanvas(layers.near, cw, ch);
        const r = mulberry32(31337);
        const rock = '#030304';
        const tones = { base: '#050508', light: '#0b0c13', edge: '#181a26', rock };
        ctx.fillStyle = rock;

        // the cave mouth: walls bulging in from both sides
        const wall = (side) => {
            const pts = [];
            const n = 40;
            const edge = wave(r, 0, [[cw * 0.012, 0.02], [cw * 0.006, 0.07]]);
            for (let i = 0; i <= n; i++) {
                const y = (i / n) * ch;
                const t = i / n;
                const bulge = cw * (0.025 + 0.11 * Math.pow(1 - Math.sin(Math.PI * t), 2.2)) + edge(y);
                pts.push([side < 0 ? bulge : cw - bulge, y]);
            }
            pts.push([side < 0 ? -5 : cw + 5, ch + 5], [side < 0 ? -5 : cw + 5, -5]);
            poly(ctx, pts);
            ctx.fill();
        };
        wall(-1);
        wall(1);

        // ceiling lip with heavy stalactites, sparse over the light
        const lip = wave(r, ch * 0.02, [[ch * 0.012, 0.01]]);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let x = 0; x <= cw; x += 6) ctx.lineTo(x, lip(x));
        ctx.lineTo(cw, -5);
        ctx.fill();
        for (let x = cw * 0.03; x < cw * 0.97; x += 14 + r() * 40) {
            const nearLight = Math.abs(x - scene.apX) < cw * 0.12;
            const sideBias = 1 - Math.sin(Math.PI * x / cw);
            const len = ch * (nearLight ? 0.02 + r() * 0.04 : 0.04 + Math.pow(r(), 1.3) * (0.12 + sideBias * 0.25));
            spike(ctx, r, x, lip(x) - 2, len, len * (0.14 + r() * 0.1), 1);
        }

        // foreground shore with dark crystal growths
        const lf = rockMass(ctx, r, -cw * 0.08, cw * 0.24, ch * 1.01, ch * 0.09);
        const rf = rockMass(ctx, r, cw * 0.78, cw * 1.08, ch * 1.01, ch * 0.11);
        cluster(ctx, r, cw * 0.07, lf(cw * 0.07) + 8, ch * 0.24, 10, UP + 0.35, 0.7, tones, null);
        cluster(ctx, r, cw * 0.94, rf(cw * 0.94) + 8, ch * 0.28, 11, UP - 0.4, 0.7, tones, null);
        ctx.fillStyle = rock;
        for (let i = 0; i < 6; i++) {
            const onLeft = i % 2 === 0;
            const x = onLeft ? cw * (0.12 + r() * 0.1) : cw * (0.8 + r() * 0.1);
            const top = onLeft ? lf(x) : rf(x);
            const len = ch * (0.03 + r() * 0.06);
            spike(ctx, r, x, top + 6, len, len * 0.35, -1);
        }
    }

    function drawCave() {
        const cw = window.innerWidth * (1 + OVERSCAN * 2);
        const ch = window.innerHeight * (1 + OVERSCAN * 2);
        scene.cw = cw;
        scene.ch = ch;
        scene.lakeY = ch * 0.8;
        scene.apX = cw * (APERTURE + OVERSCAN) / (1 + OVERSCAN * 2);
        scene.crystals = [];
        scene.drips = [];
        drawFar(cw, ch);
        drawMid(cw, ch);
        drawNear(cw, ch);
        scene.crystals.sort((a, b) => a.order - b.order);
        sizeCanvas(layers.fx, cw, ch);
        seedMotes();
    }

    /* ================================================================== */
    /* Light shaft + mist                                                  */
    /* ================================================================== */

    function buildShaft() {
        const shaft = $('#shaft');
        const r = mulberry32(12);
        const beams = [
            { a: 0, w: 70, o: 0.16, b: 14 },
            { a: -2.5, w: 30, o: 0.13, b: 6 },
            { a: 3, w: 46, o: 0.11, b: 10 },
            { a: -5, w: 120, o: 0.06, b: 24 },
            { a: 5.5, w: 18, o: 0.14, b: 4 },
            { a: 0.8, w: 200, o: 0.035, b: 40 },
        ];
        beams.forEach((bm) => {
            const el = document.createElement('span');
            el.className = 'beam';
            el.style.cssText = `--a:${bm.a}deg;--w:${bm.w}px;--o:${bm.o};--b:${bm.b}px;` +
                `--d:${(6 + r() * 8).toFixed(1)}s;--delay:${(-r() * 10).toFixed(1)}s`;
            shaft.appendChild(el);
        });
    }

    function buildFog() {
        const tile = (seed, fx, fy, gain, cut) => {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='520'>` +
                `<filter id='f' x='0' y='0' width='100%' height='100%'>` +
                `<feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='5' seed='${seed}' stitchTiles='stitch'/>` +
                `<feColorMatrix values='0 0 0 0 0.84  0 0 0 0 0.85  0 0 0 0 0.95  ${gain} 0 0 0 ${cut}'/>` +
                `</filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
            return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        };
        document.documentElement.style.setProperty('--fog-tex-1', tile(5, 0.0018, 0.012, 2.8, -1.15));
        document.documentElement.style.setProperty('--fog-tex-2', tile(29, 0.0028, 0.016, 2.4, -0.95));
    }

    /* ================================================================== */
    /* Living light: crystal glow, sparkles, motes, drips, ripples         */
    /* ================================================================== */

    const fx = layers.fx.getContext('2d');
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    (() => {
        const s = sprite.getContext('2d');
        const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(250,248,255,1)');
        g.addColorStop(0.12, 'rgba(220,210,255,0.8)');
        g.addColorStop(0.4, 'rgba(180,165,255,0.18)');
        g.addColorStop(1, 'rgba(160,140,255,0)');
        s.fillStyle = g;
        s.fillRect(0, 0, 64, 64);
    })();

    const state = {
        playing: false,
        glowGain: 0.75,
        pointer: { x: -9999, y: -9999, active: false },
        parallax: { x: 0, y: 0, tx: 0, ty: 0 },
        beat: 0,
        nextBeat: 0,
        seq: 0,
        nextDrip: 0,
    };

    let motes = [];
    const sparkles = [];
    const drops = [];
    const ripples = [];
    const strikes = [];

    function seedMotes() {
        const { cw, ch } = scene;
        motes = Array.from({ length: 110 }, () => ({
            x: scene.apX + (Math.random() - 0.5) * cw * 0.5,
            y: Math.random() * ch * 0.8,
            v: 0.05 + Math.random() * 0.15,
            ph: Math.random() * TAU,
            s: 0.6 + Math.random() * 1.4,
        }));
    }

    function toFx(clientX, clientY) {
        return [
            clientX + window.innerWidth * OVERSCAN + state.parallax.x * 0.5,
            clientY + window.innerHeight * OVERSCAN + state.parallax.y * 0.5,
        ];
    }

    function spawnDrop(x, y, bright) {
        drops.push({ x, y, vy: 0.5, bright: !!bright });
    }

    function spawnRipple(x, y, strength = 1) {
        ripples.push({ x, y, r: 1, life: strength });
        ripples.push({ x, y, r: -8, life: strength * 0.8 });
    }

    function drawCrystals(t) {
        const P = state.pointer;
        const [px, py] = toFx(P.x, P.y);
        fx.lineCap = 'round';
        for (const c of scene.crystals) {
            let a = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.0006 + c.phase));
            if (P.active) {
                const d = Math.hypot(px - c.cx, py - c.cy);
                const prox = Math.max(0, 1 - d / 260);
                a += prox * prox * 0.75;
                if (Math.random() < prox * 0.05) sparkleOn(c);
            }
            for (const s of strikes) {
                const radius = (t - s.t0) * 0.9;
                const d = Math.hypot(s.x - c.cx, s.y - c.cy);
                const diff = Math.abs(d - radius);
                if (diff < 70) {
                    const hit = (1 - diff / 70) * Math.max(0, 1 - radius / 1600);
                    a += hit * 0.9;
                    if (hit > 0.6 && Math.random() < 0.15) sparkleOn(c);
                }
            }
            c.flash *= 0.955;
            a += c.flash;
            if (state.playing) a += 0.06 + state.beat * 0.1;
            if (Math.random() < 0.0015) sparkleOn(c);
            a = clamp(a * state.glowGain, 0, 1.2);
            if (a < 0.01) continue;

            // light from inside the stone
            fx.fillStyle = `rgba(${GLOW},${(a * 0.22).toFixed(3)})`;
            poly(fx, c.lit);
            fx.fill();
            fx.strokeStyle = `rgba(${GLOW},${Math.min(1, a).toFixed(3)})`;
            fx.lineWidth = 1;
            fx.beginPath();
            for (const [p, q] of c.facets) {
                fx.moveTo(p[0], p[1]);
                fx.lineTo(q[0], q[1]);
            }
            fx.stroke();
            const s = c.len * 0.5 * (0.6 + a);
            fx.globalAlpha = clamp(a * 0.6, 0, 1);
            fx.drawImage(sprite, c.tip[0] - s / 2, c.tip[1] - s / 2, s, s);
            // its trembling reflection in the lake
            const my = 2 * scene.lakeY - c.cy;
            if (c.cy < scene.lakeY && my < scene.ch) {
                const wob = Math.sin(t * 0.002 + c.phase) * 3;
                const rs = c.len * 0.9 * (0.6 + a);
                fx.globalAlpha = clamp(a * 0.35, 0, 1);
                fx.drawImage(sprite, c.cx + wob - rs / 2, my - rs * 0.18, rs, rs * 0.36);
            }
            fx.globalAlpha = 1;
        }
    }

    function sparkleOn(c) {
        const [p, q] = c.facets[(Math.random() * c.facets.length) | 0];
        const k = Math.random();
        sparkles.push({ x: lerp(p[0], q[0], k), y: lerp(p[1], q[1], k), life: 1, s: 6 + Math.random() * 12 });
    }

    function drawSparkles(dt) {
        fx.strokeStyle = 'rgba(245,242,255,0.95)';
        for (let i = sparkles.length - 1; i >= 0; i--) {
            const sp = sparkles[i];
            sp.life -= 0.035 * dt;
            if (sp.life <= 0) {
                sparkles.splice(i, 1);
                continue;
            }
            const e = Math.sin(sp.life * Math.PI);
            const s = sp.s * e;
            fx.globalAlpha = clamp(e * state.glowGain * 1.2, 0, 1);
            fx.lineWidth = 0.9;
            fx.beginPath();
            fx.moveTo(sp.x - s, sp.y);
            fx.lineTo(sp.x + s, sp.y);
            fx.moveTo(sp.x, sp.y - s);
            fx.lineTo(sp.x, sp.y + s);
            fx.moveTo(sp.x - s * 0.35, sp.y - s * 0.35);
            fx.lineTo(sp.x + s * 0.35, sp.y + s * 0.35);
            fx.moveTo(sp.x + s * 0.35, sp.y - s * 0.35);
            fx.lineTo(sp.x - s * 0.35, sp.y + s * 0.35);
            fx.stroke();
            fx.drawImage(sprite, sp.x - s, sp.y - s, s * 2, s * 2);
        }
        fx.globalAlpha = 1;
    }

    function drawMotes(dt, t) {
        const { cw, ch } = scene;
        for (const m of motes) {
            m.y += m.v * dt;
            m.x += Math.sin(t * 0.0004 + m.ph) * 0.15 * dt;
            if (m.y > scene.lakeY) {
                m.y = ch * 0.02;
                m.x = scene.apX + (Math.random() - 0.5) * cw * 0.3;
            }
            const spread = 18 + m.y * 0.09;
            const dx = (m.x - scene.apX) / spread;
            const lit = Math.exp(-dx * dx);
            const a = (0.04 + lit * 0.75) * (state.playing ? 1.3 : 1) * (0.6 + 0.4 * Math.sin(t * 0.003 + m.ph));
            fx.fillStyle = `rgba(230,232,248,${clamp(a, 0, 1).toFixed(3)})`;
            fx.fillRect(m.x, m.y, m.s, m.s);
        }
    }

    function drawWater(dt, t) {
        const { lakeY, apX } = scene;
        // the shaft breaking into broken light on the water
        fx.fillStyle = 'rgba(225,228,250,1)';
        for (let k = 0; k < 22; k++) {
            const y = lakeY + 3 + k * k * 0.32 + k * 2;
            const w = (14 + k * 5) * (0.5 + 0.5 * Math.sin(t * 0.0021 + k * 2.3));
            const x = apX + Math.sin(t * 0.0013 + k * 1.7) * (4 + k * 2.6) - w / 2;
            fx.globalAlpha = clamp(0.45 * (1 - k / 22) * (0.4 + state.glowGain * 0.6), 0, 1);
            fx.fillRect(x, y, w, 1.2 + k * 0.05);
        }
        fx.globalAlpha = 1;

        // falling drops
        for (let i = drops.length - 1; i >= 0; i--) {
            const d = drops[i];
            d.vy += 0.32 * dt;
            d.y += d.vy * dt;
            const target = lakeY + 6;
            if (d.y >= target) {
                spawnRipple(d.x, target, d.bright ? 1.2 : 0.8);
                drops.splice(i, 1);
                continue;
            }
            const len = Math.min(18, d.vy * 2.2);
            const g = fx.createLinearGradient(d.x, d.y - len, d.x, d.y);
            g.addColorStop(0, `rgba(${GLOW},0)`);
            g.addColorStop(1, `rgba(235,232,255,${d.bright ? 0.95 : 0.6})`);
            fx.strokeStyle = g;
            fx.lineWidth = d.bright ? 1.8 : 1.2;
            fx.beginPath();
            fx.moveTo(d.x, d.y - len);
            fx.lineTo(d.x, d.y);
            fx.stroke();
        }

        // rings spreading over the black water
        fx.lineWidth = 1;
        for (let i = ripples.length - 1; i >= 0; i--) {
            const rp = ripples[i];
            rp.r += 0.75 * dt;
            rp.life -= 0.0065 * dt;
            if (rp.life <= 0) {
                ripples.splice(i, 1);
                continue;
            }
            if (rp.r <= 0) continue;
            fx.strokeStyle = `rgba(${GLOW},${clamp(rp.life * 0.55 * state.glowGain, 0, 1).toFixed(3)})`;
            fx.beginPath();
            fx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.14, 0, 0, TAU);
            fx.stroke();
        }
    }

    function tick(t) {
        // idle drips
        if (t > state.nextDrip && scene.drips.length) {
            const tip = scene.drips[(Math.random() * scene.drips.length) | 0];
            spawnDrop(tip[0], tip[1], false);
            state.nextDrip = t + (state.playing ? 500 : 1400) + Math.random() * (state.playing ? 900 : 3200);
        }
        // when playing, the stone sings in sequence: a bright note travels the clusters
        if (state.playing && t > state.nextBeat) {
            state.nextBeat = t + 380;
            const n = scene.crystals.length;
            if (n) {
                for (let k = 0; k < 3; k++) {
                    const c = scene.crystals[(state.seq + k) % n];
                    c.flash = Math.max(c.flash, 0.85 - k * 0.2);
                    if (k === 0 && Math.random() < 0.6) sparkleOn(c);
                }
                state.seq = (state.seq + 2) % n;
            }
        }
        // strikes fade out
        for (let i = strikes.length - 1; i >= 0; i--) if (t - strikes[i].t0 > 2000) strikes.splice(i, 1);
    }

    /* ================================================================== */
    /* Parallax + main loop                                                */
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

    let last = performance.now();
    function frame(t) {
        const dt = clamp((t - last) / 16.67, 0, 3);
        last = t;
        state.beat = state.playing ? Math.pow(0.5 + 0.5 * Math.sin(t * 0.0083), 8) : 0;
        tick(t);
        fx.clearRect(0, 0, scene.cw, scene.ch);
        fx.globalCompositeOperation = 'lighter';
        drawMotes(dt, t);
        drawCrystals(t);
        drawWater(dt, t);
        drawSparkles(dt);
        fx.globalCompositeOperation = 'source-over';
        applyParallax();
        if (!reduceMotion) requestAnimationFrame(frame);
    }

    /* ================================================================== */
    /* The slab: mineral veins, crystal corners, shard equaliser           */
    /* ================================================================== */

    function vein(ctx, r, x, y, ang, len, w, col, depth) {
        ctx.strokeStyle = col;
        let px = x;
        let py = y;
        let a = ang;
        const steps = Math.max(4, (len / 6) | 0);
        for (let i = 0; i < steps; i++) {
            const nx = px + Math.cos(a) * 6;
            const ny = py + Math.sin(a) * 6;
            ctx.lineWidth = Math.max(0.4, w * (1 - i / steps) * (0.6 + r() * 0.8));
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            px = nx;
            py = ny;
            a += (r() - 0.5) * 0.5;
            if (depth > 0 && r() < 0.05) vein(ctx, r, px, py, a + (r() < 0.5 ? 0.8 : -0.8), len * 0.35, w * 0.6, col, depth - 1);
        }
    }

    function drawPatina() {
        const cv = $('#card-patina');
        const rect = cv.getBoundingClientRect();
        if (!rect.width) return;
        const ctx = sizeCanvas(cv, rect.width, rect.height);
        const W = rect.width;
        const H = rect.height;
        const r = mulberry32(1618);

        // quartz veins running through the slab
        vein(ctx, r, -10, H * 0.32, 0.18, W * 1.2, 3.2, 'rgba(236,238,248,0.22)', 2);
        vein(ctx, r, W * 0.55, -10, 1.25, H * 1.1, 2.2, 'rgba(236,238,248,0.16)', 2);
        vein(ctx, r, W * 0.1, H + 10, -0.5, W * 0.6, 1.6, 'rgba(236,238,248,0.14)', 1);
        vein(ctx, r, W + 10, H * 0.78, Math.PI + 0.12, W * 0.7, 1.4, 'rgba(18,18,28,0.18)', 2);
        vein(ctx, r, W * 0.3, -10, 1.7, H * 0.8, 0.9, 'rgba(18,18,28,0.16)', 1);

        // mica glints
        for (let i = 0; i < 160; i++) {
            ctx.fillStyle = `rgba(255,255,255,${(0.15 + r() * 0.4).toFixed(2)})`;
            const s = 0.4 + r() * 1.1;
            ctx.fillRect(r() * W, r() * H, s, s);
        }
        // pits
        for (let i = 0; i < 30; i++) {
            ctx.fillStyle = `rgba(10,10,20,${(0.05 + r() * 0.12).toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(r() * W, r() * H, 0.5 + r() * 2.2, 0, TAU);
            ctx.fill();
        }
    }

    function shardPath(x, y, len, angDeg, w, skew) {
        const a = angDeg * Math.PI / 180;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const nx = -uy;
        const ny = ux;
        const body = len - w * 0.9;
        const P = (px, py) => `${px.toFixed(1)} ${py.toFixed(1)}`;
        const BL = [x - nx * w / 2, y - ny * w / 2];
        const BR = [x + nx * w / 2, y + ny * w / 2];
        const SL = [BL[0] + ux * body, BL[1] + uy * body];
        const SR = [BR[0] + ux * body, BR[1] + uy * body];
        const T = [x + ux * len + nx * skew, y + uy * len + ny * skew];
        const RB = [x + nx * w * 0.1, y + ny * w * 0.1];
        const RS = [RB[0] + ux * body, RB[1] + uy * body];
        return {
            body: `M${P(...BL)}L${P(...SL)}L${P(...T)}L${P(...SR)}L${P(...BR)}Z`,
            facets: `M${P(...RB)}L${P(...RS)}L${P(...T)}M${P(...SL)}L${P(...RS)}L${P(...SR)}`,
            shade: `M${P(...RB)}L${P(...RS)}L${P(...T)}L${P(...SR)}L${P(...BR)}Z`,
        };
    }

    function ornamentSVG(seed) {
        const r = mulberry32(seed);
        let out = '';
        // a hairline frame, like a mount for a specimen
        out += '<path d="M10 150V18M10 150H142" fill="none" stroke="currentColor" stroke-width="1.6"/>';
        out += '<path d="M16 144V64M16 144H96" fill="none" stroke="currentColor" stroke-width=".8"/>';
        out += '<path d="M10 10l4 6-4 6-4-6zM150 150l-6 4-6-4 6-4z" fill="currentColor"/>';
        const shards = [];
        for (let i = 0; i < 6; i++) {
            const t = i / 5;
            const ang = -86 + t * 80 + (r() - 0.5) * 6;
            const mid = 1 - Math.abs(t - 0.5) * 1.4;
            shards.push({ ang, len: 20 + mid * 50 + r() * 10, w: 6 + mid * 4 + r() * 2, skew: (r() - 0.5) * 3 });
        }
        shards.sort((a, b) => b.len - a.len).forEach((s) => {
            const p = shardPath(14 + (r() - 0.5) * 6, 146 + (r() - 0.5) * 4, s.len, s.ang, s.w, s.skew);
            out += `<path d="${p.body}" fill="currentColor"/>`;
            out += `<path d="${p.shade}" fill="#3d404b"/>`;
            out += `<path d="${p.facets}" fill="none" stroke="#9a9da6" stroke-width=".8"/>`;
            out += `<path d="${p.body}" fill="none" stroke="#7d8089" stroke-width="1.1"/>`;
        });
        // stray seed crystals along the frame
        for (let i = 0; i < 4; i++) {
            const along = 60 + r() * 70;
            const vertical = i % 2 === 0;
            const x = vertical ? 10 : along;
            const y = vertical ? 150 - along : 150;
            const p = shardPath(x, y, 8 + r() * 8, vertical ? -10 - r() * 30 : -80 + r() * 30, 3.5, 0);
            out += `<path d="${p.body}" fill="currentColor"/>`;
        }
        out += '<circle cx="14" cy="146" r="3" fill="currentColor"/>';
        return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
    }

    function buildCardDecor() {
        ['.ornament--tr', '.ornament--bl', '.ornament--br'].forEach((sel, i) => {
            $(sel).innerHTML = ornamentSVG(41 + i * 13);
        });
        const shards = $('#shards');
        const r = mulberry32(3);
        for (let i = 0; i < 24; i++) {
            const s = document.createElement('span');
            s.className = 'shard';
            s.style.cssText = `--lean:${((r() - 0.5) * 14).toFixed(1)}deg;--rest:${(0.3 + r() * 0.4).toFixed(2)};` +
                `--pulse:${(0.9 + r() * 1.4).toFixed(2)}s;--delay:${(-r() * 2).toFixed(2)}s`;
            shards.appendChild(s);
        }
    }

    /* ================================================================== */
    /* Covers: painted in greys, Atkinson-dithered to 1 bit                */
    /* ================================================================== */

    const TRACKS = [
        { title: 'Hymn of the Hollow Geode', artist: 'Lithic Choir', scene: 'geode', seed: 13, duration: 431 },
        { title: 'The Lake Beneath the Lake', artist: 'Sunless Ferryman', scene: 'lake', seed: 29, duration: 512 },
        { title: 'Cathedral of Dripstone', artist: 'Vault of Echoes', scene: 'dripstone', seed: 53, duration: 377 },
        { title: 'Quartz Psalm', artist: 'Amethyst Wake', scene: 'cluster', seed: 71, duration: 298 },
        { title: 'Lantern for the Deep Stair', artist: 'The Last Miners', scene: 'stair', seed: 97, duration: 465 },
    ];
    const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

    function halo(x, cx, cy, rad, a) {
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.25, `rgba(255,255,255,${a * 0.5})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }

    function glint(x, cx, cy, s) {
        x.strokeStyle = '#fff';
        x.lineWidth = 1.4;
        x.beginPath();
        x.moveTo(cx - s, cy);
        x.lineTo(cx + s, cy);
        x.moveTo(cx, cy - s);
        x.lineTo(cx, cy + s);
        x.stroke();
        halo(x, cx, cy, s * 0.9, 0.8);
    }

    function paintCoverScene(x, S, track) {
        const r = mulberry32(track.seed);
        x.lineCap = 'round';
        x.lineJoin = 'round';
        const bright = { base: '#5e5e5e', light: '#e8e8e8', edge: '#202020', rock: '#111' };

        switch (track.scene) {
            case 'geode': {
                const bg = x.createRadialGradient(S / 2, S * 0.5, 0, S / 2, S * 0.5, S * 0.75);
                bg.addColorStop(0, '#4a4a4a');
                bg.addColorStop(1, '#0d0d0d');
                x.fillStyle = bg;
                x.fillRect(0, 0, S, S);
                const cx = S / 2;
                const cy = S * 0.56;
                const rough = (rx, ry, jit) => {
                    const pts = [];
                    for (let i = 0; i < 48; i++) {
                        const a = (i / 48) * TAU;
                        const k = 1 + (r() - 0.5) * jit;
                        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
                    }
                    return pts;
                };
                x.fillStyle = '#2a2a2a';
                poly(x, rough(S * 0.37, S * 0.33, 0.08));
                x.fill();
                x.fillStyle = '#d6d6d6';
                poly(x, rough(S * 0.32, S * 0.285, 0.03));
                x.fill();
                x.fillStyle = '#7d7d7d';
                poly(x, rough(S * 0.295, S * 0.262, 0.02));
                x.fill();
                x.fillStyle = '#0c0c0c';
                poly(x, rough(S * 0.27, S * 0.24, 0.02));
                x.fill();
                for (let i = 0; i < 46; i++) {
                    const a = (i / 46) * TAU + r() * 0.08;
                    const bx = cx + Math.cos(a) * S * 0.275;
                    const by = cy + Math.sin(a) * S * 0.245;
                    const len = S * (0.06 + r() * 0.1);
                    const toC = Math.atan2(cy - by, cx - bx) + (r() - 0.5) * 0.4;
                    crystal(x, r, bx, by, len, toC, len * (0.3 + r() * 0.15), bright, null);
                }
                for (let i = 0; i < 6; i++) glint(x, cx + (r() - 0.5) * S * 0.36, cy + (r() - 0.5) * S * 0.3, 5 + r() * 7);
                break;
            }
            case 'lake': {
                const H = S * 0.6;
                const sky = x.createLinearGradient(0, 0, 0, H);
                sky.addColorStop(0, '#202020');
                sky.addColorStop(1, '#8a8a8a');
                x.fillStyle = sky;
                x.fillRect(0, 0, S, H);
                halo(x, S * 0.62, 0, S * 0.5, 0.55);
                x.fillStyle = '#0b0b0b';
                const ceil = wave(r, S * 0.12, [[S * 0.03, 0.03], [S * 0.012, 0.09]]);
                x.beginPath();
                x.moveTo(0, 0);
                for (let i = 0; i <= S; i += 3) x.lineTo(i, Math.abs(i - S * 0.62) < S * 0.06 ? 0 : ceil(i));
                x.lineTo(S, 0);
                x.fill();
                for (let i = 0; i < S; i += 6 + r() * 16) {
                    if (Math.abs(i - S * 0.62) < S * 0.08) continue;
                    const len = S * (0.03 + r() * 0.18);
                    spike(x, r, i, ceil(i) - 2, len, len * 0.22, 1);
                }
                x.fillStyle = '#151515';
                const shore = wave(r, H, [[S * 0.03, 0.02]]);
                x.beginPath();
                x.moveTo(0, H + 2);
                for (let i = 0; i <= S * 0.3; i += 3) x.lineTo(i, shore(i) - S * 0.12 * (1 - i / (S * 0.3)));
                x.lineTo(S * 0.3, H + 2);
                x.fill();
                // the ferryman
                const bx = S * 0.55;
                const by = H - 2;
                x.fillStyle = '#050505';
                x.beginPath();
                x.moveTo(bx - S * 0.13, by - S * 0.02);
                x.quadraticCurveTo(bx, by + S * 0.025, bx + S * 0.13, by - S * 0.03);
                x.lineTo(bx + S * 0.1, by);
                x.lineTo(bx - S * 0.1, by);
                x.fill();
                x.beginPath();
                x.moveTo(bx - S * 0.03, by - S * 0.015);
                x.lineTo(bx - S * 0.015, by - S * 0.11);
                x.lineTo(bx + S * 0.025, by - S * 0.11);
                x.lineTo(bx + S * 0.04, by - S * 0.015);
                x.fill();
                x.beginPath();
                x.arc(bx + S * 0.005, by - S * 0.125, S * 0.022, 0, TAU);
                x.fill();
                x.lineWidth = 2;
                x.strokeStyle = '#050505';
                x.beginPath();
                x.moveTo(bx - S * 0.06, by - S * 0.18);
                x.lineTo(bx + S * 0.09, by + S * 0.05);
                x.stroke();
                halo(x, bx + S * 0.1, by - S * 0.07, S * 0.06, 1);
                x.fillStyle = '#fff';
                x.fillRect(bx + S * 0.095, by - S * 0.078, 4, 6);
                // mirror into the water
                const img = x.getImageData(0, 0, S, Math.ceil(H));
                const tmp = document.createElement('canvas');
                tmp.width = S;
                tmp.height = Math.ceil(H);
                tmp.getContext('2d').putImageData(img, 0, 0);
                x.fillStyle = '#060606';
                x.fillRect(0, H, S, S - H);
                for (let y = 0; y < S - H; y += 2) {
                    const src = H - y * 1.2 - 2;
                    if (src < 0) break;
                    x.globalAlpha = 0.55 * (1 - y / (S - H));
                    x.drawImage(tmp, 0, src, S, 2, Math.sin(y * 0.3) * (1 + y * 0.06), H + y, S, 2);
                }
                x.globalAlpha = 1;
                break;
            }
            case 'dripstone': {
                const bg = x.createLinearGradient(0, 0, 0, S);
                bg.addColorStop(0, '#2c2c2c');
                bg.addColorStop(0.7, '#5a5a5a');
                bg.addColorStop(1, '#1a1a1a');
                x.fillStyle = bg;
                x.fillRect(0, 0, S, S);
                // the shaft of light
                const beam = x.createLinearGradient(0, 0, 0, S);
                beam.addColorStop(0, 'rgba(255,255,255,0.75)');
                beam.addColorStop(1, 'rgba(255,255,255,0.12)');
                x.fillStyle = beam;
                x.beginPath();
                x.moveTo(S * 0.46, 0);
                x.lineTo(S * 0.54, 0);
                x.lineTo(S * 0.7, S);
                x.lineTo(S * 0.3, S);
                x.fill();
                const rows = [[0.55, '#4a4a4a', 0.5], [0.75, '#262626', 0.8], [1, '#080808', 1.15]];
                rows.forEach(([depth, col, sc]) => {
                    x.fillStyle = col;
                    for (let i = 0; i < S; i += (10 + r() * 24) * sc) {
                        if (Math.abs(i - S / 2) < S * 0.07 * sc) continue;
                        const len = S * (0.04 + r() * 0.2) * sc;
                        spike(x, r, i, -2, len, len * 0.2, 1);
                    }
                    const floorY = S * lerp(0.7, 0.96, depth - 0.55);
                    x.fillRect(0, floorY, S, S);
                    for (let i = 0; i < S; i += (14 + r() * 30) * sc) {
                        const len = S * (0.03 + r() * 0.12) * sc;
                        spike(x, r, i, floorY + 2, len, len * 0.32, -1);
                    }
                    [0.18, 0.82].forEach((f) => column(x, r, S * (f + (r() - 0.5) * 0.08 * sc), -4, floorY + 4, S * 0.07 * sc));
                });
                x.fillStyle = 'rgba(255,255,255,0.4)';
                x.beginPath();
                x.ellipse(S / 2, S * 0.97, S * 0.2, S * 0.025, 0, 0, TAU);
                x.fill();
                break;
            }
            case 'cluster': {
                x.fillStyle = '#121212';
                x.fillRect(0, 0, S, S);
                halo(x, S * 0.5, S * 0.55, S * 0.55, 0.5);
                cluster(x, r, S * 0.5, S * 0.92, S * 0.72, 16, UP, 0.75, bright, null);
                x.fillStyle = '#0a0a0a';
                const ground = wave(r, S * 0.92, [[S * 0.02, 0.03]]);
                x.beginPath();
                x.moveTo(0, S);
                for (let i = 0; i <= S; i += 4) x.lineTo(i, ground(i));
                x.lineTo(S, S);
                x.fill();
                for (let i = 0; i < 7; i++) glint(x, S * (0.25 + r() * 0.5), S * (0.3 + r() * 0.55), 4 + r() * 8);
                break;
            }
            case 'stair':
            default: {
                x.fillStyle = '#000';
                x.fillRect(0, 0, S, S);
                const cx = S / 2;
                const cy = S * 0.46;
                for (let k = 0; k < 9; k++) {
                    const t = k / 8;
                    const rx = lerp(S * 0.72, S * 0.07, Math.pow(t, 0.8));
                    const ry = rx * 1.05;
                    const v = Math.round(lerp(150, 6, t));
                    x.fillStyle = `rgb(${v},${v},${v})`;
                    const pts = [];
                    for (let i = 0; i < 40; i++) {
                        const a = (i / 40) * TAU;
                        const jag = 1 + (r() - 0.5) * 0.14 + (Math.sin(a) < -0.3 ? (r() * 0.12) : 0);
                        pts.push([cx + Math.cos(a) * rx * jag, cy + Math.sin(a) * ry * jag * (Math.sin(a) > 0 ? 0.75 : 1)]);
                    }
                    poly(x, pts);
                    x.fill();
                }
                // steps descending into the dark
                for (let k = 0; k < 14; k++) {
                    const t = k / 13;
                    const y = lerp(S * 1.0, cy + S * 0.04, Math.pow(t, 0.7));
                    const y2 = lerp(S * 1.0, cy + S * 0.04, Math.pow((k + 1) / 13, 0.7));
                    const w = lerp(S * 0.5, S * 0.04, Math.pow(t, 0.8));
                    const v = Math.round(lerp(190, 30, t));
                    x.fillStyle = `rgb(${v},${v},${v})`;
                    x.fillRect(cx - w / 2, y2, w, (y - y2) * 0.45);
                    x.fillStyle = `rgb(${v * 0.35},${v * 0.35},${v * 0.35})`;
                    x.fillRect(cx - w / 2, y2 + (y - y2) * 0.45, w, (y - y2) * 0.55);
                }
                halo(x, cx, cy + S * 0.02, S * 0.07, 1);
                x.fillStyle = '#fff';
                x.fillRect(cx - 2, cy, 4, 6);
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
        const paper = '#e7e8ec';
        const inkC = '#0c0d11';

        const sc = document.createElement('canvas');
        sc.width = sc.height = S;
        paintCoverScene(sc.getContext('2d'), S, track);

        const N = S / PIX;
        const small = document.createElement('canvas');
        small.width = small.height = N;
        const smx = small.getContext('2d');
        smx.drawImage(sc, 0, 0, N, N);
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
            d[i * 4] = on ? 231 : 12;
            d[i * 4 + 1] = on ? 232 : 13;
            d[i * 4 + 2] = on ? 236 : 17;
            d[i * 4 + 3] = 255;
        }
        smx.putImageData(img, 0, 0);

        c.imageSmoothingEnabled = false;
        c.fillStyle = paper;
        c.fillRect(0, 0, S, S);
        c.drawImage(small, 0, 0, N, N, 0, 0, S, S);

        // frame: a geode crust of teeth instead of knotwork
        c.fillStyle = paper;
        c.fillRect(0, 0, S, B);
        c.fillRect(0, S - B, S, B);
        c.fillRect(0, 0, B, S);
        c.fillRect(S - B, 0, B, S);
        c.strokeStyle = inkC;
        c.fillStyle = inkC;
        c.lineWidth = 2;
        c.strokeRect(4, 4, S - 8, S - 8);
        c.strokeRect(B - 3, B - 3, S - 2 * B + 6, S - 2 * B + 6);
        const teeth = (x0, y0, x1, y1, inward) => {
            const len = Math.hypot(x1 - x0, y1 - y0);
            const ux = (x1 - x0) / len;
            const uy = (y1 - y0) / len;
            const nx = -uy * inward;
            const ny = ux * inward;
            const step = 9;
            c.beginPath();
            for (let s = 0; s <= len - step; s += step) {
                const h = 5 + ((s * 7) % 4);
                const ax = x0 + ux * s;
                const ay = y0 + uy * s;
                c.moveTo(ax, ay);
                c.lineTo(ax + ux * step / 2 + nx * h, ay + uy * step / 2 + ny * h);
                c.lineTo(ax + ux * step, ay + uy * step);
            }
            c.fill();
        };
        const m = 8;
        teeth(m + 12, m, S - m - 12, m, 1);
        teeth(S - m - 12, S - m, m + 12, S - m, 1);
        teeth(m, S - m - 12, m, m + 12, 1);
        teeth(S - m, m + 12, S - m, S - m - 12, 1);
        [[B / 2 + 1, B / 2 + 1], [S - B / 2 - 1, B / 2 + 1], [B / 2 + 1, S - B / 2 - 1], [S - B / 2 - 1, S - B / 2 - 1]].forEach(([x, y]) => {
            c.fillStyle = inkC;
            c.beginPath();
            c.moveTo(x, y - 9);
            c.lineTo(x + 7, y);
            c.lineTo(x, y + 9);
            c.lineTo(x - 7, y);
            c.closePath();
            c.fill();
            c.fillStyle = paper;
            c.fillRect(x - 1, y - 3, 2, 6);
        });

        c.save();
        c.font = `${Math.round(S * 0.07)}px font, serif`;
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
        card: $('.card'),
        title: $('#track-title'),
        artist: $('#track-artist'),
        kicker: $('#kicker'),
        shards: $('#shards'),
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
        gem: $('#progress-gem'),
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
        ui.kicker.innerHTML = `Psalm ${ROMAN[player.index]} &middot; of ${ROMAN[TRACKS.length - 1]}`;
        ui.dur.textContent = fmt(t.duration);
        drawCover(t);
        renderProgress();
    }

    function renderProgress() {
        const t = TRACKS[player.index];
        const pct = clamp((player.elapsed / t.duration) * 100, 0, 100);
        ui.progressFill.style.width = `${pct}%`;
        ui.gem.style.left = `${pct}%`;
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
        ui.shards.dataset.state = on ? 'playing' : 'idle';
    }

    function updateGlowGain() {
        const v = player.muted ? 0 : player.volume / 100;
        state.glowGain = 0.25 + v * 0.95;
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
    /* Pointer                                                             */
    /* ================================================================== */

    window.addEventListener('pointermove', (e) => {
        state.pointer.x = e.clientX;
        state.pointer.y = e.clientY;
        state.pointer.active = true;
        state.parallax.tx = (e.clientX / window.innerWidth - 0.5) * 36;
        state.parallax.ty = (e.clientY / window.innerHeight - 0.5) * 18;
    });
    document.addEventListener('pointerleave', () => {
        state.pointer.active = false;
        state.parallax.tx = 0;
        state.parallax.ty = 0;
    });
    window.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.card')) return;
        const [x, y] = toFx(e.clientX, e.clientY);
        // a struck note rings out through the stone...
        strikes.push({ x, y, t0: performance.now() });
        // ...and a bead of light falls to the water
        if (y < scene.lakeY) spawnDrop(x, y, true);
        else spawnRipple(x, y, 1.3);
        ui.hint.classList.add('is-gone');
    });

    /* ================================================================== */
    /* Boot                                                                */
    /* ================================================================== */

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            drawCave();
            drawPatina();
        }, 150);
    });

    buildShaft();
    buildFog();
    buildCardDecor();
    drawCave();
    updateGlowGain();
    renderTrack();
    requestAnimationFrame(frame);

    document.fonts.ready.then(() => {
        drawCover(TRACKS[player.index]);
        drawPatina();
    });
})();
