/* Orbit Pip - glue: canvas, input, menus, storage and the Poki SDK flow. */
(function () {
  var G = window.Game;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("c"), ctx = canvas.getContext("2d");
  var W = 0, H = 0;

  var paused = false, busy = false, overTimer = null;
  var best = 0, muted = false;

  /* ---------- storage (incognito safe) ---------- */
  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  best = parseInt(load("op_best", "0"), 10) || 0;
  muted = load("op_mute", "0") === "1";
  G.skin = parseInt(load("op_skin", "0"), 10) || 0;
  if (!G.skinUnlocked(G.skin, best)) G.skin = 0;

  /* ---------- text / UI ---------- */
  function applyText() {
    $("tagline").textContent = T("tagline");
    $("btnPlay").textContent = T("play");
    $("pauseTitle").textContent = T("pause");
    $("btnResume").textContent = T("resume");
    $("overTitle").textContent = T("over");
    $("btnAgain").textContent = T("again");
    $("reviveLabel").textContent = T("revive");
    $("newBest").textContent = T("newBest");
    refreshStart();
    refreshSoundIcon();
  }
  function refreshStart() {
    var dot = '<span style="display:inline-block;width:1em;height:1em;border-radius:50%;vertical-align:-.15em;margin-right:.45em;background:linear-gradient(135deg,' +
      G.skins[G.skin][0] + ',' + G.skins[G.skin][1] + ')"></span>';
    $("btnSkin").innerHTML = dot + T("skin");
    var next = "";
    for (var i = 0; i < G.skins.length; i++) if (!G.skinUnlocked(i, best)) { next = "  ·  🔒 " + G.skinUnlock[i]; break; }
    $("bestStart").textContent = best > 0 ? T("best") + ": " + best + next : "";
  }
  function refreshSoundIcon() {
    $("icoSoundOn").classList.toggle("hidden", muted);
    $("icoSoundOff").classList.toggle("hidden", !muted);
  }
  function show(id, on) { $(id).classList.toggle("hidden", !on); }

  /* ---------- sizing ---------- */
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.resize(W, H);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 120); });

  /* ---------- Poki ad hooks: mute + block input while an ad runs ---------- */
  Poki.setHooks({
    adStart: function () { Sfx.setAdMuted(true); show("adShade", true); },
    adEnd: function () { Sfx.setAdMuted(false); show("adShade", false); }
  });

  /* ---------- run flow ---------- */
  function beginRun() {
    if (busy) return;
    busy = true;
    Poki.gameplayStop();                      // no-op if not playing
    Poki.commercialBreak().then(function () {
      clearTimeout(overTimer);
      paused = false;
      G.start();
      show("start", false); show("over", false); show("pause", false); show("hud", true);
      Sfx.setIntensity(0); Sfx.startMusic();
      Poki.gameplayStart();                   // fired on the player's own input (Play / Play again)
      busy = false;
    });
  }

  G.onDeath = function (reason) {
    Poki.gameplayStop();
    var isBest = G.score > best;
    if (isBest) { best = G.score; save("op_best", best); }
    overTimer = setTimeout(function () {
      $("finalScore").textContent = String(G.score);
      $("finalBest").textContent = T("best") + ": " + best + "   ·   " + T("hops") + ": " + G.hops;
      show("newBest", isBest && G.score > 0);
      // rewarded continue: only once per run, only when ads are really available
      show("btnRevive", !G.revived && Poki.hasRewarded() && G.score > 0);
      show("over", true); show("hud", false);
      refreshStart();
    }, reason === "boom" ? 850 : 650);
  };

  function revive() {
    if (busy) return;
    busy = true;
    Poki.rewardedBreak().then(function (ok) {
      busy = false;
      if (ok) {
        show("over", false); show("hud", true);
        G.revive(); Poki.gameplayStart();
      }
    });
  }

  /* ---------- pause ---------- */
  function pauseGame() {
    if (G.state !== "play" || paused || busy || Poki.isInAd()) return;
    paused = true;
    Poki.gameplayStop();
    Sfx.stopMusic();
    show("pause", true);
  }
  function resumeGame() {
    if (!paused || busy) return;
    busy = true;
    Poki.commercialBreak().then(function () {
      paused = false; busy = false;
      show("pause", false);
      Sfx.startMusic();
      Poki.gameplayStart();
    });
  }

  /* ---------- input ---------- */
  function tap() {
    Sfx.unlock();
    if (paused || busy || Poki.isInAd()) return;
    G.tap();
  }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); tap(); }, { passive: false });
  document.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  window.addEventListener("keydown", function (e) {
    var k = e.code;
    if (k === "Space" || k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") e.preventDefault();
    if (e.repeat) return;
    if (k === "Escape" || k === "KeyP") {
      if (paused) resumeGame(); else pauseGame();
      return;
    }
    if (k === "Space" || k === "ArrowUp" || k === "KeyW" || k === "Enter") {
      if (G.state === "menu") { Sfx.unlock(); beginRun(); }
      else if (G.state === "dead" && !$("over").classList.contains("hidden")) beginRun();
      else if (paused) resumeGame();
      else tap();
    }
  });
  window.addEventListener("blur", pauseGame);
  document.addEventListener("visibilitychange", function () { if (document.hidden) pauseGame(); });

  function click(id, fn) { $(id).addEventListener("click", function (e) { e.preventDefault(); Sfx.unlock(); Sfx.click(); fn(); }); }
  click("btnPlay", beginRun);
  click("btnAgain", beginRun);
  click("btnRevive", revive);
  click("btnResume", resumeGame);
  click("btnPause", pauseGame);
  click("btnSound", function () {
    muted = !muted; save("op_mute", muted ? "1" : "0"); Sfx.setMuted(muted); refreshSoundIcon();
  });
  click("btnSkin", function () {
    var n = G.skins.length;
    for (var i = 1; i <= n; i++) {
      var c = (G.skin + i) % n;
      if (G.skinUnlocked(c, best)) { G.skin = c; break; }
    }
    save("op_skin", G.skin); refreshStart();
  });

  /* ---------- main loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000; last = now;
    if (!(dt > 0) || dt > 0.25) dt = 0.016;
    if (!paused && !Poki.isInAd()) G.update(dt);
    Render.draw(ctx, W, H);
    requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  resize();
  Sfx.setMuted(muted);
  applyText();
  G.reset(true);
  Poki.init().then(function () { Poki.loadingFinished(); });
  requestAnimationFrame(frame);
})();
