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

  function initLamp() {
    var canvas = document.getElementById('lavaCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var rgb = hexRgb(LAVA_COLOR);
    var r = rgb[0], g = rgb[1], b = rgb[2];

    // hot core: rotate the hue forward and lighten, for a fire-like glow
    // (matches the design tool: orange base -> yellow core, green base -> cyan core)
    var HUE_SHIFT = 25 / 360;
    var hsl = rgbToHsl(r, g, b);
    var core = hslToRgb((hsl[0] + HUE_SHIFT) % 1, hsl[1], Math.min(hsl[2] + 0.15, 0.70));
    var edgeColor = 'rgb(' + r + ', ' + g + ', ' + b + ')';
    var coreColor = 'rgb(' + core[0] + ', ' + core[1] + ', ' + core[2] + ')';

    function hotFill(cx, cy, rx, ry) {
      var radius = Math.max(rx, ry) * 2.0;
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, coreColor);
      grad.addColorStop(1, edgeColor);
      ctx.fillStyle = grad;
    }

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

    var t0 = performance.now();

    function draw() {
      var t = (performance.now() - t0) / 1000;

      ctx.fillStyle = 'rgb(' + Math.round(r * 0.10) + ', ' + Math.round(g * 0.10) + ', ' + Math.round(b * 0.10) + ')';
      ctx.fillRect(0, 0, W, H);

      // molten pool at the bottom
      var poolWobble = Math.sin(t * 0.35) * 5;
      var poolY = H + 38 + poolWobble;
      hotFill(W / 2, poolY, W * 0.60, 74);
      ctx.beginPath();
      ctx.ellipse(W / 2, poolY, W * 0.60, 74, 0, 0, Math.PI * 2);
      ctx.fill();

      // small pool clinging to the top
      var topY = -26 + Math.sin(t * 0.22 + 2) * 4;
      hotFill(W / 2, topY, W * 0.30, 34);
      ctx.beginPath();
      ctx.ellipse(W / 2, topY, W * 0.30, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      // rising / sinking blobs
      for (var j = 0; j < blobs.length; j++) {
        var bl = blobs[j];
        var yn = 0.5 - 0.5 * Math.sin((t / bl.period) * Math.PI * 2 + bl.phase);
        var y = 34 + yn * (H - 58);
        var half = (0.20 + 0.24 * (y / H)) * W;
        var x = W / 2 + Math.sin((t / bl.xPeriod) * Math.PI * 2 + bl.xPhase) * Math.min(bl.xAmp, Math.max(2, half - bl.r));
        var speedFactor = Math.abs(Math.cos((t / bl.period) * Math.PI * 2 + bl.phase));
        var ry = bl.r * bl.squish * (1 + 0.35 * speedFactor);
        var rx = bl.r * (1 - 0.18 * speedFactor);
        hotFill(x, y, rx, ry);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
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
