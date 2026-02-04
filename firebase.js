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

let ignoreNextPush = false;
let readyForPush = false;
let hadRemoteState = false;
let pendingState = null;
let lastRemoteHash = "";

function hashState(obj){
  try { return JSON.stringify(obj); }
  catch { return String(Date.now()); }
}

async function push(uid, state){
  lastRemoteHash = hashState(state);
  await setDoc(userDoc(uid), { state, updatedAt: Date.now() }, { merge:true });
}

function subscribe(uid){
  onSnapshot(userDoc(uid), async (snap)=>{
    if(!snap.exists()){
      await setDoc(userDoc(uid), { state:null, updatedAt:Date.now() }, { merge:true });
      return;
    }

    const remote = snap.data()?.state;
    if(remote){
      hadRemoteState = true;
      const h = hashState(remote);
      if(h !== lastRemoteHash){
        lastRemoteHash = h;
        ignoreNextPush = true;
        window.__SJM_SET_STATE_FROM_CLOUD?.(remote);
      }
    }

    readyForPush = true;

    if(!hadRemoteState && pendingState){
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

  subscribe(user.uid);

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
