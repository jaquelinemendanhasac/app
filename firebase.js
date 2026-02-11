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

/* 🔥 IMPORTANTE */
try {
  await enableIndexedDbPersistence(db);
} catch {}

/* ✅ DOCUMENTO ÚNICO (substitui o userDoc sem apagar a ideia de “doc”) */
function userDoc(uid){
  // uid fica só para compatibilidade (não faz mais diferença)
  return doc(db, "studio", "globalState");
}

let lastLocalWrite = 0;
let ready = false;
let applyingRemote = false;

/* ✅ fila para não quebrar digitação */
let queuedRemote = null;
window.__SJM_IS_EDITING = window.__SJM_IS_EDITING || false;

(function installEditGuards(){
  document.addEventListener("focusin", (e)=>{
    const t = e.target;
    if(t && (t.tagName==="INPUT" || t.tagName==="TEXTAREA" || t.tagName==="SELECT")){
      window.__SJM_IS_EDITING = true;
    }
  }, true);

  document.addEventListener("focusout", (e)=>{
    const t = e.target;
    if(t && (t.tagName==="INPUT" || t.tagName==="TEXTAREA" || t.tagName==="SELECT")){
      setTimeout(()=>{
        const a = document.activeElement;
        const still = a && (a.tagName==="INPUT" || a.tagName==="TEXTAREA" || a.tagName==="SELECT");
        window.__SJM_IS_EDITING = !!still;

        // aplica remoto pendente assim que parar de editar
        if(!window.__SJM_IS_EDITING && queuedRemote){
          const r = queuedRemote;
          queuedRemote = null;
          applyingRemote = true;
          try { window.__SJM_SET_STATE_FROM_CLOUD?.(r); } finally { applyingRemote = false; }
        }
      }, 80);
    }
  }, true);
})();

/* LOGIN */
async function login(){
  const email = prompt("Email do sistema:");
  const pass  = prompt("Senha:");
  if(!email || !pass) return;

  await signInWithEmailAndPassword(auth, email.trim(), pass.trim());
}

/* PUSH */
async function push(uid, state){
  const now = Date.now();
  lastLocalWrite = now;

  await setDoc(
    userDoc(uid),
    { state, updatedAt: now },
    { merge:true }
  );
}

/* SUBSCRIBE */
function subscribe(uid){

  onSnapshot(userDoc(uid), async (snap)=>{

    /* ✅ se não existe, cria e já libera o push */
    if(!snap.exists()){
      const local = window.__SJM_GET_STATE?.() || null;
      await setDoc(userDoc(uid), { state: local, updatedAt: Date.now() }, { merge:true });
      ready = true;
      return;
    }

    const data = snap.data() || {};
    const remote = data.state;
    const updatedAt = Number(data.updatedAt || 0);

    /* ✅ assim que o primeiro snapshot chega, libera o push */
    ready = true;

    // 🔥 ignora eco do próprio aparelho
    if(updatedAt === lastLocalWrite) return;

    // ✅ se a nuvem estiver vazia, semeia com o local
    if(!remote){
      const local = window.__SJM_GET_STATE?.() || null;
      if(local) await push(uid, local);
      return;
    }

    // ✅ não aplica remoto no meio da digitação
    if(window.__SJM_IS_EDITING){
      queuedRemote = remote;
      return;
    }

    applyingRemote = true;
    try{
      window.__SJM_SET_STATE_FROM_CLOUD?.(remote);
    } finally {
      applyingRemote = false;
    }
  });

}

/* AUTH */
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    await login();
    return;
  }

  subscribe(user.uid);

  window.__SJM_PUSH_TO_CLOUD = async (state)=>{
    // ✅ não trava mais para sempre: ready libera no primeiro snapshot
    if(!ready) return;
    if(applyingRemote) return;

    await push(user.uid, state);
  };

  // ✅ garante um push inicial caso o app já tenha estado local
  setTimeout(()=>{
    try{
      const local = window.__SJM_GET_STATE?.();
      if(local) window.__SJM_PUSH_TO_CLOUD(local);
    }catch{}
  }, 600);
});
