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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* COLE A CONFIG AQUI (Firebase -> Configurações do projeto -> Seus apps -> Web) */
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
  // measurementId é opcional
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function userDoc(uid){
  return doc(db, "users", uid, "app", "state");
}

async function login(){
  const email = prompt("Email do sistema:");
  const pass = prompt("Senha:");
  if(!email || !pass) return;

  try{
    await signInWithEmailAndPassword(auth, email, pass);
  }catch(e){
    console.error(e);
    alert("Login inválido. Verifique email e senha.");
  }
}

/** evita re-push quando a mudança veio da nuvem */
let ignoreNextPush = false;

/** evita re-aplicar o mesmo estado sem necessidade */
let lastRemoteHash = "";

function hashState(obj){
  try { return JSON.stringify(obj); }
  catch { return String(Date.now()); }
}

function subscribe(uid){
  onSnapshot(userDoc(uid), async (snap) => {
    if(!snap.exists()){
      try{
        await setDoc(userDoc(uid), { state: null, updatedAt: Date.now() }, { merge:true });
      }catch(e){
        console.error("Erro criando doc:", e);
      }
      return;
    }

    const remote = snap.data()?.state;
    if(!remote) return;

    const h = hashState(remote);
    if(h === lastRemoteHash) return;
    lastRemoteHash = h;

    ignoreNextPush = true;

    if (typeof window.__SJM_SET_STATE_FROM_CLOUD === "function") {
      window.__SJM_SET_STATE_FROM_CLOUD(remote);
    }
  });
}

async function push(uid, state){
  lastRemoteHash = hashState(state);

  await setDoc(
    userDoc(uid),
    { state, updatedAt: Date.now() },
    { merge:true }
  );
}

onAuthStateChanged(auth, async (user) => {
  if(!user){
    await login();
    return;
  }

  subscribe(user.uid);

  window.__SJM_PUSH_TO_CLOUD = async (state) => {
    if(ignoreNextPush){
      ignoreNextPush = false;
      return;
    }

    try{
      await push(user.uid, state);
    }catch(e){
      console.error("Erro ao enviar para nuvem:", e);
      alert("Não consegui sincronizar com a nuvem. Verifique internet e permissões do Firebase.");
    }
  };
});
