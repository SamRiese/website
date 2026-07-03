(function () {
  'use strict';

  // Fixed trip parameters (finalized defaults)
  const SPEED = 2;
  const SEGMENTS = 7;
  const WARP = 0.1;

  const canvas = document.getElementById('hypno-canvas');
  const gl = canvas.getContext('webgl', { antialias: false });
  if (!gl) return;

  const vsSource = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

  const fsSource = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_speed;
uniform float u_segments;
uniform float u_warp;
uniform vec4 u_clicks[8];
#define PI 3.141592653589793

// acid-cyber palette: UV-violet -> acid lime -> electric cyan
vec3 pal(float x) {
  return 0.5 + 0.5 * cos(2.0 * PI * (x + vec3(0.85, 0.55, 0.20)));
}

void main() {
  vec2 p0 = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 p = p0;
  float t = u_time;
  float w = t * u_speed;

  // mouse swirl + lens warp
  vec2 dm = p - u_mouse;
  float md = length(dm);
  float ang = u_warp * 1.7 * exp(-md * md * 4.0);
  float cs = cos(ang), sn = sin(ang);
  p = u_mouse + mat2(cs, -sn, sn, cs) * dm;
  p -= dm * 0.4 * u_warp * exp(-md * md * 7.0);

  // click shockwaves
  float burst = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 c = u_clicks[i];
    float tt = t - c.z;
    if (tt > 0.0 && tt < 4.0) {
      vec2 dc = p - c.xy;
      float d = length(dc) + 1e-4;
      float env = exp(-tt * 1.3);
      float ring = sin(d * 28.0 - tt * 16.0);
      p += (dc / d) * ring * env * 0.08 * exp(-d * 1.2);
      burst += env * exp(-d * 2.5) * (0.6 + 0.4 * ring);
    }
  }

  // kaleidoscope fold (rotating)
  float r = length(p) + 1e-4;
  float a0 = atan(p.y, p.x);
  // spiral twist: arms swirl outward from the center
  float a = a0 + w * 0.15 + 0.8 * sin(r * 2.5 - w * 0.35);
  float seg = 2.0 * PI / u_segments;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 kp = vec2(cos(a), sin(a)) * r;

  // breathing zoom
  kp *= 1.35 + 0.3 * sin(w * 0.45);

  float hueBase = w * 0.09 + r * 0.35 + burst * 0.8 + 0.3 * u_warp * exp(-md * md * 4.0);

  // kali fractal with orbit-trap glow
  vec2 cc = vec2(0.85 + 0.09 * sin(w * 0.23), 0.58 + 0.09 * cos(w * 0.17));
  vec2 z = kp;
  float mt = 1e5;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    z = abs(z) / max(dot(z, z), 1e-6) - cc;
    float l = length(z);
    mt = min(mt, abs(l - (0.45 + 0.18 * sin(w * 0.5))));
    col += pal(hueBase + float(i) * 0.11) * exp(-14.0 * abs(l - 0.5)) * 0.22;
  }
  // trap filaments
  col += pal(hueBase + 0.5) * exp(-mt * 22.0) * 1.4;

  // second, counter-rotating fractal lace layer
  float ca2 = cos(-w * 0.21), sa2 = sin(-w * 0.21);
  vec2 z2 = mat2(ca2, -sa2, sa2, ca2) * kp * 1.6;
  vec2 cc2 = vec2(0.62 + 0.07 * cos(w * 0.31), 0.78 + 0.07 * sin(w * 0.27));
  float mt2 = 1e5;
  for (int i = 0; i < 7; i++) {
    z2 = abs(z2) / max(dot(z2, z2), 1e-6) - cc2;
    float l2 = length(z2);
    mt2 = min(mt2, abs(l2 - 0.4));
    col += pal(hueBase + 0.33 + float(i) * 0.09) * exp(-26.0 * abs(l2 - 0.5)) * 0.045;
  }
  col += pal(hueBase + 0.8) * exp(-mt2 * 34.0) * 0.4;

  // faint nebula base layer
  float v0 = sin(kp.x * 3.0 + w) + sin(kp.y * 3.3 - w * 0.8);
  col += pal(hueBase + v0 * 0.12) * 0.05;

  // click flash
  col += vec3(1.0) * burst * 0.45;

  // glowing core
  col += pal(hueBase + 0.25) * 0.3 * exp(-r * r * 16.0);

  // tone map for bloom feel
  col = 1.0 - exp(-col * 2.4);

  col *= 1.0 - 0.55 * smoothstep(0.5, 1.2, length(p0));
  col *= 0.93 + 0.07 * sin(t * 3.4);
  col = pow(col, vec3(1.45));
  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['u_res', 'u_time', 'u_mouse', 'u_speed', 'u_segments', 'u_warp', 'u_clicks'].forEach((n) => {
    u[n] = gl.getUniformLocation(prog, n);
  });

  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  function toShader(cx, cy) {
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    const d = dpr || 1;
    return { x: (cx * d - 0.5 * w) / h, y: (0.5 * h - cy * d) / h };
  }

  const t0 = performance.now() / 1000;
  const mouseTarget = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const mouseSmooth = { ...mouseTarget };
  const clicks = [];

  window.addEventListener('pointermove', (e) => {
    mouseTarget.x = e.clientX;
    mouseTarget.y = e.clientY;
  });

  window.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.tagName === 'A') return;
    const s = toShader(e.clientX, e.clientY);
    clicks.push({ x: s.x, y: s.y, t: performance.now() / 1000 - t0 });
    if (clicks.length > 8) clicks.shift();
  });

  window.addEventListener('resize', resize);
  resize();

  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now() / 1000 - t0;

    mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * 0.07;
    mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * 0.07;
    const m = toShader(mouseSmooth.x, mouseSmooth.y);

    const clicksArr = new Float32Array(32).fill(-1000);
    clicks.forEach((c, i) => {
      clicksArr[i * 4] = c.x;
      clicksArr[i * 4 + 1] = c.y;
      clicksArr[i * 4 + 2] = c.t;
    });

    gl.uniform2f(u.u_res, canvas.width, canvas.height);
    gl.uniform1f(u.u_time, now);
    gl.uniform2f(u.u_mouse, m.x, m.y);
    gl.uniform1f(u.u_speed, SPEED);
    gl.uniform1f(u.u_segments, SEGMENTS);
    gl.uniform1f(u.u_warp, WARP);
    gl.uniform4fv(u.u_clicks, clicksArr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  requestAnimationFrame(loop);
})();
