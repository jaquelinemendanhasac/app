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
/* IndexedDB persistence (offline) */
try {
  await enableIndexedDbPersistence(db);
} catch (e) {
  // Pode falhar em multi-abas ou browsers com bloqueio de storage
  console.warn("IndexedDB persistence não ativado:", e?.code || e);
}
/* Documento único */
function globalDoc() {
  return doc(db, "studio", "globalState");
}
let applyingRemote = false;
let ready = false;
/* Helpers: compara versões usando meta.rev + meta.updatedAt */
function metaOf(state){
  const m = state?.meta || {};
  return {
    clientId: String(m.clientId || ""),
    rev: Number.isFinite(m.rev) ? m.rev : 0,
    updatedAt: Number.isFinite(m.updatedAt) ? m.updatedAt : 0
  };
}
function isRemoteNewer(remote, local){
  const r = metaOf(remote);
  const l = metaOf(local);
  if(r.rev !== l.rev) return r.rev > l.rev;
  return r.updatedAt > l.updatedAt;
}
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
  onSnapshot(globalDoc(), async (snap) => {
    ready = true;
    if (!snap.exists()) return;
    const data = snap.data();
    const remote = data?.state;
    if (!remote) return;
    const local = window.__SJM_GET_STATE?.();
    const localMeta = metaOf(local);
    const remoteMeta = metaOf(remote);
    // Evita aplicar eco do mesmo device quando não é mais novo
    if(remoteMeta.clientId && localMeta.clientId && remoteMeta.clientId === localMeta.clientId){
      if(remoteMeta.rev <= localMeta.rev){
        window.__SJM_SET_SYNC_STATUS?.("Sync: ok ");
        return;
      }
    }
    // Aplica remoto somente se for mais novo
    if(local && !isRemoteNewer(remote, local)){
      window.__SJM_SET_SYNC_STATUS?.("Sync: ok ");
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
  subscribe();
  // Função usada pelo app.js para enviar pro cloud (com debounce do app)
  window.__SJM_PUSH_TO_CLOUD = async (state) => {
    if (!ready) return;
    await push(state);
  };
  // Push inicial: só se local estiver mais novo do que o remoto (evita sobrescrever)
  setTimeout(async () => {
    try{
      const local = window.__SJM_GET_STATE?.();
      if(!local) return;
      // lê 1 snapshot (o subscribe já vai fazer isso, mas aqui é extra-seguro)
      // se não tiver remoto ainda, vai cair no push sem risco
      const unsub = onSnapshot(globalDoc(), (snap)=>{
        try{
          if(!snap.exists()){
            push(local);
            return;
          }
          const remote = snap.data()?.state;
          if(!remote || isRemoteNewer(local, remote)){
            push(local);
          }
        }finally{
        }
          unsub();
      });
    }catch(e){
      console.warn("Push inicial falhou:", e);
    }
  }, 900);
})
