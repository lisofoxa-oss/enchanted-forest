import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get } from 'firebase/database';

// ============================================
// 🔥 ВСТАВЬ СЮДА СВОЙ FIREBASE CONFIG
// ============================================
// 1. Зайди на https://console.firebase.google.com
// 2. Создай новый проект (имя любое)
// 3. В проекте нажми "Add app" → Web (</>) 
// 4. Скопируй firebaseConfig объект сюда:

const firebaseConfig = {
  apiKey: "AIzaSyCqRiciWDtvlojGl7rHYtEI9PTKz-ARZtI",
  authDomain: "enchanted-forest-8561d.firebaseapp.com",
  databaseURL: "https://enchanted-forest-8561d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "enchanted-forest-8561d",
  storageBucket: "enchanted-forest-8561d.firebasestorage.app",
  messagingSenderId: "926223339852",
  appId: "1:926223339852:web:c2958a89a9236dd47d3fe9"
};


// ============================================

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const GAME_REF = 'enchanted-forest/game';

export async function saveGame(gameState) {
  try {
    await set(ref(db, GAME_REF), { ...gameState, ts: Date.now() });
  } catch (e) {
    console.error('Firebase save error:', e);
  }
}

export async function loadGame() {
  try {
    const snapshot = await get(ref(db, GAME_REF));
    if (snapshot.exists()) return snapshot.val();
  } catch (e) {
    console.error('Firebase load error:', e);
  }
  return null;
}

export function onGameUpdate(callback) {
  return onValue(ref(db, GAME_REF), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    }
  });
}
