/* =========================================================
   Rose petals — a small canvas particle system.

   Each petal is a pre-rendered sprite (front = rich and glossy,
   back = paler and matte) drawn with a 3D tumble: as it rotates
   around its own axes it is foreshortened and its shading changes,
   so it reads as a real curved petal catching the light.

   Petals live at different depths: far ones are small, slow and
   faint; near ones are large, fast and slightly out of focus.

   Petals.burst(rect)  — petals pop up out of an element, hang, then fall
   Petals.rain(sec)    — a gentle fall from the top of the screen
   ========================================================= */
const Petals = (() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return { burst() {}, rain() {}, prepare() {} };

  const COLOURS = ["#6e1229", "#7d1731", "#8f1f3a", "#a83350", "#c26178", "#dc98aa", "#efc6d0"];
  const WEIGHTS = [3, 4, 4, 3, 2, 2, 1]; // mostly deep wine, a few blush
  const SPRITE = 64;    // sprite size in px
  const LEVELS = 5;     // shading levels from edge-on (dark) to facing us (bright)

  let canvas, ctx, dpr = 1, W = 0, H = 0;
  let sprites = null;
  const petals = [];
  let running = false, last = 0, time = 0;
  let rainUntil = 0, rainRate = 0, rainAcc = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pickColour = () => {
    let r = Math.random() * WEIGHTS.reduce((s, w) => s + w, 0);
    for (let i = 0; i < COLOURS.length; i++) if ((r -= WEIGHTS[i]) < 0) return i;
    return 0;
  };

  /* ---------- sprites ---------- */
  function petalPath(c, s) {
    // a rose petal: broad rounded top with a soft notch, tapering to the base
    const L = s * 0.92, Wd = s * 0.78;
    c.beginPath();
    c.moveTo(0, L * 0.5);
    c.bezierCurveTo(-Wd * 0.62, L * 0.28, -Wd * 0.62, -L * 0.36, -Wd * 0.2, -L * 0.48);
    c.quadraticCurveTo(0, -L * 0.4, Wd * 0.2, -L * 0.48);
    c.bezierCurveTo(Wd * 0.62, -L * 0.36, Wd * 0.62, L * 0.28, 0, L * 0.5);
    c.closePath();
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  function makeSprite(hex, back, light, blur) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = SPRITE;
    const c = cv.getContext("2d");
    c.translate(SPRITE / 2, SPRITE / 2);
    if (blur) c.filter = "blur(2.2px)";
    const s = SPRITE * (blur ? 0.78 : 0.86);
    const base = back ? 1.18 : 1;           // the underside of a petal is paler
    const k = (0.62 + light * 0.5) * base;  // lighting

    petalPath(c, s);
    // body: deeper at the base, lighter toward the tip
    const g = c.createLinearGradient(0, s * 0.5, 0, -s * 0.5);
    g.addColorStop(0, shade(hex, k * 0.7));
    g.addColorStop(0.55, shade(hex, k));
    g.addColorStop(1, shade(hex, k * 1.08));
    c.fillStyle = g;
    c.fill();

    c.save();
    petalPath(c, s);
    c.clip();
    // cupped curve: darker at the sides, like the petal curls toward us
    const side = c.createLinearGradient(-s * 0.45, 0, s * 0.45, 0);
    side.addColorStop(0, "rgba(40,0,10,.28)");
    side.addColorStop(0.3, "rgba(40,0,10,0)");
    side.addColorStop(0.7, "rgba(40,0,10,0)");
    side.addColorStop(1, "rgba(40,0,10,.22)");
    c.fillStyle = side;
    c.fillRect(-s, -s, s * 2, s * 2);
    if (!back) {
      // soft satin highlight
      const hl = c.createRadialGradient(-s * 0.1, -s * 0.14, 0, -s * 0.1, -s * 0.14, s * 0.32);
      hl.addColorStop(0, `rgba(255,235,240,${0.28 + light * 0.22})`);
      hl.addColorStop(1, "rgba(255,235,240,0)");
      c.fillStyle = hl;
      c.fillRect(-s, -s, s * 2, s * 2);
    }
    // faint veins from the base
    c.strokeStyle = back ? "rgba(255,255,255,.12)" : "rgba(60,0,15,.14)";
    c.lineWidth = 0.7;
    for (const dx of [-0.16, 0, 0.16]) {
      c.beginPath();
      c.moveTo(0, s * 0.44);
      c.quadraticCurveTo(dx * s * 0.6, 0, dx * s, -s * 0.36);
      c.stroke();
    }
    c.restore();

    // a thin darker rim
    petalPath(c, s);
    c.strokeStyle = "rgba(50,0,12,.22)";
    c.lineWidth = 0.8;
    c.stroke();
    return cv;
  }

  function buildSprites() {
    // sprites[colour][back][level][blur]
    sprites = COLOURS.map((hex) =>
      [0, 1].map((back) =>
        Array.from({ length: LEVELS }, (_, l) =>
          [0, 1].map((blur) => makeSprite(hex, back, l / (LEVELS - 1), blur))
        )
      )
    );
  }

  /* ---------- canvas ---------- */
  function setup() {
    canvas = document.createElement("canvas");
    canvas.className = "petal-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    buildSprites();
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  /* ---------- petals ---------- */
  function makePetal(x, y, vx, vy, spin) {
    // depth: a few far, most mid, a few near (big, blurred, fast)
    const r = Math.random();
    const z = r < 0.25 ? rand(0.45, 0.7) : r < 0.88 ? rand(0.75, 1.15) : rand(1.5, 2.1);
    const size = rand(15, 22) * z * Math.min(1.15, Math.max(0.8, W / 900));
    const term = rand(95, 140) * (0.6 + z * 0.4) * (H / 800); // falling speed
    return {
      x, y, vx, vy, z, size, term,
      drag: rand(1.6, 2.4),
      colour: pickColour(),
      rx: rand(0, 6.28), ry: rand(0, 6.28), rz: rand(0, 6.28),
      wx: rand(0.9, 2.2) * spin * (Math.random() < 0.5 ? -1 : 1),
      wy: rand(1.2, 3.2) * spin * (Math.random() < 0.5 ? -1 : 1),
      wz: rand(0.3, 1.2) * (Math.random() < 0.5 ? -1 : 1),
      swayPhase: rand(0, 6.28),
      swayFreq: rand(0.8, 1.6),
      swayAmp: rand(10, 28) * z,
      alpha: z < 0.72 ? rand(0.55, 0.75) : z > 1.4 ? 0.9 : rand(0.85, 1),
      blur: z > 1.4 ? 1 : 0,
      spinBoost: spin,
    };
  }

  function burst(rect) {
    if (!canvas) setup();
    const n = W < 600 ? 40 : 56;
    const cx = rect.left + rect.width / 2;
    const top = rect.top + rect.height * 0.35;
    // how high the petals can fly: the space above the envelope
    const room = Math.max(160, top - 40);
    for (let i = 0; i < n; i++) {
      const x = cx + rand(-rect.width * 0.38, rect.width * 0.38);
      const p = makePetal(
        x, top + rand(-10, 20),
        (x - cx) * rand(1.4, 2.8) + rand(-50, 50),   // fan outward
        0,
        rand(1.6, 2.6)
      );
      // with air drag the rise is roughly speed / drag, so aim each
      // petal to peak somewhere in the space above the envelope
      p.vy = -rand(0.35, 1) * room * p.drag;
      petals.push(p);
    }
    start();
  }

  // build the canvas and sprites ahead of time, so the burst never stutters
  function prepare() {
    if (!canvas) setup();
  }

  function rain(seconds = 7, perSecond) {
    if (!canvas) setup();
    rainRate = perSecond || (W < 600 ? 6 : 9);
    rainUntil = time + seconds;
    start();
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    // spawn from the rain
    if (time < rainUntil) {
      rainAcc += rainRate * dt;
      while (rainAcc >= 1) {
        rainAcc -= 1;
        petals.push(makePetal(rand(-0.1, 1.1) * W, -40, rand(-20, 20), rand(30, 70), 1));
      }
    }

    const wind = (Math.sin(time * 0.35) * 22 + Math.sin(time * 0.83 + 1.3) * 12);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw far petals first so near ones pass in front
    petals.sort((a, b) => a.z - b.z);

    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];

      // physics: gravity toward a terminal fall speed, with air drag
      p.vy += (p.term - p.vy) * p.drag * dt;
      p.vx += (wind * p.z - p.vx) * 0.9 * dt;
      // a petal tilted edge-on glides sideways a little
      p.vx += Math.sin(p.ry) * Math.cos(p.rx) * 40 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // tumbling; the burst spins fast at first, then settles
      p.spinBoost += (1 - p.spinBoost) * 0.8 * dt;
      p.rx += p.wx * p.spinBoost * dt;
      p.ry += p.wy * p.spinBoost * dt;
      p.rz += p.wz * dt;
      p.swayPhase += p.swayFreq * dt;

      if (p.y > H + 60 || p.x < -120 || p.x > W + 120) {
        petals.splice(i, 1);
        continue;
      }
    }

    for (const p of petals) {
      const fx = Math.cos(p.ry);       // foreshortening across
      const fy = Math.cos(p.rx);       // foreshortening along
      const facing = fx * fy;          // + front, − back
      const level = Math.min(LEVELS - 1, Math.floor(Math.abs(facing) * LEVELS));
      const img = sprites[p.colour][facing >= 0 ? 0 : 1][level][p.blur];

      const sx = Math.max(0.06, Math.abs(fx)) * (p.size / SPRITE) * 1.6;
      const sy = Math.max(0.12, Math.abs(fy)) * (p.size / SPRITE) * 1.6;
      const cz = Math.cos(p.rz), sz = Math.sin(p.rz);
      const x = p.x + Math.sin(p.swayPhase) * p.swayAmp;

      ctx.globalAlpha = p.alpha;
      ctx.setTransform(cz * sx * dpr, sz * sx * dpr, -sz * sy * dpr, cz * sy * dpr, x * dpr, p.y * dpr);
      ctx.drawImage(img, -SPRITE / 2, -SPRITE / 2);
    }
    ctx.globalAlpha = 1;

    if (petals.length || time < rainUntil) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  return { burst, rain, prepare };
})();

// prepare while the guest is still looking at the envelope
if ("requestIdleCallback" in window) requestIdleCallback(() => Petals.prepare && Petals.prepare(), { timeout: 1500 });
else setTimeout(() => Petals.prepare && Petals.prepare(), 600);
