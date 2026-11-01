/* Tiny localisation helper - no external requests. */
(function () {
  var S = {
    en: { tagline: "Tap to hop to the next planet!", play: "PLAY", skin: "Color", best: "Best", pause: "Paused", resume: "RESUME",
          over: "Crashed!", again: "PLAY AGAIN", revive: "Continue", newBest: "NEW BEST!", hint: "TAP!", perfect: "PERFECT!", hops: "Hops" },
    tr: { tagline: "Sıradaki gezegene zıplamak için dokun!", play: "OYNA", skin: "Renk", best: "En iyi", pause: "Duraklatıldı", resume: "DEVAM",
          over: "Çakıldın!", again: "TEKRAR OYNA", revive: "Devam et", newBest: "YENİ REKOR!", hint: "DOKUN!", perfect: "MÜKEMMEL!", hops: "Zıplama" },
    es: { tagline: "¡Toca para saltar al siguiente planeta!", play: "JUGAR", skin: "Color", best: "Mejor", pause: "Pausa", resume: "SEGUIR",
          over: "¡Chocaste!", again: "JUGAR DE NUEVO", revive: "Continuar", newBest: "¡NUEVO RÉCORD!", hint: "¡TOCA!", perfect: "¡PERFECTO!", hops: "Saltos" },
    pt: { tagline: "Toque para pular para o próximo planeta!", play: "JOGAR", skin: "Cor", best: "Melhor", pause: "Pausado", resume: "CONTINUAR",
          over: "Bateu!", again: "JOGAR NOVAMENTE", revive: "Continuar", newBest: "NOVO RECORDE!", hint: "TOQUE!", perfect: "PERFEITO!", hops: "Pulos" },
    de: { tagline: "Tippe, um zum nächsten Planeten zu hüpfen!", play: "SPIELEN", skin: "Farbe", best: "Bestwert", pause: "Pause", resume: "WEITER",
          over: "Abgestürzt!", again: "NOCHMAL", revive: "Weitermachen", newBest: "NEUER REKORD!", hint: "TIPPEN!", perfect: "PERFEKT!", hops: "Sprünge" },
    fr: { tagline: "Touche pour sauter vers la planète suivante !", play: "JOUER", skin: "Couleur", best: "Record", pause: "Pause", resume: "REPRENDRE",
          over: "Écrasé !", again: "REJOUER", revive: "Continuer", newBest: "NOUVEAU RECORD !", hint: "TOUCHE !", perfect: "PARFAIT !", hops: "Sauts" },
    ru: { tagline: "Нажми, чтобы прыгнуть на следующую планету!", play: "ИГРАТЬ", skin: "Цвет", best: "Рекорд", pause: "Пауза", resume: "ПРОДОЛЖИТЬ",
          over: "Крушение!", again: "ЕЩЁ РАЗ", revive: "Продолжить", newBest: "НОВЫЙ РЕКОРД!", hint: "НАЖМИ!", perfect: "ИДЕАЛЬНО!", hops: "Прыжки" }
  };
  var lang = "en";
  try {
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    var short = String(nav).toLowerCase().slice(0, 2);
    if (S[short]) lang = short;
  } catch (e) {}
  window.T = function (k) { return (S[lang] && S[lang][k]) || S.en[k] || k; };
  window.LANG = lang;
  try { document.documentElement.lang = lang; } catch (e) {}
})();
