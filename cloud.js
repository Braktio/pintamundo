// Cloud save: sign in with Google (Firebase Authentication) and keep the profile in
// Firestore at users/{uid}. The Android app uses the native Capacitor plugins, called
// through the bridge; the browser loads the Firebase web SDK from Google's CDN the first
// time it is needed. No bundler is needed either way.
const native = globalThis.Capacitor;
const Auth = native?.Plugins?.FirebaseAuthentication, Store = native?.Plugins?.FirebaseFirestore;
const nativeApp = !!native?.isNativePlatform?.();
// Web sign-in needs a page served over http(s) from a domain authorized in Firebase.
export const available = nativeApp ? !!(Auth && Store) : /^https?:$/.test(location.protocol);

// Public web settings of the Firebase project (the same project as google-services.json).
const CONFIG = { apiKey: 'AIzaSyBH4M_YGK2tLLCG4_sm2JsoF9cPvSlEmFI', authDomain: 'pintamundo-74676.firebaseapp.com', projectId: 'pintamundo-74676' };
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
// The web SDK, once loaded: { auth, store, session, db }. Kept so a later sign-in can open
// Google's popup straight from the tap, which browsers require.
let web = null, loading = null;
function loadWeb() {
  loading ??= Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore-lite.js'].map(file => import(SDK + file)))
    .then(([app, auth, store]) => {
      const instance = app.initializeApp(CONFIG);
      return (web = { auth, store, session: auth.getAuth(instance), db: store.getFirestore(instance) });
    })
    .catch(error => { loading = null; throw error; });
  return loading;
}

// Firebase user → { uid, name }.
const account = user => user ? { uid: user.uid, name: user.displayName || '' } : null;
export async function currentAccount() {
  if (!available) return null;
  if (nativeApp) return account((await Auth.getCurrentUser()).user);
  const { session } = await loadWeb();
  await session.authStateReady();
  return account(session.currentUser);
}
export async function signIn() {
  if (nativeApp) return account((await Auth.signInWithGoogle()).user);
  const { auth, session } = web || await loadWeb();
  return account((await auth.signInWithPopup(session, new auth.GoogleAuthProvider())).user);
}
export async function signOut() {
  if (!available) return;
  if (nativeApp) await Auth.signOut();
  else await (await loadWeb()).session.signOut();
}

// The profile is stored as JSON text, so Firestore never changes its number types.
// Level and name are copied outside it to make the console easy to read.
export async function download(uid) {
  let data;
  if (nativeApp) data = (await Store.getDocument({ reference: `users/${uid}` })).snapshot?.data;
  else { const { store, db } = await loadWeb(); data = (await store.getDoc(store.doc(db, 'users', uid))).data(); }
  return typeof data?.profile === 'string' ? data.profile : null;
}
// Global ranking: one public row per signed-in player at ranking/{uid}, read by everyone.
export async function publishRank(uid, profile) {
  const data = { name: profile.name || 'Jugador', points: profile.points, skin: profile.skin, updatedAt: Date.now() };
  if (nativeApp) await Store.setDocument({ reference: `ranking/${uid}`, data });
  else { const { store, db } = await loadWeb(); await store.setDoc(store.doc(db, 'ranking', uid), data); }
}
// The best players, most trophies first: [{ uid, name, points, skin }].
export async function topPlayers(limit = 50) {
  if (nativeApp) {
    const { snapshots } = await Store.getCollection({ reference: 'ranking', queryConstraints: [{ type: 'orderBy', fieldPath: 'points', directionStr: 'desc' }, { type: 'limit', limit }] });
    return snapshots.map(s => ({ uid: s.id, ...s.data }));
  }
  const { store, db } = await loadWeb();
  const result = await store.getDocs(store.query(store.collection(db, 'ranking'), store.orderBy('points', 'desc'), store.limit(limit)));
  return result.docs.map(d => ({ uid: d.id, ...d.data() }));
}
// Deletes everything the cloud keeps for this player: the saved profile and the ranking row.
export async function deleteData(uid) {
  for (const reference of [`users/${uid}`, `ranking/${uid}`]) {
    if (nativeApp) await Store.deleteDocument({ reference });
    else { const { store, db } = await loadWeb(); await store.deleteDoc(store.doc(db, ...reference.split('/'))); }
  }
}
export async function upload(uid, profile, level) {
  const data = { profile: JSON.stringify(profile), updatedAt: profile.updatedAt, name: profile.name, level };
  if (nativeApp) await Store.setDocument({ reference: `users/${uid}`, data });
  else { const { store, db } = await loadWeb(); await store.setDoc(store.doc(db, 'users', uid), data); }
}
