// Biome, la forêt de papier : couche publicitaire (GDD 6.3).
// Isole le kit de chaque portail. Pour le prototype : un simulateur (aucune vraie pub).
// Plus tard : brancher ici le kit Poki (PokiSDK.rewardedBreak, commercialBreak) ou CrazyGames (CrazyGames.SDK.ad.requestAd).
// API :
//   BiomeAds.recompense(texte) -> Promise<boolean>  pub récompensée ; true si elle a été vue jusqu'au bout
//   BiomeAds.coupure(texte)    -> Promise<void>     coupure (interstitielle) aux pauses naturelles
//   BiomeAds.surDebut / surFin : rappels pour couper le son et mettre le jeu en pause
(function (racine) {
  'use strict';
  const DUREE = 3; // s : durée de la pub simulée
  const Ads = { portail: 'simulateur', surDebut: null, surFin: null, enCours: false };

  function simuler(texte, recompensee) {
    return new Promise(resolve => {
      Ads.enCours = true;
      if (Ads.surDebut) Ads.surDebut();
      const voile = document.createElement('div');
      voile.className = 'pub-voile';
      voile.innerHTML = `<div class="pub-cadre"><div class="pub-titre"></div><div class="pub-compte"></div><button type="button" class="pub-passer" hidden></button></div>`;
      voile.querySelector('.pub-titre').textContent = texte;
      document.body.appendChild(voile);
      let reste = DUREE;
      const compte = voile.querySelector('.pub-compte'), bouton = voile.querySelector('.pub-passer');
      const fin = ok => {
        clearInterval(minuteur);
        voile.remove();
        Ads.enCours = false;
        if (Ads.surFin) Ads.surFin();
        resolve(ok);
      };
      compte.textContent = reste;
      const minuteur = setInterval(() => {
        reste--;
        compte.textContent = Math.max(0, reste);
        if (reste <= 0) { clearInterval(minuteur); bouton.hidden = false; bouton.textContent = '✓'; bouton.focus(); }
      }, 1000);
      bouton.addEventListener('click', () => fin(recompensee));
    });
  }

  Ads.recompense = texte => simuler(texte, true);
  Ads.coupure = texte => simuler(texte, false).then(() => undefined);
  racine.BiomeAds = Ads;
})(typeof self !== 'undefined' ? self : this);
