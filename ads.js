// Rewarded ads with Google AdMob (Android app only). An ad is only shown when the player
// chooses to watch one in return for a reward; there are no banners or forced ads. In the
// browser, or before an ad has loaded, `adReady()` is false and the offers stay hidden.
const AdMob = globalThis.Capacitor?.Plugins?.AdMob;
const nativeApp = !!globalThis.Capacitor?.isNativePlatform?.();
// The app ID lives in android/app/src/main/res/values/strings.xml (admob_app_id).
// Pintamundo's rewarded ad unit. Google's test unit, ca-app-pub-3940256099942544/5224354917,
// can be put here to try the flow without real ads.
export const REWARDED_ID = 'ca-app-pub-8874186940779998/2770981951';
const TESTING = REWARDED_ID.startsWith('ca-app-pub-3940256099942544/');

let started = null, loading = null, ready = false;
// Consent first (Google shows its form only where the law asks for it), then the SDK.
// Ads are limited to content suitable for all ages.
function start() {
  started ??= (async () => {
    const consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') await AdMob.showConsentForm();
    await AdMob.initialize({ maxAdContentRating: 'ParentalGuidance' });
  })().catch(error => { started = null; throw error; });
  return started;
}
// Loads the next ad in the background so it is ready when an offer is shown.
export function preloadAd() {
  if (!nativeApp || !AdMob || ready || loading) return;
  loading = start()
    .then(() => AdMob.prepareRewardVideoAd({ adId: REWARDED_ID, isTesting: TESTING, immersiveMode: true }))
    .then(() => { ready = true; }, () => { ready = false; })
    .finally(() => { loading = null; });
}
export const adReady = () => ready;
// Shows the loaded ad. Resolves true if the player earned the reward, false if they closed
// it early or it could not be shown. Another ad starts loading afterwards.
export function watchAd() {
  if (!ready) return Promise.resolve(false);
  ready = false;
  return new Promise(resolve => {
    let done = false, rewarded = false;
    const handles = [];
    const finish = () => { if (done) return; done = true; for (const handle of handles) handle.remove?.(); resolve(rewarded); preloadAd(); };
    const listen = (event, handler) => Promise.resolve(AdMob.addListener(event, handler)).then(handle => handles.push(handle));
    Promise.all([
      listen('onRewardedVideoAdDismissed', () => setTimeout(finish, 300)),
      listen('onRewardedVideoAdFailedToShow', finish)
    ]).then(() => AdMob.showRewardVideoAd()).then(() => { rewarded = true; }, finish);
  });
}
