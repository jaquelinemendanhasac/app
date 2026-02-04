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

/** controla quando é seguro enviar (cloud-first) */
let readyForPush = false;

/** existe estado remoto real? (se existir, nunca vamos sobrescrever com o local no boot) */
let hadRemoteState = false;

/** guarda mudanças locais feitas antes da nuvem responder */
let pendingState = null;

/** evita re-aplicar o mesmo estado sem necessidade */
let lastRemoteHash = "";

function hashState(obj){
  try { return JSON.stringify(obj); }
  catch { return String(Date.now()); }
}

async function push(uid, state){
  lastRemoteHash = hashState(state);

  await setDoc(
    userDoc(uid),
    { state, updatedAt: Date.now() },
    { merge:true }
  );
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

    // Se veio algo válido da nuvem, aplica
    if(remote){
      hadRemoteState = true;

      const h = hashState(remote);
      if(h !== lastRemoteHash){
        lastRemoteHash = h;
        ignoreNextPush = true;

        if (typeof window.__SJM_SET_STATE_FROM_CLOUD === "function") {
          window.__SJM_SET_STATE_FROM_CLOUD(remote);
        }
      }
    }

    // ✅ Libera push somente depois do primeiro snapshot
    readyForPush = true;
    window.__SJM_CLOUD_READY = true;

    // ✅ Se não havia estado remoto e o usuário mexeu antes da nuvem responder, sobe UMA vez
    if(!hadRemoteState && pendingState){
      const toSeed = pendingState;
      pendingState = null;
      try{
        await push(uid, toSeed);
      }catch(e){
        console.error("Erro ao semear nuvem:", e);
      }
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if(!user){
    await login();
    return;
  }

  subscribe(user.uid);

  window.__SJM_CLOUD_READY = false;

  window.__SJM_PUSH_TO_CLOUD = async (state) => {
    // se veio da nuvem, não reenvia
    if(ignoreNextPush){
      ignoreNextPush = false;
      return;
    }

    // ainda não está pronto? só guarda (não pisa na nuvem)
    if(!readyForPush){
      pendingState = state;
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
