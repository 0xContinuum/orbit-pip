/* Fully procedural audio (WebAudio) - zero audio files, so the build stays tiny. */
(function () {
  var ctx = null, master = null, sfxBus = null, musBus = null;
  var userMuted = false, adMuted = false;
  var musicOn = false, nextNoteTime = 0, step = 0, timer = null;
  var intensity = 0; // 0..1, raises the music tempo/brightness as the run goes on

  var SCALE = [0, 2, 4, 7, 9]; // major pentatonic - always sounds pleasant
  function freq(semi, base) { return (base || 220) * Math.pow(2, semi / 12); }
  function noteSemi(i) { var oct = Math.floor(i / 5); return SCALE[((i % 5) + 5) % 5] + 12 * oct; }

  function applyGain() {
    if (!master) return;
    var g = (userMuted || adMuted) ? 0 : 1;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
  }

  function tone(type, f, t0, dur, vol, bus, slideTo) {
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  function noise(t0, dur, vol, hp) {
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = ctx.createBufferSource(); s.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp || 400;
    var g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t0);
  }

  function scheduler() {
    if (!ctx || !musicOn) return;
    var tempo = 92 + intensity * 38;
    var stepDur = 60 / tempo / 2;
    while (nextNoteTime < ctx.currentTime + 0.18) {
      var t = nextNoteTime, s = step % 32;
      var bar = Math.floor(s / 8);
      var root = [0, -3, -5, -2][bar]; // gentle chord walk (in scale-ish semitones)
      if (s % 2 === 0) { // bass
        tone("triangle", freq(root, 110), t, stepDur * 1.8, 0.22, musBus);
      }
      var arp = [0, 2, 4, 2, 3, 1, 4, 2][s % 8];
      if (s % 2 === 1 || intensity > 0.5) {
        tone("sine", freq(noteSemi(arp + 5) + root, 220), t, stepDur * 1.5, 0.12 + intensity * 0.05, musBus);
      }
      if (intensity > 0.25 && s % 4 === 2) noise(t, 0.04, 0.05 + intensity * 0.04, 6000);
      nextNoteTime += stepDur; step++;
    }
  }

  var Audio_ = {
    unlock: function () {
      if (!ctx) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          master = ctx.createGain(); master.connect(ctx.destination);
          sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
          musBus = ctx.createGain(); musBus.gain.value = 0.28; musBus.connect(master);
          applyGain();
        } catch (e) { ctx = null; return; }
      }
      if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    },
    setMuted: function (m) { userMuted = !!m; applyGain(); },
    isMuted: function () { return userMuted; },
    setAdMuted: function (m) { adMuted = !!m; applyGain(); if (ctx && m) { try { ctx.suspend(); } catch (e) {} } else if (ctx) { try { ctx.resume(); } catch (e) {} } },

    startMusic: function () {
      if (!ctx || musicOn) return;
      musicOn = true; nextNoteTime = ctx.currentTime + 0.05; step = 0;
      timer = setInterval(scheduler, 60);
    },
    stopMusic: function () { musicOn = false; if (timer) { clearInterval(timer); timer = null; } },
    setIntensity: function (v) { intensity = Math.max(0, Math.min(1, v)); },

    hop: function () { if (!ctx) return; var t = ctx.currentTime; tone("square", 330, t, 0.14, 0.12, sfxBus, 760); },
    land: function (combo, perfect) {
      if (!ctx) return; var t = ctx.currentTime;
      var base = noteSemi(Math.min(combo, 9));
      tone("triangle", freq(base, 330), t, 0.2, 0.22);
      if (perfect) {
        tone("sine", freq(base + 12, 330), t + 0.05, 0.25, 0.16);
        tone("sine", freq(base + 19, 330), t + 0.1, 0.3, 0.12);
      }
    },
    star: function (n) { if (!ctx) return; var t = ctx.currentTime; tone("sine", freq(noteSemi(4 + (n % 5)), 440), t, 0.16, 0.2); tone("sine", freq(noteSemi(7 + (n % 5)), 440), t + 0.07, 0.2, 0.16); },
    tick: function (danger) { if (!ctx) return; tone("square", danger ? 1200 : 900, ctx.currentTime, 0.04, 0.06); },
    boom: function () { if (!ctx) return; var t = ctx.currentTime; noise(t, 0.5, 0.5, 120); tone("sawtooth", 140, t, 0.45, 0.25, sfxBus, 40); },
    lose: function () { if (!ctx) return; var t = ctx.currentTime; tone("triangle", 392, t, 0.18, 0.22); tone("triangle", 330, t + 0.16, 0.18, 0.22); tone("triangle", 262, t + 0.32, 0.4, 0.24); },
    revive: function () { if (!ctx) return; var t = ctx.currentTime; for (var i = 0; i < 4; i++) tone("sine", freq(noteSemi(i * 2), 330), t + i * 0.07, 0.25, 0.2); },
    click: function () { if (!ctx) return; tone("sine", 620, ctx.currentTime, 0.07, 0.14, sfxBus, 880); }
  };

  window.Sfx = Audio_;
})();
