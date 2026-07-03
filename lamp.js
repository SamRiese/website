(function () {
  'use strict';

  var LAVA_COLOR = '#ff3b47';

  function hexRgb(hex) {
    var h = hex.replace('#', '');
    var n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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

    // hot core: blend the base color toward a warm yellow highlight, fire-like glow
    var HIGHLIGHT = [255, 214, 120];
    var CORE_MIX = 0.55;
    var core = [
      Math.round(r + (HIGHLIGHT[0] - r) * CORE_MIX),
      Math.round(g + (HIGHLIGHT[1] - g) * CORE_MIX),
      Math.round(b + (HIGHLIGHT[2] - b) * CORE_MIX)
    ];
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
