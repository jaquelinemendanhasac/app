import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  enableIndexedDbPersistence,
  getDoc,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// V56_FORCE_LOGOUT
try { document.body?.classList.add("auth-locked"); } catch {}
const __SJM_FORCE_LOGOUT_V56 = new URLSearchParams(location.search).get("logout") === "1" || sessionStorage.getItem("sjm_force_logout") === "1";

const firebaseConfig = {
  apiKey: "AIzaSyCk7zPsYE5FRZ0K1Uuju1ASz3LZebz4oGU",
  authDomain: "app-studio-jaqueline-mendanha.firebaseapp.com",
  projectId: "app-studio-jaqueline-mendanha",
  storageBucket: "app-studio-jaqueline-mendanha.firebasestorage.app",
  messagingSenderId: "851024289589",
  appId: "1:851024289589:web:595cdaa7a44535220e367c",
};

const ALLOWED_EMAILS = new Set([
  // Para SaaS, deixe vazio. Para travar e-mails, preencha aqui.
]);

const DEV_EMAIL = ""; // removido na versão cliente
const DEV_PASSWORD = ""; // removido na versão cliente

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

if (__SJM_FORCE_LOGOUT_V56) {
  try { await signOut(auth); } catch(e) {}
  try {
    window.__SJM_CURRENT_USER = null;
    window.__SJM_DEV_UNLOCKED = false;
    window.__SJM_IS_DEVELOPER = false;
  } catch(e) {}
}

try { await enableIndexedDbPersistence(db); } catch {}

function globalDoc(user) {
  return doc(db, "studio", user.uid, "state", "globalState");
}
function studioPublicDoc(uid) {
  return doc(db, "studio", uid, "public", "autoagendamento");
}
function bookingRequestDoc(uid, requestId) {
  return doc(db, "studio", uid, "bookingRequests", requestId);
}
function isPublicBookingRoute(){
  try { return /^#agendar(\/|$)/i.test(String(location.hash || "")); } catch(e){ return false; }
}

let applyingRemote = false;
let ready = false;
let unsubscribeSnapshot = null;

function setMsg(msg) {
  const el = document.getElementById("authMsg");
  if (el) el.textContent = msg || "";
}

function showAuthTab(which) {
  const login = document.getElementById("loginForm");
  const reg = document.getElementById("registerForm");
  const tLogin = document.getElementById("authTabLogin");
  const tReg = document.getElementById("authTabRegister");
  const isReg = which === "register";
  login?.classList.toggle("isHidden", isReg);
  reg?.classList.toggle("isHidden", !isReg);
  tLogin?.classList.toggle("active", !isReg);
  tReg?.classList.toggle("active", isReg);
  setMsg("");
}

async function entrarComGoogle() {
  try {
    setMsg("Abrindo login com Google...");
    sessionStorage.removeItem("sjm_force_logout");
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred?.user;
    if (user) {
      window.__SJM_PENDING_SIGNUP = window.__SJM_PENDING_SIGNUP || {
        studioNome: user.displayName ? `Studio ${user.displayName}` : "Meu Studio",
        profissionalNome: user.displayName || "",
        studioWpp: "",
        plano: "basic"
      };
    }
    setMsg("");
  } catch (err) {
    const code = String(err?.code || "");
    console.warn("Login Google por popup falhou:", err);
    if (code.includes("popup-blocked") || code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request") || code.includes("operation-not-supported-in-this-environment")) {
      try {
        setMsg("Redirecionando para login com Google...");
        await signInWithRedirect(auth, googleProvider);
        return;
      } catch (redirectErr) {
        console.error("Login Google por redirecionamento falhou:", redirectErr);
      }
    }
    if (code.includes("unauthorized-domain")) setMsg("Domínio não autorizado no Firebase Authentication.");
    else setMsg("Não foi possível entrar com Google. Tente novamente.");
  }
}

function bindAuthUI() {
  document.getElementById("authTabLogin")?.addEventListener("click", () => showAuthTab("login"));
  document.getElementById("authTabRegister")?.addEventListener("click", () => showAuthTab("register"));
  document.getElementById("btnGoogleLogin")?.addEventListener("click", entrarComGoogle);

  document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail")?.value?.trim();
    const pass = document.getElementById("loginPass")?.value || "";
    if (!email || !pass) return setMsg("Preencha email e senha.");
    try {
      setMsg("Entrando...");
      sessionStorage.removeItem("sjm_force_logout");
      await signInWithEmailAndPassword(auth, email, pass);
      setMsg("");
    } catch (err) {
      console.error("Login falhou:", err);
      setMsg("Login inválido. Confira email e senha. Se o erro continuar, recadastre a senha no Firebase.");
    }
  });

  document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studio = document.getElementById("regStudio")?.value?.trim();
    const name = document.getElementById("regName")?.value?.trim();
    const wpp = document.getElementById("regWpp")?.value?.trim();
    const email = document.getElementById("regEmail")?.value?.trim();
    const pass = document.getElementById("regPass")?.value || "";
    const pass2 = document.getElementById("regPass2")?.value || "";
    if (!studio || !name || !email || !pass) return setMsg("Preencha os campos obrigatórios.");
    if (pass.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    if (pass !== pass2) return setMsg("As senhas não conferem.");
    try {
      setMsg("Criando conta...");
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      try { await updateProfile(cred.user, { displayName: name }); } catch {}
      window.__SJM_PENDING_SIGNUP = { studioNome: studio, profissionalNome: name, studioWpp: wpp, plano: "basic" };
      setMsg("Conta criada. Entrando...");
    } catch (err) {
      console.error("Cadastro falhou:", err);
      const code = String(err?.code || "");
      if (code.includes("email-already-in-use")) setMsg("Este email já está cadastrado. Use Entrar ou Recuperar senha.");
      else if (code.includes("invalid-email")) setMsg("Email inválido.");
      else setMsg("Não foi possível criar a conta. Verifique os dados.");
    }
  });

  document.getElementById("btnForgotPass")?.addEventListener("click", async () => {
    const email = (document.getElementById("loginEmail")?.value || prompt("Digite seu email para recuperar a senha:") || "").trim();
    if (!email) return setMsg("Digite seu email para recuperar a senha.");
    try {
      const actionCodeSettings = {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: false
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setMsg("Email de recuperação enviado. Confira a caixa de entrada, spam e lixo eletrônico.");
    } catch (err) {
      console.error("Recuperação falhou:", err);
      const code = String(err?.code || "");
      if (code.includes("invalid-email")) setMsg("Email inválido. Confira o endereço digitado.");
      else if (code.includes("user-not-found")) setMsg("Não encontrei conta com este email.");
      else if (code.includes("too-many-requests")) setMsg("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      else setMsg("Não foi possível enviar recuperação. Confira se o email está cadastrado e tente novamente.");
    }
  });
}


try {
  const redirectCred = await getRedirectResult(auth);
  const user = redirectCred?.user;
  if (user) {
    window.__SJM_PENDING_SIGNUP = window.__SJM_PENDING_SIGNUP || {
      studioNome: user.displayName ? `Studio ${user.displayName}` : "Meu Studio",
      profissionalNome: user.displayName || "",
      studioWpp: "",
      plano: "basic"
    };
    setMsg("");
  }
} catch (err) {
  console.warn("Resultado do login Google falhou:", err);
  setMsg("Não foi possível concluir o login com Google.");
}

bindAuthUI();


function notifyAppUser(userInfo, attempt = 0) {
  if (typeof window.__SJM_ON_AUTH_USER === "function") {
    try {
      window.__SJM_ON_AUTH_USER(userInfo);
      if (window.__SJM_PENDING_REMOTE_FROM_CLOUD && typeof window.__SJM_SET_STATE_FROM_CLOUD === "function") {
        const pending = window.__SJM_PENDING_REMOTE_FROM_CLOUD;
        window.__SJM_PENDING_REMOTE_FROM_CLOUD = null;
        window.__SJM_SET_STATE_FROM_CLOUD(pending);
      }
    } catch(e) {
      console.warn("auth user load:", e);
    }
    return;
  }
  if (attempt < 40) setTimeout(() => notifyAppUser(userInfo, attempt + 1), 100);
}

async function enforceAllowedEmail(user) {
  if (ALLOWED_EMAILS.size === 0) return true;
  const email = (user?.email || "").toLowerCase().trim();
  if (!ALLOWED_EMAILS.has(email)) {
    alert("Acesso negado: este e-mail não está autorizado neste sistema.");
    try { await signOut(auth); } catch {}
    return false;
  }
  return true;
}

async function push(state, user = auth.currentUser) {
  if (applyingRemote) return;
  if (!ready) return;
  if (!state || typeof state !== "object") return;
  if (!user) return;

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

  await setDoc(globalDoc(user), payload, { merge: true });
}

function subscribe(user) {
  try { unsubscribeSnapshot?.(); } catch {}
  unsubscribeSnapshot = onSnapshot(globalDoc(user), (snap) => {
    ready = true;
    if (!snap.exists()) {
      const local = window.__SJM_GET_STATE?.();
      if (local) push(local, user);
      return;
    }

    const data = snap.data() || {};
    const remote = data?.state;
    if (!remote) return;

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
      if (typeof window.__SJM_SET_STATE_FROM_CLOUD === "function") {
        window.__SJM_SET_STATE_FROM_CLOUD(remote);
      } else {
        window.__SJM_PENDING_REMOTE_FROM_CLOUD = remote;
      }
    }
    finally { applyingRemote = false; }
  });
}


window.__SJM_FIREBASE_AUTH_READY = () => !!auth.currentUser;
window.__SJM_PUBLISH_PUBLIC_AUTOAGENDAMENTO = async (publicData) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Studio não autenticado para publicar autoagendamento.");
  const payload = Object.assign({}, publicData || {}, {
    ownerUid: user.uid,
    updatedAt: Date.now(),
    version: "v83-autoagendamento-completo"
  });
  await setDoc(studioPublicDoc(user.uid), payload, { merge: true });
  return payload;
};
window.__SJM_LOAD_PUBLIC_AUTOAGENDAMENTO = async (ownerUid) => {
  const uid = String(ownerUid || "").trim();
  if (!uid) return null;
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch(e) { console.warn("login público anônimo falhou:", e); }
  }
  const snap = await getDoc(studioPublicDoc(uid));
  return snap.exists() ? (snap.data() || null) : null;
};
window.__SJM_CREATE_PUBLIC_BOOKING_REQUEST = async (ownerUid, request) => {
  const uid = String(ownerUid || "").trim();
  if (!uid) throw new Error("Link sem identificação do studio.");
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch(e) { console.warn("login público anônimo falhou:", e); }
  }
  const id = String(request?.id || ("req_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8)));
  const payload = Object.assign({}, request || {}, {
    id,
    statusPedido: "novo",
    createdAt: Date.now(),
    source: "autoagendamento-publico"
  });
  await setDoc(bookingRequestDoc(uid, id), payload, { merge: true });
  return payload;
};
window.__SJM_MARK_PUBLIC_BOOKING_REQUEST = async (requestId, data) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !requestId) return;
  await setDoc(bookingRequestDoc(user.uid, requestId), Object.assign({}, data || {}, { processedAt: Date.now() }), { merge: true });
};

let unsubscribeBookingRequests = null;
function subscribeBookingRequests(user){
  try { unsubscribeBookingRequests?.(); } catch(e) {}
  if(!user || user.isAnonymous) return;
  try{
    unsubscribeBookingRequests = onSnapshot(collection(db, "studio", user.uid, "bookingRequests"), (snap)=>{
      snap.docChanges().forEach((ch)=>{
        if(ch.type !== "added" && ch.type !== "modified") return;
        const data = ch.doc.data() || {};
        if(data.statusPedido && data.statusPedido !== "novo") return;
        if(typeof window.__SJM_HANDLE_PUBLIC_BOOKING_REQUEST === "function"){
          try { window.__SJM_HANDLE_PUBLIC_BOOKING_REQUEST(Object.assign({id: ch.doc.id}, data)); } catch(e){ console.warn("pedido autoagendamento:", e); }
        }
      });
    });
  }catch(e){ console.warn("listener autoagendamento:", e); }
}

onAuthStateChanged(auth, async (user) => {
  if (sessionStorage.getItem("sjm_force_logout") === "1") {
    try { if (user) await signOut(auth); } catch(e) {}
    document.body?.classList.add("auth-locked");
    window.__SJM_CURRENT_USER = null;
    window.__SJM_DEV_UNLOCKED = false;
    window.__SJM_IS_DEVELOPER = false;
    return;
  }
  if (!user) {
    window.__SJM_CURRENT_USER = null;
    window.__SJM_DEV_UNLOCKED = false;
    if (isPublicBookingRoute()) {
      try { await signInAnonymously(auth); } catch(e) { console.warn("auth público anônimo falhou:", e); }
      return;
    }
    document.body?.classList.add("auth-locked");
    return;
  }

  if (user.isAnonymous && isPublicBookingRoute()) {
    window.__SJM_CURRENT_USER = { uid: user.uid, email: "", name: "Visitante", role: "public" };
    window.__SJM_DEV_UNLOCKED = false;
    window.__SJM_IS_DEVELOPER = false;
    document.body?.classList.remove("auth-locked");
    return;
  }

  const ok = await enforceAllowedEmail(user);
  if (!ok) { document.body?.classList.add("auth-locked"); return; }

  const isDevUser = false;
  window.__SJM_CURRENT_USER = { uid: user.uid, email: user.email || "", name: user.displayName || "", role: isDevUser ? "developer" : "user" };
  window.__SJM_DEV_UNLOCKED = isDevUser;
  window.__SJM_IS_DEVELOPER = isDevUser;
  notifyAppUser(window.__SJM_CURRENT_USER);
  document.body?.classList.remove("auth-locked");
  if (isDevUser) setTimeout(() => { try { window.__SJM_SET_ROUTE?.("desenvolvedor"); } catch {} }, 500);

  subscribe(user);
  subscribeBookingRequests(user);

  window.__SJM_PUSH_TO_CLOUD = async (state) => push(state, user);
  window.__SJM_SIGN_OUT = async () => signOut(auth);

  setTimeout(() => {
    try {
      const local = window.__SJM_GET_STATE?.();
      const pending = window.__SJM_PENDING_SIGNUP;
      if (local && pending) {
        local.settings = local.settings || {};
        local.settings.studioNome = pending.studioNome || local.settings.studioNome;
        local.settings.studioWpp = pending.studioWpp || local.settings.studioWpp;
        local.settings.plano = pending.plano || "basic";
        window.__SJM_SET_STATE_FROM_CLOUD?.(local);
        window.__SJM_PENDING_SIGNUP = null;
      }
      if (local) push(local, user);
    } catch (e) { console.warn("push inicial:", e); }
  }, 900);
});
