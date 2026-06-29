import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
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
  return doc(db, "studios", user.uid, "state", "globalState");
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

function bindAuthUI() {
  document.getElementById("authTabLogin")?.addEventListener("click", () => showAuthTab("login"));
  document.getElementById("authTabRegister")?.addEventListener("click", () => showAuthTab("register"));

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
      setMsg("Login inválido. Confira email e senha.");
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
    document.body?.classList.add("auth-locked");
    window.__SJM_CURRENT_USER = null;
    window.__SJM_DEV_UNLOCKED = false;
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
