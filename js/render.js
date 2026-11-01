/* Orbit Pip - canvas renderer. Everything is drawn with code: no image files at all. */
(function () {
  var G = window.Game;
  var TAU = Math.PI * 2;
  var FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

  // deterministic parallax star field
  var field = [];
  (function () {
    var seed = 12345;
    function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 110; i++) field.push({ x: r(), y: r(), s: 0.6 + r() * 1.8, l: 0.04 + r() * 0.22, tw: r() * TAU });
  })();

  function bgHue() { return (250 + G.hops * 3.6) % 360; }

  function drawBackground(c, w, h) {
    var hue = bgHue();
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "hsl(" + hue + ",55%,9%)");
    g.addColorStop(1, "hsl(" + ((hue + 40) % 360) + ",55%,22%)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    var cy = G.cam.y * G.view.scale;
    for (var i = 0; i < field.length; i++) {
      var f = field[i];
      var sy = (((f.y * h - cy * f.l) % h) + h) % h;
      var a = 0.35 + 0.35 * Math.sin(G.t * 2 + f.tw);
      c.globalAlpha = a; c.fillStyle = "#fff";
      c.beginPath(); c.arc(f.x * w, sy, f.s, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }

  function starPath(c, x, y, R, r, rot) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? R : r, a = rot + i * Math.PI / 5 - Math.PI / 2;
      var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  }

  function drawPlanet(c, p) {
    var alpha = 1, sc = 1;
    if (p.state === "spent") { var k = Math.min(1, p.gone / 0.9); alpha = 1 - k * 0.8; sc = 1 - k * 0.25; }
    if (p.state === "gone") { var k2 = Math.min(1, p.gone / 0.35); alpha = 1 - k2; sc = 1 + k2 * 0.4; if (alpha <= 0) return; }
    sc *= 1 + p.pulse * 0.12;
    c.save(); c.translate(p.x, p.y); c.scale(sc, sc); c.globalAlpha = alpha;

    // orbit ring
    c.lineWidth = 2; c.setLineDash([6, 9]); c.lineDashOffset = -G.t * 14;
    c.strokeStyle = "rgba(255,255,255," + (p.state === "lit" ? 0.5 : 0.22) + ")";
    c.beginPath(); c.arc(0, 0, p.orbitR, 0, TAU); c.stroke(); c.setLineDash([]);

    // saturn-like ring behind
    if (p.ring) {
      c.save(); c.rotate(p.rot * 0.2 + 0.5); c.scale(1, 0.32);
      c.strokeStyle = "hsla(" + (p.hue + 30) + ",90%,75%,.8)"; c.lineWidth = 7;
      c.beginPath(); c.arc(0, 0, p.r * 1.55, Math.PI, TAU); c.stroke(); c.restore();
    }
    // body
    var g = c.createRadialGradient(-p.r * 0.35, -p.r * 0.4, p.r * 0.1, 0, 0, p.r);
    g.addColorStop(0, "hsl(" + p.hue + ",90%,78%)"); g.addColorStop(1, "hsl(" + p.hue + ",75%,48%)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, p.r, 0, TAU); c.fill();
    // craters
    c.fillStyle = "hsla(" + p.hue + ",70%,38%,.45)";
    for (var i = 0; i < 3; i++) {
      var a = p.id * 2.1 + i * 2.2 + p.rot * 0.15, d = p.r * (0.35 + 0.18 * i);
      c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, p.r * (0.13 + 0.04 * i), 0, TAU); c.fill();
    }
    if (p.ring) {
      c.save(); c.rotate(p.rot * 0.2 + 0.5); c.scale(1, 0.32);
      c.strokeStyle = "hsla(" + (p.hue + 30) + ",90%,75%,.9)"; c.lineWidth = 7;
      c.beginPath(); c.arc(0, 0, p.r * 1.55, 0, Math.PI); c.stroke(); c.restore();
    }
    // fuse ring
    if (p.state === "lit" && p.fuse < 1e8) {
      var frac = Math.max(0, p.fuse / p.fuseMax);
      var hue = 120 * frac;
      var danger = p.fuse < 1.5 && (Math.floor(G.t * 8) % 2 === 0);
      c.lineWidth = 7; c.lineCap = "round";
      c.strokeStyle = danger ? "#ffffff" : "hsl(" + hue + ",95%,58%)";
      c.beginPath(); c.arc(0, 0, p.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * frac); c.stroke();
    }
    c.restore();
  }

  function drawStar(c, s) {
    if (s.taken) return;
    var bob = Math.sin(G.t * 3 + s.ph) * 4;
    c.save();
    c.shadowColor = "#ffe14d"; c.shadowBlur = 16;
    c.fillStyle = "#ffe14d"; starPath(c, s.x, s.y + bob, 15, 7, G.t * 1.2 + s.ph); c.fill();
    c.restore();
  }

  function drawHazard(c, h) {
    c.save(); c.translate(h.x, h.y); c.rotate(h.rot);
    c.fillStyle = "#ff4d6d"; c.shadowColor = "#ff4d6d"; c.shadowBlur = 14;
    starPath(c, 0, 0, h.r + 7, h.r - 3, 0); c.fill();
    c.shadowBlur = 0; c.fillStyle = "#7a0f2b"; c.beginPath(); c.arc(0, 0, h.r - 6, 0, TAU); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(-3, -2, 2.4, 0, TAU); c.arc(3, -2, 2.4, 0, TAU); c.fill();
    c.restore();
  }

  function drawAim(c) {
    var P = G.pip;
    if (G.state !== "play" || !P.orb) return;
    var tx = -Math.sin(P.ang) * P.dir, ty = Math.cos(P.ang) * P.dir;
    c.save(); c.setLineDash([4, 10]); c.lineWidth = 3; c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,.55)";
    c.beginPath(); c.moveTo(P.x + tx * 16, P.y + ty * 16); c.lineTo(P.x + tx * 150, P.y + ty * 150); c.stroke();
    c.setLineDash([]); c.fillStyle = "rgba(255,255,255,.7)";
    var ex = P.x + tx * 150, ey = P.y + ty * 150, a = Math.atan2(ty, tx);
    c.beginPath(); c.moveTo(ex + Math.cos(a) * 10, ey + Math.sin(a) * 10);
    c.lineTo(ex + Math.cos(a + 2.5) * 9, ey + Math.sin(a + 2.5) * 9); c.lineTo(ex + Math.cos(a - 2.5) * 9, ey + Math.sin(a - 2.5) * 9);
    c.closePath(); c.fill(); c.restore();
  }

  function drawPip(c) {
    var P = G.pip;
    if (G.state === "dead") return;
    var col = G.skins[G.skin];
    // trail
    for (var i = 0; i < P.trail.length; i++) {
      var t = P.trail[i]; if (t.a <= 0) continue;
      c.globalAlpha = Math.max(0, t.a) * 0.5; c.fillStyle = col[0];
      c.beginPath(); c.arc(t.x, t.y, 3 + (i / P.trail.length) * 6, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    var fuelWarn = !P.orb && P.fly > G.CFG.flightTime * 0.7 && Math.floor(G.t * 14) % 2 === 0;
    var R = G.CFG.pipR + 3;
    var dx, dy;
    if (P.orb) { dx = -Math.sin(P.ang) * P.dir; dy = Math.cos(P.ang) * P.dir; }
    else { var sp = Math.hypot(P.vx, P.vy) || 1; dx = P.vx / sp; dy = P.vy / sp; }
    c.save(); c.translate(P.x, P.y);
    c.shadowColor = col[0]; c.shadowBlur = 18;
    var g = c.createRadialGradient(-4, -5, 2, 0, 0, R);
    g.addColorStop(0, "#fff"); g.addColorStop(0.35, col[0]); g.addColorStop(1, col[1]);
    c.fillStyle = fuelWarn ? "#ff9aa8" : g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.shadowBlur = 0;
    // eyes look where Pip is heading
    c.fillStyle = "#fff"; c.beginPath(); c.arc(-4, -1, 4, 0, TAU); c.arc(4, -1, 4, 0, TAU); c.fill();
    c.fillStyle = "#1b1140";
    c.beginPath(); c.arc(-4 + dx * 1.6, -1 + dy * 1.6, 2, 0, TAU); c.arc(4 + dx * 1.6, -1 + dy * 1.6, 2, 0, TAU); c.fill();
    c.restore();
  }

  function drawParticles(c) {
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i], k = 1 - p.life / p.max;
      c.globalAlpha = Math.max(0, k); c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawPopups(c) {
    c.textAlign = "center"; c.textBaseline = "middle";
    for (var i = 0; i < G.popups.length; i++) {
      var u = G.popups[i], k = u.life / u.max;
      var sc = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - (k - 0.15) * 0.2;
      c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
      c.font = "900 " + Math.round(u.size * sc) + "px " + FONT;
      c.lineWidth = 5; c.strokeStyle = "rgba(0,0,0,.45)"; c.strokeText(u.txt, u.x, u.y);
      c.fillStyle = u.col; c.fillText(u.txt, u.x, u.y);
    }
    c.globalAlpha = 1;
  }

  function drawHud(c, w, h) {
    if (G.state === "menu") return;
    var s = Math.max(14, Math.min(w, h) * 0.085);
    c.textAlign = "center"; c.textBaseline = "top";
    c.font = "900 " + Math.round(s) + "px " + FONT;
    c.lineWidth = 6; c.strokeStyle = "rgba(0,0,0,.4)";
    var top = Math.max(10, Math.min(w, h) * 0.02) + 4;
    c.strokeText(String(G.score), w / 2, top); c.fillStyle = "#fff"; c.fillText(String(G.score), w / 2, top);
    var s2 = Math.round(s * 0.36);
    c.font = "800 " + s2 + "px " + FONT; c.fillStyle = "rgba(255,255,255,.85)";
    c.fillText(T("hops") + " " + G.hops + "   ★ " + G.starCount, w / 2, top + s * 1.05);
    if (G.combo > 1 && G.state === "play") {
      c.fillStyle = "#ffd86b"; c.font = "900 " + Math.round(s2 * 1.3) + "px " + FONT;
      c.fillText("COMBO x" + G.combo, w / 2, top + s * 1.05 + s2 * 1.5);
    }
  }

  var Render = {
    draw: function (c, w, h) {
      drawBackground(c, w, h);
      var V = G.view, sh = G.shake;
      var ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
      c.save();
      c.translate(w / 2 + ox, h / 2 + oy); c.scale(V.scale, V.scale); c.translate(-G.cam.x, -G.cam.y);
      var i;
      for (i = 0; i < G.planets.length; i++) drawPlanet(c, G.planets[i]);
      for (i = 0; i < G.stars.length; i++) drawStar(c, G.stars[i]);
      for (i = 0; i < G.hazards.length; i++) drawHazard(c, G.hazards[i]);
      drawAim(c);
      drawPip(c);
      drawParticles(c);
      drawPopups(c);
      // first-hop hint
      if (G.state === "play" && G.hops === 0 && G.pip.orb) {
        var pu = 1 + Math.sin(G.t * 7) * 0.08;
        c.save(); c.translate(G.pip.orb.x, G.pip.orb.y + G.pip.orb.orbitR + 70); c.scale(pu, pu);
        c.textAlign = "center"; c.textBaseline = "middle"; c.font = "900 40px " + FONT;
        c.lineWidth = 6; c.strokeStyle = "rgba(0,0,0,.45)"; c.strokeText(T("hint"), 0, 0);
        c.fillStyle = "#fff"; c.fillText(T("hint"), 0, 0); c.restore();
      }
      c.restore();
      if (G.flash > 0) { c.fillStyle = "rgba(255,255,255," + Math.min(0.45, G.flash) + ")"; c.fillRect(0, 0, w, h); }
      drawHud(c, w, h);
    }
  };

  window.Render = Render;
})();
