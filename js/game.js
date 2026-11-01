/* Orbit Pip - core game logic (no rendering here).
 * Hop between crumbling planets: aim by timing your tap, land dead-centre for PERFECT combos. */
(function () {
  var TAU = Math.PI * 2;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var CFG = { launchSpeed: 700, flightTime: 1.4, pipR: 9, captureExtra: 26, halfPlay: 380 };
  var G = { CFG: CFG };

  G.skins = [["#ffe14d", "#ff9d2e"], ["#6dffb2", "#17c97d"], ["#7fd0ff", "#3a7bff"], ["#ff8ad8", "#c340ff"], ["#ffffff", "#9aa7ff"]];
  G.skinUnlock = [0, 150, 400, 800, 1500]; // best score needed

  G.view = { w: 800, h: 450, scale: 1, vw: 900, vh: 720 };
  G.cam = { x: 0, y: 0 };
  G.state = "menu"; // menu | play | dead
  G.planets = []; G.stars = []; G.hazards = []; G.particles = []; G.popups = [];
  G.pip = { x: 0, y: 0, vx: 0, vy: 0, orb: null, ang: 0, rad: 0, dir: 1, w: 0, fly: 0, from: null, trail: [] };
  G.score = 0; G.combo = 0; G.hops = 0; G.starCount = 0; G.t = 0; G.shake = 0; G.flash = 0;
  G.revived = false; G.lastPlanet = null; G.lastN = 0; G.genCount = 0; G.topY = 0; G.lastX = 0;
  G.skin = 0;
  G.onDeath = null; G.onPerfect = null;

  var nextId = 1;

  G.resize = function (w, h) {
    var s = Math.min(w / 900, h / 720);
    G.view.w = w; G.view.h = h; G.view.scale = s; G.view.vw = w / s; G.view.vh = h / s;
  };

  function difficulty() { return Math.min(1, G.genCount / 70); }

  function makePlanet(x, y, r) {
    var biome = Math.floor(G.genCount / 15);
    var p = {
      id: nextId++, x: x, y: y, r: r, orbitR: r + 34, n: G.genCount,
      hue: (205 + biome * 57 + rnd(-14, 14)) % 360,
      spd: (250 + difficulty() * 120) * rnd(0.92, 1.08),
      state: "idle", fuse: 0, fuseMax: 0, gone: 0, ring: rnd(0, 1) < 0.35, rot: rnd(0, TAU), pulse: 0
    };
    return p;
  }

  function generate() {
    var need = G.cam.y - G.view.vh / 2 - 420;
    while (G.topY > need) {
      var d = difficulty();
      var prevX = G.lastX, prevY = G.topY;
      G.genCount++;
      var y = prevY - (rnd(185, 235) + d * 75);
      var x = clamp(prevX + rnd(-1, 1) * (170 + d * 110), -CFG.halfPlay, CFG.halfPlay);
      var r = rnd(36, 58) - d * 12;
      var p = makePlanet(x, y, r);
      G.planets.push(p);
      if (Math.random() < 0.6) {
        G.stars.push({ x: prevX + (x - prevX) * 0.4 + rnd(-24, 24), y: prevY + (y - prevY) * 0.4, taken: false, ph: rnd(0, TAU) });
      }
      var hz = Math.min(0.55, (G.genCount - 7) * 0.03);
      if (G.genCount > 7 && Math.random() < hz) {
        G.hazards.push({ bx: prevX + (x - prevX) * 0.62, y: prevY + (y - prevY) * 0.62, amp: rnd(70, 150), sp: rnd(1.2, 2.2), ph: rnd(0, TAU), r: 15, x: 0, rot: 0 });
      }
      G.topY = y; G.lastX = x;
    }
  }

  function burst(x, y, n, col, speed, size) {
    for (var i = 0; i < n; i++) {
      var a = rnd(0, TAU), s = rnd(0.3, 1) * speed;
      G.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rnd(0.4, 0.9), size: rnd(2, size || 5), col: col });
    }
  }
  G.burst = burst;

  function popup(x, y, txt, col, size) { G.popups.push({ x: x, y: y, txt: txt, col: col || "#fff", size: size || 28, life: 0, max: 0.9 }); }

  G.reset = function (menuMode) {
    G.planets = []; G.stars = []; G.hazards = []; G.particles = []; G.popups = [];
    G.score = 0; G.combo = 0; G.hops = 0; G.starCount = 0; G.t = 0; G.shake = 0; G.flash = 0;
    G.revived = false; G.lastN = 0; G.genCount = 0; G.topY = 0; G.lastX = 0;
    G.cam.x = 0; G.cam.y = 0;
    var p0 = makePlanet(0, 0, 48);
    p0.state = "lit"; p0.fuseMax = 8; p0.fuse = menuMode ? 1e9 : 8;
    G.planets.push(p0);
    G.lastPlanet = p0;
    var P = G.pip;
    P.orb = p0; P.ang = -Math.PI / 2; P.rad = p0.orbitR; P.dir = 1; P.w = p0.spd / p0.orbitR; P.fly = 0; P.from = null; P.trail = [];
    P.x = p0.x; P.y = p0.y - p0.orbitR; P.vx = P.vy = 0;
    G.state = menuMode ? "menu" : "play";
    // in the menu the planet sits low so the title never covers Pip
    G.cam.y = p0.y - G.view.vh * (menuMode ? 0.3 : 0.12);
    generate();
  };

  G.start = function () { G.reset(false); };

  function die(reason) {
    if (G.state !== "play") return;
    G.state = "dead"; G.deadReason = reason; G.combo = 0;
    var P = G.pip;
    burst(P.x, P.y, 26, G.skins[G.skin][0], 340, 6);
    G.flash = 0.5; G.shake = Math.max(G.shake, 10);
    if (reason !== "boom") Sfx.lose();
    if (G.onDeath) G.onDeath(reason);
  }

  function explode(p) {
    p.state = "gone"; p.gone = 0;
    burst(p.x, p.y, 40, "hsl(" + p.hue + ",90%,65%)", 420, 8);
    G.shake = 16; Sfx.boom();
    if (G.pip.orb === p) { G.pip.orb = null; die("boom"); }
  }

  function launch() {
    var P = G.pip, p = P.orb; if (!p) return;
    var tx = -Math.sin(P.ang) * P.dir, ty = Math.cos(P.ang) * P.dir;
    P.vx = tx * CFG.launchSpeed; P.vy = ty * CFG.launchSpeed;
    P.orb = null; P.from = p; P.fly = 0; p.state = "spent"; p.gone = 0; P.trail = [];
    G.lastPlanet = p;
    burst(P.x, P.y, 8, "#ffffff", 140, 3);
    Sfx.hop();
  }

  G.tap = function () {
    if (G.state !== "play" || !G.pip.orb) return false;
    launch();
    return true;
  };

  function capture(p) {
    var P = G.pip;
    var rx = P.x - p.x, ry = P.y - p.y, dist = Math.hypot(rx, ry) || 1;
    var sp = Math.hypot(P.vx, P.vy) || 1, vx = P.vx / sp, vy = P.vy / sp;
    var L = rx * vy - ry * vx;
    var perfect = Math.abs(L) <= p.r * 0.38;
    P.orb = p; P.ang = Math.atan2(ry, rx); P.rad = dist; P.dir = L >= 0 ? 1 : -1; P.w = P.dir * p.spd / p.orbitR;
    P.trail = [];
    p.state = "lit"; p.fuseMax = Math.max(1.7, 4.4 - G.hops * 0.04); p.fuse = p.fuseMax; p.pulse = 1;
    var gain = Math.max(1, p.n - G.lastN);
    if (p.n > G.lastN) G.lastN = p.n;
    G.hops += gain;
    G.combo = perfect ? G.combo + 1 : 0;
    var pts = (10 + 6 * Math.min(G.combo, 10)) * gain;
    G.score += pts;
    G.lastPlanet = p;
    var col = "hsl(" + p.hue + ",95%,70%)";
    burst(p.x, p.y, perfect ? 30 : 14, perfect ? "#ffd86b" : col, perfect ? 360 : 220, 5);
    popup(p.x, p.y - p.orbitR - 20, "+" + pts, "#ffffff", 26);
    if (perfect) {
      popup(p.x, p.y - p.orbitR - 56, T("perfect") + (G.combo > 1 ? " x" + G.combo : ""), "#ffd86b", 34);
      G.flash = 0.18; G.shake = Math.max(G.shake, 4);
      if (G.onPerfect) G.onPerfect(G.combo);
    }
    Sfx.land(G.combo, perfect);
    Sfx.setIntensity(G.hops / 50);
  }

  function updatePip(dt) {
    var P = G.pip;
    if (P.orb) {
      var p = P.orb;
      P.ang += P.w * dt;
      P.rad += (p.orbitR - P.rad) * Math.min(1, dt * 10);
      P.x = p.x + Math.cos(P.ang) * P.rad; P.y = p.y + Math.sin(P.ang) * P.rad;
      if (G.state === "play" && p.state === "lit") {
        var before = p.fuse; p.fuse -= dt;
        if (p.fuse <= 0) explode(p);
        else if (p.fuse < 1.5 && Math.floor(p.fuse * 4) !== Math.floor(before * 4)) Sfx.tick(true);
      }
      return;
    }
    if (G.state !== "play") return;
    P.x += P.vx * dt; P.y += P.vy * dt; P.fly += dt;
    var hw = G.view.vw / 2 - 14;
    if (P.x > hw) { P.x = hw; P.vx = -Math.abs(P.vx); } else if (P.x < -hw) { P.x = -hw; P.vx = Math.abs(P.vx); }
    P.trail.push({ x: P.x, y: P.y, a: 1 }); if (P.trail.length > 18) P.trail.shift();
    for (var i = 0; i < G.planets.length; i++) {
      var q = G.planets[i];
      if (q.state === "spent" || q.state === "gone") continue;
      if (q === P.from && P.fly < 0.4) continue;
      if (Math.hypot(P.x - q.x, P.y - q.y) <= q.orbitR + CFG.captureExtra) { capture(q); return; }
    }
    for (var s = 0; s < G.stars.length; s++) {
      var st = G.stars[s];
      if (!st.taken && Math.hypot(P.x - st.x, P.y - st.y) < 30) {
        st.taken = true; G.starCount++; G.score += 25;
        popup(st.x, st.y - 10, "+25", "#ffe14d", 24); burst(st.x, st.y, 12, "#ffe14d", 200, 4); Sfx.star(G.starCount);
      }
    }
    for (var h = 0; h < G.hazards.length; h++) {
      var hz = G.hazards[h];
      if (Math.hypot(P.x - hz.x, P.y - hz.y) < hz.r + CFG.pipR - 2) { die("hazard"); return; }
    }
    if (P.fly > CFG.flightTime) { die("lost"); return; }
    if (P.y > G.cam.y + G.view.vh / 2 + 60) die("fall");
  }

  G.update = function (dt) {
    if (dt > 0.05) dt = 0.05;
    G.t += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt);

    for (var h = 0; h < G.hazards.length; h++) {
      var hz = G.hazards[h]; hz.x = hz.bx + Math.sin(G.t * hz.sp + hz.ph) * hz.amp; hz.rot += dt * 3;
    }
    updatePip(dt);

    for (var i = 0; i < G.planets.length; i++) {
      var p = G.planets[i];
      if (p.pulse > 0) p.pulse = Math.max(0, p.pulse - dt * 3);
      p.rot += dt * 0.3;
      if (p.state === "spent" || p.state === "gone") p.gone += dt;
    }

    for (var k = G.particles.length - 1; k >= 0; k--) {
      var q = G.particles[k]; q.life += dt;
      if (q.life >= q.max) { G.particles.splice(k, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96;
    }
    for (var m = G.popups.length - 1; m >= 0; m--) {
      var u = G.popups[m]; u.life += dt; u.y -= dt * 50;
      if (u.life >= u.max) G.popups.splice(m, 1);
    }
    for (var t = 0; t < G.pip.trail.length; t++) G.pip.trail[t].a -= dt * 3;

    // camera only ever climbs
    var anchor = G.pip.orb ? G.pip.orb.y : (G.lastPlanet ? G.lastPlanet.y : 0);
    var target = anchor - G.view.vh * 0.12;
    if (G.state !== "dead" && target < G.cam.y) G.cam.y += (target - G.cam.y) * Math.min(1, dt * 5);

    if (G.state === "play" || G.state === "menu") generate();

    // cull things far below the camera
    var cut = G.cam.y + G.view.vh / 2 + 360;
    for (var a = G.planets.length - 1; a >= 0; a--) {
      var pl = G.planets[a];
      if (pl.y > cut && pl !== G.lastPlanet && pl !== G.pip.orb) G.planets.splice(a, 1);
    }
    for (var b = G.stars.length - 1; b >= 0; b--) if (G.stars[b].y > cut) G.stars.splice(b, 1);
    for (var c = G.hazards.length - 1; c >= 0; c--) if (G.hazards[c].y > cut) G.hazards.splice(c, 1);
  };

  /* Continue after a rewarded ad: put Pip back on a fresh, fully fused planet. */
  G.revive = function () {
    var src = G.lastPlanet || G.planets[0];
    var P = G.pip;
    src.state = "lit"; src.gone = 0; src.fuseMax = 5; src.fuse = 5; src.pulse = 1;
    if (G.planets.indexOf(src) < 0) G.planets.push(src);
    P.orb = src; P.ang = -Math.PI / 2; P.rad = src.orbitR; P.dir = 1; P.w = src.spd / src.orbitR; P.trail = []; P.fly = 0;
    P.x = src.x; P.y = src.y - src.orbitR;
    for (var i = G.hazards.length - 1; i >= 0; i--) {
      if (Math.abs(G.hazards[i].y - src.y) < 360) G.hazards.splice(i, 1);
    }
    G.cam.y = Math.min(G.cam.y, src.y - G.view.vh * 0.12);
    G.revived = true; G.state = "play"; G.combo = 0; G.flash = 0.3;
    burst(src.x, src.y, 30, "#ffffff", 300, 5);
    Sfx.revive();
  };

  G.skinUnlocked = function (i, best) { return best >= G.skinUnlock[i]; };

  window.Game = G;
})();
