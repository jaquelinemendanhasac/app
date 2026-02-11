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

/* ✅ CONFIG REAL DO SEU PROJETO */
const firebaseConfig = {
  apiKey: "AIzaSyCk7zPsYE5FRZ0K1Uuju1ASz3LZebz4oGU",
  authDomain: "app-studio-jaqueline-mendanha.firebaseapp.com",
  projectId: "app-studio-jaqueline-mendanha",
  storageBucket: "app-studio-jaqueline-mendanha.firebasestorage.app",
  messagingSenderId: "851024289589",
  appId: "1:851024289589:web:595cdaa7a44535220e367c",
};

/* INIT */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* (Opcional, mas ajuda MUITO no celular/PC offline e evita “sumir sync”) */
try {
  await enableIndexedDbPersistence(db);
} catch (e) {
  // Se der "failed-precondition" (múltiplas abas) ou "unimplemented" (browser antigo), tudo bem.
  console.warn("persistence:", e.code || e.message);
}

/* ===== LOGIN ===== */
async function login(){
  const email = (prompt("Email do sistema:") || "").trim();
  const pass  = (prompt("Senha:") || "").trim();
  if(!email || !pass) return;

  try{
    await signInWithEmailAndPassword(auth, email, pass);
  }catch(e){
    console.error(e);
    alert("Falha no login: " + (e.code || e.message));
  }
}

/* ===== CLOUD STATE ===== */
function userDoc(uid){
  return doc(db, "users", uid, "app", "state");
}

let lastRemoteUpdatedAt = 0;
let lastLocalPushedAt = 0;
let ignoreNextPush = false;
let readyForPush = false;
let pendingState = null;
let lastRemoteHash = "";

function hashState(obj){
  try { return JSON.stringify(obj); }
  catch { return String(Date.now()); }
}

async function push(uid, state){
  const now = Date.now();
  lastLocalPushedAt = now;
  lastRemoteHash = hashState(state);

  await setDoc(
    userDoc(uid),
    { state, updatedAt: now },
    { merge:true }
  );
}

function subscribe(uid){
  onSnapshot(userDoc(uid), async (snap)=>{
    // ✅ 1) Se for write local pendente, não reaplica (evita “pisar” na digitação)
    if (snap.metadata && snap.metadata.hasPendingWrites) return;

    // ✅ Se ainda não existe doc, cria
    if(!snap.exists()){
      await setDoc(userDoc(uid), { state:null, updatedAt:Date.now() }, { merge:true });
      return;
    }

    const data = snap.data() || {};
    const remote = data.state;
    const remoteUpdatedAt = Number(data.updatedAt || 0);

    // ✅ 2) Se é update antigo, ignora
    if (remoteUpdatedAt && remoteUpdatedAt <= lastRemoteUpdatedAt) {
      readyForPush = true;
      return;
    }
    lastRemoteUpdatedAt = remoteUpdatedAt;

    // ✅ 3) Se foi eco do mesmo aparelho, ignora
    if (remoteUpdatedAt && remoteUpdatedAt === lastLocalPushedAt) {
      readyForPush = true;
      return;
    }

    // ✅ 4) Aplica estado remoto se mudou (sem forçar re-render durante edição)
    if(remote){
      const h = hashState(remote);
      if(h !== lastRemoteHash){
        lastRemoteHash = h;
        ignoreNextPush = true;
        window.__SJM_SET_STATE_FROM_CLOUD?.(remote);
      }
    }

    readyForPush = true;

    // ✅ 5) Se tinha estado local guardado e a nuvem estava “vazia”, empurra depois que ficar pronto
    if(pendingState && (!remote || remote === null)){
      const seed = pendingState;
      pendingState = null;
      await push(uid, seed);
    }
  });
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    await login();
    return;
  }

  // pega o estado local atual (se existir) para semear a nuvem se precisar
  pendingState = window.__SJM_GET_STATE?.() || pendingState;

  subscribe(user.uid);

  // ✅ função única pra app.js chamar quando quiser salvar
  window.__SJM_PUSH_TO_CLOUD = async (state)=>{
    if(ignoreNextPush){
      ignoreNextPush = false;
      return;
    }
    if(!readyForPush){
      pendingState = state;
      return;
    }
    await push(user.uid, state);
  };
});
