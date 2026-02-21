import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyCk7zPsYE5FRZ0K1Uuju1ASz3LZebz4oGU",
  authDomain: "app-studio-jaqueline-mendanha.firebaseapp.com",
  projectId: "app-studio-jaqueline-mendanha",
  storageBucket: "app-studio-jaqueline-mendanha.firebasestorage.app",
  messagingSenderId: "851024289589",
  appId: "1:851024289589:web:595cdaa7a44535220e367c",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

try {
  await enableIndexedDbPersistence(db);
} catch {}

/* Documento único */
function globalDoc() {
  return doc(db, "studio", "globalState");
}

let applyingRemote = false;
let ready = false;

/* LOGIN */
async function login() {
  const email = prompt("Email do sistema:");
  const pass  = prompt("Senha:");
  if (!email || !pass) return;

  await signInWithEmailAndPassword(auth, email.trim(), pass.trim());
}

/* PUSH */
async function push(state) {
  if (applyingRemote) return;

  await setDoc(globalDoc(), {
    state,
    updatedAt: Date.now()
  }, { merge: true });
}

/* SUBSCRIBE */
function subscribe() {

  onSnapshot(globalDoc(), (snap) => {

    ready = true;

    if (!snap.exists()) return;

    const data = snap.data();
    const remote = data?.state;

    if (!remote) return;

    applyingRemote = true;
    try {
      window.__SJM_SET_STATE_FROM_CLOUD?.(remote);
    } finally {
      applyingRemote = false;
    }
  });

}

/* AUTH */
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    await login();
    return;
  }

  subscribe();

  window.__SJM_PUSH_TO_CLOUD = async (state) => {
    if (!ready) return;
    await push(state);
  };

  // push inicial
  setTimeout(() => {
    const local = window.__SJM_GET_STATE?.();
    if (local) push(local);
  }, 1000);
});
