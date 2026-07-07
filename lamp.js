(function () {
  'use strict';

  var LAVA_COLOR = '#35e08a';

  function hexRgb(hex) {
    var h = hex.replace('#', '');
    var n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var hue2rgb = function (p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function initLamp() {
    var canvas = document.getElementById('lavaCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // simulate in logical (CSS-pixel) space so the blob motion/sizing math
    // below is unchanged, but render into a buffer scaled by the device's
    // pixel ratio so the metaballs stay crisp on retina/high-DPI screens
    var LW = canvas.width, LH = canvas.height;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.round(LW * dpr), H = Math.round(LH * dpr);
    canvas.width = W;
    canvas.height = H;

    var rgb = hexRgb(LAVA_COLOR);
    var r = rgb[0], g = rgb[1], b = rgb[2];

    // three-tier glow: dark rim (base color) -> mid (hue-rotated) -> hot white core
    var HUE_SHIFT = 25 / 360;
    var hsl = rgbToHsl(r, g, b);
    var mid = hslToRgb((hsl[0] + HUE_SHIFT) % 1, hsl[1], Math.min(hsl[2] + 0.15, 0.70));
    var hot = hslToRgb((hsl[0] + HUE_SHIFT) % 1, hsl[1] * 0.15, 0.93);
    var edgeR = r, edgeG = g, edgeB = b;
    var midR = mid[0], midG = mid[1], midB = mid[2];
    var hotR = hot[0], hotG = hot[1], hotB = hot[2];
    var bgR = Math.round(r * 0.16), bgG = Math.round(g * 0.16), bgB = Math.round(b * 0.16);

    // field thresholds (F ranges 0..1 for an isolated blob, higher where blobs
    // overlap): crisp bands from background -> green rim -> cyan mid -> white core
    var EDGE_LO = 0.04;
    var EDGE_HI = 0.10;
    var MID_HI = 0.20;
    var CORE_HI = 0.80;

    var blobs = [];
    for (var i = 0; i < 7; i++) {
      blobs.push({
        r: rnd(13, 30),
        phase: rnd(0, Math.PI * 2),
        period: rnd(28, 75),
        xPhase: rnd(0, Math.PI * 2),
        xPeriod: rnd(9, 22),
        xAmp: rnd(6, 20),
        squish: rnd(0.85, 1.2)
      });
    }

    var img = ctx.createImageData(W, H);
    var data = img.data;
    var sources = [];

    var t0 = performance.now();

    function draw() {
      var t = (performance.now() - t0) / 1000;

      sources.length = 0;

      // molten pool at the bottom
      var poolWobble = Math.sin(t * 0.35) * 5;
      var poolY = LH + 38 + poolWobble;
      addSource(sources, LW / 2, poolY, LW * 0.60, 74);

      // small pool clinging to the top
      var topY = -26 + Math.sin(t * 0.22 + 2) * 4;
      addSource(sources, LW / 2, topY, LW * 0.30, 34);

      // rising / sinking blobs
      for (var j = 0; j < blobs.length; j++) {
        var bl = blobs[j];
        var yn = 0.5 - 0.5 * Math.sin((t / bl.period) * Math.PI * 2 + bl.phase);
        var y = 34 + yn * (LH - 58);
        var half = (0.20 + 0.24 * (y / LH)) * LW;
        var x = LW / 2 + Math.sin((t / bl.xPeriod) * Math.PI * 2 + bl.xPhase) * Math.min(bl.xAmp, Math.max(2, half - bl.r));
        var speedFactor = Math.abs(Math.cos((t / bl.period) * Math.PI * 2 + bl.phase));
        var ry = bl.r * bl.squish * (1 + 0.35 * speedFactor);
        var rx = bl.r * (1 - 0.18 * speedFactor);
        addSource(sources, x, y, rx, ry);
      }

      renderField(sources);
      ctx.putImageData(img, 0, 0);

      // warm ambient wash pooling near the base, drawn with a standard
      // (non-blend-mode) additive composite so it renders identically
      // across browser engines
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var grad = ctx.createRadialGradient(W / 2, H * 0.98, 0, W / 2, H * 0.98, H * 0.55);
      grad.addColorStop(0, 'rgba(' + edgeR + ',' + edgeG + ',' + edgeB + ',0.35)');
      grad.addColorStop(0.6, 'rgba(' + edgeR + ',' + edgeG + ',' + edgeB + ',0.10)');
      grad.addColorStop(1, 'rgba(' + edgeR + ',' + edgeG + ',' + edgeB + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.35, W, H * 0.65);
      ctx.restore();

      requestAnimationFrame(draw);
    }

    function addSource(list, x, y, rx, ry) {
      list.push({ x: x, y: y, invRx2: 1 / (rx * rx), invRy2: 1 / (ry * ry) });
    }

    function renderField(list) {
      var idx = 0;
      for (var py = 0; py < H; py++) {
        var ly = py / dpr;
        for (var px = 0; px < W; px++) {
          var lx = px / dpr;
          var F = 0;
          for (var i = 0; i < list.length; i++) {
            var s = list[i];
            var dx = lx - s.x, dy = ly - s.y;
            var nd2 = dx * dx * s.invRx2 + dy * dy * s.invRy2;
            if (nd2 < 1) {
              var bump = 1 - nd2;
              F += bump * bump;
            }
          }

          var cr = bgR, cg = bgG, cb = bgB;
          if (F > EDGE_LO) {
            var edgeT = clamp01((F - EDGE_LO) / (EDGE_HI - EDGE_LO));
            cr = cr + (edgeR - cr) * edgeT;
            cg = cg + (edgeG - cg) * edgeT;
            cb = cb + (edgeB - cb) * edgeT;

            var midT = clamp01((F - EDGE_HI) / (MID_HI - EDGE_HI));
            cr = cr + (midR - cr) * midT;
            cg = cg + (midG - cg) * midT;
            cb = cb + (midB - cb) * midT;

            var hotT = clamp01((F - MID_HI) / (CORE_HI - MID_HI));
            cr = cr + (hotR - cr) * hotT;
            cg = cg + (hotG - cg) * hotT;
            cb = cb + (hotB - cb) * hotT;
          }

          data[idx] = cr;
          data[idx + 1] = cg;
          data[idx + 2] = cb;
          data[idx + 3] = 255;
          idx += 4;
        }
      }
    }

    requestAnimationFrame(draw);
  }

  function initEmailLink() {
    var link = document.getElementById('emailLink');
    if (!link) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      // assembled at runtime only — never present as mailto in the markup
      var user = ['foo'].join('');
      var domain = ['mail', 'com'].join('.');
      window.location.href = ['mail', 'to:'].join('') + user + String.fromCharCode(64) + domain;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLamp();
    initEmailLink();
  });
})();
