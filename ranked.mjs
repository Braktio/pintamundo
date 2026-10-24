// Server-side ranked play: verifies the phones' Google accounts and writes the trophies of
// every online match to Firestore, so nobody can raise their own. Only the server can write
// the ranking (see firestore.rules). Each season has its own collection, ranking-YYYY-MM.
// It runs only when FIREBASE_SERVICE_ACCOUNT holds a Firebase service-account key (JSON).
import { rankChange, seasonOf, previousSeason, seasonStart, PROGRESS_EPOCH } from './engine.js';

export async function createRanked(serviceAccount) {
  const [{ initializeApp, cert }, { getFirestore }, { getAuth }] = await Promise.all([
    import('firebase-admin/app'), import('firebase-admin/firestore'), import('firebase-admin/auth')
  ]);
  const app = initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  const db = getFirestore(app), auth = getAuth(app);
  const row = (season, uid) => db.collection('ranking-' + season).doc(uid);
  // Adds one match to a player's season row, starting the season from half of last
  // season's trophies the first time. Returns the new total.
  async function apply(result, season) {
    return db.runTransaction(async tx => {
      const current = await tx.get(row(season, result.uid));
      // Rows from before the last progress reset (another epoch) count as empty.
      const fresh = doc => doc.exists && doc.data().epoch === PROGRESS_EPOCH ? doc.data() : null;
      let points = fresh(current)?.points;
      if (points === undefined) points = seasonStart(season, fresh(await tx.get(row(previousSeason(season), result.uid)))?.points);
      const next = Math.max(0, points + rankChange(result));
      tx.set(row(season, result.uid), { name: result.name, skin: result.skin, points: next, epoch: PROGRESS_EPOCH, updatedAt: Date.now() });
      return { change: next - points, points: next };
    });
  }
  return {
    verify: token => auth.verifyIdToken(token).then(decoded => decoded.uid),
    // `send(client, message)` tells each phone its new trophies (and its new friends).
    async record(results, send) {
      const season = seasonOf();
      await Promise.all(results.map(async result => {
        try {
          const { change, points } = await apply(result, season);
          send(result.client, { t: 'trophies', season, change, points, friends: result.friends });
        } catch (error) { console.error('Ranking:', error.message); }
      }));
    }
  };
}
