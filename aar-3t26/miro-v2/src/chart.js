// Procedural "night nautical chart" layer for each frame.
// Draws bathymetric contours (marching squares over a smooth field),
// depth soundings, a graduated chart neatline and an optional compass rose.
(function () {
  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeField(w, h, seed) {
    const r = rng(seed);
    const blobs = [];
    for (let i = 0; i < 22; i++) {
      blobs.push({ x: r() * w * 1.2 - w * 0.1, y: r() * h * 1.2 - h * 0.1, s: (0.06 + r() * 0.22) * w, a: r() * 2 - 1 });
    }
    const p1 = r() * 6.28, p2 = r() * 6.28;
    return function (x, y) {
      let v = 0;
      for (const b of blobs) {
        const dx = x - b.x, dy = y - b.y;
        v += b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
      }
      v += 0.22 * Math.sin(x / w * 5.3 + p1) * Math.cos(y / h * 3.7 + p2);
      v += 0.08 * Math.sin((x + y) / w * 13 + p2);
      return v;
    };
  }

  function contours(ctx, w, h, seed, opts) {
    const step = opts.step || 7;
    const f = makeField(w, h, seed);
    const nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1;
    const g = new Float32Array(nx * ny);
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = f(i * step, j * step); g[j * nx + i] = v;
      if (v < mn) mn = v; if (v > mx) mx = v;
    }
    const levels = opts.levels || 34;
    for (let L = 1; L < levels; L++) {
      const t = mn + (mx - mn) * (L / levels);
      const index = L % 5 === 0;
      ctx.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = g[j * nx + i], b = g[j * nx + i + 1], c = g[(j + 1) * nx + i + 1], d = g[(j + 1) * nx + i];
        let k = 0;
        if (a > t) k |= 8; if (b > t) k |= 4; if (c > t) k |= 2; if (d > t) k |= 1;
        if (k === 0 || k === 15) continue;
        const x = i * step, y = j * step;
        const lerp = (p, q) => (t - p) / (q - p);
        const top = [x + step * lerp(a, b), y];
        const right = [x + step, y + step * lerp(b, c)];
        const bottom = [x + step * lerp(d, c), y + step];
        const left = [x, y + step * lerp(a, d)];
        const segs = {
          1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
          5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
          9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
          13: [[bottom, right]], 14: [[left, bottom]]
        }[k];
        for (const s of segs) { ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); }
      }
      ctx.strokeStyle = index ? opts.indexColor : opts.color;
      ctx.lineWidth = index ? 1.25 : 0.7;
      ctx.stroke();
    }
  }

  function soundings(ctx, w, h, seed, color) {
    const r = rng(seed * 7 + 3);
    ctx.fillStyle = color;
    ctx.font = 'italic 500 11px "IBM Plex Mono", monospace';
    for (let i = 0; i < 120; i++) {
      const x = 40 + r() * (w - 80), y = 40 + r() * (h - 80);
      const d = Math.floor(8 + r() * 90);
      const sub = Math.floor(r() * 10);
      ctx.fillText(String(d), x, y);
      ctx.font = 'italic 500 8px "IBM Plex Mono", monospace';
      ctx.fillText(String(sub), x + (d > 9 ? 14 : 8), y + 3);
      ctx.font = 'italic 500 11px "IBM Plex Mono", monospace';
    }
  }

  function neatline(ctx, w, h, colors) {
    const m = 14, band = 8;
    ctx.fillStyle = colors.frame;
    ctx.fillRect(m, m, w - 2 * m, band);
    ctx.fillRect(m, h - m - band, w - 2 * m, band);
    ctx.fillRect(m, m, band, h - 2 * m);
    ctx.fillRect(w - m - band, m, band, h - 2 * m);
    // graduated minutes: alternating light segments
    ctx.fillStyle = colors.tick;
    const seg = 48;
    for (let x = m + band, k = 0; x < w - m - band; x += seg, k++) {
      if (k % 2 === 0) {
        ctx.fillRect(x, m + 2, Math.min(seg, w - m - band - x), band - 4);
        ctx.fillRect(x, h - m - band + 2, Math.min(seg, w - m - band - x), band - 4);
      }
    }
    for (let y = m + band, k = 0; y < h - m - band; y += seg, k++) {
      if (k % 2 === 0) {
        ctx.fillRect(m + 2, y, band - 4, Math.min(seg, h - m - band - y));
        ctx.fillRect(w - m - band + 2, y, band - 4, Math.min(seg, h - m - band - y));
      }
    }
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(m + band + 6.5, m + band + 6.5, w - 2 * (m + band + 6.5), h - 2 * (m + band + 6.5));
  }

  function rose(ctx, cx, cy, R, colors) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
    for (const rr of [R, R * 0.92, R * 0.62]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); }
    for (let d = 0; d < 360; d += 5) {
      const a = d * Math.PI / 180, l = d % 30 === 0 ? 14 : d % 10 === 0 ? 9 : 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92);
      ctx.lineTo(Math.cos(a) * (R * 0.92 - l), Math.sin(a) * (R * 0.92 - l));
      ctx.stroke();
    }
    ctx.fillStyle = colors.text;
    ctx.font = '500 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 30) {
      const a = (d - 90) * Math.PI / 180;
      ctx.fillText(String(d).padStart(3, '0'), Math.cos(a) * (R + 16), Math.sin(a) * (R + 16));
    }
    // star
    const pts = (n, r1, r2, rot) => {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    };
    pts(4, R * 0.58, R * 0.1, -Math.PI / 2); ctx.fillStyle = colors.fill; ctx.fill(); ctx.stroke();
    pts(4, R * 0.36, R * 0.08, -Math.PI / 4); ctx.fillStyle = colors.fill2; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  window.drawChart = function (canvas, cfg) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    contours(ctx, w, h, cfg.seed, { color: 'rgba(120,160,200,.085)', indexColor: 'rgba(140,178,214,.16)' });
    soundings(ctx, w, h, cfg.seed, 'rgba(150,175,205,.13)');
    if (cfg.rose) rose(ctx, cfg.rose[0], cfg.rose[1], cfg.rose[2], { line: 'rgba(201,162,74,.28)', text: 'rgba(201,162,74,.45)', fill: 'rgba(201,162,74,.20)', fill2: 'rgba(142,162,184,.14)' });
    if (!cfg.noNeat) neatline(ctx, w, h, { frame: '#0d1a29', tick: 'rgba(230,220,198,.55)', line: 'rgba(230,220,198,.18)' });
  };
  window.drawNeat = function (canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    neatline(ctx, w, h, { frame: '#0d1a29', tick: 'rgba(230,220,198,.55)', line: 'rgba(230,220,198,.18)' });
  };
})();
