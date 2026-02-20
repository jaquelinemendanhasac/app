/* Studio Jaqueline Mendanha — Gestão Completa (SYNC PRO / FIXED v17)
  - Blindado contra tela branca (elementos ausentes não quebram)
  - Sincronização total (derived + UI)
  - Regra do estúdio: Realizado => Recebido = preço do procedimento (sempre)
  - Agenda cria/remove Atendimentos automaticamente
  - Status "Bloqueio" (Folga/Compromisso) não cria atendimento e não tem valor
  - Clientes: N° do molde (substitui Saúde/Medicamentos)
  - ✅ FIX: não perder foco ao digitar (anti-eco do Firebase + remoto pendente)
*/

const APP_BUILD = "v18";

// ✅ Dashboard: escolha como calcular despesas no "Lucro Líquido" do mês
// "ALL"  => despesas de TODOS os meses
// "MONTH"=> despesas SOMENTE do mês atual (versão alternativa)
const DASH_LUCRO_DESPESAS_SCOPE = "ALL";


// =======================================================
// ✅ SJM: DIGITAÇÃO SEM PERDER FOCO (evita re-render no input)
// =======================================================
window.__SJM_IS_EDITING = window.__SJM_IS_EDITING || false;

function isTextField(el){
  return el && (el.tagName==="INPUT" || el.tagName==="TEXTAREA" || el.tagName==="SELECT");
}

// guarda foco/caret antes de render pesado
function captureFocus(){
  const a = document.activeElement;
  if(!isTextField(a)) return null;

  return {
    id: a.id || null,
    name: a.name || null,
    datasetKey: a.dataset?.k || null,
    selStart: (typeof a.selectionStart === "number") ? a.selectionStart : null,
    selEnd: (typeof a.selectionEnd === "number") ? a.selectionEnd : null,
  };
}

// restaura foco/caret depois do render
function restoreFocus(s){
  if(!s) return;

  let el = null;
  if(s.id) el = document.getElementById(s.id);
  if(!el && s.name) el = document.querySelector(`[name="${CSS.escape(s.name)}"]`);
  if(!el && s.datasetKey) el = document.querySelector(`[data-k="${CSS.escape(s.datasetKey)}"]`);

  if(el && isTextField(el)){
    el.focus({ preventScroll:true });
    if(typeof el.setSelectionRange === "function" && s.selStart != null && s.selEnd != null){
      try { el.setSelectionRange(s.selStart, s.selEnd); } catch {}
    }
  }
}

// use ISSO quando precisar renderizar muito (tabelas)
function safeRender(fn){
  const snap = captureFocus();
  try { fn(); } finally { restoreFocus(snap); }
}

// debounce de commit (pra não salvar a cada tecla)
function debounce(fn, ms=250){
  let t = null;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
}

// =======================================================
// ✅ MODO DIGITANDO (evita sync mexer no input ativo)
// =======================================================
document.addEventListener("focusin", (e)=>{
  if(isTextField(e.target)) window.__SJM_IS_EDITING = true;
}, true);

const ROUTES = [
  { id:"dashboard", label:"Dashboard" },
  { id:"calendario", label:"Calendário" },
  { id:"agenda", label:"Agenda" },
  { id:"whatsapp", label:"WhatsApp" },
  { id:"atendimentos", label:"Atendimentos" },
  { id:"procedimentos", label:"Procedimentos" },
  { id:"clientes", label:"Clientes" },
  { id:"materiais", label:"Materiais" },
  { id:"despesas", label:"Despesas" },
  { id:"config", label:"Config" },
];

const KEY = "sjm_sync_pro_v1";

/* =================== HELPERS SAFE =================== */
const $ = (sel)=> document.querySelector(sel);
const $$ = (sel)=> Array.from(document.querySelectorAll(sel));
const byId = (id)=> document.getElementById(id);

function safeText(id, text){
  const el = byId(id);
  if(el) el.textContent = text;
}
function safeValue(id, value){
  const el = byId(id);
  if(el) el.value = value;
}
function onClick(id, fn){
  const el = byId(id);
  if(el) el.onclick = fn;
}
function onChange(id, fn){
  const el = byId(id);
  if(el) el.addEventListener("change", fn);
}
function onInput(id, fn){
  const el = byId(id);
  if(el) el.addEventListener("input", fn);
}

const money = (n)=> (Number(n||0)).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

/* ✅ num() mais resistente (aceita 0,01 / 0.01 / 00001) */
const num = (v)=> {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  // remove espaços
  let clean = s.replace(/\s+/g,"");

  // se tiver vírgula, trata pt-BR: 1.234,56 -> 1234.56
  if (clean.includes(",")) clean = clean.replace(/\./g,"").replace(",", ".");

  const x = Number(clean);
  return Number.isFinite(x) ? x : 0;
};

const uid = ()=> Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(2,6);
const todayISO = ()=> {
  // ✅ FIX: usa data LOCAL (evita virar 1 dia antes por fuso)
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
};

function fmtBRDate(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function addDaysISO(iso, days){
  const d = new Date(iso+"T00:00:00");
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

// =======================================================
// ✅ SJM: ID do dispositivo + versão (evita "eco" do Firebase derrubar foco)
// (NÃO usa uid() aqui pra não depender da ordem)
// =======================================================
function makeClientId(){
  return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(2,8);
}
const CLIENT_ID_KEY = KEY + "_client_id";
const CLIENT_ID = localStorage.getItem(CLIENT_ID_KEY) || makeClientId();
localStorage.setItem(CLIENT_ID_KEY, CLIENT_ID);

// guarda remoto pendente enquanto está digitando
window.__SJM_PENDING_REMOTE = window.__SJM_PENDING_REMOTE || null;

function ensureMeta(s){
  s.meta = s.meta && typeof s.meta === "object" ? s.meta : {};
  if(!s.meta.clientId) s.meta.clientId = CLIENT_ID;
  if(typeof s.meta.rev !== "number") s.meta.rev = 0;
  if(typeof s.meta.updatedAt !== "number") s.meta.updatedAt = Date.now();
  return s;
}

function bumpRev(){
  ensureMeta(state);
  state.meta.clientId = CLIENT_ID;
  state.meta.rev = (typeof state.meta.rev === "number" ? state.meta.rev : 0) + 1;
  state.meta.updatedAt = Date.now();
}

/* =================== STATE =================== */
function defaultState(){
  return {
    meta: { clientId: CLIENT_ID, rev: 0, updatedAt: Date.now() },

    settings: {
      studioNome: "Studio Jaqueline Mendanha",
      logoUrl: "",
      corPrimaria: "#7B2CBF",
      corAcento: "#F72585",
      studioWpp: ""
    },
    wpp: {
      horaLembrete: "09:00",
      horaRelatorio: "20:00",
      tplConfirmacao:
`Olá {cliente}! Seu horário foi agendado no {studio} ✅
📅 {data} às {hora}
💅 {procedimento} — {valor}
Responda *SIM* para confirmar, por favor. 💜`,
      tplLembrete:
`Oi {cliente}! Passando para lembrar seu horário amanhã no {studio} 💜
📅 {data} às {hora}
💅 {procedimento}
Se precisar remarcar, me avise por aqui.`,
      tplAgradecimento:
`Obrigada, {cliente}! 💜
Foi um prazer te atender no {studio}.
Se puder, me mande um feedback e uma foto das unhas 😍`,
      tplRelatorio:
`📌 Relatório do dia {data} — {studio}

{lista}

Total recebido: {total}`
    },
    procedimentos: [
      { id: uid(), nome:"Alongamento", preco:130, reajuste:"", duracaoMin: 120 },
      { id: uid(), nome:"Manutenção", preco:90, reajuste:"", duracaoMin: 120 },
      { id: uid(), nome:"Remoção + Nova Aplicação", preco:160, reajuste:"", duracaoMin: 150 },
      { id: uid(), nome:"Remoção de Alongamento", preco:60, reajuste:"", duracaoMin: 60 },
    ],

    clientes: [],
    agenda: [],
    materiais: [],
    atendimentos: [],
    despesas: [],
    wppQueue: []
  };
}

function sanitizeState(parsed){
  const base = defaultState();
  const s = { ...base, ...(parsed && typeof parsed === "object" ? parsed : {}) };

  // ✅ garante meta
  s.meta = (s.meta && typeof s.meta === "object") ? s.meta : {};
  if(!s.meta.clientId) s.meta.clientId = CLIENT_ID;
  if(typeof s.meta.rev !== "number") s.meta.rev = 0;
  if(typeof s.meta.updatedAt !== "number") s.meta.updatedAt = Date.now();

  s.settings = { ...base.settings, ...(s.settings && typeof s.settings==="object" ? s.settings : {}) };
  s.wpp = { ...base.wpp, ...(s.wpp && typeof s.wpp==="object" ? s.wpp : {}) };

  const arr = (v)=> Array.isArray(v) ? v : [];
  s.procedimentos = arr(s.procedimentos);
  s.clientes = arr(s.clientes);
  s.agenda = arr(s.agenda);
  s.materiais = arr(s.materiais);
  s.atendimentos = arr(s.atendimentos);
  s.despesas = arr(s.despesas);
  s.wppQueue = arr(s.wppQueue);

  // migração: agenda
  s.agenda.forEach(a=>{
    if(a && typeof a==="object"){
      if(a.id === undefined) a.id = uid();
      if(a.recebido === undefined) a.recebido = 0;
      if(a.atendId === undefined) a.atendId = "";
      if(a.status === undefined) a.status = "Agendado";
      if(a.obs === undefined) a.obs = "";
      if(a.hora === undefined) a.hora = "08:00";
      if(a.data === undefined) a.data = todayISO();
      if(a.cliente === undefined) a.cliente = "";
      if(a.procedimento === undefined) a.procedimento = (s.procedimentos?.[0]?.nome || "Alongamento");
    }
  });

  // migração: clientes (remove saude/meds e usa molde)
  s.clientes.forEach(c=>{
    if(c && typeof c==="object"){
      if(c.id === undefined) c.id = uid();
      if(c.nome === undefined) c.nome = "";
      if(c.wpp === undefined) c.wpp = "";
      if(c.tel === undefined) c.tel = "";
      if(c.nasc === undefined) c.nasc = "";
      if(c.alergia === undefined) c.alergia = "N";
      if(c.quais === undefined) c.quais = "";
      if(c.gestante === undefined) c.gestante = "N";
      // ✅ novo campo
      if(c.molde === undefined){
        const oldSaude = (c.saude !== undefined) ? String(c.saude||"").trim() : "";
        const oldMeds  = (c.meds !== undefined) ? String(c.meds||"").trim() : "";
        const join = [oldSaude, oldMeds].filter(Boolean).join(" / ");
        c.molde = join || "";
      }
      if(c.obs === undefined) c.obs = "";

      // limpa campos antigos
      if(c.saude !== undefined) delete c.saude;
      if(c.meds !== undefined) delete c.meds;
    }
  });

  // migração: atendimentos
  s.atendimentos.forEach(a=>{
    if(a && typeof a==="object"){
      if(a.id === undefined) a.id = uid();
      if(a.data === undefined) a.data = todayISO();
      if(a.cliente === undefined) a.cliente = "";
      if(a.procedimento === undefined) a.procedimento = (s.procedimentos?.[0]?.nome || "Alongamento");
      if(a.recebido === undefined) a.recebido = 0;
      if(a.maoObra === undefined) a.maoObra = 0;
      if(a.foto === undefined) a.foto = "";
      if(a.fromAgendaId === undefined) a.fromAgendaId = "";
      if(a.auto === undefined) a.auto = !!a.fromAgendaId;
    }
  });

  // migração: materiais
  s.materiais.forEach(m=>{
    if(m && typeof m==="object"){
      if(m.id === undefined) m.id = uid();
      if(m.qtdTotal === undefined) m.qtdTotal = 0;
      if(m.valorCompra === undefined) m.valorCompra = 0;
      if(m.qtdCliente === undefined) m.qtdCliente = 0;
      if(m.unidade === undefined) m.unidade = "ml";
      if(m.custoUnit === undefined) m.custoUnit = 0;
      if(m.custoCliente === undefined) m.custoCliente = 0;
      if(m.rendimento === undefined) m.rendimento = 0;
    }
  });

  // migração: despesas
  s.despesas.forEach(d=>{
    if(d && typeof d==="object"){
      if(d.id === undefined) d.id = uid();
      if(d.data === undefined) d.data = todayISO();
      if(d.tipo === undefined) d.tipo = "Fixa";
      if(d.valor === undefined) d.valor = 0;
      if(d.desc === undefined) d.desc = "";
    }
  });

  return s;
}

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaultState();
    return sanitizeState(JSON.parse(raw));
  }catch{
    return defaultState();
  }
}

let state = load();
ensureMeta(state);

window.__SJM_GET_STATE = () => state;
window.__SJM_CLOUD_READY = window.__SJM_CLOUD_READY || false;

/* ✅ status de sync no rodapé */
window.__SJM_SET_SYNC_STATUS = (msg)=>{
  const el = byId("syncInfo");
  if(el) el.textContent = msg;
};
window.__SJM_SET_SYNC_STATUS("Sync: aguardando…");

/* =================== CLOUD SYNC (Firebase Bridge) =================== */
let cloudTimer = null;
function scheduleCloudPush(){
  if(typeof window.__SJM_PUSH_TO_CLOUD !== "function") return;

  if(cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async ()=>{
    cloudTimer = null;
    try{
      ensureMeta(state);
      await window.__SJM_PUSH_TO_CLOUD(state);
    }catch(e){
      console.error("Cloud push falhou:", e);
      window.__SJM_SET_SYNC_STATUS("Sync: erro ao enviar ❌");
    }
  }, 350);
}

let __SJM_IS_SYNCING = false;

function saveSoft(){
  // ✅ alterações locais incrementam rev (evita eco do Firebase)
  if(!__SJM_IS_SYNCING){
    bumpRev();
  }

  try{
    localStorage.setItem(KEY, JSON.stringify(state));
  }catch(e){
    console.warn("localStorage cheio?", e);
  }

  // ✅ evita spam de cloud durante sync automático (syncDerivedAndUI / apply remoto)
  if(!__SJM_IS_SYNCING){
    scheduleCloudPush();
  }
}

// ✅ aplica remoto de forma segura (anti-eco + sem derrubar foco)
window.__SJM_APPLY_REMOTE_STATE = (remoteState) => {
  const incoming = sanitizeState(remoteState);
  ensureMeta(incoming);
  ensureMeta(state);

  // ignora eco do mesmo device quando não é mais novo
  if(incoming.meta.clientId === CLIENT_ID && incoming.meta.rev <= state.meta.rev){
    window.__SJM_SET_SYNC_STATUS("Sync: ok ✅");
    return;
  }

  state = incoming;

  enforceAgendaRecebidoRules();
  syncAgendaToAtendimentos();
  state.materiais.forEach(calcularMaterial);
  state.atendimentos.forEach(calcularAtendimento);

  __SJM_IS_SYNCING = true;
  try{
    localStorage.setItem(KEY, JSON.stringify(state));
  }catch(e){
    console.warn("localStorage cheio?", e);
  }
  __SJM_IS_SYNCING = false;

  applyTheme();
  renderAllHard();

  window.__SJM_SET_SYNC_STATUS("Sync: atualizado ✅");
};

window.__SJM_SET_STATE_FROM_CLOUD = (remoteState) => {
  // se está digitando, segura o remoto pra não recriar a tabela e perder foco
  if(window.__SJM_IS_EDITING){
    window.__SJM_PENDING_REMOTE = remoteState;
    window.__SJM_SET_SYNC_STATUS("Sync: recebido (aguardando terminar) ⏳");
    return;
  }
  window.__SJM_APPLY_REMOTE_STATE(remoteState);
};

document.addEventListener("focusout", (e)=>{
  if(isTextField(e.target)){
    window.__SJM_IS_EDITING = false;

    // ✅ se chegou atualização remota enquanto digitava, aplica agora
    if(window.__SJM_PENDING_REMOTE){
      const remote = window.__SJM_PENDING_REMOTE;
      window.__SJM_PENDING_REMOTE = null;
      window.__SJM_APPLY_REMOTE_STATE(remote);
      return;
    }

    scheduleSync();
  }
}, true);

/* =================== CONFIRM DELETE =================== */
function confirmDel(label="este item"){
  return confirm(`Tem certeza que deseja excluir ${label}?`);
}

/* =================== THEME / HEADER =================== */
function applyTheme(){
  const r = document.documentElement;
  r.style.setProperty("--p", state.settings.corPrimaria || "#7B2CBF");
  r.style.setProperty("--a", state.settings.corAcento || "#F72585");

  safeText("studioTitle", state.settings.studioNome || "Studio Jaqueline Mendanha");
  safeText("buildInfo", `${APP_BUILD} • Dados salvos no seu aparelho (localStorage).`);

  const url = (state.settings.logoUrl||"").trim();

  const img = byId("logoImg");
  if(img){
    if(url){
      img.src = url;
      img.classList.remove("isHidden");
    }else{
      img.removeAttribute("src");
      img.classList.add("isHidden");
    }
  }

  const dash = byId("dashLogo");
  if(dash){
    if(url){
      dash.src = url;
      dash.classList.remove("isHidden");
    }else{
      dash.removeAttribute("src");
      dash.classList.add("isHidden");
    }
  }
}
applyTheme();

/* =================== ROUTING =================== */
(function initRouting(){
  const tabs = byId("tabs");
  if(!tabs) return;

  tabs.innerHTML = ROUTES.map(r => `<button class="tab" data-tab="${r.id}">${r.label}</button>`).join("");

  tabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".tab");
    if(!btn) return;
    setRoute(btn.dataset.tab);
  });

  function setRoute(route){
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab===route));
    $$(".panel").forEach(p => p.classList.toggle("active", p.dataset.route===route));
    history.replaceState({}, "", `#${route}`);
  }

  window.__SJM_SET_ROUTE = setRoute;
  setRoute(location.hash.replace("#","") || "dashboard");
})();

function setRoute(route){
  if(typeof window.__SJM_SET_ROUTE === "function") window.__SJM_SET_ROUTE(route);
}

/* =================== BACKUP =================== */
onClick("btnExport", ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `studio-jaqueline-mendanha-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

onChange("fileImport", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const parsed = JSON.parse(await file.text());
    state = sanitizeState(parsed);

    enforceAgendaRecebidoRules();
    syncAgendaToAtendimentos();
    state.materiais.forEach(calcularMaterial);
    state.atendimentos.forEach(calcularAtendimento);

    saveSoft();
    applyTheme();
    renderAllHard();
    scheduleSync();
    alert("Backup importado ✅");
  }catch{
    alert("Arquivo inválido.");
  }finally{
    e.target.value = "";
  }
});

/* =================== DOM HELPERS (tables) =================== */
function inputHTML({value="", type="text", cls="", readonly=false, options=null, step=null, inputmode=null}){
  const stepAttr = step ? ` step="${step}"` : "";
  const imAttr = inputmode ? ` inputmode="${inputmode}"` : "";
  if(options){
    const opts = options.map(o => `<option ${o===value?"selected":""}>${o}</option>`).join("");
    return `<select class="mini ${cls}" ${readonly?"disabled":""}>${opts}</select>`;
  }
  return `<input class="mini ${cls} ${readonly?"read":""}" type="${type}" value="${value ?? ""}" ${readonly?"readonly":""}${stepAttr}${imAttr} />`;
}
function getCell(tr, idx){ return tr.querySelectorAll("td")[idx]; }
function getInp(td){ return td ? td.querySelector("input,select") : null; }

/* =================== DEBOUNCE SYNC =================== */
let syncTimer = null;
function scheduleSync(){
  if(syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(()=>{
    syncTimer = null;

    if(window.__SJM_IS_EDITING){
      scheduleSync();
      return;
    }

    syncDerivedAndUI();
  }, 220);
}

/* =================== CORE LOOKUPS =================== */
function procPrice(nome){
  const p = state.procedimentos.find(x => x.nome === nome);
  return p ? num(p.preco) : 0;
}
function findClientByName(name){
  const n = (name||"").trim().toLowerCase();
  return state.clientes.find(c => (c.nome||"").trim().toLowerCase() === n) || null;
}
function clientWpp(name){
  const c = findClientByName(name);
  return c?.wpp || c?.tel || "";
}

/* =================== DURAÇÃO PROCEDIMENTO =================== */
function procDuracao(nome){
  const p = state.procedimentos.find(x => x.nome === nome);
  return p?.duracaoMin || 60;
}

/* =================== CONFLITO POR DURAÇÃO =================== */
function isConflictByDuration(index){
  const a = state.agenda[index];
  if(!a?.data || !a?.hora) return false;
  if((a.status||"Agendado")==="Cancelado") return false;
  if((a.status||"Agendado")==="Bloqueio") return false;

  const inicioA = new Date(`${a.data}T${a.hora}`);
  const fimA = new Date(inicioA.getTime() + procDuracao(a.procedimento) * 60000);

  return state.agenda.some((b, i) => {
    if(i === index) return false;
    if((b.status||"Agendado") === "Cancelado") return false;
    if((b.status||"Agendado") === "Bloqueio") return false;
    if(b.data !== a.data) return false;
    if(!b.hora) return false;

    const inicioB = new Date(`${b.data}T${b.hora}`);
    const fimB = new Date(inicioB.getTime() + procDuracao(b.procedimento) * 60000);

    return inicioA < fimB && fimA > inicioB;
  });
}

function updateConflictUI(){}

/* =================== REGRA DO ESTÚDIO =================== */
function enforceAgendaRecebidoRules(){
  state.agenda.forEach(ag=>{
    const status = (ag.status || "Agendado");

    if(status === "Bloqueio"){
      ag.procedimento = "—";
      ag.recebido = 0;
      return;
    }

    if(status === "Realizado"){
      ag.recebido = procPrice(ag.procedimento);
    }else if(status === "Cancelado" || status === "Remarcado"){
      ag.recebido = 0;
    }else{
      if(ag.recebido === undefined) ag.recebido = 0;
    }
  });
}

/* =================== WHATSAPP =================== */
function normalizePhoneBR(p){
  const d = String(p||"").replace(/\D/g,"");
  if(!d) return "";
  if(d.startsWith("55")) return d;
  return "55" + d;
}
function waLink(phoneDigits, text){
  const p = normalizePhoneBR(phoneDigits);

  // ✅ FIX: normaliza unicode (evita   em emojis no WhatsApp)
  const safeText = String(text || "").normalize("NFC");

  const msg = encodeURIComponent(safeText);
  return `https://wa.me/${p}?text=${msg}`;
}

function fillTpl(tpl, a){
  const studio = state.settings.studioNome || "Studio";
  const valor = money(procPrice(a.procedimento));
  return String(tpl||"")
    .replaceAll("{cliente}", a.cliente || "")
    .replaceAll("{data}", fmtBRDate(a.data))
    .replaceAll("{hora}", a.hora || "")
    .replaceAll("{procedimento}", a.procedimento || "")
    .replaceAll("{valor}", valor)
    .replaceAll("{studio}", studio);
}
async function copyToClipboardSafe(text){
  try{ await navigator.clipboard.writeText(text); return true; }
  catch{ return false; }
}
// ✅ compatibilidade: se algum trecho chamar fillTemplate, não quebra
function fillTemplate(tpl, a){
  return fillTpl(tpl, a);
}

/* =================== MATERIAIS =================== */
function calcularMaterial(m){
  const qtdTotal = num(m.qtdTotal);
  const valorCompra = num(m.valorCompra);
  const qtdCliente = num(m.qtdCliente);

  m.custoUnit = (qtdTotal > 0) ? (valorCompra / qtdTotal) : 0;
  m.custoCliente = m.custoUnit * qtdCliente;
  m.rendimento = (qtdCliente > 0) ? (qtdTotal / qtdCliente) : 0;
}
function custoMateriaisPorCliente(){
  return state.materiais.reduce((s,m)=>{
    calcularMaterial(m);
    return s + (num(m.custoCliente)||0);
  }, 0);
}

/* =================== ATENDIMENTOS (DERIVED) =================== */
function calcularAtendimento(a){
  a.valor = procPrice(a.procedimento);
  a.custoMaterial = custoMateriaisPorCliente();
  a.custoTotal = num(a.custoMaterial) + num(a.maoObra);
  a.lucro = num(a.recebido) - num(a.custoTotal);
}

/* =================== AGENDA -> ATENDIMENTOS =================== */
function getAtendimentoByAgendaId(agendaId){
  return state.atendimentos.find(x => x.fromAgendaId === agendaId) || null;
}
function ensureAtendimentoFromAgenda(ag){
  let at = getAtendimentoByAgendaId(ag.id);
  if(!at){
    at = {
      id: uid(),
      fromAgendaId: ag.id,
      auto: true,
      data: ag.data || todayISO(),
      cliente: ag.cliente || "",
      procedimento: ag.procedimento || "",
      valor: procPrice(ag.procedimento),
      recebido: 0,
      custoMaterial: custoMateriaisPorCliente(),
      maoObra: 0,
      custoTotal: 0,
      lucro: 0,
      foto: ""
    };
    state.atendimentos.unshift(at);
  }
  return at;
}
function removeAtendimentoFromAgenda(agendaId){
  const before = state.atendimentos.length;
  state.atendimentos = state.atendimentos.filter(x => x.fromAgendaId !== agendaId);
  return state.atendimentos.length !== before;
}
function syncAgendaToAtendimentos(){
  state.agenda.forEach(ag=>{
    const status = (ag.status || "Agendado");

    if(status === "Bloqueio"){
      ag.procedimento = "—";
      ag.recebido = 0;
      removeAtendimentoFromAgenda(ag.id);
      return;
    }

    if(status === "Realizado"){
      ag.recebido = procPrice(ag.procedimento);

      const at = ensureAtendimentoFromAgenda(ag);
      at.data = ag.data || at.data;
      at.cliente = ag.cliente || at.cliente;
      at.procedimento = ag.procedimento || at.procedimento;
      at.valor = procPrice(at.procedimento);
      at.recebido = num(ag.recebido);
    }else{
      removeAtendimentoFromAgenda(ag.id);
    }
  });
}

/* =================== DASH =================== */
function monthKey(iso){
  if(!iso) return "";
  const [y,m] = iso.split("-");
  return `${y}-${m}`;
}
function currentMonthKey(){
  return monthKey(todayISO());
}

// ✅ Resumo com opção de filtrar por mês e escolher escopo de despesas
function calcResumo(opts = {}){
  const {
    onlyMonthKey = null,          // ex: "2026-02" para filtrar atendimentos do mês
    despesasScope = "ALL"         // "ALL" ou "MONTH"
  } = opts;

  const atend = onlyMonthKey
    ? state.atendimentos.filter(a => monthKey(a.data) === onlyMonthKey)
    : state.atendimentos;

  const receita = atend.reduce((s,a)=> s + num(a.recebido), 0);
  const custos  = atend.reduce((s,a)=> s + (num(a.custoMaterial)+num(a.maoObra)), 0);

  const despesasFonte = (despesasScope === "MONTH" && onlyMonthKey)
    ? state.despesas.filter(d => monthKey(d.data) === onlyMonthKey)
    : state.despesas;

  const despesas = despesasFonte.reduce((s,d)=> s + num(d.valor), 0);

  const lucro = receita - custos - despesas;

  return { receita, custos, despesas, lucro };
}

function calcMonthlyRevenue(){
  const map = new Map();
  for(const a of state.atendimentos){
    const k = monthKey(a.data);
    if(!k) continue;
    map.set(k, (map.get(k)||0) + num(a.recebido));
  }
  const keys = Array.from(map.keys()).sort();
  return keys.map(k => ({ k, v: map.get(k) }));
}

/* ======= Charts (no libs) ======= */
function drawBars(canvas, labels, values){
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.clientWidth * devicePixelRatio;
  const H = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0,0,W,H);

  const pad = 26 * devicePixelRatio;
  const max = Math.max(...values, 1);
  const slot = (W - pad*2) / values.length;
  const barW = slot * 0.65;

  ctx.strokeStyle = "#e6e7eb";
  ctx.lineWidth = 2*devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(pad, H-pad);
  ctx.lineTo(W-pad, H-pad);
  ctx.stroke();

  values.forEach((v,i)=>{
    const x = pad + i*slot + (slot-barW)/2;
    const h = (H - pad*2) * (v/max);
    const y = (H-pad) - h;

    const g = ctx.createLinearGradient(0,y,0,H-pad);
    g.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue("--a").trim() || "#F72585");
    g.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue("--p").trim() || "#7B2CBF");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#2B2D42";
    ctx.font = `${11*devicePixelRatio}px system-ui`;
    ctx.fillText(labels[i], x, (H - pad/2));
  });
}
function drawLine(canvas, points){
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.clientWidth * devicePixelRatio;
  const H = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0,0,W,H);

  const pad = 26 * devicePixelRatio;
  const max = Math.max(...points.map(p=>p.v), 1);
  const n = Math.max(points.length, 2);

  ctx.strokeStyle = "#e6e7eb";
  ctx.lineWidth = 2*devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(pad, H-pad);
  ctx.lineTo(W-pad, H-pad);
  ctx.stroke();

  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--p").trim() || "#7B2CBF";
  ctx.lineWidth = 3*devicePixelRatio;
  ctx.beginPath();
  points.forEach((p,i)=>{
    const x = pad + (W-pad*2) * (i/(n-1));
    const y = (H-pad) - (H-pad*2) * (p.v/max);
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

/* =================== ✅ CALENDÁRIO =================== */
let __CAL_CURSOR = new Date();
let __CAL_SELECTED_ISO = todayISO();

function pad2(n){ return String(n).padStart(2,"0"); }
function isoFromDate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function dateFromISO(iso){
  const [y,m,d] = (iso||"").split("-").map(Number);
  return new Date(y, (m||1)-1, d||1);
}
function monthTitle(d){
  const m = d.toLocaleString("pt-BR",{month:"long"});
  const y = d.getFullYear();
  return `${m.charAt(0).toUpperCase()+m.slice(1)} / ${y}`;
}
function startGridDate(cursor){
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const dow = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  return start;
}
function sameISO(a,b){ return String(a||"") === String(b||""); }

function agendaOfDay(iso){
  return state.agenda
    .filter(a => a?.data === iso && (a.status||"Agendado") !== "Cancelado")
    .slice()
    .sort((x,y)=> (x.hora||"").localeCompare(y.hora||""));
}

function conflictsInDay(iso){
  const items = agendaOfDay(iso)
    .filter(x => (x.status||"Agendado") !== "Bloqueio")
    .map((a)=> {
      const inicio = new Date(`${a.data}T${a.hora||"00:00"}`);
      const fim = new Date(inicio.getTime() + procDuracao(a.procedimento)*60000);
      return { a, inicio, fim };
    });
  for(let i=0;i<items.length;i++){
    for(let j=i+1;j<items.length;j++){
      if(items[i].inicio < items[j].fim && items[i].fim > items[j].inicio){
        return true;
      }
    }
  }
  return false;
}

function dayBadges(iso){
  const itens = agendaOfDay(iso);
  const totalAg = itens.length;
  const totalRec = itens
    .filter(a => (a.status||"Agendado") === "Realizado")
    .reduce((s,a)=> s + num(a.recebido), 0);

  return { totalAg, totalRec };
}

function renderCalendar(){
  const grid = byId("calGrid");
  const title = byId("calTitle");
  if(!grid || !title) return;

  title.textContent = monthTitle(__CAL_CURSOR);

  const start = startGridDate(__CAL_CURSOR);
  const curMonth = __CAL_CURSOR.getMonth();
  const today = todayISO();

  const cells = [];
  for(let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const iso = isoFromDate(d);

    const isOther = d.getMonth() !== curMonth;
    const isToday = sameISO(iso, today);
    const isSel = sameISO(iso, __CAL_SELECTED_ISO);

    const { totalAg, totalRec } = dayBadges(iso);
    const hasConflict = conflictsInDay(iso);

    const mini = agendaOfDay(iso).slice(0,2).map(a=>{
      const label = (a.status==="Bloqueio") ? "BLOQUEIO" : ((a.cliente||"").trim() || "Sem nome");
      return `<div class="calMiniItem">${a.hora || ""} — ${label}</div>`;
    }).join("");

    const badgeAg = totalAg ? `<span class="calBadge">${totalAg}x</span>` : "";
    const badgeRec = totalRec ? `<span class="calBadge ok">${money(totalRec)}</span>` : "";
    const badgeConf = hasConflict ? `<span class="calBadge danger">Conflito</span>` : "";

    cells.push(`
      <div class="calDay ${isOther?"isOther":""} ${isToday?"isToday":""} ${isSel?"isSelected":""}" data-iso="${iso}">
        <div class="calDayTop">
          <div class="calNum">${d.getDate()}</div>
          <div class="calBadges">${badgeAg}${badgeRec}${badgeConf}</div>
        </div>
        <div class="calMiniList">${mini}</div>
      </div>
    `);
  }

  grid.innerHTML = cells.join("");

  grid.querySelectorAll(".calDay").forEach(el=>{
    el.addEventListener("click", ()=>{
      __CAL_SELECTED_ISO = el.dataset.iso;
      renderCalendar();
      renderCalendarDay();
    });
  });

  renderCalendarDay();
}

function renderCalendarDay(){
  const t = byId("calDayTitle");
  const box = byId("calDayList");
  const resumo = byId("calDayResumo");
  if(!t || !box || !resumo) return;

  const iso = __CAL_SELECTED_ISO || todayISO();
  t.textContent = `Dia ${fmtBRDate(iso)}`;

  const itens = agendaOfDay(iso);
  const totalAg = itens.length;
  const totalRec = itens.filter(a => (a.status||"Agendado")==="Realizado").reduce((s,a)=> s + num(a.recebido), 0);
  const hasConflict = conflictsInDay(iso);

  resumo.innerHTML = `
    <div class="calChip">Agendamentos: ${totalAg}</div>
    <div class="calChip">Recebido: ${money(totalRec)}</div>
    <div class="calChip ${hasConflict ? "danger": ""}">${hasConflict ? "⚠️ Conflito de horário" : "Sem conflito"}</div>
  `;

  if(!itens.length){
    box.innerHTML = `<div class="hint">Sem agendamentos neste dia.</div>`;
    return;
  }

  box.innerHTML = itens.map((a)=>{
    const st = (a.status||"Agendado");
    const rec = num(a.recebido);
    const val = (st==="Bloqueio") ? 0 : procPrice(a.procedimento);

    const idx = state.agenda.findIndex(x=>x && x.id===a.id);
    const conflita = (idx >= 0) ? isConflictByDuration(idx) : false;

    const titulo = (st==="Bloqueio")
      ? `${a.hora || ""} — BLOQUEIO`
      : `${a.hora || ""} — ${(a.cliente||"").trim() || "Sem nome"}`;

    return `
      <div class="calListItem ${conflita ? "danger" : ""}">
        <div class="calListHead">
          <b>${titulo}</b>
          <span class="calListMeta">${st}</span>
        </div>
        <div class="calListMeta">Procedimento: ${a.procedimento || "—"} • Valor: ${money(val)} • Recebido: ${money(rec)}</div>
                <div class="actions" style="margin:6px 0 0;gap:8px;">
          <button class="btn btn--ghost" data-act="realizado" data-id="${a.id}">Marcar Realizado</button>
          <button class="btn btn--ghost" data-act="agendado" data-id="${a.id}">Voltar p/ Agendado</button>
          <button class="btn btn--ghost" data-act="cancelado" data-id="${a.id}">Cancelar</button>
        </div>
        ${a.obs ? `<div class="calListMeta">Obs: ${String(a.obs)}</div>` : ``}
      </div>
    `;
  }).join("");

  // ✅ ações rápidas no Calendário (sem sair da tela)
  box.onclick = (e)=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    const ag = state.agenda.find(x=>x && x.id===id);
    if(!ag) return;

    if(act === 'realizado'){
      ag.status = 'Realizado';
      ag.recebido = procPrice(ag.procedimento);
    }else if(act === 'agendado'){
      ag.status = 'Agendado';
      ag.recebido = 0;
    }else if(act === 'cancelado'){
      ag.status = 'Cancelado';
      ag.recebido = 0;
    }

    // atualiza tudo imediatamente
    enforceAgendaRecebidoRules();
    syncAgendaToAtendimentos();
    state.atendimentos.forEach(calcularAtendimento);

    saveSoft();
    renderAgendaHard();
    renderAtendimentosHard();
    renderCalendar();
    scheduleSync();
  };
}

function bindCalendarUI(){
  onClick("calPrev", ()=>{
    __CAL_CURSOR = new Date(__CAL_CURSOR.getFullYear(), __CAL_CURSOR.getMonth()-1, 1);
    renderCalendar();
  });
  onClick("calNext", ()=>{
    __CAL_CURSOR = new Date(__CAL_CURSOR.getFullYear(), __CAL_CURSOR.getMonth()+1, 1);
    renderCalendar();
  });
  onClick("calToday", ()=>{
    __CAL_CURSOR = new Date();
    __CAL_SELECTED_ISO = todayISO();
    renderCalendar();
  });
  onClick("calNew", ()=>{
    const iso = __CAL_SELECTED_ISO || todayISO();
    const firstProc = state.procedimentos.find(p=>p.nome)?.nome || "Alongamento";
    state.agenda.unshift({
      id:uid(),
      data: iso,
      hora: "08:00",
      cliente:"",
      procedimento:firstProc,
      status:"Agendado",
      recebido: 0,
      obs:"",
      atendId:""
    });
    saveSoft();
    renderAgendaHard();
    renderCalendar();
    scheduleSync();
    setRoute("agenda");
  });
}

function updateCalendarAuto(){
  renderCalendar();
}

/* =================== SYNC ENGINE =================== */
function syncDerivedAndUI(){
  __SJM_IS_SYNCING = true;
  try{
    enforceAgendaRecebidoRules();
    syncAgendaToAtendimentos();
    state.materiais.forEach(calcularMaterial);
    state.atendimentos.forEach(calcularAtendimento);

    updateAgendaAutoCells();
    updateAtendimentosAutoCells();
    updateDashboardKPIs();

    updateCalendarAuto();

    saveSoft();
  } finally {
    __SJM_IS_SYNCING = false;
  }
}

/* =================== RENDER HARD =================== */
function renderAllHard(){
  // ✅ mantém foco/caret mesmo se renderizar muita coisa
  safeRender(()=>{
    renderProcedimentos();
    renderClientes();
    renderAgendaHard();
    renderMateriaisHard();
    renderAtendimentosHard();
    renderDespesas();
    bindWppUI();
    bindConfigUI();
    renderDashboard();
    renderWppQueue();

    bindCalendarUI();
    renderCalendar();
  });
}

/* =================== AGENDA =================== */
function getAgendaTbody(){ return $("#tblAgenda tbody"); }
function getAgendaNotice(){ return byId("agendaNotice"); }

onClick("btnAddAgenda", ()=>{
  const firstProc = state.procedimentos.find(p=>p.nome)?.nome || "Alongamento";
  state.agenda.unshift({
    id:uid(),
    data: todayISO(),
    hora: "08:00",
    cliente:"",
    procedimento:firstProc,
    status:"Agendado",
    recebido: 0,
    obs:"",
    atendId:""
  });
  saveSoft();
  renderAgendaHard();
  scheduleSync();
});

onClick("btnClearAgenda", ()=>{
  if(state.agenda.length && !confirm("Tem certeza que deseja limpar a agenda inteira?")) return;
  state.agenda.forEach(a => removeAtendimentoFromAgenda(a.id));
  state.agenda = [];
  saveSoft();
  renderAgendaHard();
  scheduleSync();
});

onClick("btnReportToday", ()=> sendReportToday());

function isConflict(i){
  const a = state.agenda[i];
  if(!a?.data || !a?.hora) return false;
  if((a.status||"Agendado")==="Bloqueio") return false;
  const key = `${a.data}|${a.hora}`;
  const active = (x)=> (x.status||"Agendado") !== "Cancelado";
  return state.agenda.some((x,idx)=> idx!==i && active(x) && active(a) && `${x.data}|${x.hora}` === key);
}

/* ✅✅✅ FIX PRINCIPAL: renderAgendaHard sem HTML inválido e sem JS dentro da string */
function renderAgendaHard(){
  const tblAgendaBody = getAgendaTbody();
  const agendaNotice = getAgendaNotice();
  if(!tblAgendaBody) return;

  if(agendaNotice){
    agendaNotice.hidden = true;
    agendaNotice.textContent = "";
  }

  const procNames = state.procedimentos.map(p=>p.nome).filter(Boolean);
  const statuses = ["Agendado","Realizado","Cancelado","Remarcado","Bloqueio"];

  enforceAgendaRecebidoRules();

  tblAgendaBody.innerHTML = state.agenda.map((a,i)=>{
    const isBlock = (a.status==="Bloqueio");
    const val = isBlock ? 0 : procPrice(a.procedimento);
    const conflict = isBlock ? false : isConflict(i);
    const conflictDur = isBlock ? false : isConflictByDuration(i);

    const wpp = clientWpp(a.cliente);
    const rec = num(a.recebido);
    const procValue = isBlock ? "—" : a.procedimento;

    return `
      <tr data-id="${a.id}" class="${(conflict || conflictDur) ? "danger" : ""}">
        <td>${inputHTML({value:a.data, type:"date"})}</td>
        <td>${inputHTML({value:a.hora, type:"time", step:"60"})}</td>
        <td>${inputHTML({value:a.cliente})}</td>
        <td>${inputHTML({value:wpp, readonly:true})}</td>
        <td>${inputHTML({value:procValue, options: isBlock ? ["—"] : (procNames.length?procNames:["Alongamento"]), readonly:isBlock})}</td>
        <td>${inputHTML({value:val.toFixed(2), type:"text", cls:"money", readonly:true})}</td>
        <td>${inputHTML({value:a.status, options: statuses})}</td>
        <td>${inputHTML({value:rec.toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal", readonly:isBlock})}</td>
        <td>${inputHTML({value:a.obs})}</td>

        <td>
          <div class="iconRow">
            <button class="iconBtn" data-conf title="Confirmação">📩</button>
            <button class="iconBtn" data-lem title="Lembrete">⏰</button>
            <button class="iconBtn" data-agr title="Agradecimento">🙏</button>
          </div>
        </td>

        <td>
          <button class="iconBtn" data-del title="Excluir">✕</button>
        </td>
      </tr>
    `;
  }).join("");

  tblAgendaBody.querySelectorAll("tr").forEach((tr)=>{
    const id = tr.dataset.id;
    const idx = state.agenda.findIndex(x => x && x.id === id);
    if(idx < 0) return;

    const a = state.agenda[idx];
    const isBlock = (a.status==="Bloqueio");

    const tdData = getCell(tr,0);
    const tdHora = getCell(tr,1);
    const tdCli  = getCell(tr,2);
    const tdWpp  = getCell(tr,3);
    const tdProc = getCell(tr,4);
    const tdVal  = getCell(tr,5);
    const tdSta  = getCell(tr,6);
    const tdRec  = getCell(tr,7);
    const tdObs  = getCell(tr,8);

    const inpWpp = getInp(tdWpp);
    const inpVal = getInp(tdVal);
    const inpRec = getInp(tdRec);

    getInp(tdData)?.addEventListener("change", ()=>{
      a.data = getInp(tdData).value;
      saveSoft(); updateConflictUI(); scheduleSync();
    });
    getInp(tdHora)?.addEventListener("change", ()=>{
      a.hora = getInp(tdHora).value;
      saveSoft(); updateConflictUI(); scheduleSync();
    });

    getInp(tdCli)?.addEventListener("input", ()=>{
      a.cliente = getInp(tdCli).value;
      if(inpWpp) inpWpp.value = clientWpp(a.cliente);
      saveSoft(); scheduleSync();
    });

    getInp(tdProc)?.addEventListener("change", ()=>{
      if(isBlock) return;
      a.procedimento = getInp(tdProc).value;
      const preco = procPrice(a.procedimento);
      if(inpVal) inpVal.value = preco.toFixed(2);

      if((a.status||"Agendado") === "Realizado"){
        a.recebido = preco;
        if(inpRec) inpRec.value = preco.toFixed(2);
      }
      saveSoft(); updateConflictUI(); scheduleSync();
    });

    getInp(tdSta)?.addEventListener("change", ()=>{
      a.status = getInp(tdSta).value;

      if(a.status === "Bloqueio"){
        a.procedimento = "—";
        a.recebido = 0;
        if(inpRec) inpRec.value = "0.00";
        if(inpVal) inpVal.value = "0.00";
      } else if(a.status === "Realizado"){
        a.recebido = procPrice(a.procedimento);
        if(inpRec) inpRec.value = num(a.recebido).toFixed(2);
      } else if(a.status === "Cancelado" || a.status === "Remarcado"){
        a.recebido = 0;
        if(inpRec) inpRec.value = "0.00";
      }

      saveSoft(); updateConflictUI(); scheduleSync();
    });

    inpRec?.addEventListener("input", ()=>{
      if((a.status||"Agendado")==="Bloqueio"){
        a.recebido = 0;
        inpRec.value = "0.00";
        saveSoft(); scheduleSync();
        return;
      }

      a.recebido = num(inpRec.value);

      if((a.status||"Agendado") === "Realizado"){
        a.recebido = procPrice(a.procedimento);
        inpRec.value = num(a.recebido).toFixed(2);
      }

      saveSoft(); scheduleSync();
    });

    getInp(tdObs)?.addEventListener("input", ()=>{
      a.obs = getInp(tdObs).value;
      saveSoft();
    });

    tr.querySelector("[data-conf]")?.addEventListener("click", ()=>{
      if((a.status||"Agendado")==="Bloqueio") return;
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      const txt = fillTpl(state.wpp.tplConfirmacao, a);
      window.open(waLink(phone, txt), "_blank");
    });

    tr.querySelector("[data-lem]")?.addEventListener("click", ()=>{
      if((a.status||"Agendado")==="Bloqueio") return;
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      const txt = fillTpl(state.wpp.tplLembrete, a);
      window.open(waLink(phone, txt), "_blank");
    });

    tr.querySelector("[data-agr]")?.addEventListener("click", ()=>{
      if((a.status||"Agendado")==="Bloqueio") return;
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      const txt = fillTpl(state.wpp.tplAgradecimento, a);
      window.open(waLink(phone, txt), "_blank");
    });

    tr.querySelector("[data-del]")?.addEventListener("click", ()=>{
      if(!confirmDel("este agendamento")) return;
      removeAtendimentoFromAgenda(a.id);
      state.agenda.splice(idx,1);
      saveSoft();
      renderAgendaHard();
      scheduleSync();
    });

    updateConflictUI();

    const conflictDurHere = isBlock ? false : isConflictByDuration(idx);
    if(agendaNotice && conflictDurHere){
      agendaNotice.hidden = false;
      agendaNotice.textContent =
        "⚠️ Conflito de horário: a duração do procedimento ultrapassa outro atendimento.";
    }
  });
}

function updateAgendaAutoCells(){
  const tblAgendaBody = getAgendaTbody();
  if(!tblAgendaBody) return;

  const rows = tblAgendaBody.querySelectorAll("tr");
  rows.forEach((tr)=>{
    const id = tr.dataset.id;
    const a = state.agenda.find(x=>x.id===id);
    if(!a) return;

    if((a.status||"Agendado") === "Bloqueio"){
      a.procedimento = "—";
      a.recebido = 0;
    } else if((a.status||"Agendado") === "Realizado"){
      a.recebido = procPrice(a.procedimento);
    } else if(a.status === "Cancelado" || a.status === "Remarcado"){
      a.recebido = 0;
    }

    const inpWpp = getInp(getCell(tr,3));
    const inpVal = getInp(getCell(tr,5));
    const inpRec = getInp(getCell(tr,7));

    const active = document.activeElement;

    if(inpWpp && active !== inpWpp) inpWpp.value = clientWpp(a.cliente);
    if(inpVal && active !== inpVal) inpVal.value = ((a.status==="Bloqueio")?0:procPrice(a.procedimento)).toFixed(2);
    if(inpRec && active !== inpRec) inpRec.value = num(a.recebido).toFixed(2);
  });
}

/* ... (resto do seu arquivo continua do jeito que você enviou) ... */
/* =================== PROCEDIMENTOS =================== */
function renderProcedimentos(){
  const body = document.querySelector('#tblProc tbody');
  if(!body) return;

  body.innerHTML = state.procedimentos.map((p)=>{
    return `
      <tr data-id="${p.id}">
        <td>${inputHTML({value:p.nome||""})}</td>
        <td>${inputHTML({value:num(p.preco).toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal"})}</td>
        <td>${inputHTML({value:p.reajuste||"", type:"date"})}</td>
        <td>${inputHTML({value:(p.duracaoMin??60), type:"number", step:"1"})}</td>
        <td><button class="iconBtn" data-del>✕</button></td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const p = state.procedimentos.find(x=>x.id===id);
    if(!p) return;

    const inpNome = getInp(getCell(tr,0));
    const inpPreco= getInp(getCell(tr,1));
    const inpReaj = getInp(getCell(tr,2));
    const inpDur  = getInp(getCell(tr,3));

    inpNome?.addEventListener('input', ()=>{ p.nome = inpNome.value; saveSoft(); scheduleSync(); });
    inpPreco?.addEventListener('input', ()=>{ p.preco = num(inpPreco.value); saveSoft(); scheduleSync(); });
    inpReaj?.addEventListener('change',()=>{ p.reajuste = inpReaj.value; saveSoft(); });
    inpDur?.addEventListener('input', ()=>{ p.duracaoMin = Math.max(1, Math.round(num(inpDur.value)||60)); saveSoft(); scheduleSync(); });

    tr.querySelector('[data-del]')?.addEventListener('click', ()=>{
      if(!confirmDel('este procedimento')) return;
      state.procedimentos = state.procedimentos.filter(x=>x.id!==id);
      if(!state.procedimentos.length){
        state.procedimentos.push({ id: uid(), nome:'Alongamento', preco:130, reajuste:'', duracaoMin:120 });
      }
      saveSoft();
      renderProcedimentos();
      renderAgendaHard();
      renderAtendimentosHard();
      renderCalendar();
      scheduleSync();
    });
  });
}

onClick('btnAddProc', ()=>{
  state.procedimentos.unshift({ id: uid(), nome:'', preco:0, reajuste:'', duracaoMin:60 });
  saveSoft();
  renderProcedimentos();
  scheduleSync();
});

onClick('btnResetProc', ()=>{
  if(!confirm('Restaurar procedimentos padrão?')) return;
  state.procedimentos = defaultState().procedimentos;
  saveSoft();
  renderProcedimentos();
  renderAgendaHard();
  renderAtendimentosHard();
  renderCalendar();
  scheduleSync();
});

/* =================== CLIENTES =================== */
function renderClientes(){
  const body = document.querySelector('#tblCli tbody');
  if(!body) return;

  body.innerHTML = state.clientes.map((c)=>{
    return `
      <tr data-id="${c.id}">
        <td>${inputHTML({value:c.nome||''})}</td>
        <td>${inputHTML({value:c.wpp||''})}</td>
        <td>${inputHTML({value:c.tel||''})}</td>
        <td>${inputHTML({value:c.nasc||'', type:'date'})}</td>
        <td>${inputHTML({value:c.alergia||'N', options:['N','S']})}</td>
        <td>${inputHTML({value:c.quais||''})}</td>
        <td>${inputHTML({value:c.gestante||'N', options:['N','S']})}</td>
        <td>${inputHTML({value:c.molde||''})}</td>
        <td>${inputHTML({value:c.obs||''})}</td>
        <td><button class="iconBtn" data-del>✕</button></td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const c = state.clientes.find(x=>x.id===id);
    if(!c) return;

    const inpNome = getInp(getCell(tr,0));
    const inpWpp  = getInp(getCell(tr,1));
    const inpTel  = getInp(getCell(tr,2));
    const inpNasc = getInp(getCell(tr,3));
    const inpAle  = getInp(getCell(tr,4));
    const inpQuais= getInp(getCell(tr,5));
    const inpGes  = getInp(getCell(tr,6));
    const inpMolde= getInp(getCell(tr,7));
    const inpObs  = getInp(getCell(tr,8));

    inpNome?.addEventListener('input', ()=>{ c.nome = inpNome.value; saveSoft(); scheduleSync(); });
    inpWpp?.addEventListener('input',  ()=>{ c.wpp  = inpWpp.value;  saveSoft(); updateAgendaAutoCells(); updateAtendimentosAutoCells(); });
    inpTel?.addEventListener('input',  ()=>{ c.tel  = inpTel.value;  saveSoft(); });
    inpNasc?.addEventListener('change',()=>{ c.nasc = inpNasc.value; saveSoft(); });
    inpAle?.addEventListener('change', ()=>{ c.alergia = inpAle.value; saveSoft(); });
    inpQuais?.addEventListener('input',()=>{ c.quais = inpQuais.value; saveSoft(); });
    inpGes?.addEventListener('change', ()=>{ c.gestante = inpGes.value; saveSoft(); });
    inpMolde?.addEventListener('input',()=>{ c.molde = inpMolde.value; saveSoft(); });
    inpObs?.addEventListener('input',  ()=>{ c.obs  = inpObs.value;  saveSoft(); });

    tr.querySelector('[data-del]')?.addEventListener('click', ()=>{
      if(!confirmDel('esta cliente')) return;
      state.clientes = state.clientes.filter(x=>x.id!==id);
      saveSoft();
      renderClientes();
      updateAgendaAutoCells();
      updateAtendimentosAutoCells();
      scheduleSync();
    });
  });
}

onClick('btnAddCliente', ()=>{
  state.clientes.unshift({ id: uid(), nome:'', wpp:'', tel:'', nasc:'', alergia:'N', quais:'', gestante:'N', molde:'', obs:'' });
  saveSoft();
  renderClientes();
  scheduleSync();
});

/* =================== MATERIAIS =================== */
function renderMateriaisHard(){
  const body = document.querySelector('#tblMat tbody');
  if(!body) return;

  state.materiais.forEach(calcularMaterial);

  const unidades = ['ml','L','g','kg','un'];

  body.innerHTML = state.materiais.map((m)=>{
    const nome = (m.nome ?? m.material ?? '');
    return `
      <tr data-id="${m.id}">
        <td>${inputHTML({value:nome})}</td>
        <td>${inputHTML({value:num(m.qtdTotal).toString(), type:'number', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:m.unidade||'ml', options:unidades})}</td>
        <td>${inputHTML({value:num(m.valorCompra).toFixed(2), type:'number', cls:'money', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:num(m.custoUnit).toFixed(4), type:'text', cls:'money', readonly:true})}</td>
        <td>${inputHTML({value:num(m.qtdCliente).toString(), type:'number', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:num(m.rendimento).toFixed(2), type:'text', readonly:true})}</td>
        <td>${inputHTML({value:num(m.custoCliente).toFixed(4), type:'text', cls:'money', readonly:true})}</td>
        <td><button class="iconBtn" data-del>✕</button></td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const m = state.materiais.find(x=>x.id===id);
    if(!m) return;

    const inpNome = getInp(getCell(tr,0));
    const inpQtdT = getInp(getCell(tr,1));
    const inpUn   = getInp(getCell(tr,2));
    const inpVal  = getInp(getCell(tr,3));
    const inpQtdC = getInp(getCell(tr,5));

    const recalc = ()=>{
      m.nome = inpNome?.value ?? (m.nome||m.material||'');
      m.qtdTotal = num(inpQtdT?.value);
      m.unidade  = inpUn?.value || m.unidade || 'ml';
      m.valorCompra = num(inpVal?.value);
      m.qtdCliente  = num(inpQtdC?.value);
      calcularMaterial(m);

      const inpCustoU = getInp(getCell(tr,4));
      const inpRend   = getInp(getCell(tr,6));
      const inpCustoC = getInp(getCell(tr,7));
      if(inpCustoU) inpCustoU.value = num(m.custoUnit).toFixed(4);
      if(inpRend)   inpRend.value   = num(m.rendimento).toFixed(2);
      if(inpCustoC) inpCustoC.value = num(m.custoCliente).toFixed(4);

      saveSoft();
      scheduleSync();
    };

    inpNome?.addEventListener('input', recalc);
    inpQtdT?.addEventListener('input', recalc);
    inpUn?.addEventListener('change',  recalc);
    inpVal?.addEventListener('input',  recalc);
    inpQtdC?.addEventListener('input', recalc);

    tr.querySelector('[data-del]')?.addEventListener('click', ()=>{
      if(!confirmDel('este material')) return;
      state.materiais = state.materiais.filter(x=>x.id!==id);
      saveSoft();
      renderMateriaisHard();
      renderAtendimentosHard();
      scheduleSync();
    });
  });
}

onClick('btnAddMat', ()=>{
  state.materiais.unshift({ id: uid(), nome:'', qtdTotal:0, unidade:'ml', valorCompra:0, qtdCliente:0, custoUnit:0, custoCliente:0, rendimento:0 });
  saveSoft();
  renderMateriaisHard();
  scheduleSync();
});

/* =================== ATENDIMENTOS =================== */
function getAtendTbody(){ return document.querySelector('#tblAtend tbody'); }

function renderAtendimentosHard(){
  const body = getAtendTbody();
  if(!body) return;

  const procNames = state.procedimentos.map(p=>p.nome).filter(Boolean);

  state.atendimentos.forEach(calcularAtendimento);

  body.innerHTML = state.atendimentos.map((a)=>{
    const wpp = clientWpp(a.cliente);
    const valor = procPrice(a.procedimento);
    return `
      <tr data-id="${a.id}">
        <td>${inputHTML({value:a.data||todayISO(), type:'date'})}</td>
        <td>${inputHTML({value:a.cliente||''})}</td>
        <td>${inputHTML({value:wpp, readonly:true})}</td>
        <td>${inputHTML({value:a.procedimento||'', options: procNames.length?procNames:['Alongamento']})}</td>
        <td>${inputHTML({value:valor.toFixed(2), type:'text', cls:'money', readonly:true})}</td>
        <td>${inputHTML({value:num(a.recebido).toFixed(2), type:'number', cls:'money', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:num(a.custoMaterial).toFixed(4), type:'text', cls:'money', readonly:true})}</td>
        <td>${inputHTML({value:num(a.maoObra).toFixed(2), type:'number', cls:'money', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:num(a.custoTotal).toFixed(2), type:'text', cls:'money', readonly:true})}</td>
        <td>${inputHTML({value:num(a.lucro).toFixed(2), type:'text', cls:'money', readonly:true})}</td>
        <td>
          <input class="mini" type="file" accept="image/*" data-foto />
          ${a.foto ? `<div class="hint">📸 ok</div>` : `<div class="hint">sem foto</div>`}
        </td>
        <td><button class="iconBtn" data-wpp>📲</button></td>
        <td><button class="iconBtn" data-del>✕</button></td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const a = state.atendimentos.find(x=>x.id===id);
    if(!a) return;

    const inpData = getInp(getCell(tr,0));
    const inpCli  = getInp(getCell(tr,1));
    const inpWpp  = getInp(getCell(tr,2));
    const inpProc = getInp(getCell(tr,3));
    const inpVal  = getInp(getCell(tr,4));
    const inpRec  = getInp(getCell(tr,5));
    const inpCmat = getInp(getCell(tr,6));
    const inpMao  = getInp(getCell(tr,7));
    const inpCtot = getInp(getCell(tr,8));
    const inpLuc  = getInp(getCell(tr,9));

    const recalc = ()=>{
      calcularAtendimento(a);
      if(inpVal)  inpVal.value  = num(a.valor).toFixed(2);
      if(inpCmat) inpCmat.value = num(a.custoMaterial).toFixed(4);
      if(inpCtot) inpCtot.value = num(a.custoTotal).toFixed(2);
      if(inpLuc)  inpLuc.value  = num(a.lucro).toFixed(2);
    };

    inpData?.addEventListener('change', ()=>{ a.data = inpData.value; saveSoft(); scheduleSync(); });

    inpCli?.addEventListener('input', ()=>{
      a.cliente = inpCli.value;
      if(inpWpp) inpWpp.value = clientWpp(a.cliente);
      saveSoft();
    });

    inpProc?.addEventListener('change', ()=>{
      a.procedimento = inpProc.value;
      recalc();
      saveSoft();
      scheduleSync();
    });

    inpRec?.addEventListener('input', ()=>{
      a.recebido = num(inpRec.value);
      recalc();
      saveSoft();
      scheduleSync();
    });

    inpMao?.addEventListener('input', ()=>{
      a.maoObra = num(inpMao.value);
      recalc();
      saveSoft();
      scheduleSync();
    });

    tr.querySelector('[data-foto]')?.addEventListener('change', async (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;
      if(file.size > 2_500_000){
        alert('Foto muito pesada. Tente uma menor (até ~2,5MB).');
        e.target.value = '';
        return;
      }
      const b64 = await new Promise((resolve,reject)=>{
        const r = new FileReader();
        r.onload = ()=>resolve(String(r.result||''));
        r.onerror= reject;
        r.readAsDataURL(file);
      });
      a.foto = b64;
      saveSoft();
      renderAtendimentosHard();
    });

    tr.querySelector('[data-wpp]')?.addEventListener('click', async ()=>{
      const phone = clientWpp(a.cliente);
      if(!phone){ alert('Cliente sem WhatsApp. Preencha em Clientes.'); setRoute('clientes'); return; }

      const msg = `Oi ${a.cliente||''}! 💜\nObrigada por vir ao ${state.settings.studioNome||'Studio'}!\n\nProcedimento: ${a.procedimento||''}\nValor: ${money(num(a.recebido))}`;
      const ok = await copyToClipboardSafe(msg);
      if(ok) alert('Mensagem copiada ✅\nCole no WhatsApp.');
      window.open(waLink(phone, msg), '_blank');
    });

    tr.querySelector('[data-del]')?.addEventListener('click', ()=>{
      if(!confirmDel('este atendimento')) return;
      state.atendimentos = state.atendimentos.filter(x=>x.id!==id);
      saveSoft();
      renderAtendimentosHard();
      scheduleSync();
    });
  });
}

function updateAtendimentosAutoCells(){
  const body = getAtendTbody();
  if(!body) return;

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const a = state.atendimentos.find(x=>x.id===id);
    if(!a) return;

    calcularAtendimento(a);

    const active = document.activeElement;
    const inpWpp  = getInp(getCell(tr,2));
    const inpVal  = getInp(getCell(tr,4));
    const inpCmat = getInp(getCell(tr,6));
    const inpCtot = getInp(getCell(tr,8));
    const inpLuc  = getInp(getCell(tr,9));

    if(inpWpp && active !== inpWpp) inpWpp.value = clientWpp(a.cliente);
    if(inpVal && active !== inpVal) inpVal.value = num(a.valor).toFixed(2);
    if(inpCmat) inpCmat.value = num(a.custoMaterial).toFixed(4);
    if(inpCtot) inpCtot.value = num(a.custoTotal).toFixed(2);
    if(inpLuc)  inpLuc.value  = num(a.lucro).toFixed(2);
  });
}

onClick('btnAddAtendimento', ()=>{
  const firstProc = state.procedimentos.find(p=>p.nome)?.nome || 'Alongamento';
  state.atendimentos.unshift({
    id: uid(), data: todayISO(), cliente:'', procedimento:firstProc,
    recebido: 0, maoObra: 0, custoMaterial: 0, custoTotal: 0, lucro: 0,
    foto:'', fromAgendaId:'', auto:false
  });
  saveSoft();
  renderAtendimentosHard();
  scheduleSync();
});

/* =================== DESPESAS =================== */
function renderDespesas(){
  const body = document.querySelector('#tblDesp tbody');
  if(!body) return;

  const tipos = ['Fixa','Variável'];

  body.innerHTML = state.despesas.map((d)=>{
    return `
      <tr data-id="${d.id}">
        <td>${inputHTML({value:d.data||todayISO(), type:'date'})}</td>
        <td>${inputHTML({value:d.tipo||'Fixa', options:tipos})}</td>
        <td>${inputHTML({value:num(d.valor).toFixed(2), type:'number', cls:'money', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:d.desc||''})}</td>
        <td><button class="iconBtn" data-del>✕</button></td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const d = state.despesas.find(x=>x.id===id);
    if(!d) return;

    const inpData = getInp(getCell(tr,0));
    const inpTipo = getInp(getCell(tr,1));
    const inpVal  = getInp(getCell(tr,2));
    const inpDesc = getInp(getCell(tr,3));

    inpData?.addEventListener('change', ()=>{ d.data = inpData.value; saveSoft(); scheduleSync(); });
    inpTipo?.addEventListener('change', ()=>{ d.tipo = inpTipo.value; saveSoft(); scheduleSync(); });
    inpVal?.addEventListener('input',  ()=>{ d.valor = num(inpVal.value); saveSoft(); scheduleSync(); });
    inpDesc?.addEventListener('input', ()=>{ d.desc = inpDesc.value; saveSoft(); });

    tr.querySelector('[data-del]')?.addEventListener('click', ()=>{
      if(!confirmDel('esta despesa')) return;
      state.despesas = state.despesas.filter(x=>x.id!==id);
      saveSoft();
      renderDespesas();
      scheduleSync();
    });
  });
}

onClick('btnAddDespesa', ()=>{
  state.despesas.unshift({ id: uid(), data: todayISO(), tipo:'Fixa', valor:0, desc:'' });
  saveSoft();
  renderDespesas();
  scheduleSync();
});

/* =================== WHATSAPP =================== */
function bindWppUI(){
  const setV = (id, v)=>{ const el = byId(id); if(el) el.value = v ?? ''; };

  setV('wppHoraLembrete', state.wpp.horaLembrete || '09:00');
  setV('wppHoraRelatorio', state.wpp.horaRelatorio || '20:00');
  setV('tplConfirmacao', state.wpp.tplConfirmacao || '');
  setV('tplLembrete', state.wpp.tplLembrete || '');
  setV('tplAgradecimento', state.wpp.tplAgradecimento || '');
  setV('tplRelatorio', state.wpp.tplRelatorio || '');

  onClick('btnSaveWpp', ()=>{
    state.wpp.horaLembrete = byId('wppHoraLembrete')?.value || '09:00';
    state.wpp.horaRelatorio = byId('wppHoraRelatorio')?.value || '20:00';
    state.wpp.tplConfirmacao = byId('tplConfirmacao')?.value || '';
    state.wpp.tplLembrete = byId('tplLembrete')?.value || '';
    state.wpp.tplAgradecimento = byId('tplAgradecimento')?.value || '';
    state.wpp.tplRelatorio = byId('tplRelatorio')?.value || '';
    saveSoft();
    alert('WhatsApp salvo ✅');
  });

  onClick('btnQueueTomorrow', ()=>{
    const tomorrow = addDaysISO(todayISO(), 1);
    const itens = state.agenda
      .filter(a=>a.data===tomorrow && (a.status||'Agendado')==='Agendado')
      .slice()
      .sort((x,y)=>(x.hora||'').localeCompare(y.hora||''));

    state.wppQueue = itens.map((a)=>{
      const phone = clientWpp(a.cliente);
      const txt = fillTpl(state.wpp.tplLembrete, a);
      return { id: uid(), type:'lembrete', data: tomorrow, cliente:a.cliente||'', phone, text: txt };
    });

    saveSoft();
    renderWppQueue();
    alert('Fila criada ✅');
  });

  onClick('btnSendReport', ()=> sendReportToday());
}

function renderWppQueue(){
  const box = byId('wppQueue');
  if(!box) return;

  if(!state.wppQueue?.length){
    box.innerHTML = `<div class="hint">Fila vazia.</div>`;
    return;
  }

  box.innerHTML = state.wppQueue.map((q)=>{
    const phone = q.phone ? normalizePhoneBR(q.phone) : '';
    const btn = phone ? `<a class="btn btn--ghost" href="${waLink(phone, q.text)}" target="_blank" rel="noopener">Abrir WhatsApp</a>` : `<span class="hint">Sem WhatsApp</span>`;
    return `
      <div class="calListItem">
        <div class="calListHead">
          <b>${q.cliente || 'Cliente'}</b>
          <span class="calListMeta">${q.data || ''}</span>
        </div>
        <pre>${String(q.text||'')}</pre>
        <div class="actions">
          ${btn}
          <button class="btn btn--ghost" data-copy="${q.id}">Copiar</button>
          <button class="btn btn--ghost" data-del="${q.id}">Remover</button>
        </div>
      </div>
    `;
  }).join('');

  box.querySelectorAll('[data-copy]').forEach((b)=>{
    b.addEventListener('click', async ()=>{
      const id = b.getAttribute('data-copy');
      const q = state.wppQueue.find(x=>x.id===id);
      if(!q) return;
      const ok = await copyToClipboardSafe(q.text||'');
      alert(ok ? 'Copiado ✅' : 'Não foi possível copiar.');
    });
  });

  box.querySelectorAll('[data-del]').forEach((b)=>{
    b.addEventListener('click', ()=>{
      const id = b.getAttribute('data-del');
      state.wppQueue = state.wppQueue.filter(x=>x.id!==id);
      saveSoft();
      renderWppQueue();
    });
  });
}

function sendReportToday(){
  const wppStudio = (state.settings.studioWpp||'').trim();
  if(!wppStudio){
    alert('Configure seu WhatsApp do Studio em Config.');
    setRoute('config');
    return;
  }

  const iso = todayISO();
  const itens = state.agenda
    .filter(a=>a.data===iso && (a.status||'Agendado')==='Realizado')
    .slice()
    .sort((x,y)=>(x.hora||'').localeCompare(y.hora||''));

  const lista = itens.length
    ? itens.map(a=>`• ${a.hora||''} — ${a.cliente||''} (${a.procedimento||''}) — ${money(procPrice(a.procedimento))}`).join('\n')
    : 'Sem atendimentos realizados.';

  const total = itens.reduce((s,a)=> s + num(a.recebido), 0);

  const msg = String(state.wpp.tplRelatorio||'')
    .replaceAll('{data}', fmtBRDate(iso))
    .replaceAll('{studio}', state.settings.studioNome||'Studio')
    .replaceAll('{lista}', lista)
    .replaceAll('{total}', money(total));

  window.open(waLink(wppStudio, msg), '_blank');
}

/* =================== CONFIG =================== */
function bindConfigUI(){
  safeValue('cfgStudioNome', state.settings.studioNome||'');
  safeValue('cfgLogoUrl', state.settings.logoUrl||'');
  safeValue('cfgCorPrimaria', state.settings.corPrimaria||'#7B2CBF');
  safeValue('cfgCorAcento', state.settings.corAcento||'#F72585');
  safeValue('cfgStudioWpp', state.settings.studioWpp||'');

  onClick('btnSaveConfig', ()=>{
    state.settings.studioNome = byId('cfgStudioNome')?.value || state.settings.studioNome;
    state.settings.logoUrl = byId('cfgLogoUrl')?.value || '';
    state.settings.corPrimaria = byId('cfgCorPrimaria')?.value || '#7B2CBF';
    state.settings.corAcento = byId('cfgCorAcento')?.value || '#F72585';
    state.settings.studioWpp = byId('cfgStudioWpp')?.value || '';

    saveSoft();
    applyTheme();
    renderDashboard();
    renderCalendar();
    alert('Config salva ✅');
  });
}

/* =================== DASHBOARD COMPARAÇÕES (MoM / YoY) =================== */
function mkToParts(mk){
  const [y,m] = String(mk||'').split('-').map(Number);
  if(!y || !m) return null;
  return { y, m };
}
function partsToMk(y,m){
  return `${y}-${String(m).padStart(2,'0')}`;
}
function prevMonthKey(mk){
  const p = mkToParts(mk);
  if(!p) return '';
  let y = p.y, m = p.m - 1;
  if(m <= 0){ m = 12; y -= 1; }
  return partsToMk(y,m);
}
function yearAgoMonthKey(mk){
  const p = mkToParts(mk);
  if(!p) return '';
  return partsToMk(p.y - 1, p.m);
}
function monthRevenue(mk){
  if(!mk) return 0;
  return state.atendimentos
    .filter(a => monthKey(a.data) === mk)
    .reduce((s,a)=> s + num(a.recebido), 0);
}
function pctChange(cur, prev){
  const c = num(cur);
  const p = num(prev);
  if(p === 0) return null;
  return ((c - p) / p) * 100;
}
function fmtPct(v){
  if(v === null) return '—';
  const n = Math.round(v*10)/10;
  const sign = (n>0) ? '+' : '';
  return `${sign}${n}%`;
}

function updateRevenueComparisons(){
  const hintMoM = byId('hintMoM');
  const hintYoY = byId('hintYoY');
  if(!hintMoM || !hintYoY) return;

  const mk = currentMonthKey();
  const mkPrev = prevMonthKey(mk);
  const mkYoY  = yearAgoMonthKey(mk);

  const cur = monthRevenue(mk);
  const prev = monthRevenue(mkPrev);
  const yoy = monthRevenue(mkYoY);

  const momPct = pctChange(cur, prev);
  const yoyPct = pctChange(cur, yoy);

  hintMoM.textContent = `Mês atual vs mês anterior: ${money(cur)} vs ${money(prev)} (${fmtPct(momPct)})`;
  hintYoY.textContent = `Mês atual vs ano anterior: ${money(cur)} vs ${money(yoy)} (${fmtPct(yoyPct)})`;
}

/* =================== DASHBOARD =================== */
function updateDashboardKPIs(){
  const k1 = byId("kpiReceita");
  const k2 = byId("kpiCustos");
  const k3 = byId("kpiDespesas");
  const k4 = byId("kpiLucro");
  if(!k1 || !k2 || !k3 || !k4) return;

  const mk = currentMonthKey();

  // ✅ KPIs do mês atual (receita/custos/lucro)
  const resumoMes = calcResumo({
    onlyMonthKey: mk,
    despesasScope: DASH_LUCRO_DESPESAS_SCOPE
  });

  // ✅ Despesas SEMPRE TOTAL (pra manter “Despesas” como todos os meses)
  const despesasTotal = state.despesas.reduce((s,d)=> s + num(d.valor), 0);

  k1.textContent = money(resumoMes.receita);
  k2.textContent = money(resumoMes.custos);
  k3.textContent = money(despesasTotal);

  // ✅ Lucro do mês com despesas conforme a constante (ALL ou MONTH)
  k4.textContent = money(resumoMes.lucro);
}

function renderDashboard(){
  updateDashboardKPIs();

  const bars = byId("chartBars");
  const line = byId("chartLine");

  const mk = currentMonthKey();

  // ✅ Barras: receita/lucro do mês + despesas total
  const resumoMes = calcResumo({
    onlyMonthKey: mk,
    despesasScope: DASH_LUCRO_DESPESAS_SCOPE
  });
  const despesasTotal = state.despesas.reduce((s,d)=> s + num(d.valor), 0);

  drawBars(
    bars,
    ["Receita (mês)","Lucro (mês)","Despesas (total)"],
    [resumoMes.receita, resumoMes.lucro, despesasTotal]
  );

  // ✅ Linha: receita por mês (histórico)
  const monthly = calcMonthlyRevenue();
  drawLine(line, monthly);

  // Se existir comparação, mantém
  if(typeof updateRevenueComparisons === "function"){
    updateRevenueComparisons();
  }
}

/* =================== BOOT =================== */
function renderAllOnce(){
  renderAllHard();
  renderDashboard();
}

renderAllOnce();

/* =================== SERVICE WORKER =================== */
(async function registerSW(){
  try{
    if("serviceWorker" in navigator){
      await navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" });

    }
  }catch(e){
    console.warn("SW falhou:", e);
  }
})();

/* =================== FINAL SYNC =================== */
enforceAgendaRecebidoRules();
syncAgendaToAtendimentos();
state.materiais.forEach(calcularMaterial);
state.atendimentos.forEach(calcularAtendimento);
saveSoft();
scheduleSync();
