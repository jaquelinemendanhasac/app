/* Studio Jaqueline Mendanha — Gestão Completa (SYNC PRO / FIXED)
   - Blindado contra tela branca (elementos ausentes não quebram)
   - Sincronização total (derived + UI)
   - Regra do estúdio: Realizado => Recebido = preço do procedimento (sempre)
   - Agenda cria/remove Atendimentos automaticamente
*/

const ROUTES = [
  { id:"dashboard", label:"Dashboard" },
  { id:"calendario", label:"Calendário" }, // ✅ ADICIONADO (sem remover nada)
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

const num = (v)=> {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  let clean = s;
  if (clean.includes(",")) clean = clean.replace(/\./g,"").replace(",",".");

  const x = Number(clean);
  return Number.isFinite(x) ? x : 0;
};

const uid = ()=> Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(2,6);
const todayISO = ()=> new Date().toISOString().slice(0,10);

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

/* =================== STATE =================== */
function defaultState(){
  return {
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

  // migração: atendimentos
  s.atendimentos.forEach(a=>{
    if(a && typeof a==="object"){
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

  // ✅ migração: clientes (SAÚDE -> MOLDE, MEDS -> N° DO MOLDE)
  s.clientes.forEach(c=>{
    if(c && typeof c==="object"){
      if(c.nome === undefined) c.nome = "";
      if(c.wpp === undefined) c.wpp = "";
      if(c.tel === undefined) c.tel = "";
      if(c.nasc === undefined) c.nasc = "";
      if(c.alergia === undefined) c.alergia = "N";
      if(c.quais === undefined) c.quais = "";
      if(c.gestante === undefined) c.gestante = "N";
      if(c.obs === undefined) c.obs = "";

      // migra valores antigos sem perder dados
      if(c.molde === undefined){
        c.molde = (c.saude !== undefined) ? String(c.saude || "") : "";
      }
      if(c.nMolde === undefined){
        c.nMolde = (c.meds !== undefined) ? String(c.meds || "") : "";
      }

      // remove campos antigos (não obrigatório, mas evita confusão no JSON)
      if(c.saude !== undefined) delete c.saude;
      if(c.meds !== undefined) delete c.meds;
    }
  });

  // migração: materiais
  s.materiais.forEach(m=>{
    if(m && typeof m==="object"){
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
// ✅ usado pelo firebase.js para ler o estado atual local
window.__SJM_GET_STATE = () => state;

// ✅ Flag para saber se a nuvem já respondeu ao menos 1 vez
window.__SJM_CLOUD_READY = window.__SJM_CLOUD_READY || false;

/* =================== CLOUD SYNC (Firebase Bridge) =================== */
let cloudTimer = null;
function scheduleCloudPush(){
  if(typeof window.__SJM_PUSH_TO_CLOUD !== "function") return;

  if(cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async ()=>{
    cloudTimer = null;
    try{
      await window.__SJM_PUSH_TO_CLOUD(state);
    }catch(e){
      console.error("Cloud push falhou:", e);
    }
  }, 350);
}

// ✅ Anti-loop: evita saveSoft -> scheduleSync -> syncDerivedAndUI -> saveSoft infinito
let __SJM_IS_SYNCING = false;

function saveSoft(){
  try{
    localStorage.setItem(KEY, JSON.stringify(state));
  }catch(e){
    console.warn("localStorage cheio?", e);
  }
  // ✅ push com debounce (mais estável entre celular/pc)
  scheduleCloudPush();
}

window.__SJM_SET_STATE_FROM_CLOUD = (remoteState) => {
  state = sanitizeState(remoteState);

  enforceAgendaRecebidoRules();
  syncAgendaToAtendimentos();
  state.materiais.forEach(calcularMaterial);
  state.atendimentos.forEach(calcularAtendimento);

  localStorage.setItem(KEY, JSON.stringify(state));

  applyTheme();
  renderAllHard();
};

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

  // ✅ logo no Dashboard também
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

  // expose
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
    syncDerivedAndUI();
  }, 120);
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
  return p?.duracaoMin || 60; // padrão 1h
}

/* =================== CONFLITO POR DURAÇÃO (FIX) =================== */
function isConflictByDuration(index){
  const a = state.agenda[index];
  if(!a?.data || !a?.hora) return false;

  const inicioA = new Date(`${a.data}T${a.hora}`);
  const fimA = new Date(inicioA.getTime() + procDuracao(a.procedimento) * 60000);

  return state.agenda.some((b, i) => {
    if(i === index) return false;
    if((b.status||"Agendado") === "Cancelado") return false;
    if(b.data !== a.data) return false;
    if(!b.hora) return false;

    const inicioB = new Date(`${b.data}T${b.hora}`);
    const fimB = new Date(inicioB.getTime() + procDuracao(b.procedimento) * 60000);

    return inicioA < fimB && fimA > inicioB;
  });
}

/* =================== updateConflictUI (SAFE) =================== */
function updateConflictUI(){}

/* =================== REGRA DO ESTÚDIO =================== */
function enforceAgendaRecebidoRules(){
  state.agenda.forEach(ag=>{
    const status = (ag.status || "Agendado");
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
  const msg = encodeURIComponent(text || "");
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
function calcResumo(){
  const receita = state.atendimentos.reduce((s,a)=> s + num(a.recebido), 0);
  const custos  = state.atendimentos.reduce((s,a)=> s + (num(a.custoMaterial)+num(a.maoObra)), 0);
  const despesas= state.despesas.reduce((s,d)=> s + num(d.valor), 0);
  const lucro   = receita - custos - despesas;
  return { receita, custos, despesas, lucro };
}
function monthKey(iso){
  if(!iso) return "";
  const [y,m] = iso.split("-");
  return `${y}-${m}`;
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

/* =================== ✅ CALENDÁRIO (ADICIONADO) =================== */
let __CAL_CURSOR = new Date();           // mês em exibição
let __CAL_SELECTED_ISO = todayISO();     // dia selecionado

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
  const items = agendaOfDay(iso).map((a)=> {
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
      return `<div class="calMiniItem">${a.hora || ""} — ${(a.cliente||"").trim() || "Sem nome"}</div>`;
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
    const val = procPrice(a.procedimento);

    const idx = state.agenda.findIndex(x=>x && x.id===a.id);
    const conflita = (idx >= 0) ? isConflictByDuration(idx) : false;

    return `
      <div class="calListItem ${conflita ? "danger" : ""}">
        <div class="calListHead">
          <b>${a.hora || ""} — ${(a.cliente||"").trim() || "Sem nome"}</b>
          <span class="calListMeta">${st}</span>
        </div>
        <div class="calListMeta">Procedimento: ${a.procedimento || ""} • Valor: ${money(val)} • Recebido: ${money(rec)}</div>
        ${a.obs ? `<div class="calListMeta">Obs: ${String(a.obs)}</div>` : ``}
      </div>
    `;
  }).join("");
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
  const key = `${a.data}|${a.hora}`;
  const active = (x)=> (x.status||"Agendado") !== "Cancelado";
  return state.agenda.some((x,idx)=> idx!==i && active(x) && active(a) && `${x.data}|${x.hora}` === key);
}

function renderAgendaHard(){
  const tblAgendaBody = getAgendaTbody();
  const agendaNotice = getAgendaNotice();
  if(!tblAgendaBody) return;

  if(agendaNotice){
    agendaNotice.hidden = true;
    agendaNotice.textContent = "";
  }

  const procNames = state.procedimentos.map(p=>p.nome).filter(Boolean);
  const statuses = ["Agendado","Realizado","Cancelado","Remarcado"];

  enforceAgendaRecebidoRules();

  tblAgendaBody.innerHTML = state.agenda.map((a,i)=>{
    const val = procPrice(a.procedimento);
    const conflict = isConflict(i);
    const conflictDur = isConflictByDuration(i);

    const wpp = clientWpp(a.cliente);
    const rec = num(a.recebido);
    return `
      <tr data-id="${a.id}" class="${(conflict || conflictDur) ? "danger" : ""}">
        <td>${inputHTML({value:a.data, type:"date"})}</td>
        <td>${inputHTML({value:a.hora, type:"time", step:"60"})}</td>
        <td>${inputHTML({value:a.cliente})}</td>
        <td>${inputHTML({value:wpp, readonly:true})}</td>
        <td>${inputHTML({value:a.procedimento, options: procNames.length?procNames:["Alongamento"]})}</td>
        <td>${inputHTML({value:val.toFixed(2), type:"text", cls:"money", readonly:true})}</td>
        <td>${inputHTML({value:a.status, options: statuses})}</td>
        <td>${inputHTML({value:rec.toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal"})}</td>
        <td>${inputHTML({value:a.obs})}</td>
        <td>
          <div class="iconRow">
            <button class="iconBtn" data-conf title="Confirmação">📩</button>
            <button class="iconBtn" data-lem title="Lembrete">⏰</button>
          </div>
        </td>
        <td><button class="iconBtn" data-del title="Excluir">✕</button></td>
      </tr>
    `;
  }).join("");

  tblAgendaBody.querySelectorAll("tr").forEach((tr,idx)=>{
    const a = state.agenda[idx];

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

      if(a.status === "Realizado"){
        a.recebido = procPrice(a.procedimento);
        if(inpRec) inpRec.value = num(a.recebido).toFixed(2);
      }else if(a.status === "Cancelado" || a.status === "Remarcado"){
        a.recebido = 0;
        if(inpRec) inpRec.value = "0.00";
      }

      saveSoft(); updateConflictUI(); scheduleSync();
    });

    inpRec?.addEventListener("input", ()=>{
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
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      const txt = fillTpl(state.wpp.tplConfirmacao, a);
      window.open(waLink(phone, txt), "_blank");
    });

    tr.querySelector("[data-lem]")?.addEventListener("click", ()=>{
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      const txt = fillTpl(state.wpp.tplLembrete, a);
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

    const conflictDurHere = isConflictByDuration(idx);
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

    if((a.status||"Agendado") === "Realizado"){
      a.recebido = procPrice(a.procedimento);
    }else if(a.status === "Cancelado" || a.status === "Remarcado"){
      a.recebido = 0;
    }

    const inpWpp = getInp(getCell(tr,3));
    const inpVal = getInp(getCell(tr,5));
    const inpRec = getInp(getCell(tr,7));

    if(inpWpp) inpWpp.value = clientWpp(a.cliente);
    if(inpVal) inpVal.value = procPrice(a.procedimento).toFixed(2);
    if(inpRec) inpRec.value = num(a.recebido).toFixed(2);
  });
}

/* =================== PROCEDIMENTOS =================== */
const tblProcBody = $("#tblProc tbody");
onClick("btnAddProc", ()=>{
  state.procedimentos.push({ id: uid(), nome:"", preco:0, reajuste:"" });
  saveSoft();
  renderProcedimentos();
  scheduleSync();
});
onClick("btnResetProc", ()=>{
  if(!confirm("Restaurar procedimentos padrão? Isso remove os seus atuais.")) return;
  state.procedimentos = defaultState().procedimentos;
  saveSoft();
  renderProcedimentos();
  renderAgendaHard();
  renderAtendimentosHard();
  scheduleSync();
});

function renderProcedimentos(){
  if(!tblProcBody) return;

  tblProcBody.innerHTML = state.procedimentos.map(p=>`
    <tr data-id="${p.id}">
      <td>${inputHTML({value:p.nome})}</td>
      <td>${inputHTML({value:num(p.preco).toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal"})}</td>
      <td>${inputHTML({value:p.reajuste, type:"date"})}</td>
      <td><button class="iconBtn" data-del title="Excluir">✕</button></td>
    </tr>
  `).join("");

  tblProcBody.querySelectorAll("tr").forEach((tr)=>{
    const id = tr.dataset.id;
    const p = state.procedimentos.find(x=>x.id===id);
    if(!p) return;

    tr.addEventListener("input", ()=>{
      p.nome = getInp(getCell(tr,0)).value;
      p.preco = num(getInp(getCell(tr,1)).value);
      p.reajuste = getInp(getCell(tr,2)).value;
      saveSoft();
      scheduleSync();
    });

    tr.querySelector("[data-del]")?.addEventListener("click", ()=>{
      if(!confirmDel("este procedimento")) return;
      state.procedimentos = state.procedimentos.filter(x=>x.id!==id);
      saveSoft();
      renderProcedimentos();
      scheduleSync();
    });
  });
}

/* =================== CLIENTES =================== */
const tblCliBody = $("#tblCli tbody");
onClick("btnAddCliente", ()=>{
  state.clientes.unshift({
    id:uid(), nome:"", wpp:"", tel:"", nasc:"",
    alergia:"N", quais:"", gestante:"N",
    molde:"", nMolde:"", obs:""
  });
  saveSoft();
  renderClientes();
  scheduleSync();
});

function renderClientes(){
  if(!tblCliBody) return;

  const sn = ["S","N"];
  tblCliBody.innerHTML = state.clientes.map(c=>`
    <tr data-id="${c.id}">
      <td>${inputHTML({value:c.nome})}</td>
      <td>${inputHTML({value:c.wpp})}</td>
      <td>${inputHTML({value:c.tel})}</td>
      <td>${inputHTML({value:c.nasc, type:"date"})}</td>
      <td>${inputHTML({value:c.alergia, options: sn})}</td>
      <td>${inputHTML({value:c.quais})}</td>
      <td>${inputHTML({value:c.gestante, options: sn})}</td>
      <td>${inputHTML({value:c.molde})}</td>
      <td>${inputHTML({value:c.nMolde})}</td>
      <td>${inputHTML({value:c.obs})}</td>
      <td><button class="iconBtn" data-del title="Excluir">✕</button></td>
    </tr>
  `).join("");

  tblCliBody.querySelectorAll("tr").forEach((tr)=>{
    const id = tr.dataset.id;
    const c = state.clientes.find(x=>x.id===id);
    if(!c) return;

    tr.addEventListener("input", ()=>{
      c.nome = getInp(getCell(tr,0)).value;
      c.wpp  = getInp(getCell(tr,1)).value;
      c.tel  = getInp(getCell(tr,2)).value;
      c.nasc = getInp(getCell(tr,3)).value;
      c.alergia = getInp(getCell(tr,4)).value;
      c.quais = getInp(getCell(tr,5)).value;
      c.gestante = getInp(getCell(tr,6)).value;
      c.molde = getInp(getCell(tr,7)).value;
      c.nMolde = getInp(getCell(tr,8)).value;
      c.obs = getInp(getCell(tr,9)).value;
      saveSoft();
      scheduleSync();
    });

    tr.querySelector("[data-del]")?.addEventListener("click", ()=>{
      if(!confirmDel("esta cliente")) return;
      state.clientes = state.clientes.filter(x=>x.id!==id);
      saveSoft();
      renderClientes();
      scheduleSync();
    });
  });
}

/* =================== MATERIAIS =================== */
const tblMatBody = $("#tblMat tbody");
onClick("btnAddMat", ()=>{
  state.materiais.unshift({
    id:uid(), nome:"",
    qtdTotal:0, unidade:"ml", valorCompra:0,
    qtdCliente:0, custoUnit:0, custoCliente:0, rendimento:0
  });
  saveSoft();
  renderMateriaisHard();
  scheduleSync();
});

function renderMateriaisHard(){
  if(!tblMatBody) return;

  const unidades = ["ml","L","g","kg","un"];
  state.materiais.forEach(calcularMaterial);

  tblMatBody.innerHTML = state.materiais.map(m=>`
    <tr data-id="${m.id}">
      <td>${inputHTML({value:m.nome})}</td>
      <td>${inputHTML({value:m.qtdTotal, type:"number", step:"0.01", inputmode:"decimal"})}</td>
      <td>${inputHTML({value:m.unidade, options: unidades})}</td>
      <td>${inputHTML({value:num(m.valorCompra).toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal"})}</td>
      <td>${inputHTML({value:(m.custoUnit||0).toFixed(6), type:"text", readonly:true})}</td>
      <td>${inputHTML({value:m.qtdCliente, type:"number", step:"0.01", inputmode:"decimal"})}</td>
      <td>${inputHTML({value:(m.rendimento||0).toFixed(0), type:"text", readonly:true})}</td>
      <td>${inputHTML({value:(m.custoCliente||0).toFixed(2), type:"text", cls:"money", readonly:true})}</td>
      <td><button class="iconBtn" data-del title="Excluir">✕</button></td>
    </tr>
  `).join("");

  tblMatBody.querySelectorAll("tr").forEach((tr)=>{
    const id = tr.dataset.id;
    const m = state.materiais.find(x=>x.id===id);
    if(!m) return;

    const inpCU = getInp(getCell(tr,4));
    const inpRen = getInp(getCell(tr,6));
    const inpCC = getInp(getCell(tr,7));

    const recompute = ()=>{
      m.nome = getInp(getCell(tr,0)).value;
      m.qtdTotal = num(getInp(getCell(tr,1)).value);
      m.unidade = getInp(getCell(tr,2)).value;
      m.valorCompra = num(getInp(getCell(tr,3)).value);
      m.qtdCliente = num(getInp(getCell(tr,5)).value);

      calcularMaterial(m);

      if(inpCU) inpCU.value = (m.custoUnit||0).toFixed(6);
      if(inpRen) inpRen.value = (m.rendimento||0).toFixed(0);
      if(inpCC) inpCC.value = (m.custoCliente||0).toFixed(2);

      saveSoft();
      scheduleSync();
    };

    tr.addEventListener("input", recompute);
    tr.addEventListener("change", recompute);

    tr.querySelector("[data-del]")?.addEventListener("click", ()=>{
      if(!confirmDel("este material")) return;
      state.materiais = state.materiais.filter(x=>x.id!==id);
      saveSoft();
      renderMateriaisHard();
      scheduleSync();
    });
  });
}

/* =================== ATENDIMENTOS =================== */
const tblAtendBody = $("#tblAtend tbody");
onClick("btnAddAtendimento", ()=>{
  const firstProc = state.procedimentos.find(p=>p.nome)?.nome || "Alongamento";
  state.atendimentos.unshift({
    id:uid(), data:todayISO(),
    cliente:"", procedimento:firstProc,
    valor: procPrice(firstProc),
    recebido:0,
    custoMaterial: custoMateriaisPorCliente(),
    maoObra:0,
    custoTotal:0,
    lucro:0,
    foto:"",
    fromAgendaId:"",
    auto:false
  });
  saveSoft();
  renderAtendimentosHard();
  scheduleSync();
});

function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderAtendimentosHard(){
  if(!tblAtendBody) return;

  const procNames = state.procedimentos.map(p=>p.nome).filter(Boolean);
  state.atendimentos.forEach(calcularAtendimento);

  tblAtendBody.innerHTML = state.atendimentos.map(a=>{
    const wpp = clientWpp(a.cliente);
    const lucroCls = (a.lucro||0) < 0 ? "danger" : "ok";
    const tag = a.fromAgendaId ? ` <span style="font-size:11px;opacity:.7;">(Agenda)</span>` : "";
    return `
      <tr data-id="${a.id}">
        <td>${inputHTML({value:a.data, type:"date"})}</td>
        <td>${inputHTML({value:a.cliente})}${tag}</td>
        <td>${inputHTML({value:wpp, readonly:true})}</td>
        <td>${inputHTML({value:a.procedimento, options: procNames.length?procNames:["Alongamento"]})}</td>
        <td>${inputHTML({value:(a.valor||0).toFixed(2), type:"text", cls:"money", readonly:true})}</td>
        <td>${inputHTML({value:num(a.recebido).toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal"})}</td>
        <td>${inputHTML({value:(a.custoMaterial||0).toFixed(2), type:"text", cls:"money", readonly:true})}</td>
        <td>${inputHTML({value:num(a.maoObra).toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal"})}</td>
        <td>${inputHTML({value:(a.custoTotal||0).toFixed(2), type:"text", cls:"money", readonly:true})}</td>
        <td>${inputHTML({value:(a.lucro||0).toFixed(2), type:"text", cls:`money ${lucroCls}`, readonly:true})}</td>

        <td>
          <div class="iconRow">
            <label class="iconBtn" title="Adicionar foto">
              📷
              <input type="file" accept="image/*" data-photo hidden />
            </label>
            <button class="iconBtn" data-openphoto title="Abrir foto">🖼️</button>
          </div>
        </td>

        <td>
          <div class="iconRow">
            <button class="iconBtn" data-thx title="Agradecimento (texto)">💜</button>
            <button class="iconBtn" data-sendphoto title="WhatsApp: mensagem + abrir foto">📷➡️</button>
          </div>
        </td>

        <td><button class="iconBtn" data-del title="Excluir">✕</button></td>
      </tr>
    `;
  }).join("");

  tblAtendBody.querySelectorAll("tr").forEach((tr)=>{
    const id = tr.dataset.id;
    const a = state.atendimentos.find(x=>x.id===id);
    if(!a) return;

    const tdData = getCell(tr,0);
    const tdCli  = getCell(tr,1);
    const tdWpp  = getCell(tr,2);
    const tdProc = getCell(tr,3);
    const tdVal  = getCell(tr,4);
    const tdRec  = getCell(tr,5);
    const tdMao  = getCell(tr,7);

    const inpWpp = getInp(tdWpp);
    const inpVal = getInp(tdVal);

    getInp(tdData)?.addEventListener("change", ()=>{
      a.data = getInp(tdData).value;
      saveSoft();
      scheduleSync();
    });

    getInp(tdCli)?.addEventListener("input", ()=>{
      a.cliente = getInp(tdCli).value;
      if(inpWpp) inpWpp.value = clientWpp(a.cliente);
      saveSoft();
      scheduleSync();
    });

    getInp(tdProc)?.addEventListener("change", ()=>{
      a.procedimento = getInp(tdProc).value;
      if(inpVal) inpVal.value = procPrice(a.procedimento).toFixed(2);
      saveSoft();
      scheduleSync();
    });

    getInp(tdRec)?.addEventListener("input", ()=>{
      a.recebido = num(getInp(tdRec).value);
      saveSoft();
      scheduleSync();
    });

    getInp(tdMao)?.addEventListener("input", ()=>{
      a.maoObra = num(getInp(tdMao).value);
      saveSoft();
      scheduleSync();
    });

    const photoInput = tr.querySelector("[data-photo]");
    if(photoInput){
      photoInput.onchange = async ()=>{
        const file = photoInput.files?.[0];
        if(!file) return;
        a.foto = await fileToDataURL(file);
        saveSoft();
        alert("Foto salva ✅");
        photoInput.value = "";
      };
    }

    tr.querySelector("[data-openphoto]")?.addEventListener("click", ()=>{
      if(!a.foto){ alert("Sem foto nesse atendimento."); return; }
      const w = window.open("", "_blank");
      w.document.write(`<img src="${a.foto}" style="max-width:100%;height:auto;"/>`);
    });

    tr.querySelector("[data-thx]")?.addEventListener("click", async ()=>{
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      const fake = { data:a.data, hora:"", cliente:a.cliente, procedimento:a.procedimento };
      const txt = fillTpl(state.wpp.tplAgradecimento, fake);
      await copyToClipboardSafe(txt);
      window.open(waLink(phone, txt), "_blank");
    });

    tr.querySelector("[data-sendphoto]")?.addEventListener("click", async ()=>{
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      if(!a.foto){ alert("Esse atendimento não tem foto. Clique no 📷 e adicione."); return; }

      const fake = { data:a.data, hora:"", cliente:a.cliente, procedimento:a.procedimento };
      const txt = fillTpl(state.wpp.tplAgradecimento, fake);
      await copyToClipboardSafe(txt);

      window.open(waLink(phone, txt), "_blank");

      const w = window.open("", "_blank");
      w.document.write(`
        <title>Foto do atendimento</title>
        <div style="font-family:system-ui;padding:12px">
          <h3>Foto do atendimento</h3>
          <p>Volte no WhatsApp e clique no 📎 para anexar esta foto.</p>
          <img src="${a.foto}" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #eee"/>
        </div>
      `);
    });

    tr.querySelector("[data-del]")?.addEventListener("click", ()=>{
      if(!confirmDel("este atendimento")) return;
      state.atendimentos = state.atendimentos.filter(x=>x.id!==id);
      saveSoft();
      renderAtendimentosHard();
      scheduleSync();
    });
  });
}

function updateAtendimentosAutoCells(){
  if(!tblAtendBody) return;

  const rows = tblAtendBody.querySelectorAll("tr");
  rows.forEach((tr)=>{
    const id = tr.dataset.id;
    const a = state.atendimentos.find(x=>x.id===id);
    if(!a) return;

    calcularAtendimento(a);

    const inpWpp = getInp(getCell(tr,2));
    const inpVal = getInp(getCell(tr,4));
    const inpCM  = getInp(getCell(tr,6));
    const inpCT  = getInp(getCell(tr,8));
    const inpLuc = getInp(getCell(tr,9));

    if(inpWpp) inpWpp.value = clientWpp(a.cliente);
    if(inpVal) inpVal.value = (a.valor||0).toFixed(2);
    if(inpCM)  inpCM.value  = (a.custoMaterial||0).toFixed(2);
    if(inpCT)  inpCT.value  = (a.custoTotal||0).toFixed(2);
    if(inpLuc){
      inpLuc.value = (a.lucro||0).toFixed(2);
      inpLuc.classList.toggle("danger", (a.lucro||0) < 0);
      inpLuc.classList.toggle("ok", (a.lucro||0) >= 0);
    }
  });
}

/* =================== DESPESAS =================== */
const tblDespBody = $("#tblDesp tbody");
onClick("btnAddDespesa", ()=>{
  state.despesas.unshift({ id:uid(), data:todayISO(), tipo:"Fixa", valor:0, desc:"" });
  saveSoft();
  renderDespesas();
  scheduleSync();
});

function renderDespesas(){
  if(!tblDespBody) return;

  const tipos = ["Fixa","Variável"];
  tblDespBody.innerHTML = state.despesas.map(d=>`
    <tr data-id="${d.id}">
      <td>${inputHTML({value:d.data, type:"date"})}</td>
      <td>${inputHTML({value:d.tipo, options: tipos})}</td>
      <td>${inputHTML({value:num(d.valor).toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal"})}</td>
      <td>${inputHTML({value:d.desc})}</td>
      <td><button class="iconBtn" data-del title="Excluir">✕</button></td>
    </tr>
  `).join("");

  tblDespBody.querySelectorAll("tr").forEach((tr)=>{
    const id = tr.dataset.id;
    const d = state.despesas.find(x=>x.id===id);
    if(!d) return;

    tr.addEventListener("input", ()=>{
      d.data = getInp(getCell(tr,0)).value;
      d.tipo = getInp(getCell(tr,1)).value;
      d.valor = num(getInp(getCell(tr,2)).value);
      d.desc = getInp(getCell(tr,3)).value;
      saveSoft();
      scheduleSync();
    });

    tr.querySelector("[data-del]")?.addEventListener("click", ()=>{
      if(!confirmDel("esta despesa")) return;
      state.despesas = state.despesas.filter(x=>x.id!==id);
      saveSoft();
      renderDespesas();
      scheduleSync();
    });
  });
}

/* =================== KPI / DASH =================== */
function updateDashboardKPIs(){
  const { receita, custos, despesas, lucro } = calcResumo();

  safeText("kpiReceita", money(receita));
  safeText("kpiCustos", money(custos));
  safeText("kpiDespesas", money(despesas));
  safeText("kpiLucro", money(lucro));

  const bars = byId("chartBars");
  drawBars(bars, ["Receita","Lucro","Despesas"], [receita, lucro, despesas]);

  const line = byId("chartLine");
  const monthly = calcMonthlyRevenue();
  drawLine(line, monthly.length ? monthly : [{k:"-",v:0},{k:"-",v:0}]);
}
function renderDashboard(){ updateDashboardKPIs(); }

/* =================== WHATSAPP PAGE =================== */
function reportTodayText(){
  const data = todayISO();
  const lista = state.agenda
    .filter(a => a.data === data && (a.status||"Agendado") !== "Cancelado")
    .sort((x,y)=> (x.hora||"").localeCompare(y.hora||""))
    .map(a => `• ${a.hora} — ${a.cliente} — ${a.procedimento} (${money(procPrice(a.procedimento))}) [${a.status||"Agendado"}]`)
    .join("\n");

  const total = state.agenda
    .filter(a => a.data === data && (a.status||"Agendado") === "Realizado")
    .reduce((s,a)=> s + num(a.recebido), 0);

  return (state.wpp.tplRelatorio||"")
    .replaceAll("{data}", fmtBRDate(data))
    .replaceAll("{studio}", state.settings.studioNome || "Studio")
    .replaceAll("{lista}", lista || "(sem agendamentos)")
    .replaceAll("{total}", money(total));
}
function sendReportToday(){
  const myWpp = state.settings.studioWpp;
  if(!myWpp){
    alert("Defina seu WhatsApp em Config.");
    setRoute("config");
    return;
  }
  window.open(waLink(myWpp, reportTodayText()), "_blank");
}

function renderWppQueue(){
  const box = byId("wppQueue");
  if(!box) return;

  const q = state.wppQueue || [];
  if(!q.length){
    box.innerHTML = `<div class="hint">Sem mensagens na fila.</div>`;
    return;
  }

  box.innerHTML = q.map((m,i)=>`
    <div style="display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-bottom:1px solid #eee;">
      <div style="flex:1;">
        <div style="font-weight:900;">${m.type}</div>
        <div style="font-size:12px; opacity:.8;">Para: ${m.phone || "(sem número)"}</div>
        <pre>${m.text}</pre>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn" data-send="${i}" ${m.phone ? "" : "disabled"}>Enviar</button>
        <button class="btn btn--ghost" data-del="${i}">Remover</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-send]").forEach(btn=>{
    btn.onclick = ()=>{
      const idx = Number(btn.dataset.send);
      const m = state.wppQueue[idx];
      if(!m?.phone){
        alert("Sem WhatsApp. Preencha em Clientes.");
        return;
      }
      window.open(waLink(m.phone, m.text), "_blank");
    };
  });

  box.querySelectorAll("[data-del]").forEach(btn=>{
    btn.onclick = ()=>{
      if(!confirmDel("esta mensagem da fila")) return;
      const idx = Number(btn.dataset.del);
      state.wppQueue.splice(idx,1);
      saveSoft();
      renderWppQueue();
    };
  });
}

function bindWppUI(){
  const hL = byId("wppHoraLembrete");
  const hR = byId("wppHoraRelatorio");
  const tC = byId("tplConfirmacao");
  const tL = byId("tplLembrete");
  const tA = byId("tplAgradecimento");
  const tRel = byId("tplRelatorio");

  if(hL) hL.value = state.wpp.horaLembrete || "09:00";
  if(hR) hR.value = state.wpp.horaRelatorio || "20:00";
  if(tC) tC.value = state.wpp.tplConfirmacao || "";
  if(tL) tL.value = state.wpp.tplLembrete || "";
  if(tA) tA.value = state.wpp.tplAgradecimento || "";
  if(tRel) tRel.value = state.wpp.tplRelatorio || "";

  onClick("btnSaveWpp", ()=>{
    state.wpp.horaLembrete = hL?.value || "09:00";
    state.wpp.horaRelatorio = hR?.value || "20:00";
    state.wpp.tplConfirmacao = tC?.value ?? state.wpp.tplConfirmacao;
    state.wpp.tplLembrete = tL?.value ?? state.wpp.tplLembrete;
    state.wpp.tplAgradecimento = tA?.value ?? state.wpp.tplAgradecimento;
    state.wpp.tplRelatorio = tRel?.value ?? state.wpp.tplRelatorio;
    saveSoft();
    alert("WhatsApp salvo ✅");
    renderWppQueue();
  });

  onClick("btnQueueTomorrow", ()=>{
    const tomorrow = addDaysISO(todayISO(), 1);
    const itens = state.agenda
      .filter(a => a.data === tomorrow && (a.status||"Agendado") !== "Cancelado")
      .sort((x,y)=> (x.hora||"").localeCompare(y.hora||""));

    state.wppQueue = itens
      .map(a=>{
        const phone = clientWpp(a.cliente);
        const txt = fillTpl(state.wpp.tplLembrete, a);
        return { id:uid(), type:`Lembrete (amanhã ${fmtBRDate(tomorrow)})`, phone, text: txt };
      })
      .filter(m => m.phone);

    saveSoft();
    setRoute("whatsapp");
    renderWppQueue();
  });

  onClick("btnSendReport", ()=> sendReportToday());
}

/* =================== CONFIG =================== */
function bindConfigUI(){
  const elNome = byId("cfgStudioNome");
  const elLogo = byId("cfgLogoUrl");
  const elP = byId("cfgCorPrimaria");
  const elA = byId("cfgCorAcento");
  const elW = byId("cfgStudioWpp");

  if(elNome) elNome.value = state.settings.studioNome || "Studio Jaqueline Mendanha";
  if(elLogo) elLogo.value = state.settings.logoUrl || "";
  if(elP) elP.value = state.settings.corPrimaria || "#7B2CBF";
  if(elA) elA.value = state.settings.corAcento || "#F72585";
  if(elW) elW.value = state.settings.studioWpp || "";

  onClick("btnSaveConfig", ()=>{
    state.settings.studioNome = elNome?.value.trim() || "Studio Jaqueline Mendanha";
    state.settings.logoUrl = elLogo?.value.trim() || "";
    state.settings.corPrimaria = elP?.value || "#7B2CBF";
    state.settings.corAcento = elA?.value || "#F72585";
    state.settings.studioWpp = elW?.value.trim() || "";
    saveSoft();
    applyTheme();
    alert("Config salva ✅");
    scheduleSync();
  });
}

/* =================== BOOT =================== */
function boot(){
  try{
    enforceAgendaRecebidoRules();
    syncAgendaToAtendimentos();
    state.materiais.forEach(calcularMaterial);
    state.atendimentos.forEach(calcularAtendimento);

    renderAllHard();
    scheduleSync();
  }catch(e){
    console.error("BOOT ERROR:", e);
    alert("Erro ao iniciar o app. Abra o console (F12) e me mande o erro.");
  }
}
boot();

// ✅ se o firebase já estiver pronto, força um push inicial
setTimeout(() => {
  if (typeof window.__SJM_PUSH_TO_CLOUD === "function") {
    try { window.__SJM_PUSH_TO_CLOUD(state); } catch {}
  }
}, 800);

/* =================== PWA: service worker =================== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}
