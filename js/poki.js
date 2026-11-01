/* Thin, safe wrapper around the Poki SDK.
 * - Never fires the same gameplay event twice in a row.
 * - Blocks SDK events while an ad is playing.
 * - Falls back to a local stub when the SDK cannot load (GitHub Pages / offline dev).
 * - Always calls onAdStart / onAdEnd so the game can mute audio and block input. */
(function () {
  var sdkReady = false;
  var playing = false;
  var inAd = false;
  var hooks = { adStart: function () {}, adEnd: function () {} };

  function sdk() { return window.PokiSDK && typeof window.PokiSDK.init === "function" ? window.PokiSDK : null; }

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  var Poki = {
    setHooks: function (h) { hooks.adStart = h.adStart || hooks.adStart; hooks.adEnd = h.adEnd || hooks.adEnd; },

    init: function () {
      var s = sdk();
      if (!s) { sdkReady = false; return Promise.resolve(false); }
      return s.init().then(function () { sdkReady = true; return true; })
        .catch(function () { sdkReady = false; return false; });
    },

    loadingFinished: function () {
      var s = sdk();
      if (s) safe(function () { s.gameLoadingFinished(); });
    },

    gameplayStart: function () {
      if (inAd || playing) return;
      playing = true;
      var s = sdk();
      if (s) safe(function () { s.gameplayStart(); });
    },

    gameplayStop: function () {
      if (inAd || !playing) return;
      playing = false;
      var s = sdk();
      if (s) safe(function () { s.gameplayStop(); });
    },

    isPlaying: function () { return playing; },
    isInAd: function () { return inAd; },

    /* Resolves when the break is over (or immediately when there is no SDK). */
    commercialBreak: function () {
      var s = sdk();
      if (!s || !sdkReady) return Promise.resolve();
      return new Promise(function (resolve) {
        var done = false;
        function finish() { if (done) return; done = true; inAd = false; hooks.adEnd(); resolve(); }
        inAd = true;
        var p;
        try {
          p = s.commercialBreak(function () { hooks.adStart(); });
        } catch (e) { finish(); return; }
        hooks.adStart();
        if (p && p.then) p.then(finish, finish); else finish();
      });
    },

    /* Resolves with true when the player should get the reward. */
    rewardedBreak: function () {
      var s = sdk();
      if (!s || !sdkReady) return Promise.resolve(false); // no SDK / ad blocked => never grant a reward
      return new Promise(function (resolve) {
        var done = false;
        function finish(ok) { if (done) return; done = true; inAd = false; hooks.adEnd(); resolve(!!ok); }
        inAd = true;
        var p;
        try {
          p = s.rewardedBreak({ size: "small", onStart: function () { hooks.adStart(); } });
        } catch (e) { finish(false); return; }
        hooks.adStart();
        if (p && p.then) p.then(finish, function () { finish(false); }); else finish(false);
      });
    },

    hasRewarded: function () { return !!(sdk() && sdkReady); }
  };

  window.Poki = Poki;
})();
