// Cloud save: sign in with Google or Facebook (Firebase Authentication) and keep the
// profile in Firestore at users/{uid}. It uses the native Capacitor plugins of the
// Android app, called through the bridge, so no bundler is needed. In the browser, or
// in an APK built without Firebase configured, `available` is false and the game
// simply keeps its progress on the device.
const native = globalThis.Capacitor;
const Auth = native?.Plugins?.FirebaseAuthentication, Store = native?.Plugins?.FirebaseFirestore;
export const available = !!(native?.isNativePlatform?.() && Auth && Store);

export const PROVIDERS = { google: 'Google', facebook: 'Facebook' };
// Firebase user → { uid, name, provider }.
function account(user) {
  if (!user) return null;
  const id = user.providerData?.map(p => p.providerId).find(p => p === 'google.com' || p === 'facebook.com');
  return { uid: user.uid, name: user.displayName || '', provider: id === 'facebook.com' ? 'facebook' : 'google' };
}
export async function currentAccount() {
  if (!available) return null;
  const { user } = await Auth.getCurrentUser();
  return account(user);
}
export async function signIn(provider) {
  const result = provider === 'facebook' ? await Auth.signInWithFacebook() : await Auth.signInWithGoogle();
  return account(result.user);
}
export async function signOut() { if (available) await Auth.signOut(); }

// The profile is stored as JSON text, so Firestore never changes its number types.
// Level and name are copied outside it to make the console easy to read.
export async function download(uid) {
  const { snapshot } = await Store.getDocument({ reference: `users/${uid}` });
  return typeof snapshot?.data?.profile === 'string' ? snapshot.data.profile : null;
}
export async function upload(uid, profile, level) {
  await Store.setDocument({ reference: `users/${uid}`, data: { profile: JSON.stringify(profile), updatedAt: profile.updatedAt, name: profile.name, level } });
}
