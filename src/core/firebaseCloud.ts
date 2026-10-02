/** Este módulo (SDK incluído) só é carregado quando o serviço de contas está configurado. */
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, inMemoryPersistence, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { validateProfile, type ProfileData } from './profile';
import type { CloudTransport } from './cloud';

export async function createFirebaseTransport(options: FirebaseOptions): Promise<CloudTransport> {
  const app = initializeApp(options, 'karimbolandia-saves');
  const auth = getAuth(app);
  auth.languageCode = 'pt-BR';
  try { await setPersistence(auth, browserLocalPersistence); }
  catch { await setPersistence(auth, inMemoryPersistence); }
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const target = (uid: string) => {
    if (auth.currentUser?.uid !== uid) throw new Error('A conta mudou.');
    return doc(db, 'saves', uid);
  };
  const encode = (data: ProfileData) => {
    if (!validateProfile(data)) throw new Error('Save inválido.');
    const payload = JSON.stringify(data);
    if (new TextEncoder().encode(payload).length > 250000) throw new Error('Save grande demais. Baixe um backup.');
    return payload;
  };
  return {
    userChanged: fn => onAuthStateChanged(auth, user => fn(user ? { uid: user.uid, email: user.email } : null)),
    login: async () => { await signInWithPopup(auth, provider); },
    logout: () => signOut(auth),
    read: async uid => {
      const snapshot = await getDocFromServer(target(uid));
      if (!snapshot.exists()) return null;
      const raw = snapshot.data();
      const data = typeof raw.payload === 'string' ? validateProfile(JSON.parse(raw.payload)) : null;
      if (!data || !Number.isSafeInteger(raw.revision) || raw.revision < 1) throw new Error('Save remoto incompatível.');
      return { revision: raw.revision, data };
    },
    write: async (uid, data, expectedRevision) => {
      const ref = target(uid), payload = encode(data);
      return runTransaction(db, async transaction => {
        const old = await transaction.get(ref);
        const revision = old.exists() ? old.data().revision : 0;
        if (revision !== expectedRevision) throw new Error('O save foi alterado em outro aparelho.');
        // A cópia anterior viaja junto no objeto privado da conta.
        transaction.set(ref, { v: 1, revision: revision + 1, payload, previousPayload: old.exists() ? old.data().payload : '', updatedAt: serverTimestamp() });
        return revision + 1;
      });
    },
  };
}
