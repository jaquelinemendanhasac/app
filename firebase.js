import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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

const ALLOWED_EMAILS = new Set([
  "sacjaquelinemendanha@gmail.com",
]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

try { await enableIndexedDbPersistence(db); } catch {}

/* Documento único */
function globalDoc() {
  return doc(db, "studio", "globalState");
}

let applyingRemote = false;
let ready = false;

/* LOGIN (obrigatório) */
async function login() {
  const email = prompt("Email do sistema:");
  const pass  = prompt("Senha:");
  if (!email || !pass) return;

  try{
    await signInWithEmailAndPassword(auth, email.trim(), pass.trim());
  }catch(err){
    console.error("Login falhou:", err);
    alert("Login inválido. Confira email/senha.");
  }
}

/* Segurança: só permite e-mail autorizado */
async function enforceAllowedEmail(user){
  const email = (user?.email || "").toLowerCase().trim();
  if(!ALLOWED_EMAILS.has(email)){
    alert("Acesso negado: este e-mail não está autorizado neste sistema.");
    try { await signOut(auth); } catch {}
    return false;
  }
  return true;
}

/* PUSH */
async function push(state) {
  if (applyingRemote) return;
  if (!ready) return;
  if (!state || typeof state !== "object") return;

  // usa meta do seu app.js (clientId/rev/updatedAt)
  const meta = state.meta && typeof state.meta === "object" ? state.meta : {};
  const payload = {
    state,
    meta: {
      clientId: meta.clientId || null,
      rev: typeof meta.rev === "number" ? meta.rev : 0,
      updatedAt: typeof meta.updatedAt === "number" ? meta.updatedAt : Date.now(),
    },
    updatedAt: Date.now()
  };

  await setDoc(globalDoc(), payload, { merge: true });
}

/* SUBSCRIBE */
function subscribe() {
  onSnapshot(globalDoc(), (snap) => {
    ready = true;
    if (!snap.exists()) return;

    const data = snap.data() || {};
    const remote = data?.state;
    if (!remote) return;

    // Anti-eco simples: se o app.js já tem meta e o remoto é "mais velho", ignora
    const local = window.__SJM_GET_STATE?.();
    const localMeta = local?.meta || {};
    const remoteMeta = remote?.meta || {};

    if (
      localMeta?.clientId &&
      remoteMeta?.clientId &&
      localMeta.clientId === remoteMeta.clientId &&
      typeof remoteMeta.rev === "number" &&
      typeof localMeta.rev === "number" &&
      remoteMeta.rev <= localMeta.rev
    ){
      window.__SJM_SET_SYNC_STATUS?.("Sync: ok ✅");
      return;
    }

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

  const ok = await enforceAllowedEmail(user);
  if(!ok) return;

  subscribe();

  // o app.js chama isso via scheduleCloudPush()
  window.__SJM_PUSH_TO_CLOUD = async (state) => {
    await push(state);
  };

  // push inicial (se já tem estado local)
  setTimeout(() => {
    const local = window.__SJM_GET_STATE?.();
    if (local) push(local);
  }, 900);
});
