import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Queue display runs on LG WebOS TV which lacks IndexedDB support for
// persistent cache. Use memory-only cache for that route, persistent for
// the main app.
var db;
var isQueueDisplay = window.location.pathname === '/queue-display';

if (isQueueDisplay) {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} else {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (e) {
    // Fallback if persistence is not supported (e.g. private browsing)
    console.warn('Persistent cache unavailable, falling back to memory:', e);
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  }
}

const auth = getAuth(app);

export { db, auth };
export default app;
