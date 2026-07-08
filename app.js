/* Studio Jaqueline Mendanha — Gestão Completa (SYNC PRO / FIXED v17)
  - Blindado contra tela branca (elementos ausentes não quebram)
  - Sincronização total (derived + UI)
  - Regra do estúdio: Realizado => Recebido = preço do procedimento (sempre)
  - Agenda cria/remove Atendimentos automaticamente
  - Status "Bloqueio" (Folga/Compromisso) não cria atendimento e não tem valor
  - Clientes: N° do molde (substitui Saúde/Medicamentos)
  - ✅ FIX: não perder foco ao digitar (anti-eco do Firebase + remoto pendente)
*/

const APP_BUILD = "Studio Sync Pro — Limpa Estável 1.0";
window.__SJM_APP_LOADED = true;

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

const saveSoftDebounced = debounce(()=> saveSoft(), 250);
const scheduleSyncDebounced = debounce(()=> scheduleSync(), 350);

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
  { id:"clientes", label:"Clientes" },
  { id:"crm", label:"CRM" },
  { id:"procedimentos", label:"Procedimentos" },
  { id:"materiais", label:"Materiais" },
  { id:"despesas", label:"Despesas" },
  { id:"fidelidade", label:"Fidelidade" },
  { id:"autoagendamento", label:"Autoagendamento" },
  { id:"config", label:"Configuração" },
  { id:"desenvolvedor", label:"Dev" },
];

const PLAN_LABELS = {
  basic: "Básico",
  pro: "Pro",
  premium: "Premium",
  developer: "Desenvolvedor"
};

const PLAN_FEATURES = {
  basic: ["calendario", "agenda", "whatsapp", "procedimentos", "clientes", "config"],
  pro: ["dashboard", "calendario", "agenda", "whatsapp", "crm", "procedimentos", "clientes", "materiais", "despesas", "config"],
  premium: ["dashboard", "calendario", "agenda", "whatsapp", "crm", "procedimentos", "clientes", "materiais", "despesas", "config", "fidelidade", "fotos", "clienteApp", "equipe", "cupons", "export"],
  developer: ["dashboard", "calendario", "agenda", "whatsapp", "crm", "procedimentos", "clientes", "materiais", "despesas", "config", "desenvolvedor", "fidelidade", "fotos", "clienteApp", "equipe", "cupons", "export", "suporte", "dev"]
};

function getCurrentPlan(){
  if(window.__SJM_IS_DEVELOPER === true) return "developer";
  const plan = String(state?.settings?.plano || "premium").toLowerCase();
  return PLAN_FEATURES[plan] ? plan : "premium";
}
function canAccessRoute(route){
  const r = String(route || "").toLowerCase();
  const plan = getCurrentPlan();
  return (PLAN_FEATURES[plan] || PLAN_FEATURES.premium).includes(r);
}
function planNeededForRoute(route){
  const r = String(route || "").toLowerCase();
  if(PLAN_FEATURES.basic.includes(r)) return "basic";
  if(PLAN_FEATURES.pro.includes(r)) return "pro";
  return "premium";
}
function planUpgradeMessage(route){
  const needed = planNeededForRoute(route);
  return `Recurso disponível no Plano ${PLAN_LABELS[needed] || needed}.`;
}
function canUseFeature(feature){
  const f = String(feature || "").toLowerCase();
  const plan = getCurrentPlan();
  return (PLAN_FEATURES[plan] || []).includes(f);
}
function requireFeature(feature){
  if(canUseFeature(feature)) return true;
  const needed = planNeededForRoute(feature);
  alert(`Recurso disponível no Plano ${PLAN_LABELS[needed] || needed}.`);
  return false;
}
function applyPlanUI(){
  const plan = getCurrentPlan();
  safeText("currentPlanBadge", `Plano ${PLAN_LABELS[plan] || plan}`);

  $$(".tab").forEach(btn=>{
    const route = String(btn.dataset.tab || "").toLowerCase();
    const locked = !canAccessRoute(route);
    btn.classList.toggle("locked", locked);
    btn.title = locked ? planUpgradeMessage(route) : "";
  });

  $$("[data-feature]").forEach(el=>{
    const feature = String(el.dataset.feature || "").toLowerCase();
    const locked = !(PLAN_FEATURES[plan] || []).includes(feature);
    el.classList.toggle("featureLocked", locked);
  });
}


const PLAN_PRICES = {
  basic: "R$ 29,90/mês",
  pro: "R$ 59,90/mês",
  premium: "R$ 99,90/mês",
  developer: "Acesso interno"
};

const PLAN_DESCRIPTIONS = {
  basic: ["Agenda e calendário", "Cadastro de clientes", "Procedimentos", "WhatsApp manual", "Backup"],
  pro: ["Tudo do Básico", "Dashboard financeiro", "CRM e remarketing", "Materiais", "Despesas", "Relatórios"],
  premium: ["Tudo do Pro", "Fotos por cliente", "Mensagens avançadas", "Fidelidade", "Exportar PDF e Excel"],
  developer: ["Acesso total", "Suporte às profissionais", "Diagnóstico", "Controle de planos", "Ferramentas para futuras melhorias"]
};

function renderPlanCards(){
  const box = byId("planCards");
  if(!box) return;
  const current = getCurrentPlan();
  const plans = ["basic", "pro", "premium"];
  if(window.__SJM_IS_DEVELOPER === true || String(state?.settings?.plano||"").toLowerCase()==="developer") plans.push("developer");
  box.innerHTML = plans.map(plan => {
    const active = current === plan;
    const features = (PLAN_DESCRIPTIONS[plan] || []).map(x=>`<li>${x}</li>`).join("");
    const btn = active ? `<button class="btn btn--ghost" disabled>Plano atual</button>` : `<button class="btn" data-change-plan="${plan}">Mudar para este plano</button>`;
    return `<div class="planCard ${active ? "active" : ""}">
      <div class="planCard__top"><b>${PLAN_LABELS[plan]}</b><span>${PLAN_PRICES[plan]}</span></div>
      <ul>${features}</ul>
      ${btn}
    </div>`;
  }).join("");
}

function openPlanModal(){
  renderPlanCards();
  const m = byId("planModal");
  if(m) m.hidden = false;
}
function closePlanModal(){
  const m = byId("planModal");
  if(m) m.hidden = true;
}
function changePlan(plan){
  if(!PLAN_FEATURES[plan]) return;
  const old = state.settings.plano || "premium";
  state.settings.plano = plan;
  saveSoft();
  applyPlanUI();
  renderPlanCards();
  safeValue("cfgPlano", plan);
  scheduleSync();
  alert(`Plano alterado de ${PLAN_LABELS[old] || old} para ${PLAN_LABELS[plan] || plan}.\n\nNenhum dado foi apagado. Clientes, agenda, fotos e financeiro continuam salvos.`);
}

function bindPlanModal(){
  const badge = byId("currentPlanBadge");
  if(badge){ badge.style.cursor = "pointer"; badge.title = "Ver planos"; badge.onclick = openPlanModal; }
  onClick("btnOpenPlans", openPlanModal);
  onClick("btnClosePlanModal", closePlanModal);
  document.addEventListener("click", (e)=>{
    const btn = e.target?.closest?.("[data-change-plan]");
    if(!btn) return;
    changePlan(btn.dataset.changePlan);
  });
}

const KEY = "sjm_sync_pro_v1";
let ACTIVE_STORAGE_KEY = KEY;
function safeStorageId(v){ return String(v||"default").trim().toLowerCase().replace(/[^a-z0-9._-]+/g,"_").slice(0,90) || "default"; }
function storageKeyForUser(user){
  const id = user?.uid || user?.email || user;
  return `${KEY}__user__${safeStorageId(id)}`;
}

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

/* =================== PROCEDIMENTOS ESPECIAIS DO SISTEMA =================== */
/* Médico/Folga/Compromisso/Reunião ocupam horário, mas não entram em CRM,
   faturamento, clientes atendidas, ticket médio, DRE nem estatísticas. */
const SPECIAL_PROC_NAMES = ["MÉDICO", "MEDICO", "FOLGA", "COMPROMISSO", "REUNIÃO", "REUNIAO"];

function normalizeProcName(nome){
  return String(nome || "").trim().toUpperCase();
}

function isSpecialProcedure(nome){
  return SPECIAL_PROC_NAMES.includes(normalizeProcName(nome));
}

function specialProceduresDefault(){
  return [
    { id: uid(), nome:"Médico", preco:0, reajuste:"", duracaoMin:60, categoria:"Sistema", especial:true, ativo:"S" },
    { id: uid(), nome:"Folga", preco:0, reajuste:"", duracaoMin:60, categoria:"Sistema", especial:true, ativo:"S" },
    { id: uid(), nome:"Compromisso", preco:0, reajuste:"", duracaoMin:60, categoria:"Sistema", especial:true, ativo:"S" },
    { id: uid(), nome:"Reunião", preco:0, reajuste:"", duracaoMin:60, categoria:"Sistema", especial:true, ativo:"S" },
  ];
}

function ensureSpecialProcedures(targetState = state){
  if(!targetState || !Array.isArray(targetState.procedimentos)) return;
  const exists = (nome)=> targetState.procedimentos.some(p => normalizeProcName(p?.nome) === normalizeProcName(nome));
  specialProceduresDefault().forEach((sp)=>{
    if(!exists(sp.nome)) targetState.procedimentos.push(sp);
  });
  targetState.procedimentos.forEach((p)=>{
    if(isSpecialProcedure(p?.nome)){
      p.especial = true;
      p.categoria = p.categoria || "Sistema";
      p.preco = 0;
      p.precoBase = 0;
      p.reajuste = "";
      p.historico = [];
    }
  });
}


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
      studioWpp: "",
      plano: "premium"
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
      tplFotoProcedimento:
`Oi {cliente}! 💜
Seguem as fotos do seu procedimento realizado no {studio}.
💅 {procedimento} — {data}
Obrigada pela preferência! ✨`,
      tplFidelidade:
`Parabéns, {cliente}! 🎉
Você ganhou mais um selo no cartão fidelidade do {studio}.
Continue fazendo suas manutenções para completar seu cartão. 💜`,
      tplAniversario:
`Feliz aniversário, {cliente}! 🎂💜
O {studio} deseja um dia lindo para você.`,
      tplReativacao:
`Oi {cliente}! 💜 Faz um tempinho que você não vem ao {studio}.
Que tal agendarmos sua manutenção?`,
      tplRelatorio:
`📌 Relatório do dia {data} — {studio}

{lista}

Total recebido: {total}`
    },
    procedimentos: [
      ...specialProceduresDefault(),
    ],

    clientes: [],
    agenda: [],
    materiais: [],
    atendimentos: [],
    despesas: [],
    receitasExtras: [],
    wppQueue: [],

    // ✅ CRM / Remarketing
    crm: {
      tplRemarketing:
`Oi {cliente}! 💜 Faz {dias} dias desde seu último atendimento no {studio}.
Que tal agendarmos sua manutenção? 😊`,
      filtro: "ALL",
      busca: ""
    },
    crmQueue: []
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
  if(!PLAN_FEATURES[String(s.settings.plano || "").toLowerCase()]) s.settings.plano = "premium";
  s.wpp = { ...base.wpp, ...(s.wpp && typeof s.wpp==="object" ? s.wpp : {}) };
  if(!s.wpp.tplFotoProcedimento) s.wpp.tplFotoProcedimento = base.wpp.tplFotoProcedimento;
  if(!s.wpp.tplFidelidade) s.wpp.tplFidelidade = base.wpp.tplFidelidade;
  if(!s.wpp.tplAniversario) s.wpp.tplAniversario = base.wpp.tplAniversario;
  if(!s.wpp.tplReativacao) s.wpp.tplReativacao = base.wpp.tplReativacao;
  s.crm = { ...base.crm, ...(s.crm && typeof s.crm==="object" ? s.crm : {}) };

  const arr = (v)=> Array.isArray(v) ? v : [];
  s.procedimentos = arr(s.procedimentos);
  s.procedimentos.forEach(p=>{
    if(p && typeof p==="object"){
      if(p.id === undefined) p.id = uid();
      if(p.nome === undefined) p.nome = "";
      if(p.preco === undefined) p.preco = 0;
      if(p.reajuste === undefined) p.reajuste = "";
      if(p.duracaoMin === undefined) p.duracaoMin = 60;
      if(p.categoria === undefined) p.categoria = "Geral";
      if(p.ativo === undefined) p.ativo = "S";
      if(p.garantiaDias === undefined) p.garantiaDias = 0;
      if(p.retornoDias === undefined) p.retornoDias = 0;
      if(!Array.isArray(p.historico)) p.historico = [];
      if(p.precoBase === undefined) p.precoBase = num(p.preco);
      p.historico = p.historico
        .filter(h => h && typeof h === "object")
        .map(h => ({
          dataInicio: String(h.dataInicio || "").slice(0,10),
          valor: num(h.valor)
        }))
        .filter(h => h.dataInicio);
      p.historico.sort((a,b)=> a.dataInicio.localeCompare(b.dataInicio));
      if(p.historico.length){
        p.preco = num(p.historico[p.historico.length-1].valor);
        p.reajuste = p.historico[p.historico.length-1].dataInicio;
      }
    }
  });
  ensureSpecialProcedures(s);
  s.clientes = arr(s.clientes);
  s.agenda = arr(s.agenda);
  s.materiais = arr(s.materiais);
  s.atendimentos = arr(s.atendimentos);
  s.despesas = arr(s.despesas);
  s.receitasExtras = arr(s.receitasExtras);
  s.wppQueue = arr(s.wppQueue);
  s.crmQueue = arr(s.crmQueue);

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
      if(a.procedimento === undefined) a.procedimento = (s.procedimentos?.[0]?.nome || "Compromisso");
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
      if(!Array.isArray(c.fotos)) c.fotos = [];
      c.fotos = c.fotos.filter(f => f && typeof f === "object").map(f => ({
        id: f.id || uid(),
        atendimentoId: f.atendimentoId || "",
        data: String(f.data || todayISO()).slice(0,10),
        procedimento: f.procedimento || "",
        imagem: f.imagem || "",
        enviadoWhatsApp: !!f.enviadoWhatsApp,
        createdAt: typeof f.createdAt === "number" ? f.createdAt : Date.now()
      }));

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
      if(a.procedimento === undefined) a.procedimento = (s.procedimentos?.[0]?.nome || "Compromisso");
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
      if(m.nome === undefined && m.material !== undefined) m.nome = m.material;
      if(m.nome === undefined) m.nome = "";
      if(m.unidade === undefined) m.unidade = "ml";

      // Novo modelo de cálculo:
      // qtdPorUnidade = quantos ml/g/kg/un vem em cada embalagem/unidade comprada
      // valorUnidade = quanto custou cada embalagem/unidade
      // unidadesCompradas = quantas embalagens/unidades foram compradas
      // qtdCliente = quanto usa em cada atendimento
      if(m.qtdPorUnidade === undefined) m.qtdPorUnidade = num(m.qtdTotal);
      if(m.valorUnidade === undefined) m.valorUnidade = num(m.valorCompra);
      if(m.unidadesCompradas === undefined) m.unidadesCompradas = (m.qtdComprada !== undefined) ? num(m.qtdComprada) : 1;
      if(m.qtdCliente === undefined) m.qtdCliente = 0;

      if(m.qtdTotal === undefined) m.qtdTotal = 0;
      if(m.valorCompra === undefined) m.valorCompra = 0;
      if(m.custoUnit === undefined) m.custoUnit = 0;
      if(m.custoCliente === undefined) m.custoCliente = 0;
      if(m.rendimento === undefined) m.rendimento = 0;
      if(m.estoqueMin === undefined) m.estoqueMin = 0;
      if(m.fornecedor === undefined) m.fornecedor = "";
      if(m.validade === undefined) m.validade = "";
      calcularMaterial(m);
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

  // migração: receitas extras
  s.receitasExtras.forEach(r=>{
    if(r && typeof r==="object"){
      if(r.id === undefined) r.id = uid();
      if(r.data === undefined) r.data = todayISO();
      if(r.descricao === undefined) r.descricao = "";
      if(r.valor === undefined) r.valor = 0;
    }
  });

  return s;
}

function load(){
  // ✅ v66: carregamento compatível com versões antigas.
  // Procura a base com mais dados em todas as chaves locais do Studio Sync Pro.
  // Isso evita perder clientes/agenda/materiais ao trocar a pasta/versão antes do Firebase.
  function scoreLocalState(s){
    try{
      if(!s || typeof s !== "object") return -1;
      return (Array.isArray(s.procedimentos)?s.procedimentos.length:0)
        + (Array.isArray(s.agenda)?s.agenda.length:0)
        + (Array.isArray(s.clientes)?s.clientes.length:0)
        + (Array.isArray(s.atendimentos)?s.atendimentos.length:0)
        + (Array.isArray(s.materiais)?s.materiais.length:0)
        + (Array.isArray(s.despesas)?s.despesas.length:0)
        + (Array.isArray(s.receitasExtras)?s.receitasExtras.length:0)
        + (Array.isArray(s.wppQueue)?s.wppQueue.length:0)
        + (Array.isArray(s.crmQueue)?s.crmQueue.length:0);
    }catch{ return -1; }
  }
  function timeLocalState(s){
    try{ return Number(s?.meta?.updatedAt || 0); }catch{ return 0; }
  }

  const candidates = [];
  try{
    const direct = localStorage.getItem(ACTIVE_STORAGE_KEY);
    if(direct) candidates.push(JSON.parse(direct));
  }catch{}
  try{
    const legacy = localStorage.getItem(KEY);
    if(legacy) candidates.push(JSON.parse(legacy));
  }catch{}

  try{
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(!k) continue;
      if(k === CLIENT_ID_KEY) continue;
      if(k === ACTIVE_STORAGE_KEY || k === KEY || k.startsWith(KEY + "__user__") || k.includes("sjm_sync_pro")){
        const raw = localStorage.getItem(k);
        if(raw && raw.trim().startsWith("{")){
          candidates.push(JSON.parse(raw));
        }
      }
    }
  }catch{}

  let best = null;
  let bestScore = -1;
  let bestTime = -1;
  for(const c of candidates){
    const s = sanitizeState(c);
    const sc = scoreLocalState(s);
    const tm = timeLocalState(s);
    if(sc > bestScore || (sc === bestScore && tm > bestTime)){
      best = s;
      bestScore = sc;
      bestTime = tm;
    }
  }

  if(best){
    try{ localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(best)); }catch{}
    try{ localStorage.setItem(KEY, JSON.stringify(best)); }catch{}
    return sanitizeState(best);
  }

  return defaultState();
}

let state = load();
ensureMeta(state);

function stateDataScore(s){
  try{
    if(!s || typeof s !== "object") return 0;
    return (Array.isArray(s.procedimentos)?s.procedimentos.length:0)
      + (Array.isArray(s.agenda)?s.agenda.length:0)
      + (Array.isArray(s.clientes)?s.clientes.length:0)
      + (Array.isArray(s.atendimentos)?s.atendimentos.length:0)
      + (Array.isArray(s.materiais)?s.materiais.length:0)
      + (Array.isArray(s.despesas)?s.despesas.length:0)
      + (Array.isArray(s.receitasExtras)?s.receitasExtras.length:0)
      + (Array.isArray(s.wppQueue)?s.wppQueue.length:0)
      + (Array.isArray(s.crmQueue)?s.crmQueue.length:0);
  }catch{ return 0; }
}
function stateFreshness(s){
  try{
    const t = Number(s?.meta?.updatedAt || 0);
    return Number.isFinite(t) ? t : 0;
  }catch{ return 0; }
}
function chooseBestState(candidates){
  let best = null;
  let bestScore = -1;
  let bestTime = -1;
  for(const c of candidates){
    if(!c) continue;
    const score = stateDataScore(c);
    const time = stateFreshness(c);
    if(score > bestScore || (score === bestScore && time > bestTime)){
      best = c;
      bestScore = score;
      bestTime = time;
    }
  }
  return best;
}

window.__SJM_ON_AUTH_USER = (userInfo)=>{
  try{
    const newKey = storageKeyForUser(userInfo);

    const currentState = sanitizeState(state);
    const currentScore = stateDataScore(currentState);

    let legacyState = null;
    let legacyScore = 0;
    try{
      const legacyRaw = localStorage.getItem(KEY);
      if(legacyRaw){
        legacyState = sanitizeState(JSON.parse(legacyRaw));
        legacyScore = stateDataScore(legacyState);
      }
    }catch{}

    let userState = null;
    let userScore = 0;
    try{
      const userRaw = localStorage.getItem(newKey);
      if(userRaw){
        userState = sanitizeState(JSON.parse(userRaw));
        userScore = stateDataScore(userState);
      }
    }catch{}

    // ✅ Correção v37: escolhe a base mais completa; se empatar, usa a mais recente.
    // Isso preserva dados e também alterações simples, como horário do WhatsApp.
    let chosen = chooseBestState([userState, currentState, legacyState]);
    if(!chosen) chosen = defaultState();

    ACTIVE_STORAGE_KEY = newKey;
    state = sanitizeState(chosen);
    ensureMeta(state);

    // Salva também na chave do usuário e mantém uma cópia de segurança local.
    try{ localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state)); }catch{}
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch{}

    applyTheme();
    renderAllHard();
    scheduleCloudPush();
    window.__SJM_SET_SYNC_STATUS?.("Sync: usuário carregado ✅");
  }catch(e){
    console.error("Falha ao carregar dados do usuário:", e);
    window.__SJM_SET_SYNC_STATUS?.("Sync: erro ao carregar usuário ❌");
  }
};

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
    localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
    // ✅ cópia de segurança local para não perder dados se o usuário/troca de login falhar
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

  const incomingScore = stateDataScore(incoming);
  const localScore = stateDataScore(state);
  const incomingTime = stateFreshness(incoming);
  const localTime = stateFreshness(state);

  // Proteção do autoagendamento: logo após receber pedido público, não deixar
  // um snapshot remoto antigo apagar o agendamento recém-inserido.
  try{
    const recentPublic = Date.now() - Number(window.__SJM_LAST_PUBLIC_BOOKING_AT||0) < 15000;
    if(recentPublic){
      const localReqs = new Set((state.agenda||[]).map(a=>String(a.publicRequestId||'')).filter(Boolean));
      const incomingReqs = new Set((incoming.agenda||[]).map(a=>String(a.publicRequestId||'')).filter(Boolean));
      for(const rid of localReqs){
        if(!incomingReqs.has(rid)){
          window.__SJM_SET_SYNC_STATUS('Sync: remoto antigo ignorado após autoagendamento ✅');
          scheduleCloudPush();
          return;
        }
      }
    }
  }catch(e){}

  // Proteção forte: remoto mais vazio ou mais antigo não apaga dados/configurações locais.
  if(incomingScore < localScore || (incomingScore === localScore && incomingTime < localTime)){
    window.__SJM_SET_SYNC_STATUS("Sync: remoto antigo ignorado ✅");
    scheduleCloudPush();
    return;
  }

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
    localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
    // ✅ cópia de segurança local para não perder dados se o usuário/troca de login falhar
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
  safeText("buildInfo", "");

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

  tabs.innerHTML = ROUTES.map(r => `<button class="tab" data-tab="${r.id}">${r.label}<span class="lockMark"> 🔒</span></button>`).join("");
  applyPlanUI();

  tabs.addEventListener("click", (e)=>{
    const btn = e.target.closest(".tab");
    if(!btn) return;
    setRoute(btn.dataset.tab);
  });

  function setRoute(route){
    let r = String(route||"").toLowerCase();
    if(/^agendar(\/|$)/i.test(r)){
      history.replaceState({}, "", `#${r}`);
      return;
    }
    if(!canAccessRoute(r)){
      alert(planUpgradeMessage(r));
      r = canAccessRoute("dashboard") ? "dashboard" : "agenda";
    }
    $$(".tab").forEach(t => t.classList.toggle("active", String(t.dataset.tab||"").toLowerCase()===r));
    $$(".panel").forEach(p => p.classList.toggle("active", String(p.dataset.route||"").toLowerCase()===r));
    history.replaceState({}, "", `#${r}`);
    applyPlanUI();
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

/* Importação de backup: fluxo único no patch LIMPEZA FINAL. */

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
function procPrice(nome, data=null){
  if(isSpecialProcedure(nome)) return 0;
  const p = state.procedimentos.find(x => x.nome === nome);
  if(!p) return 0;

  const historico = Array.isArray(p.historico) ? [...p.historico] : [];
  historico.sort((a,b)=> String(a.dataInicio||"").localeCompare(String(b.dataInicio||"")));

  if(!data){
    if(historico.length) return num(historico[historico.length-1].valor);
    return num(p.preco);
  }

  let valor = (p.precoBase !== undefined) ? num(p.precoBase) : num(p.preco);
  for(const h of historico){
    if(String(h.dataInicio||"") && h.dataInicio <= data){
      valor = num(h.valor);
    }
  }
  return num(valor);
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

  const stA = (a.status || "Agendado");
  if(stA === "Cancelado" || stA === "Remarcado") return false;
  if(stA === "Bloqueio") return false;

  const inicioA = new Date(`${a.data}T${a.hora}`);
  if(Number.isNaN(inicioA.getTime())) return false;

  const durA = Math.max(1, Number(procDuracao(a.procedimento)) || 60);
  const fimA = new Date(inicioA.getTime() + durA * 60000);

  return state.agenda.some((b, i) => {
    if(i === index) return false;
    if(a.id && b?.id && a.id === b.id) return false;

    const stB = (b?.status || "Agendado");
    if(stB === "Cancelado" || stB === "Remarcado") return false;
    if(stB === "Bloqueio") return false;
    if(b.data !== a.data) return false;
    if(!b.hora) return false;

    const inicioB = new Date(`${b.data}T${b.hora}`);
    if(Number.isNaN(inicioB.getTime())) return false;

    const durB = Math.max(1, Number(procDuracao(b.procedimento)) || 60);
    const fimB = new Date(inicioB.getTime() + durB * 60000);

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

    if(isSpecialProcedure(ag.procedimento)){
      ag.recebido = 0;
      return;
    }

    if(status === "Realizado"){
      ag.recebido = procPrice(ag.procedimento, ag.data);
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
  const valor = money(procPrice(a.procedimento, a.data));
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
  // Modelo correto:
  // Ex.: Gel com 15 ml por pote, R$70 por pote, 2 potes comprados,
  // usa 2 ml por cliente.
  // Custo por ml = 70 / 15 = 4,6667
  // Custo por cliente = 4,6667 * 2 = 9,3334
  // Total comprado = 15 * 2 = 30 ml
  if(!m || typeof m !== "object") return;

  // Migração segura dos nomes antigos.
  if(m.qtdPorUnidade === undefined) m.qtdPorUnidade = (m.conteudoUnidade !== undefined) ? num(m.conteudoUnidade) : num(m.qtdTotal);
  if(m.valorUnidade === undefined) m.valorUnidade = num(m.valorCompra);
  if(m.unidadesCompradas === undefined) m.unidadesCompradas = (m.qtdComprada !== undefined) ? num(m.qtdComprada) : 1;
  if(m.qtdCliente === undefined) m.qtdCliente = 0;
  if(!m.unidade) m.unidade = "ml";

  const qtdPorUnidade = num(m.qtdPorUnidade);
  const valorUnidade = num(m.valorUnidade);
  const unidadesCompradas = Math.max(0, num(m.unidadesCompradas));
  const qtdCliente = num(m.qtdCliente);

  m.qtdTotal = qtdPorUnidade * unidadesCompradas;
  m.valorCompra = valorUnidade * unidadesCompradas;
  m.custoUnit = (qtdPorUnidade > 0) ? (valorUnidade / qtdPorUnidade) : 0;
  m.custoCliente = m.custoUnit * qtdCliente;
  m.rendimento = (qtdCliente > 0) ? (m.qtdTotal / qtdCliente) : 0;
}
function custoMateriaisPorCliente(){
  return state.materiais.reduce((s,m)=>{
    calcularMaterial(m);
    return s + (num(m.custoCliente)||0);
  }, 0);
}

/* =================== CRM (Atendimentos) — DERIVED =================== */
function calcularAtendimento(a){
  if(isSpecialProcedure(a.procedimento)){
    a.valor = 0;
    a.recebido = 0;
    a.custoMaterial = 0;
    a.custoTotal = 0;
    a.lucro = 0;
    return;
  }
  a.valor = procPrice(a.procedimento, a.data);
  a.custoMaterial = custoMateriaisPorCliente();
  a.custoTotal = num(a.custoMaterial) + num(a.maoObra);
  a.lucro = num(a.recebido) - num(a.custoTotal);
}

/* =================== AGENDA -> CRM (Atendimentos) =================== */
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
      valor: procPrice(ag.procedimento, ag.data),
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

    if(isSpecialProcedure(ag.procedimento)){
      ag.recebido = 0;
      removeAtendimentoFromAgenda(ag.id);
      return;
    }

    if(status === "Realizado"){
      ag.recebido = procPrice(ag.procedimento, ag.data);

      const at = ensureAtendimentoFromAgenda(ag);
      at.data = ag.data || at.data;
      at.cliente = ag.cliente || at.cliente;
      at.procedimento = ag.procedimento || at.procedimento;
      at.valor = procPrice(at.procedimento, at.data);
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
    onlyMonthKey = null,
    despesasScope = "ALL"
  } = opts;

  const atend = onlyMonthKey
    ? state.atendimentos.filter(a => monthKey(a.data) === onlyMonthKey)
    : state.atendimentos;

  const receitaAtend = atend.reduce((s,a)=> s + num(a.recebido), 0);

  const receitaExtras = (state.receitasExtras || [])
    .filter(r => !onlyMonthKey || monthKey(r.data) === onlyMonthKey)
    .reduce((s,r)=> s + num(r.valor), 0);

  const receita = receitaAtend + receitaExtras;
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
  for(const r of (state.receitasExtras || [])){
    const k = monthKey(r.data);
    if(!k) continue;
    map.set(k, (map.get(k)||0) + num(r.valor));
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

/* =================== ✅ CALENDÁRIO (COM BOTÕES) =================== */
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

// ✅ helper para criar "Novo agendamento" no dia selecionado
function calNewAtSelectedDay(){
  const iso = __CAL_SELECTED_ISO || todayISO();
  const firstProc = state.procedimentos.find(p=>p.nome && !p.especial)?.nome || state.procedimentos.find(p=>p.nome)?.nome || "Compromisso";
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

    const dayItems = agendaOfDay(iso);
    const times = dayItems.slice(0,3).map(a=>{
      const status = (a.status || "Agendado");
      const kindClass = status === "Bloqueio" ? "block" : (status === "Cancelado" ? "cancel" : (status === "Realizado" ? "done" : "book"));
      return `<span class="calTime ${kindClass}">${a.hora || "--:--"}</span>`;
    }).join("");

    const badgeAg = totalAg ? `<span class="calCount">${totalAg}x</span>` : "";
    const badgeRec = totalRec ? `<span class="calMoney">R$</span>` : "";
    const badgeConf = hasConflict ? `<span class="calConflict">!</span>` : "";

    cells.push(`
      <div class="calDay ${isOther?"isOther":""} ${isToday?"isToday":""} ${isSel?"isSelected":""}" data-iso="${iso}">
        <div class="calDayTop">
          <div class="calNum">${d.getDate()}</div>
          <div class="calBadges">${badgeAg}${badgeRec}${badgeConf}</div>
        </div>
        <div class="calMiniList">${times}</div>
      </div>
    `);
  }

  grid.innerHTML = cells.join("");

  grid.querySelectorAll(".calDay").forEach(el=>{
    el.addEventListener("click", ()=>{
      __CAL_SELECTED_ISO = el.dataset.iso;
      renderCalendar();
      renderCalendarDay();
      setTimeout(()=>{
        const dayBox = byId("calDayTitle");
        if(dayBox) dayBox.scrollIntoView({behavior:"smooth", block:"start"});
      }, 80);
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
    box.innerHTML = `
      <div class="hint">Sem agendamentos neste dia.</div>
      <div class="actions" style="margin-top:10px;">
        <button class="btn" data-cal-act="new">+ Novo agendamento</button>
      </div>
    `;
    box.querySelector('[data-cal-act="new"]')?.addEventListener('click', calNewAtSelectedDay);
    return;
  }

  box.innerHTML = itens.map((a)=>{
    const st = (a.status||"Agendado");
    const rec = num(a.recebido);
    const val = (st==="Bloqueio") ? 0 : procPrice(a.procedimento, a.data);

    const idx = state.agenda.findIndex(x=>x && x.id===a.id);
    const conflita = (idx >= 0) ? isConflictByDuration(idx) : false;

    const titulo = (st==="Bloqueio")
      ? `${a.hora || ""} — BLOQUEIO`
      : `${a.hora || ""} — ${(a.cliente||"").trim() || "Sem nome"}`;

    const isBlock = (st==="Bloqueio");

    // ✅ botões: Realizado / Cancelado / Editar (Agenda)
    const buttons = isBlock ? `` : `
      <div class="actions" style="margin-top:8px; gap:8px;">
        <button class="btn btn--ghost" data-cal-act="done" data-id="${a.id}">Realizado</button>
        <button class="btn btn--ghost" data-cal-act="cancel" data-id="${a.id}">Cancelado</button>
        <button class="btn btn--ghost" data-cal-act="edit" data-id="${a.id}">Editar</button>
      </div>
    `;

    return `
      <div class="calListItem ${conflita ? "danger" : ""}">
        <div class="calListHead">
          <b>${titulo}</b>
          <span class="calListMeta">${st}</span>
        </div>
        <div class="calListMeta">Procedimento: ${a.procedimento || "—"} • Valor: ${money(val)} • Recebido: ${money(rec)}</div>
        ${a.obs ? `<div class="calListMeta">Obs: ${String(a.obs)}</div>` : ``}
        ${buttons}
      </div>
    `;
  }).join("");

  // ✅ binds dos botões do dia
  box.querySelectorAll('[data-cal-act]').forEach((btn)=>{
    btn.addEventListener('click', ()=>{
      const act = btn.getAttribute('data-cal-act');
      if(act === 'new'){ calNewAtSelectedDay(); return; }

      const id = btn.getAttribute('data-id');
      const ag = state.agenda.find(x=>x && x.id===id);
      if(!ag) return;

      if(act === 'done'){
        window.handleCalendarRealizadoComFoto ? window.handleCalendarRealizadoComFoto(ag) : handleCalendarRealizadoComFoto(ag);
        return;
      }

      if(act === 'cancel'){
        ag.status = "Cancelado";
        ag.recebido = 0;
        removeAtendimentoFromAgenda(ag.id);
        saveSoft();
        renderAgendaHard();
        renderCalendar();
        scheduleSync();
        return;
      }

      if(act === 'edit'){
        openAgendaEditorById(ag.id);
        return;
      }
    });
  });
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
  onClick("calNew", calNewAtSelectedDay);
}

function updateCalendarAuto(){
  renderCalendar();
}


// ✅ Calendário: ao clicar em Realizado, abre câmera/galeria, salva foto e abre WhatsApp
function handleCalendarRealizadoComFoto(ag){
  if(!ag) return;

  ag.status = "Realizado";
  ag.recebido = isSpecialProcedure(ag.procedimento) ? 0 : procPrice(ag.procedimento, ag.data);
  saveSoft();
  renderAgendaHard();
  renderCalendar();
  scheduleSync();

  if(isSpecialProcedure(ag.procedimento)){
    alert('Compromisso marcado como realizado ✅');
    return;
  }

  if(!canUseFeature('fotos')){
    alert('Atendimento marcado como realizado ✅');
    return;
  }

  const ask = confirm('Atendimento marcado como realizado ✅\n\nDeseja tirar ou carregar uma foto do procedimento agora?');
  if(!ask) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.top = '-9999px';
  input.style.opacity = '0';
  document.body.appendChild(input);

  input.addEventListener('change', async ()=>{
    try{
      const file = input.files && input.files[0];
      if(!file){ input.remove(); return; }

      if(file.size > 2_500_000){
        alert('Foto muito pesada. Tente uma menor, até aproximadamente 2,5 MB.');
        input.remove();
        return;
      }

      const b64 = await new Promise((resolve, reject)=>{
        const r = new FileReader();
        r.onload = ()=> resolve(String(r.result || ''));
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      saveAgendaProcedurePhoto(ag, b64);
      saveSoft();
      renderAgendaHard();
      renderCalendar();
      renderClientes();
      renderClientPhotoPanel();
      renderAtendimentosHard();
      scheduleSync();

      const at = getAtendimentoByAgendaId(ag.id) || ag;
      const txt = gratitudeMsgForAtendimento(at);
      const phone = clientWpp(ag.cliente);

      if(phone){
        await copyToClipboardSafe(txt);
        alert('Foto salva na pasta da cliente ✅\n\nA mensagem foi copiada. O WhatsApp será aberto para enviar à cliente.');
        window.open(waLink(phone, txt), '_blank');
      }else{
        alert('Foto salva na pasta da cliente ✅\n\nCliente sem WhatsApp cadastrado. Preencha o WhatsApp na aba Clientes para enviar.');
      }
    }catch(err){
      console.error(err);
      alert('Não consegui salvar a foto. Tente novamente.');
    }finally{
      try{ input.remove(); }catch{}
    }
  }, { once:true });

  input.click();
}

/* =================== SYNC ENGINE =================== */
function syncDerivedAndUI(){
  ensureSpecialProcedures();
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
    if(typeof renderCRM === "function") renderCRM();

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
    renderClientPhotoPanel();
    renderAgendaHard();
    renderMateriaisHard();
    renderAtendimentosHard();
    renderDespesas();
    bindWppUI();
    bindConfigUI();
    renderDashboard();
    renderWppQueue();
    bindCRMUI();
    renderCRM();

    bindCalendarUI();
    renderCalendar();
    renderAtendimentosHard();
    applyPlanUI();
  });
}

/* =================== AGENDA =================== */
function getAgendaTbody(){ return $("#tblAgenda tbody"); }
function getAgendaNotice(){ return byId("agendaNotice"); }

function setAgendaViewMode(mode){
  window.__agendaViewMode = mode === "list" ? "list" : "form";
  const form = byId("agendaFormPanel");
  const list = byId("agendaListPanel");
  if(form) form.hidden = window.__agendaViewMode !== "form";
  if(list) list.hidden = window.__agendaViewMode !== "list";
}

onClick("btnAddAgenda", ()=>{
  const firstProc = state.procedimentos.find(p=>p.nome && !p.especial)?.nome || state.procedimentos.find(p=>p.nome)?.nome || "Compromisso";
  const novo = {
    id:uid(),
    data: todayISO(),
    hora: "08:00",
    cliente:"",
    procedimento:firstProc,
    status:"Agendado",
    recebido: 0,
    obs:"",
    atendId:""
  };
  state.agenda.unshift(novo);
  window.__agendaSelectedId = novo.id;
  setAgendaViewMode("form");
  saveSoft();
  renderAgendaHard();
  scheduleSync();
});

onClick("btnAgendaTodos", ()=>{
  setAgendaViewMode("list");
  renderAgendaCompact();
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
  const stA = (a.status || "Agendado");
  if(stA === "Cancelado" || stA === "Remarcado" || stA === "Bloqueio") return false;
  const key = `${a.data}|${a.hora}`;
  return state.agenda.some((x,idx)=>{
    if(idx === i) return false;
    if(a.id && x?.id && a.id === x.id) return false;
    const st = (x?.status || "Agendado");
    if(st === "Cancelado" || st === "Remarcado" || st === "Bloqueio") return false;
    return `${x.data}|${x.hora}` === key;
  });
}



function escAttr(v){
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll('"',"&quot;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function ensureAgendaClientesDatalist(){
  let dl = byId("agendaClientesDatalist");
  if(!dl){
    dl = document.createElement("datalist");
    dl.id = "agendaClientesDatalist";
    document.body.appendChild(dl);
  }
  dl.innerHTML = state.clientes
    .map(c => (c?.nome||"").trim())
    .filter(Boolean)
    .sort((a,b)=> a.localeCompare(b, "pt-BR"))
    .map(nome => `<option value="${escAttr(nome)}"></option>`)
    .join("");
  return dl;
}

function agendaClienteInputHTML(valor=""){
  return `<input class="mini" type="text" list="agendaClientesDatalist" value="${escAttr(valor)}" />`;
}

function openAgendaEditorById(agendaId){
  // Abre a Agenda no formulário compacto e carrega exatamente o registro selecionado.
  // Corrige o erro em que "Editar" do Calendário abria um novo agendamento vazio.
  const ag = state.agenda.find(x => x && x.id === agendaId);
  if(!ag) return;

  window.__agendaSelectedId = agendaId;
  setRoute("agenda");
  setAgendaViewMode("form");

  const doOpen = ()=>{
    ensureAgendaClientesDatalist();
    renderAgendaCompact();
    updateAgendaAutoCells();

    const detail = byId('agendaCompactDetail') || byId('agendaFormPanel');
    if(detail) detail.scrollIntoView({ behavior:"smooth", block:"start" });

    const inputNome = byId('agDetCliente');
    if(inputNome){
      inputNome.focus({ preventScroll:true });
      try{ inputNome.select(); }catch{}
    }
  };

  requestAnimationFrame(()=> setTimeout(doOpen, 80));
}




/* =================== AGENDA COMPACTA =================== */
function agendaStatusClass(st){
  return String(st||"Agendado").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function agendaCompactEnsureSelected(items){
  const ids = items.map(x=>x.id);
  if(!window.__agendaSelectedId || !ids.includes(window.__agendaSelectedId)){
    window.__agendaSelectedId = ids[0] || "";
  }
}
function agendaCompactTodayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function agendaCompactFiltered(){
  const busca = normName(byId('agendaFiltroBusca')?.value || "");
  const data = byId('agendaFiltroData')?.value || "";
  const status = byId('agendaFiltroStatus')?.value || "";
  const hoje = agendaCompactTodayISO();
  return state.agenda.slice().filter(a=>{
    const st = (a.status || "Agendado");
    const agData = String(a.data || "");

    if(data && agData !== data) return false;
    if(status && st !== status) return false;

    // Quando o filtro estiver em "Agendado", esconder datas passadas.
    // Datas antigas continuam disponíveis no Histórico, Busca, Relatórios e no filtro "Todos".
    if(status === "Agendado" && agData && agData < hoje) return false;

    if(busca){
      const txt = normName(`${a.cliente||""} ${a.procedimento||""} ${a.obs||""}`);
      if(!txt.includes(busca)) return false;
    }
    return true;
  }).sort((a,b)=> String(a.data||"").localeCompare(String(b.data||"")) || String(a.hora||"").localeCompare(String(b.hora||"")));
}
function bindAgendaCompactFilters(){
  ['agendaFiltroBusca','agendaFiltroData','agendaFiltroStatus'].forEach(id=>{
    const el = byId(id);
    if(!el || el.__agendaCompactBound) return;
    el.__agendaCompactBound = true;
    const ev = id === 'agendaFiltroBusca' ? 'input' : 'change';
    el.addEventListener(ev, ()=>{
      window.__agendaSelectedId = "";
      renderAgendaCompact();
    });
  });
}
function renderAgendaCompact(){
  const list = byId('agendaCompactList');
  const detail = byId('agendaCompactDetail');
  if(!list || !detail) return;
  bindAgendaCompactFilters();

  const items = agendaCompactFiltered();
  agendaCompactEnsureSelected(items);

  if(!items.length){
    list.innerHTML = `<div class="hint" style="padding:16px;">Nenhum agendamento encontrado.</div>`;
    detail.innerHTML = `<div class="hint">Selecione outro filtro ou crie um novo agendamento.</div>`;
    return;
  }

  list.innerHTML = items.map(a=>{
    const st = a.status || "Agendado";
    const active = a.id === window.__agendaSelectedId ? ' isActive' : '';
    return `<button type="button" class="agendaItem${active}" data-agenda-id="${escAttr(a.id)}">
      <div>
        <div class="agendaItem__name">${escapeHTML(a.cliente || (st==='Bloqueio' ? 'Bloqueio' : 'Cliente sem nome'))}</div>
        <div class="agendaItem__meta">
          <span>${a.data ? fmtBRDate(a.data) : 'Sem data'}</span>
          <span>${a.hora || 'Sem hora'}</span>
          <span>${escapeHTML(a.procedimento || 'Sem procedimento')}</span>
        </div>
        <div style="margin-top:7px;"><span class="agendaBadge agendaBadge--${agendaStatusClass(st)}">${escapeHTML(st)}</span></div>
      </div>
      <div class="agendaItem__arrow">›</div>
    </button>`;
  }).join('');

  list.querySelectorAll('[data-agenda-id]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      window.__agendaSelectedId = btn.dataset.agendaId || '';
      setAgendaViewMode("form");
      renderAgendaCompact();
    });
  });

  const ag = state.agenda.find(x=>x.id===window.__agendaSelectedId) || items[0];
  if(!ag) return;
  const idx = state.agenda.findIndex(x=>x.id===ag.id);
  const isBlock = (ag.status === 'Bloqueio');
  const procNames = state.procedimentos.map(p=>p.nome).filter(Boolean);
  const statuses = ["Agendado","Confirmado","Realizado","Cancelado","Remarcado","Bloqueio"];
  const wpp = clientWpp(ag.cliente);
  const val = isBlock ? 0 : procPrice(ag.procedimento, ag.data);
  const rec = num(ag.recebido);
  const conflict = !isBlock && (isConflict(idx) || isConflictByDuration(idx));

  detail.innerHTML = `
    <div class="agendaDetail__head">
      <div>
        <h3>${escapeHTML(ag.cliente || (isBlock ? 'Bloqueio' : 'Novo agendamento'))}</h3>
        <div class="hint">${ag.data ? fmtBRDate(ag.data) : 'Sem data'} ${ag.hora ? 'às ' + ag.hora : ''}</div>
      </div>
      <span class="agendaBadge agendaBadge--${agendaStatusClass(ag.status)}">${escapeHTML(ag.status||'Agendado')}</span>
    </div>
    ${conflict ? `<div class="notice" style="margin:0 0 12px 0;">⚠️ Conflito de horário: confira data, hora e duração.</div>` : ''}
    <div class="agendaDetail__grid" data-detail-id="${escAttr(ag.id)}">
      <label class="field"><span>Data</span><input id="agDetData" type="date" value="${escAttr(ag.data||'')}"></label>
      <label class="field"><span>Hora</span><input id="agDetHora" type="time" step="60" value="${escAttr(ag.hora||'')}"></label>
      <label class="field"><span>Cliente</span><input id="agDetCliente" list="agendaClientesDatalist" value="${escAttr(ag.cliente||'')}"></label>
      <label class="field"><span>Contato</span><input id="agDetWpp" value="${escAttr(wpp)}" readonly></label>
      <label class="field"><span>Procedimento</span><select id="agDetProc" ${isBlock?'disabled':''}>${(isBlock?["—"]:(procNames.length?procNames:["Compromisso"])).map(n=>`<option value="${escAttr(n)}" ${n===(ag.procedimento||'')?'selected':''}>${escapeHTML(n)}</option>`).join('')}</select></label>
      <label class="field"><span>Valor</span><input id="agDetValor" type="text" value="${escAttr(val.toFixed(2))}" readonly></label>
      <label class="field"><span>Status</span><select id="agDetStatus">${statuses.map(n=>`<option value="${escAttr(n)}" ${n===(ag.status||'Agendado')?'selected':''}>${escapeHTML(n)}</option>`).join('')}</select></label>
      <label class="field"><span>Recebido</span><input id="agDetRecebido" type="number" step="0.01" inputmode="decimal" value="${escAttr(rec.toFixed(2))}" ${isBlock?'readonly':''}></label>
      <label class="field agendaDetail__wide"><span>Observação</span><textarea id="agDetObs" rows="3">${escapeHTML(ag.obs||'')}</textarea></label>
    </div>
    <div class="agendaDetail__actions">
      <button class="btn btn--ghost" id="agDetConf" type="button" ${isBlock?'disabled':''}>📩 Confirmação</button>
      <button class="btn btn--ghost" id="agDetLem" type="button" ${isBlock?'disabled':''}>⏰ Lembrete</button>
      <button class="btn btn--ghost" id="agDetAgr" type="button" ${isBlock?'disabled':''}>💬 Agradecimento</button>
      <button class="btn btn--ghost" id="agDetDel" type="button">Excluir</button>
    </div>`;

  const refresh = ()=>{
    if(!isSpecialProcedure(ag.procedimento) && (ag.status||'Agendado') !== 'Bloqueio'){
      ag.valor = procPrice(ag.procedimento, ag.data);
    } else {
      ag.valor = 0;
      ag.recebido = 0;
    }
    saveSoft();
    syncAgendaToAtendimentos();
    updateConflictUI();
    scheduleSync();
    renderAgendaCompact();
  };
  byId('agDetData')?.addEventListener('change', e=>{ ag.data=e.target.value; refresh(); });
  byId('agDetHora')?.addEventListener('change', e=>{ ag.hora=e.target.value; refresh(); });
  byId('agDetCliente')?.addEventListener('input', e=>{
    // A digitação aparece imediatamente; só o salvamento fica em lote.
    ag.cliente = e.target.value;
    const w = byId('agDetWpp');
    if(w) w.value = clientWpp(ag.cliente);
    saveSoftDebounced();
    scheduleSyncDebounced();
  });
  byId('agDetProc')?.addEventListener('change', e=>{
    if(isBlock) return;
    ag.procedimento = e.target.value;
    const preco = procPrice(ag.procedimento, ag.data);
    ag.valor = preco;
    const inpValor = byId('agDetValor');
    if(inpValor) inpValor.value = preco.toFixed(2);
    if(isSpecialProcedure(ag.procedimento)){
      ag.recebido = 0;
      const inpRec = byId('agDetRecebido');
      if(inpRec) inpRec.value = '0.00';
    }else if((ag.status||'Agendado')==='Realizado'){
      ag.recebido = preco;
      const inpRec = byId('agDetRecebido');
      if(inpRec) inpRec.value = preco.toFixed(2);
    }
    refresh();
  });
  byId('agDetStatus')?.addEventListener('change', e=>{
    ag.status=e.target.value;
    if(ag.status==='Bloqueio'){ ag.procedimento='—'; ag.recebido=0; }
    else if(ag.status==='Realizado'){ ag.recebido=procPrice(ag.procedimento, ag.data); }
    else if(ag.status==='Cancelado' || ag.status==='Remarcado'){ ag.recebido=0; }
    refresh();
  });
  byId('agDetRecebido')?.addEventListener('input', e=>{ if((ag.status||'Agendado')==='Realizado') ag.recebido=procPrice(ag.procedimento, ag.data); else ag.recebido=num(e.target.value); saveSoftDebounced(); scheduleSyncDebounced(); });
  byId('agDetObs')?.addEventListener('input', e=>{ ag.obs=e.target.value; saveSoftDebounced(); scheduleSyncDebounced(); });
  byId('agDetConf')?.addEventListener('click', ()=>{ const phone=clientWpp(ag.cliente); if(!phone){ alert('Cliente sem WhatsApp. Preencha em Clientes.'); setRoute('clientes'); return; } window.open(waLink(phone, fillTpl(state.wpp.tplConfirmacao, ag)), '_blank'); });
  byId('agDetLem')?.addEventListener('click', ()=>{ const phone=clientWpp(ag.cliente); if(!phone){ alert('Cliente sem WhatsApp. Preencha em Clientes.'); setRoute('clientes'); return; } window.open(waLink(phone, fillTpl(state.wpp.tplLembrete, ag)), '_blank'); });
  byId('agDetAgr')?.addEventListener('click', async ()=>{ const phone=clientWpp(ag.cliente); if(!phone){ alert('Cliente sem WhatsApp. Preencha em Clientes.'); setRoute('clientes'); return; } const at=getAtendimentoByAgendaId(ag.id)||{...ag,id:ag.id}; const txt=gratitudeMsgForAtendimento(at); const ok=await copyToClipboardSafe(txt); if(ok) alert('Mensagem de agradecimento copiada ✅'); window.open(waLink(phone, txt), '_blank'); });
  byId('agDetDel')?.addEventListener('click', ()=>{ if(!confirmDel('este agendamento')) return; removeAtendimentoFromAgenda(ag.id); state.agenda=state.agenda.filter(x=>x.id!==ag.id); window.__agendaSelectedId=''; saveSoft(); scheduleSync(); renderAgendaHard(); });
}

function renderAgendaHard(){
  if(!window.__agendaViewMode) setAgendaViewMode("form");
  ensureAgendaClientesDatalist();

  const tblAgendaBody = getAgendaTbody();
  const agendaNotice = getAgendaNotice();
  if(!tblAgendaBody) return;

  if(agendaNotice){
    agendaNotice.hidden = true;
    agendaNotice.textContent = "";
  }

  const procNames = state.procedimentos.map(p=>p.nome).filter(Boolean);
  const statuses = ["Agendado","Confirmado","Realizado","Cancelado","Remarcado","Bloqueio"];

  enforceAgendaRecebidoRules();

  tblAgendaBody.innerHTML = state.agenda.map((a,i)=>{
    const isBlock = (a.status==="Bloqueio");
    const val = isBlock ? 0 : procPrice(a.procedimento, a.data);
    const conflict = isBlock ? false : isConflict(i);
    const conflictDur = isBlock ? false : isConflictByDuration(i);

    const wpp = clientWpp(a.cliente);
    const rec = num(a.recebido);
    const procValue = isBlock ? "—" : a.procedimento;

    return `
      <tr data-id="${a.id}" class="${(conflict || conflictDur) ? "danger" : ""}">
        <td>${inputHTML({value:a.data, type:"date"})}</td>
        <td>${inputHTML({value:a.hora, type:"time", step:"60"})}</td>
        <td>${agendaClienteInputHTML(a.cliente)}</td>
        <td>${inputHTML({value:wpp, readonly:true})}</td>
        <td>${inputHTML({value:procValue, options: isBlock ? ["—"] : (procNames.length?procNames:["Compromisso"]), readonly:isBlock})}</td>
        <td>${inputHTML({value:val.toFixed(2), type:"text", cls:"money", readonly:true})}</td>
        <td>${inputHTML({value:a.status, options: statuses})}</td>
        <td>${inputHTML({value:rec.toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal", readonly:isBlock})}</td>
        <td>${inputHTML({value:a.obs})}</td>
        <td>
          <div class="iconRow">
            <button class="iconBtn" data-conf title="Confirmação" ${isBlock?"disabled":""}>📩</button>
            <button class="iconBtn" data-lem title="Lembrete" ${isBlock?"disabled":""}>⏰</button>
            <button class="iconBtn" data-agr title="Agradecimento" ${isBlock?"disabled":""}>💬</button>
          </div>
        </td>
        <td><button class="iconBtn" data-del title="Excluir">✕</button></td>
      </tr>
    `;
  }).join("");

  tblAgendaBody.querySelectorAll("tr").forEach((tr,idx)=>{
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
      saveSoftDebounced();
      scheduleSyncDebounced();
    });

    getInp(tdProc)?.addEventListener("change", ()=>{
      if(isBlock) return;
      a.procedimento = getInp(tdProc).value;
      const preco = procPrice(a.procedimento, a.data);
      a.valor = preco;
      if(inpVal) inpVal.value = preco.toFixed(2);

      if(isSpecialProcedure(a.procedimento)){
        a.recebido = 0;
        if(inpRec) inpRec.value = "0.00";
      }else if((a.status||"Agendado") === "Realizado"){
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
        a.recebido = procPrice(a.procedimento, a.data);
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
        a.recebido = procPrice(a.procedimento, a.data);
        inpRec.value = num(a.recebido).toFixed(2);
      }

      saveSoft(); scheduleSync();
    });

    getInp(tdObs)?.addEventListener("input", ()=>{
      a.obs = getInp(tdObs).value;
      saveSoftDebounced();
      scheduleSyncDebounced();
    });

    tr.querySelector("[data-ag-foto]")?.addEventListener("change", async (e)=>{
      if(!requireFeature('fotos')) return;
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
      saveAgendaProcedurePhoto(a, b64);
      saveSoft();
      renderAgendaHard();
      renderAtendimentosHard();
      renderClientes();
      renderClientPhotoPanel();
      alert('Foto salva na pasta da cliente ✅');
    });

    tr.querySelector("[data-locked-feature]")?.addEventListener("click", (e)=>{
      requireFeature(e.currentTarget.dataset.lockedFeature || 'fotos');
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

    tr.querySelector("[data-agr]")?.addEventListener("click", async ()=>{
      if((a.status||"Agendado")==="Bloqueio") return;
      const phone = clientWpp(a.cliente);
      if(!phone){ alert("Cliente sem WhatsApp. Preencha em Clientes."); setRoute("clientes"); return; }
      const at = getAtendimentoByAgendaId(a.id) || { ...a, id:a.id };
      const txt = gratitudeMsgForAtendimento(at);
      const ok = await copyToClipboardSafe(txt);
      if(ok) alert("Mensagem de agradecimento copiada ✅\nO WhatsApp será aberto. Se quiser enviar a foto, anexe a imagem salva na pasta da cliente.");
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

  renderAgendaCompact();
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
      a.recebido = procPrice(a.procedimento, a.data);
    } else if(a.status === "Cancelado" || a.status === "Remarcado"){
      a.recebido = 0;
    }

    const inpWpp = getInp(getCell(tr,3));
    const inpVal = getInp(getCell(tr,5));
    const inpRec = getInp(getCell(tr,7));

    const active = document.activeElement;

    if(inpWpp && active !== inpWpp) inpWpp.value = clientWpp(a.cliente);
    if(inpVal && active !== inpVal) inpVal.value = ((a.status==="Bloqueio")?0:procPrice(a.procedimento, a.data)).toFixed(2);
    if(inpRec && active !== inpRec) inpRec.value = num(a.recebido).toFixed(2);
  });
}

/* =======================================================
   ✅ RESTO DO APP (tabelas + binds) — COMPLETO
   (Mantém seus IDs. Só completa as funções que faltavam.)
======================================================= */

/* =================== PROCEDIMENTOS =================== */
function renderProcedimentos(){
  const body = document.querySelector('#tblProc tbody');
  if(!body) return;

  body.innerHTML = state.procedimentos.map((p)=>{
    return `
      <tr data-id="${p.id}">
        <td>${inputHTML({value:p.nome||"", readonly: !!p.especial})}</td>
        <td>${inputHTML({value:num(p.preco).toFixed(2), type:"number", cls:"money", step:"0.01", inputmode:"decimal", readonly: !!p.especial})}</td>
        <td>${inputHTML({value:p.reajuste||"", type:"date", readonly: !!p.especial})}</td>
        <td>${inputHTML({value:(p.duracaoMin??60), type:"number", step:"1"})}</td>
        <td>${p.especial ? '<span class="muted">Sistema</span>' : '<button class="iconBtn" data-del>✕</button>'}</td>
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

    inpNome?.addEventListener('input', ()=>{ if(p.especial){ inpNome.value = p.nome || ""; return; } p.nome = inpNome.value; saveSoft(); scheduleSync(); });

    inpPreco?.addEventListener('input', ()=>{
      if(p.especial){ p.preco = 0; inpPreco.value = "0.00"; return; }
      const novoPreco = num(inpPreco.value);
      const tinhaHistorico = Array.isArray(p.historico) && p.historico.length > 0;
      p.preco = novoPreco;
      if(!tinhaHistorico && !p.reajuste){
        p.precoBase = novoPreco;
      }
      saveSoft();
      scheduleSync();
    });

    inpReaj?.addEventListener('change',()=>{
      if(p.especial){ p.reajuste = ""; inpReaj.value = ""; return; }
      p.reajuste = inpReaj.value || "";
      if(!Array.isArray(p.historico)) p.historico = [];
      if(p.reajuste){
        const idxHist = p.historico.findIndex(h => h.dataInicio === p.reajuste);
        const entry = { dataInicio: p.reajuste, valor: num(p.preco) };
        if(idxHist >= 0) p.historico[idxHist] = entry;
        else p.historico.push(entry);
        p.historico.sort((a,b)=> a.dataInicio.localeCompare(b.dataInicio));
      }
      saveSoft();
      scheduleSync();
      renderAgendaHard();
      renderAtendimentosHard();
      renderCalendar();
      renderDashboard();
    });

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
        <td><button class="iconBtn" data-open-photos>📁 ${Array.isArray(c.fotos)?c.fotos.length:0}</button></td>
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

    tr.querySelector('[data-open-photos]')?.addEventListener('click', ()=>{
      setRoute('clientes');
      renderClientPhotoPanel();
      byId('clientPhotoPanel')?.scrollIntoView({behavior:'smooth', block:'start'});
    });

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
  state.clientes.unshift({ id: uid(), nome:'', wpp:'', tel:'', nasc:'', alergia:'N', quais:'', gestante:'N', molde:'', obs:'', fotos:[] });
  saveSoft();
  renderClientes();
  scheduleSync();
});

/* =================== MATERIAIS =================== */
function renderMaterialAlerts(){
  const box = byId('materialAlerts');
  if(!box) return;
  const baixo = state.materiais.filter(m => num(m.qtdTotal) <= num(m.estoqueMin) && num(m.estoqueMin) > 0);
  const vencendo = state.materiais.filter(m => m.validade && m.validade <= addDaysISO(todayISO(), 30));
  box.innerHTML = `
    <div class="miniCards">
      <div class="miniCard"><b>Estoque baixo</b><span>${baixo.length}</span></div>
      <div class="miniCard"><b>Validade em até 30 dias</b><span>${vencendo.length}</span></div>
      <div class="miniCard"><b>Itens cadastrados</b><span>${state.materiais.length}</span></div>
    </div>
    ${baixo.length ? `<small class="hint dangerText">Atenção: ${baixo.map(m=>m.nome||m.material||'Sem nome').join(', ')}</small>` : `<small class="hint">Nenhum alerta de estoque baixo.</small>`}
  `;
}

function renderMateriaisHard(){
  renderMaterialAlerts();
  const body = document.querySelector('#tblMat tbody');
  if(!body) return;

  state.materiais.forEach(calcularMaterial);

  const unidades = ['ml','L','g','kg','un'];

  body.innerHTML = state.materiais.map((m)=>{
    calcularMaterial(m);
    const nome = (m.nome ?? m.material ?? '');
    return `
      <tr data-id="${m.id}">
        <td>${inputHTML({value:nome})}</td>
        <td>${inputHTML({value:num(m.qtdPorUnidade).toString(), type:'number', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:m.unidade||'ml', options:unidades})}</td>
        <td>${inputHTML({value:num(m.valorUnidade).toFixed(2), type:'number', cls:'money', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:num(m.unidadesCompradas).toString(), type:'number', step:'1', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:num(m.qtdTotal).toFixed(2), type:'text', readonly:true})}</td>
        <td>${inputHTML({value:num(m.qtdCliente).toString(), type:'number', step:'0.01', inputmode:'decimal'})}</td>
        <td>${inputHTML({value:num(m.custoCliente).toFixed(4), type:'text', cls:'money', readonly:true})}</td>
        <td>${inputHTML({value:num(m.rendimento).toFixed(2), type:'text', readonly:true})}</td>
        <td><button class="iconBtn" data-del>✕</button></td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const m = state.materiais.find(x=>x.id===id);
    if(!m) return;

    const inpNome = getInp(getCell(tr,0));
    const inpQtdUn = getInp(getCell(tr,1));
    const inpUn   = getInp(getCell(tr,2));
    const inpValUn  = getInp(getCell(tr,3));
    const inpUnCompradas = getInp(getCell(tr,4));
    const inpQtdC = getInp(getCell(tr,6));

    const persistMaterialNow = ()=>{
      try{
        localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(KEY, JSON.stringify(state));
        const u = window.__SJM_CURRENT_USER;
        if(u?.uid) localStorage.setItem(storageKeyForUser(u.uid), JSON.stringify(state));
        if(u?.email) localStorage.setItem(storageKeyForUser(u.email), JSON.stringify(state));
      }catch(e){ console.warn('backup material:', e); }
    };

    const recalc = ()=>{
      m.nome = inpNome?.value ?? (m.nome||m.material||'');
      m.qtdPorUnidade = num(inpQtdUn?.value);
      m.unidade  = inpUn?.value || m.unidade || 'ml';
      m.valorUnidade = num(inpValUn?.value);
      m.unidadesCompradas = num(inpUnCompradas?.value);
      m.qtdCliente  = num(inpQtdC?.value);
      calcularMaterial(m);

      const inpTotal  = getInp(getCell(tr,5));
      const inpCustoC = getInp(getCell(tr,7));
      const inpRend   = getInp(getCell(tr,8));
      if(inpTotal)  inpTotal.value  = num(m.qtdTotal).toFixed(2);
      if(inpCustoC) inpCustoC.value = num(m.custoCliente).toFixed(4);
      if(inpRend)   inpRend.value   = num(m.rendimento).toFixed(2);

      saveSoft();
      persistMaterialNow();
      scheduleSync();
    };

    [inpNome, inpQtdUn, inpValUn, inpUnCompradas, inpQtdC].forEach(inp=>{
      inp?.addEventListener('input', recalc);
      inp?.addEventListener('change', recalc);
      inp?.addEventListener('blur', recalc);
    });
    inpUn?.addEventListener('change',  recalc);

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
  state.materiais.unshift({ id: uid(), nome:'', qtdPorUnidade:0, unidade:'ml', valorUnidade:0, unidadesCompradas:1, qtdTotal:0, valorCompra:0, qtdCliente:0, custoUnit:0, custoCliente:0, rendimento:0, estoqueMin:0, fornecedor:'', validade:'' });
  saveSoft();
  renderMateriaisHard();
  scheduleSync();
});

/* =================== CRM (Atendimentos) =================== */
function getAtendTbody(){ return document.querySelector('#tblCRM tbody') || document.querySelector('#tblAtend tbody'); }

function getOrCreateClientByName(name){
  const n = String(name || "").trim();
  if(!n) return null;
  let c = findClientByName(n);
  if(!c){
    c = { id: uid(), nome:n, wpp:"", tel:"", nasc:"", alergia:"N", quais:"", gestante:"N", molde:"", obs:"", fotos:[] };
    state.clientes.unshift(c);
  }
  if(!Array.isArray(c.fotos)) c.fotos = [];
  return c;
}

function saveProcedurePhoto(a, imagem){
  if(!a || !imagem) return null;
  a.foto = imagem;
  const c = getOrCreateClientByName(a.cliente);
  if(!c) return null;
  const foto = {
    id: uid(),
    atendimentoId: a.id || "",
    data: a.data || todayISO(),
    procedimento: a.procedimento || "",
    imagem,
    enviadoWhatsApp: false,
    createdAt: Date.now()
  };
  c.fotos.unshift(foto);
  return foto;
}

function saveAgendaProcedurePhoto(ag, imagem){
  if(!ag || !imagem) return null;
  const at = ensureAtendimentoFromAgenda(ag);
  at.data = ag.data || todayISO();
  at.cliente = ag.cliente || "";
  at.procedimento = ag.procedimento || "";
  at.recebido = (ag.status === "Realizado") ? procPrice(ag.procedimento, ag.data) : num(ag.recebido);
  return saveProcedurePhoto(at, imagem);
}

function gratitudeMsgForAtendimento(a){
  const tpl = state.wpp.tplFotoProcedimento || state.wpp.tplAgradecimento;
  return fillTpl(tpl, {
    cliente: a.cliente || "",
    data: a.data || todayISO(),
    hora: a.hora || "",
    procedimento: a.procedimento || "",
  });
}

function renderClientPhotoPanel(){
  const box = byId("clientPhotoPanel");
  if(!box) return;
  const clientesComFoto = state.clientes
    .filter(c => Array.isArray(c.fotos) && c.fotos.length)
    .sort((a,b)=> String(a.nome||"").localeCompare(String(b.nome||"")));

  if(!clientesComFoto.length){
    box.innerHTML = '<div class="hint">Nenhuma foto salva ainda. As fotos tiradas no CRM aparecerão aqui, separadas por cliente.</div>';
    return;
  }

  box.innerHTML = clientesComFoto.map(c => `
    <details class="photoFolder">
      <summary>📁 ${c.nome || "Cliente sem nome"} <span class="hintInline">${c.fotos.length} foto(s)</span></summary>
      <div class="photoGrid">
        ${c.fotos.map(f => `
          <div class="photoCard">
            ${f.imagem ? `<img src="${f.imagem}" alt="Foto do procedimento" />` : ''}
            <div class="photoMeta">${fmtBRDate(f.data)} • ${f.procedimento || 'Procedimento'}</div>
          </div>
        `).join('')}
      </div>
    </details>
  `).join('');
}

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
          ${canUseFeature('fotos') ? `<input class="mini" type="file" accept="image/*" data-foto />` : `<button class="iconBtn" data-locked-feature="fotos">🔒 Premium</button>`}
          ${a.foto ? `<div class="hint">📸 foto salva</div>` : `<div class="hint">sem foto</div>`}
          ${a.foto ? `<img class="thumbProc" src="${a.foto}" alt="Foto do procedimento" />` : ``}
        </td>
        <td><button class="iconBtn" data-wpp>💬 Enviar</button></td>
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
      saveProcedurePhoto(a, b64);
      saveSoft();
      renderAtendimentosHard();
      renderClientes();
      renderClientPhotoPanel();
      alert('Foto salva na pasta da cliente ✅');
    });

    tr.querySelector('[data-locked-feature]')?.addEventListener('click', (e)=>{
      requireFeature(e.currentTarget.dataset.lockedFeature || 'fotos');
    });

    tr.querySelector('[data-wpp]')?.addEventListener('click', async ()=>{
      const phone = clientWpp(a.cliente);
      if(!phone){ alert('Cliente sem WhatsApp. Preencha em Clientes.'); setRoute('clientes'); return; }

      const msg = gratitudeMsgForAtendimento(a);
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

function addAtendimentoManual(){
  const firstProc = state.procedimentos.find(p=>p.nome)?.nome || 'Alongamento';
  state.atendimentos.unshift({
    id: uid(), data: todayISO(), cliente:'', procedimento:firstProc,
    recebido: 0, maoObra: 0, custoMaterial: 0, custoTotal: 0, lucro: 0,
    foto:'', fromAgendaId:'', auto:false
  });
  saveSoft();
  renderAtendimentosHard();
  renderFotosClientes();
  scheduleSync();
}

onClick('btnAddAtendimento', addAtendimentoManual);

// ✅ Compat: botão novo "CRM" (se existir no HTML) usa a mesma ação do antigo "Atendimento"
onClick('btnAddCRM', addAtendimentoManual);

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

function normalizeHora(v, fallback='20:00'){
  const raw = String(v || '').trim();
  let m = raw.match(/^(\d{1,2})$/);
  if(m){
    const h = Math.max(0, Math.min(23, Number(m[1])));
    return String(h).padStart(2,'0') + ':00';
  }
  m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if(m){
    const h = Number(m[1]);
    const min = Number(m[2]);
    if(Number.isFinite(h) && Number.isFinite(min) && h>=0 && h<=23 && min>=0 && min<=59){
      return String(h).padStart(2,'0') + ':' + String(min).padStart(2,'0');
    }
  }
  return fallback;
}

/* =================== WHATSAPP =================== */
function bindWppUI(){
  const setV = (id, v)=>{ const el = byId(id); if(el) el.value = v ?? ''; };

  setV('wppHoraLembrete', normalizeHora(state.wpp.horaLembrete, '09:00'));
  setV('wppHoraRelatorio', normalizeHora(state.wpp.horaRelatorio, '20:00'));
  setV('tplConfirmacao', state.wpp.tplConfirmacao || '');
  setV('tplLembrete', state.wpp.tplLembrete || '');
  setV('tplAgradecimento', state.wpp.tplAgradecimento || '');
  setV('tplFotoProcedimento', state.wpp.tplFotoProcedimento || '');
  setV('tplFidelidade', state.wpp.tplFidelidade || '');
  setV('tplAniversario', state.wpp.tplAniversario || '');
  setV('tplReativacao', state.wpp.tplReativacao || '');
  setV('tplRelatorio', state.wpp.tplRelatorio || '');

  const tplBtn = byId('btnToggleTemplatesWpp');
  const tplWrap = byId('wppTemplatesWrap');
  if(tplBtn && tplWrap && !tplBtn.__wppToggleBound){
    tplBtn.__wppToggleBound = true;
    tplBtn.addEventListener('click', ()=>{
      const closed = tplWrap.classList.contains('isHidden');
      tplWrap.classList.toggle('isHidden', !closed);
      tplBtn.textContent = closed ? 'Fechar textos dos templates' : 'Abrir textos dos templates';
    });
  }

  const persistWpp = ()=>{
    state.wpp = state.wpp && typeof state.wpp === 'object' ? state.wpp : {};
    state.wpp.horaLembrete = normalizeHora(byId('wppHoraLembrete')?.value, '09:00');
    state.wpp.horaRelatorio = normalizeHora(byId('wppHoraRelatorio')?.value, '20:00');
    if(byId('wppHoraLembrete')) byId('wppHoraLembrete').value = state.wpp.horaLembrete;
    if(byId('wppHoraRelatorio')) byId('wppHoraRelatorio').value = state.wpp.horaRelatorio;
    state.wpp.tplConfirmacao = byId('tplConfirmacao')?.value || '';
    state.wpp.tplLembrete = byId('tplLembrete')?.value || '';
    state.wpp.tplAgradecimento = byId('tplAgradecimento')?.value || '';
    state.wpp.tplFotoProcedimento = byId('tplFotoProcedimento')?.value || '';
    state.wpp.tplFidelidade = byId('tplFidelidade')?.value || '';
    state.wpp.tplAniversario = byId('tplAniversario')?.value || '';
    state.wpp.tplReativacao = byId('tplReativacao')?.value || '';
    state.wpp.tplRelatorio = byId('tplRelatorio')?.value || '';
    saveSoft();
    scheduleSync();
  };
  ['wppHoraLembrete','wppHoraRelatorio'].forEach(id=>{
    const el = byId(id);
    if(el){ el.onchange = persistWpp; el.oninput = persistWpp; }
  });
  ['tplConfirmacao','tplLembrete','tplAgradecimento','tplFotoProcedimento','tplFidelidade','tplAniversario','tplReativacao','tplRelatorio'].forEach(id=>{
    const el = byId(id);
    if(el){ el.oninput = persistWpp; el.onchange = persistWpp; }
  });

  onClick('btnSaveWpp', ()=>{
    state.wpp.horaLembrete = normalizeHora(byId('wppHoraLembrete')?.value, '09:00');
    state.wpp.horaRelatorio = normalizeHora(byId('wppHoraRelatorio')?.value, '20:00');
    if(byId('wppHoraLembrete')) byId('wppHoraLembrete').value = state.wpp.horaLembrete;
    if(byId('wppHoraRelatorio')) byId('wppHoraRelatorio').value = state.wpp.horaRelatorio;
    state.wpp.tplConfirmacao = byId('tplConfirmacao')?.value || '';
    state.wpp.tplLembrete = byId('tplLembrete')?.value || '';
    state.wpp.tplAgradecimento = byId('tplAgradecimento')?.value || '';
    state.wpp.tplFotoProcedimento = byId('tplFotoProcedimento')?.value || '';
    state.wpp.tplFidelidade = byId('tplFidelidade')?.value || '';
    state.wpp.tplAniversario = byId('tplAniversario')?.value || '';
    state.wpp.tplReativacao = byId('tplReativacao')?.value || '';
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


/* =================== CRM / REMARKETING =================== */
function normName(s){ return String(s||"").trim().toLowerCase(); }

function daysBetweenISO(aISO, bISO){
  if(!aISO || !bISO) return null;
  const a = new Date(aISO+"T00:00:00");
  const b = new Date(bISO+"T00:00:00");
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

function getLastAtendimentoISOByClientName(nome){
  const n = normName(nome);
  if(!n) return "";

  let best = "";

  // 1) atende (CRM) explícito
  for(const a of (state.atendimentos||[])){
    if(!a) continue;
    if(normName(a.cliente) !== n) continue;
    const d = String(a.data||"");
    if(d && (!best || d > best)) best = d;
  }

  // 2) fallback: agenda realizado (caso não tenha atendimento derivado por algum motivo)
  for(const ag of (state.agenda||[])){
    if(!ag) continue;
    if((ag.status||"Agendado") !== "Realizado") continue;
    if(normName(ag.cliente) !== n) continue;
    const d = String(ag.data||"");
    if(d && (!best || d > best)) best = d;
  }

  return best;
}

function classifyCRM(days){
  if(days === null) return { key:"NONE", label:"Sem histórico" };
  if(days <= 30)   return { key:"OK",   label:"Em dia (≤30)" };
  if(days <= 45)   return { key:"ATT",  label:"Atenção (31–45)" };
  if(days <= 70)   return { key:"R1",   label:"Remarketing (46–70)" };
  if(days <= 90)   return { key:"R2",   label:"Remarketing (71–90)" };
  return            { key:"OLD",  label:"Antigos (90+)" };
}

function fillCrmTpl(tpl, item){
  const studio = state.settings.studioNome || "Studio";
  return String(tpl||"")
    .replaceAll("{cliente}", item.cliente || "")
    .replaceAll("{dias}", String(item.dias ?? ""))
    .replaceAll("{ultima}", item.ultima ? fmtBRDate(item.ultima) : "")
    .replaceAll("{studio}", studio);
}

function getCrmElements(){
  return {
    // KPIs (suporta IDs antigos e novos do seu index.html)
    kpiTotal: byId("crmKpiTotal") || byId("crmTotal") || byId("kpiCrmTotal"),
    kpiOk:    byId("crmKpiOk")    || byId("crmOk"),
    // "Atenção" pode estar como crmKpiAtt OU crmKpiWarn
    kpiAtt:   byId("crmKpiAtt")   || byId("crmKpiWarn") || byId("crmAtt"),
    // Alguns layouts juntam REM+OLD em um KPI só (crmKpiRisk)
    kpiRem:   byId("crmKpiRem")   || byId("crmRem"),
    kpiOld:   byId("crmKpiOld")   || byId("crmOld"),
    kpiRisk:  byId("crmKpiRisk")  || byId("crmRisk"),

    selFiltro: byId("crmFiltro") || byId("crmFilter"),
    inpBusca:  byId("crmBusca")  || byId("crmSearch"),
    txtTpl:    byId("crmTpl")    || byId("crmTemplate") || byId("crmMensagem"),

    btnSaveTpl: byId("btnCrmSaveTpl") || byId("btnSaveCrmTpl") || byId("btnSaveCrmTemplate"),
    // botão novo (gera conforme o filtro selecionado)
    btnGenSelected: byId("btnCrmQueueSelected") || byId("btnCrmGenSelected") || byId("btnCrmQueue"),
    // legado: botões antigos 45+ / 90+ (se ainda existirem)
    btnGen45:   byId("btnCrmGen45")   || byId("btnCrmQueue45") || byId("btnCrm45"),
    btnGen90:   byId("btnCrmGen90")   || byId("btnCrmQueue90") || byId("btnCrm90"),
    btnClear:   byId("btnCrmClear")   || byId("btnCrmClearQueue") || byId("btnCrmClearQueue"),

    // tabela do seu HTML é #tblCRM
    tbl: $("#tblCRM tbody") || $("#tblCrmQueue tbody") || $("#tblCRMQueue tbody") || $("#tblCrm tbody"),
    chart: byId("crmChart") || byId("chartCRM") || byId("crmBars"),

    // opcional: se você usar um container em div em vez de tabela
    listBox: byId("crmQueue"),
  };
}

function ensureCrmDefaults(){
  state.crm = state.crm && typeof state.crm==="object" ? state.crm : {};
  if(!state.crm.tplRemarketing){
    state.crm.tplRemarketing =
`Oi {cliente}! 💜 Faz {dias} dias desde seu último atendimento no {studio}.
Que tal agendarmos sua manutenção? 😊`;
  }
  if(!state.crm.filtro) state.crm.filtro = "ALL";
  if(state.crm.busca === undefined) state.crm.busca = "";
  state.crmQueue = Array.isArray(state.crmQueue) ? state.crmQueue : [];
}

function buildCrmRows(){
  const today = todayISO();

  // base de clientes: usa state.clientes, mas também inclui quem aparece em atendimentos/agenda
  const names = new Map();

  (state.clientes||[]).forEach(c=>{
    const nm = String(c?.nome||"").trim();
    if(nm) names.set(normName(nm), nm);
  });
  (state.atendimentos||[]).forEach(a=>{
    const nm = String(a?.cliente||"").trim();
    if(nm) names.set(normName(nm), nm);
  });
  (state.agenda||[]).forEach(a=>{
    const nm = String(a?.cliente||"").trim();
    if(nm) names.set(normName(nm), nm);
  });

  const rows = [];
  for(const [nk, displayName] of names.entries()){
    const ultima = getLastAtendimentoISOByClientName(displayName);
    const dias = ultima ? daysBetweenISO(ultima, today) : null;
    const cls = classifyCRM(dias);

    const wpp = clientWpp(displayName);

    rows.push({
      id: uid(),
      cliente: displayName,
      phone: wpp,
      ultima: ultima || "",
      dias: dias,
      situacaoKey: cls.key,
      situacaoLabel: cls.label
    });
  }

  // ordena: mais dias primeiro, sem histórico por último
  rows.sort((a,b)=>{
    const da = (a.dias===null) ? -1 : a.dias;
    const db = (b.dias===null) ? -1 : b.dias;
    return db - da;
  });

  return rows;
}

function applyCrmFilter(rows){
  const filtro = (state.crm?.filtro || "ALL");
  const busca = normName(state.crm?.busca || "");

  return rows.filter(r=>{
    if(busca && !normName(r.cliente).includes(busca)) return false;

    if(filtro === "ALL") return true;
    if(filtro === "OK") return r.situacaoKey === "OK";

    // aceita valores antigos e novos do <select> do HTML
    if(filtro === "ATT" || filtro === "WARN") return r.situacaoKey === "ATT";

    // novos buckets
    if(filtro === "R1") return r.situacaoKey === "R1";
    if(filtro === "R2") return r.situacaoKey === "R2";

    // legado (REM/REMARKETING) = soma dos dois remarketing
    if(filtro === "REM" || filtro === "REMARKETING") return (r.situacaoKey === "R1" || r.situacaoKey === "R2");

    if(filtro === "OLD" || filtro === "WINBACK") return r.situacaoKey === "OLD";
    if(filtro === "NONE" || filtro === "NOHIST") return r.situacaoKey === "NONE";

    return true;
  });
}

function renderCRM(){
  ensureCrmDefaults();

  const el = getCrmElements();
  const allRows = buildCrmRows();

  const withHist = allRows.filter(r=>r.situacaoKey !== "NONE");
  const cOk  = allRows.filter(r=>r.situacaoKey==="OK").length;
  const cAtt = allRows.filter(r=>r.situacaoKey==="ATT").length;
  const cR1  = allRows.filter(r=>r.situacaoKey==="R1").length;
  const cR2  = allRows.filter(r=>r.situacaoKey==="R2").length;
  const cRem = cR1 + cR2; // remarketing total (46–90)
  const cOld = allRows.filter(r=>r.situacaoKey==="OLD").length;

  if(el.kpiTotal) el.kpiTotal.textContent = String(withHist.length);
  if(el.kpiOk)    el.kpiOk.textContent    = String(cOk);
  if(el.kpiAtt)   el.kpiAtt.textContent   = String(cAtt);

  // se existir KPI "risk" no HTML, ele mostra REM + OLD juntos
  if(el.kpiRisk){
    el.kpiRisk.textContent = String(cRem + cOld);
  }else{
    if(el.kpiRem) el.kpiRem.textContent = String(cRem);
    if(el.kpiOld) el.kpiOld.textContent = String(cOld);
  }
  if(el.kpiRem)   el.kpiRem.textContent   = String(cRem);
  if(el.kpiOld)   el.kpiOld.textContent   = String(cOld);

  if(el.txtTpl && document.activeElement !== el.txtTpl){
    el.txtTpl.value = state.crm.tplRemarketing || "";
  }
  if(el.selFiltro && document.activeElement !== el.selFiltro){
    el.selFiltro.value = state.crm.filtro || "ALL";
  }
  if(el.inpBusca && document.activeElement !== el.inpBusca){
    el.inpBusca.value = state.crm.busca || "";
  }

  // gráfico simples (barras por bucket)
  if(el.chart){
    drawBars(el.chart, ["Em dia","Atenção","Remarketing","Antigos"], [cOk,cAtt,cRem,cOld]);
  }

  // tabela da fila
  if(el.tbl){
    if(!state.crmQueue.length){
      el.tbl.innerHTML = `<tr><td colspan="6"><div class="hint">Fila vazia.</div></td></tr>`;
      return;
    }

    el.tbl.innerHTML = state.crmQueue.map((q)=>`
      <tr data-id="${q.id}">
        <td>${q.cliente||""}</td>
        <td>${q.phone||""}</td>
        <td>${q.ultima?fmtBRDate(q.ultima):""}</td>
        <td>${q.dias ?? ""}</td>
        <td>${q.situacaoLabel||""}</td>
        <td>
          <div class="iconRow">
            <button class="iconBtn" data-wa title="WhatsApp">📲</button>
            <button class="iconBtn" data-copy title="Copiar">📋</button>
            <button class="iconBtn" data-del title="Remover">✕</button>
          </div>
        </td>
      </tr>
    `).join("");

    el.tbl.querySelectorAll("tr").forEach((tr)=>{
      const id = tr.dataset.id;
      const q = state.crmQueue.find(x=>x.id===id);
      if(!q) return;

      tr.querySelector("[data-wa]")?.addEventListener("click", ()=>{
        if(!q.phone){ alert("Cliente sem WhatsApp."); return; }
        const msg = fillCrmTpl(state.crm.tplRemarketing, q);
        window.open(waLink(q.phone, msg), "_blank");
      });

      tr.querySelector("[data-copy]")?.addEventListener("click", async ()=>{
        const msg = fillCrmTpl(state.crm.tplRemarketing, q);
        const ok = await copyToClipboardSafe(msg);
        alert(ok ? "Mensagem copiada ✅" : "Não foi possível copiar.");
      });

      tr.querySelector("[data-del]")?.addEventListener("click", ()=>{
        state.crmQueue = state.crmQueue.filter(x=>x.id!==id);
        saveSoft();
        renderCRM();
      });
    });
  }
}

function genCrmQueueSelected(){
  ensureCrmDefaults();
  const filtro = (state.crm?.filtro || "ALL");
  const base = buildCrmRows();

  let rows = base;

  switch(filtro){
    case "OK":
      rows = base.filter(r=>r.situacaoKey === "OK");
      break;

    case "ATT":
    case "WARN":
      rows = base.filter(r=>r.situacaoKey === "ATT");
      break;

    case "R1":
      rows = base.filter(r=>r.situacaoKey === "R1");
      break;

    case "R2":
      rows = base.filter(r=>r.situacaoKey === "R2");
      break;

    // legado: "REMARKETING" (46–90) = R1 + R2
    case "REM":
    case "REMARKETING":
      rows = base.filter(r=>r.situacaoKey === "R1" || r.situacaoKey === "R2");
      break;

    case "OLD":
    case "WINBACK":
      rows = base.filter(r=>r.situacaoKey === "OLD");
      break;

    case "NONE":
    case "NOHIST":
      rows = base.filter(r=>r.situacaoKey === "NONE");
      break;

    case "ALL":
    default:
      // por padrão, não enfileira "Sem histórico"
      rows = base.filter(r=>r.situacaoKey !== "NONE");
      break;
  }

  state.crmQueue = rows.map(r=>({
    id: uid(),
    cliente: r.cliente,
    phone: r.phone,
    ultima: r.ultima,
    dias: r.dias,
    situacaoKey: r.situacaoKey,
    situacaoLabel: r.situacaoLabel
  }));

  saveSoft();
  renderCRM();
}

// ✅ legado (mantém compatibilidade se ainda existir botão 45+/90+)
function genCrmQueue(minDias){
  ensureCrmDefaults();
  const rows = buildCrmRows()
    .filter(r=>r.dias !== null && r.dias >= minDias);

  state.crmQueue = rows.map(r=>({
    id: uid(),
    cliente: r.cliente,
    phone: r.phone,
    ultima: r.ultima,
    dias: r.dias,
    situacaoKey: r.situacaoKey,
    situacaoLabel: r.situacaoLabel
  }));

  saveSoft();
  renderCRM();
}

function clearCrmQueue(){
  state.crmQueue = [];
  saveSoft();
  renderCRM();
}

function bindCRMUI(){
  ensureCrmDefaults();
  const el = getCrmElements();

  // evita bind duplicado
  if(bindCRMUI.__bound) return;
  bindCRMUI.__bound = true;

  el.selFiltro?.addEventListener("change", ()=>{
    state.crm.filtro = el.selFiltro.value || "ALL";
    saveSoft();
    renderCRM();
  });

  el.inpBusca?.addEventListener("input", ()=>{
    state.crm.busca = el.inpBusca.value || "";
    saveSoft();
    renderCRM();
  });

  el.txtTpl?.addEventListener("input", ()=>{
    state.crm.tplRemarketing = el.txtTpl.value || "";
    saveSoft();
  });

  el.btnSaveTpl?.addEventListener("click", ()=>{
    state.crm.tplRemarketing = el.txtTpl?.value || state.crm.tplRemarketing;
    saveSoft();
    alert("Template salvo ✅");
  });

  // ✅ gera fila conforme o filtro selecionado
  el.btnGenSelected?.addEventListener("click", genCrmQueueSelected);

  // legado (se existir no HTML antigo)
  el.btnGen45?.addEventListener("click", ()=> genCrmQueue(45));
  el.btnGen90?.addEventListener("click", ()=> genCrmQueue(90));

  el.btnClear?.addEventListener("click", clearCrmQueue);
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
    ? itens.map(a=>`• ${a.hora||''} — ${a.cliente||''} (${a.procedimento||''}) — ${money(procPrice(a.procedimento, a.data))}`).join('\n')
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
  const cfgStudioNome = byId('cfgStudioNome');
  const cfgLogoUrl = byId('cfgLogoUrl');
  const cfgLogoFile = byId('cfgLogoFile');
  const cfgCorPrimaria = byId('cfgCorPrimaria');
  const cfgCorAcento = byId('cfgCorAcento');
  const cfgStudioWpp = byId('cfgStudioWpp');
  const cfgPlano = byId('cfgPlano');

  safeValue('cfgStudioNome', state.settings.studioNome || '');
  safeValue('cfgLogoUrl', state.settings.logoUrl || '');
  safeValue('cfgCorPrimaria', state.settings.corPrimaria || '#7B2CBF');
  safeValue('cfgCorAcento', state.settings.corAcento || '#F72585');
  safeValue('cfgStudioWpp', state.settings.studioWpp || '');
  safeValue('cfgPlano', state.settings.plano || 'premium');

  renderPlanCards();
  applyPlanUI();

  if(cfgLogoFile && !cfgLogoFile.__sjmBound){
    cfgLogoFile.__sjmBound = true;
    cfgLogoFile.addEventListener('change', (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      if(!file.type || !file.type.startsWith('image/')){
        alert('Escolha um arquivo de imagem válido.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = ()=>{
        const dataUrl = String(reader.result || '');
        if(!dataUrl.startsWith('data:image/')){
          alert('Não foi possível ler a imagem da logo.');
          return;
        }
        state.settings.logoUrl = dataUrl;
        safeValue('cfgLogoUrl', dataUrl);
        saveSoft();
        applyTheme();
        scheduleSync();
        alert('Logo carregada e salva ✅');
      };
      reader.onerror = ()=> alert('Não foi possível carregar a imagem da logo.');
      reader.readAsDataURL(file);
    });
  }

  const btnClearLogo = byId('btnClearLogo');
  if(btnClearLogo && !btnClearLogo.__sjmBound){
    btnClearLogo.__sjmBound = true;
    btnClearLogo.addEventListener('click', ()=>{
      state.settings.logoUrl = '';
      safeValue('cfgLogoUrl', '');
      if(cfgLogoFile) cfgLogoFile.value = '';
      saveSoft();
      applyTheme();
      scheduleSync();
      alert('Logo removida ✅');
    });
  }

  if(cfgLogoUrl && !cfgLogoUrl.__sjmBound){
    cfgLogoUrl.__sjmBound = true;
    cfgLogoUrl.addEventListener('input', ()=>{
      state.settings.logoUrl = cfgLogoUrl.value.trim();
      saveSoftDebounced();
      applyTheme();
    });
  }

  const applyConfigColors = ()=>{
    const p = cfgCorPrimaria?.value || state.settings.corPrimaria || '#7B2CBF';
    const a = cfgCorAcento?.value || state.settings.corAcento || '#F72585';
    state.settings.corPrimaria = p;
    state.settings.corAcento = a;
    applyTheme();
  };

  if(cfgCorPrimaria && !cfgCorPrimaria.__sjmBound){
    cfgCorPrimaria.__sjmBound = true;
    cfgCorPrimaria.addEventListener('input', applyConfigColors);
    cfgCorPrimaria.addEventListener('change', ()=>{ applyConfigColors(); saveSoft(); scheduleSync(); });
  }
  if(cfgCorAcento && !cfgCorAcento.__sjmBound){
    cfgCorAcento.__sjmBound = true;
    cfgCorAcento.addEventListener('input', applyConfigColors);
    cfgCorAcento.addEventListener('change', ()=>{ applyConfigColors(); saveSoft(); scheduleSync(); });
  }

  const btnSaveConfig = byId('btnSaveConfig');
  if(btnSaveConfig && !btnSaveConfig.__sjmBound){
    btnSaveConfig.__sjmBound = true;
    btnSaveConfig.addEventListener('click', ()=>{
      state.settings.studioNome = cfgStudioNome?.value || state.settings.studioNome || 'Studio Jaqueline Mendanha';
      state.settings.logoUrl = cfgLogoUrl?.value.trim() || '';
      state.settings.corPrimaria = cfgCorPrimaria?.value || '#7B2CBF';
      state.settings.corAcento = cfgCorAcento?.value || '#F72585';
      state.settings.studioWpp = cfgStudioWpp?.value || '';
      state.settings.plano = cfgPlano?.value || 'premium';

      saveSoft();
      applyTheme();
      renderDashboard();
      renderCalendar();
      renderAtendimentosHard();
      applyPlanUI();
      renderPlanCards();
      scheduleSync();
      alert('Config salva ✅');
    });
  }
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


function ensureReceitasExtrasUI(){
  const panel = document.querySelector('.panel[data-route="dashboard"]');
  if(!panel) return;

  let host = byId('boxReceitasExtras');
  if(!host){
    host = document.createElement('div');
    host.className = 'box';
    host.id = 'boxReceitasExtras';
    host.innerHTML = `
      <h3>Receitas extras</h3>
      <div class="row">
        <label class="field">
          <span>Data</span>
          <input id="rxData" type="date" />
        </label>
        <label class="field" style="flex:1;">
          <span>Descrição</span>
          <input id="rxDescricao" type="text" placeholder="Ex.: Joias vendidas" />
        </label>
        <label class="field">
          <span>Valor</span>
          <input id="rxValor" type="number" step="0.01" inputmode="decimal" />
        </label>
      </div>
      <div class="actions">
        <button class="btn" id="btnAddReceitaExtra">+ Adicionar receita extra</button>
      </div>
      <div class="tableWrap">
        <table class="table" id="tblReceitasExtras">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    panel.appendChild(host);

    const btn = byId('btnAddReceitaExtra');
    btn?.addEventListener('click', ()=>{
      const data = byId('rxData')?.value || todayISO();
      const descricao = (byId('rxDescricao')?.value || '').trim();
      const valor = num(byId('rxValor')?.value);
      if(!descricao){
        alert('Digite a descrição da receita extra.');
        byId('rxDescricao')?.focus();
        return;
      }
      if(valor <= 0){
        alert('Digite um valor válido.');
        byId('rxValor')?.focus();
        return;
      }

      state.receitasExtras.unshift({
        id: uid(),
        data,
        descricao,
        valor
      });

      if(byId('rxDescricao')) byId('rxDescricao').value = '';
      if(byId('rxValor')) byId('rxValor').value = '';
      if(byId('rxData')) byId('rxData').value = todayISO();

      saveSoft();
      renderReceitasExtrasUI();
      renderDashboard();
    });
  }

  const dataInp = byId('rxData');
  if(dataInp && !dataInp.value) dataInp.value = todayISO();
}

function renderReceitasExtrasUI(){
  ensureReceitasExtrasUI();

  const body = document.querySelector('#tblReceitasExtras tbody');
  if(!body) return;

  body.innerHTML = (state.receitasExtras || []).map((r)=>`
    <tr data-id="${r.id}">
      <td>${inputHTML({value:r.data || todayISO(), type:'date'})}</td>
      <td>${inputHTML({value:r.descricao || ''})}</td>
      <td>${inputHTML({value:num(r.valor).toFixed(2), type:'number', cls:'money', step:'0.01', inputmode:'decimal'})}</td>
      <td><button class="iconBtn" data-del>✕</button></td>
    </tr>
  `).join('');

  body.querySelectorAll('tr').forEach((tr)=>{
    const id = tr.dataset.id;
    const r = (state.receitasExtras || []).find(x=>x.id===id);
    if(!r) return;

    const inpData = getInp(getCell(tr,0));
    const inpDesc = getInp(getCell(tr,1));
    const inpVal  = getInp(getCell(tr,2));

    inpData?.addEventListener('change', ()=>{
      r.data = inpData.value || todayISO();
      saveSoftDebounced();
      scheduleSyncDebounced();
      updateDashboardKPIs();
    });

    inpDesc?.addEventListener('input', ()=>{
      r.descricao = inpDesc.value;
      saveSoftDebounced();
      scheduleSyncDebounced();
    });

    inpVal?.addEventListener('input', ()=>{
      r.valor = num(inpVal.value);
      updateDashboardKPIs();
      saveSoftDebounced();
      scheduleSyncDebounced();
    });

    inpVal?.addEventListener('blur', ()=> renderDashboard());
    inpData?.addEventListener('blur', ()=> renderDashboard());

    tr.querySelector('[data-del]')?.addEventListener('click', ()=>{
      if(!confirmDel('esta receita extra')) return;
      state.receitasExtras = state.receitasExtras.filter(x=>x.id!==id);
      saveSoft();
      renderReceitasExtrasUI();
      renderDashboard();
    });
  });
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

function updateDashboardInsights(){
  const atendMes = state.atendimentos.filter(a => monthKey(a.data) === currentMonthKey());
  const clientes = new Set(atendMes.map(a => String(a.cliente||'').trim()).filter(Boolean));
  const receita = atendMes.reduce((sum,a)=> sum + num(a.recebido), 0);
  const ticket = atendMes.length ? receita / atendMes.length : 0;
  const procMap = new Map();
  atendMes.forEach(a => { const p = a.procedimento || '—'; procMap.set(p, (procMap.get(p)||0)+1); });
  const topProc = [...procMap.entries()].sort((a,b)=>b[1]-a[1])[0];
  const future = state.agenda.filter(a => a.data >= todayISO() && (a.status||'Agendado') !== 'Cancelado').sort((a,b)=> (a.data+a.hora).localeCompare(b.data+b.hora))[0];
  safeText('kpiClientesMes', String(clientes.size));
  safeText('kpiTicketMedio', money(ticket));
  safeText('kpiTopProcedimento', topProc ? `${topProc[0]} (${topProc[1]})` : '—');
  safeText('kpiProximoHorario', future ? `${fmtBRDate(future.data)} ${future.hora||''}` : '—');
}


function escapeHTML(v){
  return String(v ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function exportDateBR(){
  return new Date().toLocaleString('pt-BR');
}

function monthLabelBR(mk){
  if(!mk) return '';
  const [y,m] = mk.split('-').map(Number);
  const d = new Date(y, (m||1)-1, 1);
  const txt = d.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  return txt.charAt(0).toUpperCase()+txt.slice(1);
}

function getDashboardExportData(){
  enforceAgendaRecebidoRules();
  syncAgendaToAtendimentos();
  state.materiais.forEach(calcularMaterial);
  state.atendimentos.forEach(calcularAtendimento);

  const mk = currentMonthKey();
  const resumoMes = calcResumo({ onlyMonthKey: mk, despesasScope: DASH_LUCRO_DESPESAS_SCOPE });
  const atendMes = state.atendimentos.filter(a => monthKey(a.data) === mk);
  const clientesMes = new Set(atendMes.map(a=>String(a.cliente||'').trim()).filter(Boolean));
  const receitaAtendMes = atendMes.reduce((s,a)=>s+num(a.recebido),0);
  const ticket = atendMes.length ? receitaAtendMes / atendMes.length : 0;
  const procMap = new Map();
  atendMes.forEach(a=>{
    const p = a.procedimento || '—';
    procMap.set(p, (procMap.get(p)||0)+1);
  });
  const topProc = [...procMap.entries()].sort((a,b)=>b[1]-a[1])[0];
  const future = state.agenda
    .filter(a => a.data >= todayISO() && (a.status||'Agendado') !== 'Cancelado')
    .slice()
    .sort((a,b)=> (a.data+(a.hora||'')).localeCompare(b.data+(b.hora||'')))[0];

  const despesasTotal = state.despesas.reduce((s,d)=>s+num(d.valor),0);

  return {
    studio: state.settings.studioNome || 'Studio',
    periodo: monthLabelBR(mk),
    geradoEm: exportDateBR(),
    receita: resumoMes.receita,
    custos: resumoMes.custos,
    despesas: despesasTotal,
    lucro: resumoMes.lucro,
    clientesMes: clientesMes.size,
    ticket,
    topProc: topProc ? `${topProc[0]} (${topProc[1]})` : '—',
    proximo: future ? `${fmtBRDate(future.data)} ${future.hora||''} — ${future.cliente||''}` : '—',
    atendimentos: state.atendimentos || [],
    clientes: state.clientes || [],
    materiais: state.materiais || [],
    despesasLista: state.despesas || [],
    receitasExtras: state.receitasExtras || [],
    crm: (typeof buildCRMRows === "function") ? buildCRMRows() : []
  };
}

function tableHTML(headers, rows){
  return `<table><thead><tr>${headers.map(h=>`<th>${escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>`+
    rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHTML(c)}</td>`).join('')}</tr>`).join('')+
    `</tbody></table>`;
}

function buildReportHTML(){
  const d = getDashboardExportData();
  const resumo = [
    ['Receita', money(d.receita)],
    ['Custos', money(d.custos)],
    ['Despesas', money(d.despesas)],
    ['Lucro líquido', money(d.lucro)],
    ['Clientes atendidas no mês', d.clientesMes],
    ['Ticket médio', money(d.ticket)],
    ['Procedimento mais vendido', d.topProc],
    ['Próximo horário', d.proximo]
  ];

  const atend = d.atendimentos.map(a=>[
    fmtBRDate(a.data), a.cliente, a.procedimento, money(procPrice(a.procedimento, a.data)), money(a.recebido), money(a.custoMaterial), money(a.maoObra), money(a.lucro)
  ]);
  const despesas = d.despesasLista.map(x=>[fmtBRDate(x.data), x.tipo, x.desc, money(x.valor)]);
  const rx = d.receitasExtras.map(x=>[fmtBRDate(x.data), x.descricao, money(x.valor)]);
  const materiais = d.materiais.map(m=>[m.nome||m.material||'', m.qtdPorUnidade, m.unidade, money(m.valorUnidade), m.unidadesCompradas, m.qtdTotal, m.qtdCliente, num(m.custoCliente).toFixed(4), num(m.rendimento).toFixed(2)]);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório ${escapeHTML(d.studio)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#222;margin:24px;} h1{color:#7B2CBF;margin-bottom:4px;} h2{margin-top:24px;color:#2B2D42;} .muted{color:#666} .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.card{border:1px solid #ddd;border-radius:12px;padding:12px;background:#fafafa}.label{font-size:12px;font-weight:bold;color:#3b2b5f}.value{font-size:20px;margin-top:8px} table{border-collapse:collapse;width:100%;margin:10px 0 20px;font-size:12px} th{background:#2B2D42;color:white;text-align:left} th,td{border:1px solid #ddd;padding:8px;vertical-align:top}.negative{color:#b00020;font-weight:bold}@media print{button{display:none}.cards{grid-template-columns:repeat(4,1fr)} body{margin:12mm}}
  </style></head><body>
  <h1>${escapeHTML(d.studio)}</h1><div class="muted">Relatório financeiro • ${escapeHTML(d.periodo)} • Gerado em ${escapeHTML(d.geradoEm)}</div>
  <div class="cards">
    ${resumo.map(([k,v])=>`<div class="card"><div class="label">${escapeHTML(k)}</div><div class="value ${String(v).startsWith('-')?'negative':''}">${escapeHTML(v)}</div></div>`).join('')}
  </div>
  <h2>Resumo</h2>${tableHTML(['Indicador','Valor'], resumo)}
  <h2>Atendimentos</h2>${tableHTML(['Data','Cliente','Procedimento','Valor','Recebido','Custo material','Mão de obra','Lucro'], atend)}
  <h2>Receitas extras</h2>${tableHTML(['Data','Descrição','Valor'], rx)}
  <h2>Despesas</h2>${tableHTML(['Data','Tipo','Descrição','Valor'], despesas)}
  <h2>Materiais</h2>${tableHTML(['Material','Qtd por unidade','Unidade','Valor unidade','Unidades compradas','Total comprado','Uso cliente','Custo cliente','Rendimento'], materiais)}
  <div class="muted">Relatório gerado automaticamente pelo Studio Sync Pro.</div>
  </body></html>`;
}

function pdfEscape(v){
  return String(v ?? '').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]+/g,' ');
}

function wrapTextPDF(text, maxChars=92){
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach(w=>{
    if((line + ' ' + w).trim().length > maxChars){
      if(line) lines.push(line);
      line = w;
    }else{
      line = (line + ' ' + w).trim();
    }
  });
  if(line) lines.push(line);
  return lines.length ? lines : [''];
}

function makeSimplePDF(lines){
  const pageW = 595, pageH = 842;
  const marginX = 42;
  const topY = 800;
  const lineH = 15;
  const pages = [];
  let cur = [];
  let y = topY;

  function newPage(){
    if(cur.length) pages.push(cur);
    cur = [];
    y = topY;
  }

  lines.forEach(item=>{
    const text = typeof item === 'string' ? item : (item.text || '');
    const size = typeof item === 'object' && item.size ? item.size : 10;
    const bold = typeof item === 'object' && item.bold;
    const gap = typeof item === 'object' && item.gap ? item.gap : 0;
    const maxChars = size >= 16 ? 58 : 92;
    const wrapped = wrapTextPDF(text, maxChars);
    wrapped.forEach(line=>{
      if(y < 45) newPage();
      cur.push({ text: line, y, size, bold });
      y -= lineH + (size > 12 ? 3 : 0);
    });
    y -= gap;
  });
  if(cur.length) pages.push(cur);

  const objects = [];
  function addObj(s){ objects.push(s); return objects.length; }

  const fontRegular = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBold = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageRefs = [];
  const contentRefs = [];

  pages.forEach(page=>{
    const stream = page.map(l=>{
      const f = l.bold ? 'F2' : 'F1';
      return `BT /${f} ${l.size} Tf ${marginX} ${l.y} Td (${pdfEscape(l.text)}) Tj ET`;
    }).join('\n');
    const content = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    const cRef = addObj(content);
    contentRefs.push(cRef);
    const pRef = addObj('');
    pageRefs.push(pRef);
  });

  const pagesRef = addObj('');
  pageRefs.forEach((pRef, i)=>{
    objects[pRef-1] = `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentRefs[i]} 0 R >>`;
  });
  objects[pagesRef-1] = `<< /Type /Pages /Kids [${pageRefs.map(r=>r+' 0 R').join(' ')}] /Count ${pageRefs.length} >>`;
  const catalogRef = addObj(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

  let pdf = '%PDF-1.4\n% Studio Sync Pro\n';
  const offsets = [0];
  objects.forEach((obj, i)=>{
    offsets.push(pdf.length);
    pdf += `${i+1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf += String(offsets[i]).padStart(10,'0') + ' 00000 n \n';
  pdf += `trailer\n<< /Size ${objects.length+1} /Root ${catalogRef} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function exportDashboardPDF(){
  try{
    const d = getDashboardExportData();
    const lines = [];
    lines.push({text: d.studio || 'Studio Sync Pro', size: 20, bold: true, gap: 4});
    lines.push({text: `Relatório financeiro - ${d.periodo}`, size: 13, bold: true, gap: 2});
    lines.push({text: `Gerado em ${d.geradoEm}`, size: 10, gap: 8});
    lines.push({text: 'RESUMO', size: 14, bold: true, gap: 3});
    lines.push(`Receita: ${money(d.receita)}`);
    lines.push(`Custos: ${money(d.custos)}`);
    lines.push(`Despesas: ${money(d.despesas)}`);
    lines.push(`Lucro líquido: ${money(d.lucro)}`);
    lines.push(`Clientes atendidas no mês: ${d.clientesMes}`);
    lines.push(`Ticket médio: ${money(d.ticket)}`);
    lines.push(`Procedimento mais vendido: ${d.topProc}`);
    lines.push(`Próximo horário: ${d.proximo}`);
    lines.push({text: 'ATENDIMENTOS', size: 14, bold: true, gap: 3});
    if(d.atendimentos.length){
      d.atendimentos.forEach(a=> lines.push(`${fmtBRDate(a.data)} | ${a.cliente || '-'} | ${a.procedimento || '-'} | Recebido: ${money(a.recebido)} | Lucro: ${money(a.lucro)}`));
    }else lines.push('Sem atendimentos no período.');
    lines.push({text: 'RECEITAS EXTRAS', size: 14, bold: true, gap: 3});
    if(d.receitasExtras.length){
      d.receitasExtras.forEach(r=> lines.push(`${fmtBRDate(r.data)} | ${r.descricao || '-'} | ${money(r.valor)}`));
    }else lines.push('Sem receitas extras cadastradas.');
    lines.push({text: 'DESPESAS', size: 14, bold: true, gap: 3});
    if(d.despesasLista.length){
      d.despesasLista.forEach(x=> lines.push(`${fmtBRDate(x.data)} | ${x.tipo || '-'} | ${x.desc || '-'} | ${money(x.valor)}`));
    }else lines.push('Sem despesas cadastradas.');
    lines.push({text: 'MATERIAIS', size: 14, bold: true, gap: 3});
    if(d.materiais.length){
      d.materiais.forEach(m=> lines.push(`${m.nome || m.material || '-'} | Qtd: ${m.qtdTotal || 0} ${m.unidade || ''} | Valor: ${money(m.valorCompra)} | Custo cliente: ${num(m.custoCliente).toFixed(4)}`));
    }else lines.push('Sem materiais cadastrados.');
    const pdf = makeSimplePDF(lines);
    downloadFile(`studio-sync-pro-relatorio-${todayISO()}.pdf`, pdf, 'application/pdf');
  }catch(e){
    console.error('Erro ao exportar PDF:', e);
    alert('Não foi possível exportar o PDF. Veja o console para detalhes.');
  }
}

function downloadFile(filename, content, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    a.remove();
    URL.revokeObjectURL(url);
  }, 250);
}

function sheetSection(title, headers, rows){
  return `<h2>${escapeHTML(title)}</h2>` + tableHTML(headers, rows);
}

function exportDashboardExcel(){
  try{
    const d = getDashboardExportData();
    const resumo = [
      ['Período', d.periodo], ['Gerado em', d.geradoEm], ['Receita', money(d.receita)], ['Custos', money(d.custos)], ['Despesas', money(d.despesas)], ['Lucro líquido', money(d.lucro)], ['Clientes atendidas no mês', d.clientesMes], ['Ticket médio', money(d.ticket)], ['Procedimento mais vendido', d.topProc], ['Próximo horário', d.proximo]
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse}th,td{border:1px solid #999;padding:6px}th{background:#2B2D42;color:#fff}h1,h2{font-family:Arial}</style></head><body>`+
      `<h1>${escapeHTML(d.studio)} - Relatório Studio Sync Pro</h1>`+
      sheetSection('Dashboard', ['Indicador','Valor'], resumo)+
      sheetSection('Atendimentos', ['Data','Cliente','Procedimento','Valor','Recebido','Custo material','Mão de obra','Lucro'], d.atendimentos.map(a=>[fmtBRDate(a.data), a.cliente, a.procedimento, money(procPrice(a.procedimento,a.data)), money(a.recebido), money(a.custoMaterial), money(a.maoObra), money(a.lucro)]))+
      sheetSection('Clientes', ['Nome','WhatsApp','Telefone','Nascimento','Alergia','Gestante','Nº molde','Obs.'], d.clientes.map(c=>[c.nome,c.wpp,c.tel,fmtBRDate(c.nasc),c.alergia,c.gestante,c.molde,c.obs]))+
      sheetSection('Materiais', ['Material','Qtd por unidade','Unidade','Valor unidade','Unidades compradas','Total comprado','Uso cliente','Custo cliente','Rendimento'], d.materiais.map(m=>[m.nome||m.material||'',m.qtdTotal,m.unidade,money(m.valorCompra),num(m.custoUnit).toFixed(4),m.qtdCliente,num(m.rendimento).toFixed(2),num(m.custoCliente).toFixed(4)]))+
      sheetSection('Despesas', ['Data','Tipo','Descrição','Valor'], d.despesasLista.map(x=>[fmtBRDate(x.data),x.tipo,x.desc,money(x.valor)]))+
      sheetSection('Receitas extras', ['Data','Descrição','Valor'], d.receitasExtras.map(x=>[fmtBRDate(x.data),x.descricao,money(x.valor)]))+
      `</body></html>`;
    downloadFile(`studio-sync-pro-relatorio-${todayISO()}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
  }catch(e){
    console.error('Erro ao exportar Excel:', e);
    alert('Não foi possível exportar o Excel. Veja o console para detalhes.');
  }
}

function bindDashboardExportButtons(){
  const pdfBtn = byId('btnExportPDF');
  const excelBtn = byId('btnExportExcel');
  if(pdfBtn && !pdfBtn.dataset.boundExport){
    pdfBtn.dataset.boundExport = '1';
    pdfBtn.addEventListener('click', (e)=>{ e.preventDefault(); exportDashboardPDF(); });
  }
  if(excelBtn && !excelBtn.dataset.boundExport){
    excelBtn.dataset.boundExport = '1';
    excelBtn.addEventListener('click', (e)=>{ e.preventDefault(); exportDashboardExcel(); });
  }
}

// Bind extra: garante que os botões funcionem mesmo se a tela for renderizada depois.
setTimeout(bindDashboardExportButtons, 300);
window.__SJM_EXPORT_PDF = exportDashboardPDF;
window.__SJM_EXPORT_EXCEL = exportDashboardExcel;

function bindDashboardExportButtons(){
  onClick('btnExportPDF', exportDashboardPDF);
  onClick('btnExportExcel', exportDashboardExcel);
}

function renderDashboard(){
  bindDashboardExportButtons();
  updateDashboardKPIs();
  updateDashboardInsights();
  renderReceitasExtrasUI();

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
      await navigator.serviceWorker.register("./service-worker.js");
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

/* =========================================================
   ✅ v30 FINAL: EXPORTAÇÃO E FOTO DO CALENDÁRIO CORRIGIDAS
   - Exporta PDF/Excel sem depender das funções antigas
   - Abre câmera/galeria direto ao clicar em Realizado
   ========================================================= */
function __sjmSafeArray(v){ return Array.isArray(v) ? v : []; }
function __sjmCleanText(v){
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\r\n\t]+/g,' ')
    .replace(/[()\\]/g,' ')
    .trim();
}
function __sjmCsvCell(v){
  return '"' + String(v ?? '').replace(/"/g,'""') + '"';
}
function __sjmDownloadBlob(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url); }catch{} }, 800);
}
function __sjmResumoSeguro(){
  try{
    enforceAgendaRecebidoRules();
    syncAgendaToAtendimentos();
    __sjmSafeArray(state.materiais).forEach(calcularMaterial);
    __sjmSafeArray(state.atendimentos).forEach(calcularAtendimento);
  }catch(e){ console.warn('Resumo seguro: sync parcial', e); }

  const mk = currentMonthKey();
  const atendMes = __sjmSafeArray(state.atendimentos).filter(a=>monthKey(a.data)===mk);
  const receita = atendMes.reduce((s,a)=>s+num(a.recebido),0) + __sjmSafeArray(state.receitasExtras).filter(r=>monthKey(r.data)===mk).reduce((s,r)=>s+num(r.valor),0);
  const custos = atendMes.reduce((s,a)=>s+num(a.custoMaterial)+num(a.maoObra),0);
  const despesas = __sjmSafeArray(state.despesas).reduce((s,d)=>s+num(d.valor),0);
  const clientes = new Set(atendMes.map(a=>String(a.cliente||'').trim()).filter(Boolean));
  const ticket = atendMes.length ? receita / atendMes.length : 0;
  const procMap = new Map();
  atendMes.forEach(a=>procMap.set(a.procedimento||'—',(procMap.get(a.procedimento||'—')||0)+1));
  const topProc = [...procMap.entries()].sort((a,b)=>b[1]-a[1])[0];
  const future = __sjmSafeArray(state.agenda).filter(a=>a.data>=todayISO() && (a.status||'Agendado')!=='Cancelado').sort((a,b)=>(a.data+(a.hora||'')).localeCompare(b.data+(b.hora||'')))[0];
  return {
    studio: state.settings?.studioNome || 'Studio Sync Pro',
    data: new Date().toLocaleString('pt-BR'),
    receita, custos, despesas, lucro: receita-custos-despesas,
    clientesMes: clientes.size,
    ticket,
    topProc: topProc ? `${topProc[0]} (${topProc[1]})` : '—',
    proximo: future ? `${fmtBRDate(future.data)} ${future.hora||''} - ${future.cliente||''}` : '—',
    atendimentos: __sjmSafeArray(state.atendimentos),
    clientes: __sjmSafeArray(state.clientes),
    materiais: __sjmSafeArray(state.materiais),
    despesasLista: __sjmSafeArray(state.despesas),
    receitasExtras: __sjmSafeArray(state.receitasExtras)
  };
}
function __sjmMakePdf(lines){
  const W=595, H=842, mx=42, top=800, lineH=16;
  const safeLines=[];
  lines.forEach(line=>{
    const t=__sjmCleanText(line);
    if(!t){ safeLines.push(' '); return; }
    for(let i=0;i<t.length;i+=88) safeLines.push(t.slice(i,i+88));
  });
  const pages=[]; let cur=[]; let y=top;
  safeLines.forEach(t=>{ if(y<45){ pages.push(cur); cur=[]; y=top; } cur.push({t,y}); y-=lineH; });
  if(cur.length) pages.push(cur);
  const objs=[]; const add=o=>{ objs.push(o); return objs.length; };
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contentRefs=[], pageRefs=[];
  pages.forEach(page=>{
    const stream=page.map(l=>`BT /F1 10 Tf ${mx} ${l.y} Td (${l.t}) Tj ET`).join('\n');
    const c=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    contentRefs.push(c);
    pageRefs.push(add(''));
  });
  const pagesRef=add('');
  pageRefs.forEach((r,i)=>{ objs[r-1]=`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentRefs[i]} 0 R >>`; });
  objs[pagesRef-1]=`<< /Type /Pages /Kids [${pageRefs.map(r=>r+' 0 R').join(' ')}] /Count ${pageRefs.length} >>`;
  const catalog=add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);
  let pdf='%PDF-1.4\n'; const offsets=[0];
  objs.forEach((o,i)=>{ offsets.push(pdf.length); pdf+=`${i+1} 0 obj\n${o}\nendobj\n`; });
  const xref=pdf.length;
  pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
function exportDashboardPDF(){
  try{
    const d=__sjmResumoSeguro();
    const lines=[
      d.studio, 'Relatorio financeiro - Studio Sync Pro', 'Gerado em: '+d.data, '',
      'Receita: '+money(d.receita), 'Custos: '+money(d.custos), 'Despesas: '+money(d.despesas), 'Lucro liquido: '+money(d.lucro),
      'Clientes atendidas no mes: '+d.clientesMes, 'Ticket medio: '+money(d.ticket), 'Procedimento mais vendido: '+d.topProc, 'Proximo horario: '+d.proximo,
      '', 'ATENDIMENTOS'
    ];
    d.atendimentos.forEach(a=>lines.push(`${fmtBRDate(a.data)} | ${a.cliente||'-'} | ${a.procedimento||'-'} | Recebido ${money(a.recebido)} | Lucro ${money(a.lucro)}`));
    lines.push('', 'DESPESAS'); d.despesasLista.forEach(x=>lines.push(`${fmtBRDate(x.data)} | ${x.tipo||'-'} | ${x.desc||'-'} | ${money(x.valor)}`));
    lines.push('', 'RECEITAS EXTRAS'); d.receitasExtras.forEach(x=>lines.push(`${fmtBRDate(x.data)} | ${x.descricao||'-'} | ${money(x.valor)}`));
    lines.push('', 'MATERIAIS'); d.materiais.forEach(m=>lines.push(`${m.nome||m.material||'-'} | ${m.qtdTotal||0} ${m.unidade||''} comprados | Unidade ${money(m.valorUnidade)} | Custo cliente ${num(m.custoCliente).toFixed(4)}`));
    const pdf=__sjmMakePdf(lines);
    __sjmDownloadBlob(`studio-sync-pro-relatorio-${todayISO()}.pdf`, new Blob([pdf], {type:'application/pdf'}));
  }catch(e){ console.error('PDF v30 erro:', e); alert('Erro ao exportar PDF: '+(e?.message||e)); }
}
function exportDashboardExcel(){
  try{
    const d=__sjmResumoSeguro();
    const rows=[];
    const add=(...r)=>rows.push(r.map(__sjmCsvCell).join(';'));
    add('STUDIO SYNC PRO - RELATORIO'); add('Studio', d.studio); add('Gerado em', d.data); add('');
    add('Indicador','Valor');
    add('Receita', money(d.receita)); add('Custos', money(d.custos)); add('Despesas', money(d.despesas)); add('Lucro liquido', money(d.lucro)); add('Clientes mes', d.clientesMes); add('Ticket medio', money(d.ticket)); add('Procedimento mais vendido', d.topProc); add('Proximo horario', d.proximo); add('');
    add('ATENDIMENTOS'); add('Data','Cliente','Procedimento','Recebido','Custo material','Mao de obra','Lucro');
    d.atendimentos.forEach(a=>add(fmtBRDate(a.data),a.cliente,a.procedimento,money(a.recebido),money(a.custoMaterial),money(a.maoObra),money(a.lucro))); add('');
    add('CLIENTES'); add('Nome','WhatsApp','Telefone','Nascimento','Alergia','Gestante','Molde','Obs');
    d.clientes.forEach(c=>add(c.nome,c.wpp,c.tel,c.nasc,c.alergia,c.gestante,c.molde,c.obs)); add('');
    add('MATERIAIS'); add('Material','Qtd por unidade','Unidade','Valor unidade','Unidades compradas','Total comprado','Uso cliente','Custo cliente','Rendimento');
    d.materiais.forEach(m=>add(m.nome||m.material||'',m.qtdPorUnidade,m.unidade,money(m.valorUnidade),m.unidadesCompradas,m.qtdTotal,m.qtdCliente,num(m.custoCliente).toFixed(4),num(m.rendimento).toFixed(2))); add('');
    add('DESPESAS'); add('Data','Tipo','Descricao','Valor');
    d.despesasLista.forEach(x=>add(fmtBRDate(x.data),x.tipo,x.desc,money(x.valor))); add('');
    add('RECEITAS EXTRAS'); add('Data','Descricao','Valor');
    d.receitasExtras.forEach(x=>add(fmtBRDate(x.data),x.descricao,money(x.valor)));
    const csv='\ufeff'+rows.join('\n');
    __sjmDownloadBlob(`studio-sync-pro-relatorio-${todayISO()}.csv`, new Blob([csv], {type:'text/csv;charset=utf-8'}));
  }catch(e){ console.error('Excel v30 erro:', e); alert('Erro ao exportar Excel: '+(e?.message||e)); }
}
function bindDashboardExportButtons(){
  const pdfBtn=byId('btnExportPDF');
  const excelBtn=byId('btnExportExcel');
  if(pdfBtn) pdfBtn.onclick=(e)=>{ e.preventDefault(); exportDashboardPDF(); };
  if(excelBtn) excelBtn.onclick=(e)=>{ e.preventDefault(); exportDashboardExcel(); };
}
window.__SJM_EXPORT_PDF=exportDashboardPDF;
window.__SJM_EXPORT_EXCEL=exportDashboardExcel;
setTimeout(bindDashboardExportButtons, 100);
setTimeout(bindDashboardExportButtons, 800);

function __sjmOpenPhotoPickerForAgenda(ag){
  return new Promise((resolve)=>{
    const input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.style.position='fixed';
    input.style.left='0';
    input.style.top='0';
    input.style.width='1px';
    input.style.height='1px';
    input.style.opacity='0.01';
    document.body.appendChild(input);
    input.onchange=async()=>{
      try{
        const file=input.files && input.files[0];
        if(!file){ resolve(false); return; }
        if(file.size>2_500_000){ alert('Foto muito pesada. Tente uma foto menor, até aproximadamente 2,5 MB.'); resolve(false); return; }
        const b64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result||'')); r.onerror=rej; r.readAsDataURL(file); });
        saveAgendaProcedurePhoto(ag,b64);
        saveSoft();
        renderAgendaHard(); renderCalendar(); renderClientes(); renderClientPhotoPanel(); renderAtendimentosHard(); scheduleSync();
        const at=getAtendimentoByAgendaId(ag.id)||ag;
        const txt=gratitudeMsgForAtendimento(at);
        const phone=clientWpp(ag.cliente);
        if(phone){ await copyToClipboardSafe(txt); window.open(waLink(phone,txt),'_blank'); alert('Foto salva ✅\nMensagem copiada e WhatsApp aberto. Agora anexe/envie a foto para a cliente.'); }
        else alert('Foto salva ✅\nCliente sem WhatsApp cadastrado.');
        resolve(true);
      }catch(e){ console.error('foto v30 erro:',e); alert('Erro ao salvar foto: '+(e?.message||e)); resolve(false); }
      finally{ try{ input.remove(); }catch{} }
    };
    input.click();
  });
}
function handleCalendarRealizadoComFoto(ag){
  if(!ag) return;
  ag.status='Realizado';
  ag.recebido=procPrice(ag.procedimento, ag.data);
  saveSoft(); renderAgendaHard(); renderCalendar(); scheduleSync();
  if(!canUseFeature('fotos')){ alert('Atendimento marcado como realizado ✅'); return; }
  // abre direto a galeria/câmera dentro do clique do usuário
  __sjmOpenPhotoPickerForAgenda(ag);
}


/* =========================================================
   ✅ v31 FINAL: login obrigatório, exportação corrigida, foto opcional ao realizar
   ========================================================= */
(function(){
  function v31Ascii(text){
    return String(text ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[()\\]/g,' ')
      .replace(/[^\x20-\x7E]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function v31CsvCell(v){ return '"' + String(v ?? '').replace(/"/g,'""') + '"'; }
  function v31Download(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url); }catch{} }, 1200);
  }
  function v31Resumo(){
    try{
      enforceAgendaRecebidoRules();
      syncAgendaToAtendimentos();
      (Array.isArray(state.materiais)?state.materiais:[]).forEach(calcularMaterial);
      (Array.isArray(state.atendimentos)?state.atendimentos:[]).forEach(calcularAtendimento);
    }catch(e){ console.warn('v31 resumo parcial', e); }
    const mk = currentMonthKey();
    const atendMes = (state.atendimentos||[]).filter(a=>monthKey(a.data)===mk);
    const receitaExtrasMes = (state.receitasExtras||[]).filter(r=>monthKey(r.data)===mk).reduce((s,r)=>s+num(r.valor),0);
    const receita = atendMes.reduce((s,a)=>s+num(a.recebido),0) + receitaExtrasMes;
    const custos = atendMes.reduce((s,a)=>s+num(a.custoMaterial)+num(a.maoObra),0);
    const despesas = (state.despesas||[]).reduce((s,d)=>s+num(d.valor),0);
    const clientes = new Set(atendMes.map(a=>String(a.cliente||'').trim()).filter(Boolean));
    const procMap = new Map();
    atendMes.forEach(a=>procMap.set(a.procedimento||'-',(procMap.get(a.procedimento||'-')||0)+1));
    const topProc = [...procMap.entries()].sort((a,b)=>b[1]-a[1])[0];
    const future = (state.agenda||[]).filter(a=>a.data>=todayISO() && (a.status||'Agendado')!=='Cancelado').sort((a,b)=>(a.data+(a.hora||'')).localeCompare(b.data+(b.hora||'')))[0];
    return {
      studio: state.settings?.studioNome || 'Studio Sync Pro',
      geradoEm: new Date().toLocaleString('pt-BR'),
      receita, custos, despesas, lucro: receita-custos-despesas,
      clientesMes: clientes.size,
      ticket: atendMes.length ? receita / atendMes.length : 0,
      topProc: topProc ? `${topProc[0]} (${topProc[1]})` : '-',
      proximo: future ? `${fmtBRDate(future.data)} ${future.hora||''} - ${future.cliente||''}` : '-',
      atendimentos: state.atendimentos || [],
      clientes: state.clientes || [],
      materiais: state.materiais || [],
      despesasLista: state.despesas || [],
      receitasExtras: state.receitasExtras || []
    };
  }
  function v31Pdf(lines){
    const pageW=595, pageH=842, mx=40, top=800, lineH=15;
    const safe=[];
    lines.forEach(l=>{
      const t=v31Ascii(l);
      if(!t){ safe.push(' '); return; }
      for(let i=0;i<t.length;i+=92) safe.push(t.slice(i,i+92));
    });
    const pages=[]; let cur=[]; let y=top;
    safe.forEach(t=>{ if(y<45){ pages.push(cur); cur=[]; y=top; } cur.push({t,y}); y-=lineH; });
    if(cur.length) pages.push(cur);
    const objs=[]; const add=o=>{ objs.push(o); return objs.length; };
    const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const contentRefs=[], pageRefs=[];
    pages.forEach(page=>{
      const stream=page.map(l=>`BT /F1 10 Tf ${mx} ${l.y} Td (${l.t}) Tj ET`).join('\n');
      const len=new TextEncoder().encode(stream).length;
      const c=add(`<< /Length ${len} >>\nstream\n${stream}\nendstream`);
      contentRefs.push(c); pageRefs.push(add(''));
    });
    const pagesRef=add('');
    pageRefs.forEach((r,i)=>{ objs[r-1]=`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentRefs[i]} 0 R >>`; });
    objs[pagesRef-1]=`<< /Type /Pages /Kids [${pageRefs.map(r=>r+' 0 R').join(' ')}] /Count ${pageRefs.length} >>`;
    const catalog=add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);
    let pdf='%PDF-1.4\n'; const offsets=[0];
    objs.forEach((o,i)=>{ offsets.push(new TextEncoder().encode(pdf).length); pdf+=`${i+1} 0 obj\n${o}\nendobj\n`; });
    const xref=new TextEncoder().encode(pdf).length;
    pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
    for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return pdf;
  }
  function v31ExportPDF(){
    const d=v31Resumo();
    const lines=[d.studio,'Relatorio financeiro - Studio Sync Pro','Gerado em: '+d.geradoEm,'',
      'Receita: '+money(d.receita),'Custos: '+money(d.custos),'Despesas: '+money(d.despesas),'Lucro liquido: '+money(d.lucro),
      'Clientes atendidas no mes: '+d.clientesMes,'Ticket medio: '+money(d.ticket),'Procedimento mais vendido: '+d.topProc,'Proximo horario: '+d.proximo,'',
      'ATENDIMENTOS'];
    (d.atendimentos||[]).forEach(a=>lines.push(`${fmtBRDate(a.data)} | ${a.cliente||'-'} | ${a.procedimento||'-'} | Recebido ${money(a.recebido)} | Lucro ${money(a.lucro)}`));
    lines.push('', 'DESPESAS'); (d.despesasLista||[]).forEach(x=>lines.push(`${fmtBRDate(x.data)} | ${x.tipo||'-'} | ${x.desc||'-'} | ${money(x.valor)}`));
    lines.push('', 'RECEITAS EXTRAS'); (d.receitasExtras||[]).forEach(x=>lines.push(`${fmtBRDate(x.data)} | ${x.descricao||'-'} | ${money(x.valor)}`));
    lines.push('', 'MATERIAIS'); (d.materiais||[]).forEach(m=>lines.push(`${m.nome||m.material||'-'} | ${m.qtdTotal||0} ${m.unidade||''} comprados | Unidade ${money(m.valorUnidade)} | Custo cliente ${num(m.custoCliente).toFixed(4)}`));
    v31Download(`studio-sync-pro-relatorio-${todayISO()}.pdf`, new Blob([v31Pdf(lines)], {type:'application/pdf'}));
  }
  function v31ExportExcel(){
    const d=v31Resumo();
    const rows=[]; const add=(...r)=>rows.push(r.map(v31CsvCell).join(';'));
    add('STUDIO SYNC PRO - RELATORIO'); add('Studio', d.studio); add('Gerado em', d.geradoEm); add('');
    add('Indicador','Valor');
    add('Receita', money(d.receita)); add('Custos', money(d.custos)); add('Despesas', money(d.despesas)); add('Lucro liquido', money(d.lucro)); add('Clientes mes', d.clientesMes); add('Ticket medio', money(d.ticket)); add('Procedimento mais vendido', d.topProc); add('Proximo horario', d.proximo); add('');
    add('ATENDIMENTOS'); add('Data','Cliente','Procedimento','Recebido','Custo material','Mao de obra','Lucro');
    (d.atendimentos||[]).forEach(a=>add(fmtBRDate(a.data),a.cliente,a.procedimento,money(a.recebido),money(a.custoMaterial),money(a.maoObra),money(a.lucro))); add('');
    add('CLIENTES'); add('Nome','WhatsApp','Telefone','Nascimento','Alergia','Gestante','Molde','Obs');
    (d.clientes||[]).forEach(c=>add(c.nome,c.wpp,c.tel,c.nasc,c.alergia,c.gestante,c.molde,c.obs)); add('');
    add('MATERIAIS'); add('Material','Qtd total','Unidade','Valor compra','Custo unitario','Qtd cliente','Rendimento','Custo cliente');
    (d.materiais||[]).forEach(m=>add(m.nome||m.material||'',m.qtdTotal,m.unidade,money(m.valorCompra),num(m.custoUnit).toFixed(4),m.qtdCliente,num(m.rendimento).toFixed(2),num(m.custoCliente).toFixed(4))); add('');
    add('DESPESAS'); add('Data','Tipo','Descricao','Valor');
    (d.despesasLista||[]).forEach(x=>add(fmtBRDate(x.data),x.tipo,x.desc,money(x.valor))); add('');
    add('RECEITAS EXTRAS'); add('Data','Descricao','Valor');
    (d.receitasExtras||[]).forEach(x=>add(fmtBRDate(x.data),x.descricao,money(x.valor)));
    v31Download(`studio-sync-pro-relatorio-${todayISO()}.csv`, new Blob(['\ufeff'+rows.join('\n')], {type:'text/csv;charset=utf-8'}));
  }
  function v31BindExport(){
    const pdf=byId('btnExportPDF'), excel=byId('btnExportExcel');
    if(pdf){ pdf.removeAttribute('onclick'); pdf.onclick=(e)=>{ e.preventDefault(); e.stopPropagation(); v31ExportPDF(); }; }
    if(excel){ excel.removeAttribute('onclick'); excel.onclick=(e)=>{ e.preventDefault(); e.stopPropagation(); v31ExportExcel(); }; }
  }
  window.__SJM_EXPORT_PDF=v31ExportPDF;
  window.__SJM_EXPORT_EXCEL=v31ExportExcel;
  document.addEventListener('click', function(e){
    const b=e.target?.closest?.('#btnExportPDF,#btnExportExcel');
    if(!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(b.id==='btnExportPDF') v31ExportPDF(); else v31ExportExcel();
  }, true);
  setTimeout(v31BindExport,50); setTimeout(v31BindExport,500); setTimeout(v31BindExport,1500);
})();

/* v31: Realizado pergunta se deseja foto. Se não, apenas realiza. Fotos não aparecem na tabela da agenda. */
function __sjmOpenPhotoPickerForAgenda(ag){
  return new Promise((resolve)=>{
    const input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.style.position='fixed';
    input.style.left='-9999px';
    input.style.top='0';
    document.body.appendChild(input);
    input.onchange=async()=>{
      try{
        const file=input.files && input.files[0];
        if(!file){ resolve(false); return; }
        if(file.size>2_500_000){ alert('Foto muito pesada. Tente uma foto menor, até aproximadamente 2,5 MB.'); resolve(false); return; }
        const b64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result||'')); r.onerror=rej; r.readAsDataURL(file); });
        saveAgendaProcedurePhoto(ag,b64);
        saveSoft();
        renderAgendaHard(); renderCalendar(); renderClientes(); renderClientPhotoPanel(); renderAtendimentosHard(); scheduleSync();
        const at=getAtendimentoByAgendaId(ag.id)||ag;
        const txt=gratitudeMsgForAtendimento(at);
        const phone=clientWpp(ag.cliente);
        if(phone){ await copyToClipboardSafe(txt); window.open(waLink(phone,txt),'_blank'); alert('Foto salva na pasta da cliente ✅\nMensagem copiada e WhatsApp aberto. Agora anexe/envie a foto.'); }
        else alert('Foto salva na pasta da cliente ✅\nCliente sem WhatsApp cadastrado.');
        resolve(true);
      }catch(e){ console.error('foto v31 erro:',e); alert('Erro ao salvar foto: '+(e?.message||e)); resolve(false); }
      finally{ try{ input.remove(); }catch{} }
    };
    input.click();
  });
}
function handleCalendarRealizadoComFoto(ag){
  if(!ag) return;
  ag.status='Realizado';
  ag.recebido=procPrice(ag.procedimento, ag.data);
  saveSoft();
  renderAgendaHard(); renderCalendar(); syncAgendaToAtendimentos(); renderDashboard(); scheduleSync();
  if(!canUseFeature('fotos')){ alert('Atendimento marcado como realizado ✅'); return; }
  const enviarFoto = confirm('Atendimento marcado como realizado ✅\n\nDeseja enviar uma foto?');
  if(enviarFoto){
    __sjmOpenPhotoPickerForAgenda(ag);
  }
}


/* =========================================================
   ✅ v32 FINAL: exportação robusta + foto opcional somente galeria + login bloqueado
   ========================================================= */
(function(){
  const BUILD = 'v37-persistencia-whatsapp-final-corrigido';

  function safeNum(v){ try { return num(v); } catch { return Number(v||0)||0; } }
  function safeMoney(v){ try { return money(v); } catch { return 'R$ ' + (Number(v||0)||0).toFixed(2).replace('.', ','); } }
  function safeDateBR(iso){ try { return fmtBRDate(iso); } catch { return String(iso||''); } }
  function escapeHtml(v){
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function downloadBlobV32(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url); }catch{} }, 1500);
  }
  function prepareDataV32(){
    try{
      enforceAgendaRecebidoRules();
      syncAgendaToAtendimentos();
      (state.materiais||[]).forEach(calcularMaterial);
      (state.atendimentos||[]).forEach(calcularAtendimento);
    }catch(e){ console.warn('prepareDataV32 parcial:', e); }
    const mk = currentMonthKey();
    const atendMes = (state.atendimentos||[]).filter(a=>monthKey(a.data)===mk);
    const receitaExtrasMes = (state.receitasExtras||[]).filter(r=>monthKey(r.data)===mk).reduce((s,r)=>s+safeNum(r.valor),0);
    const receita = atendMes.reduce((s,a)=>s+safeNum(a.recebido),0) + receitaExtrasMes;
    const custos = atendMes.reduce((s,a)=>s+safeNum(a.custoMaterial)+safeNum(a.maoObra),0);
    const despesas = (state.despesas||[]).reduce((s,d)=>s+safeNum(d.valor),0);
    const clientesSet = new Set(atendMes.map(a=>String(a.cliente||'').trim()).filter(Boolean));
    const procMap = new Map();
    atendMes.forEach(a=>procMap.set(a.procedimento||'-',(procMap.get(a.procedimento||'-')||0)+1));
    const topProc = [...procMap.entries()].sort((a,b)=>b[1]-a[1])[0];
    const future = (state.agenda||[]).filter(a=>a.data>=todayISO() && (a.status||'Agendado')!=='Cancelado').sort((a,b)=>(a.data+(a.hora||'')).localeCompare(b.data+(b.hora||'')))[0];
    return {
      studio: state.settings?.studioNome || 'Studio Sync Pro',
      geradoEm: new Date().toLocaleString('pt-BR'),
      receita, custos, despesas, lucro: receita-custos-despesas,
      clientesMes: clientesSet.size,
      ticket: atendMes.length ? receita / atendMes.length : 0,
      topProc: topProc ? `${topProc[0]} (${topProc[1]})` : '-',
      proximo: future ? `${safeDateBR(future.data)} ${future.hora||''} - ${future.cliente||''}` : '-',
      atendimentos: state.atendimentos || [],
      clientes: state.clientes || [],
      materiais: state.materiais || [],
      despesasLista: state.despesas || [],
      receitasExtras: state.receitasExtras || []
    };
  }
  function cssPrintV32(){
    return `
      body{font-family:Arial,sans-serif;color:#1f2230;margin:24px;background:#fff}
      h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:22px 0 8px}
      .muted{color:#6b7280;font-size:12px;margin-bottom:18px}
      .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 20px}
      .card{border:1px solid #e6e7eb;border-radius:12px;padding:10px;background:#fafafa}
      .label{font-size:11px;font-weight:bold;color:#4b3a65}.value{font-size:18px;margin-top:6px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
      th{background:#2B2D42;color:white;text-align:left;padding:7px}td{border:1px solid #e6e7eb;padding:6px;vertical-align:top}
      @media print{button{display:none}.cards{grid-template-columns:repeat(4,1fr)}}`;
  }
  function reportHtmlV32(d){
    const row = (...cells)=>'<tr>'+cells.map(c=>`<td>${escapeHtml(c)}</td>`).join('')+'</tr>';
    const head = (...cells)=>'<tr>'+cells.map(c=>`<th>${escapeHtml(c)}</th>`).join('')+'</tr>';
    return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório Studio Sync Pro</title><style>${cssPrintV32()}</style></head><body>
      <h1>${escapeHtml(d.studio)}</h1><div class="muted">Relatório financeiro • Gerado em ${escapeHtml(d.geradoEm)}</div>
      <div class="cards">
        <div class="card"><div class="label">Receita</div><div class="value">${escapeHtml(safeMoney(d.receita))}</div></div>
        <div class="card"><div class="label">Custos</div><div class="value">${escapeHtml(safeMoney(d.custos))}</div></div>
        <div class="card"><div class="label">Despesas</div><div class="value">${escapeHtml(safeMoney(d.despesas))}</div></div>
        <div class="card"><div class="label">Lucro líquido</div><div class="value">${escapeHtml(safeMoney(d.lucro))}</div></div>
        <div class="card"><div class="label">Clientes no mês</div><div class="value">${escapeHtml(d.clientesMes)}</div></div>
        <div class="card"><div class="label">Ticket médio</div><div class="value">${escapeHtml(safeMoney(d.ticket))}</div></div>
        <div class="card"><div class="label">Mais vendido</div><div class="value">${escapeHtml(d.topProc)}</div></div>
        <div class="card"><div class="label">Próximo horário</div><div class="value">${escapeHtml(d.proximo)}</div></div>
      </div>
      <h2>Atendimentos</h2><table>${head('Data','Cliente','Procedimento','Recebido','Custo Material','Mão de Obra','Lucro')}${(d.atendimentos||[]).map(a=>row(safeDateBR(a.data),a.cliente,a.procedimento,safeMoney(a.recebido),safeMoney(a.custoMaterial),safeMoney(a.maoObra),safeMoney(a.lucro))).join('')}</table>
      <h2>Clientes</h2><table>${head('Nome','WhatsApp','Telefone','Nascimento','Alergia','Gestante','Molde','Obs')}${(d.clientes||[]).map(c=>row(c.nome,c.wpp,c.tel,c.nasc,c.alergia,c.gestante,c.molde,c.obs)).join('')}</table>
      <h2>Materiais</h2><table>${head('Material','Qtd total','Unidade','Valor compra','Custo unitário','Qtd cliente','Rendimento','Custo cliente')}${(d.materiais||[]).map(m=>row(m.nome||m.material||'',m.qtdTotal,m.unidade,safeMoney(m.valorCompra),safeNum(m.custoUnit).toFixed(4),m.qtdCliente,safeNum(m.rendimento).toFixed(2),safeNum(m.custoCliente).toFixed(4))).join('')}</table>
      <h2>Despesas</h2><table>${head('Data','Tipo','Descrição','Valor')}${(d.despesasLista||[]).map(x=>row(safeDateBR(x.data),x.tipo,x.desc,safeMoney(x.valor))).join('')}</table>
      <h2>Receitas extras</h2><table>${head('Data','Descrição','Valor')}${(d.receitasExtras||[]).map(x=>row(safeDateBR(x.data),x.descricao,safeMoney(x.valor))).join('')}</table>
    </body></html>`;
  }
  function exportPDFV32(){
    try{
      const html = reportHtmlV32(prepareDataV32());
      const w = window.open('', '_blank');
      if(!w){ alert('O navegador bloqueou a janela do PDF. Libere pop-ups para imprimir/salvar em PDF.'); return; }
      w.document.open();
      w.document.write(html + `<script>setTimeout(()=>{window.print();},450)<\/script>`);
      w.document.close();
    }catch(e){ console.error('PDF v32 erro:', e); alert('Erro ao exportar PDF: '+(e?.message||e)); }
  }
  function exportExcelV32(){
    try{
      const html = reportHtmlV32(prepareDataV32());
      const excel = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html.replace(/^[\s\S]*<body>/i,'').replace(/<\/body>[\s\S]*$/i,'')}</body></html>`;
      downloadBlobV32(`studio-sync-pro-relatorio-${todayISO()}.xls`, new Blob(['\ufeff'+excel], {type:'application/vnd.ms-excel;charset=utf-8'}));
    }catch(e){ console.error('Excel v32 erro:', e); alert('Erro ao exportar Excel: '+(e?.message||e)); }
  }
  function bindExportV32(){
    const pdf=byId('btnExportPDF'), excel=byId('btnExportExcel');
    if(pdf){ pdf.onclick=(e)=>{ e.preventDefault(); e.stopPropagation(); exportPDFV32(); }; }
    if(excel){ excel.onclick=(e)=>{ e.preventDefault(); e.stopPropagation(); exportExcelV32(); }; }
  }
  document.addEventListener('click', function(e){
    const b=e.target?.closest?.('#btnExportPDF,#btnExportExcel');
    if(!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(b.id==='btnExportPDF') exportPDFV32(); else exportExcelV32();
  }, true);
  window.__SJM_EXPORT_PDF = exportPDFV32;
  window.__SJM_EXPORT_EXCEL = exportExcelV32;
  setTimeout(bindExportV32, 50); setTimeout(bindExportV32, 800); setTimeout(bindExportV32, 1800);

  // Foto Premium: somente galeria, sem capture/câmera obrigatória, e sem aparecer na tabela da agenda.
  window.__SJM_PICK_GALLERY_FOR_AGENDA = function(ag){
    return new Promise((resolve)=>{
      const input=document.createElement('input');
      input.type='file';
      input.accept='image/*';
      input.style.position='fixed'; input.style.left='-9999px'; input.style.top='0';
      document.body.appendChild(input);
      input.onchange=async()=>{
        try{
          const file=input.files && input.files[0];
          if(!file){ resolve(false); return; }
          if(file.size>3_500_000){ alert('Foto muito pesada. Escolha uma imagem menor, até aproximadamente 3,5 MB.'); resolve(false); return; }
          const b64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result||'')); r.onerror=rej; r.readAsDataURL(file); });
          saveAgendaProcedurePhoto(ag,b64);
          saveSoft();
          try{ renderAgendaHard(); renderCalendar(); renderClientes(); renderClientPhotoPanel(); renderAtendimentosHard(); renderDashboard(); scheduleSync(); }catch{}
          const at=getAtendimentoByAgendaId(ag.id)||ag;
          const txt=gratitudeMsgForAtendimento(at);
          const phone=clientWpp(ag.cliente);
          if(phone){ await copyToClipboardSafe(txt); window.open(waLink(phone,txt),'_blank'); alert('Foto salva na pasta da cliente ✅\nWhatsApp aberto com a mensagem pronta. Agora anexe a foto se desejar.'); }
          else alert('Foto salva na pasta da cliente ✅\nCliente sem WhatsApp cadastrado.');
          resolve(true);
        }catch(e){ console.error('Foto galeria v32 erro:', e); alert('Erro ao salvar foto: '+(e?.message||e)); resolve(false); }
        finally{ try{ input.remove(); }catch{} }
      };
      input.click();
    });
  };
  window.handleCalendarRealizadoComFoto = function(ag){
    if(!ag) return;
    ag.status='Realizado';
    ag.recebido=procPrice(ag.procedimento, ag.data);
    saveSoft();
    try{ syncAgendaToAtendimentos(); renderAgendaHard(); renderCalendar(); renderDashboard(); scheduleSync(); }catch{}
    if(!canUseFeature('fotos')){ alert('Atendimento marcado como realizado ✅'); return; }
    const enviarFoto = confirm('Atendimento marcado como realizado ✅\n\nDeseja enviar uma foto?');
    if(enviarFoto) window.__SJM_PICK_GALLERY_FOR_AGENDA(ag);
  };
})();


/* =========================================================
   ✅ v34: Planos, Desenvolvedor, exportação PDF real e foto via galeria
   ========================================================= */
(function(){
  function escPdf(v){ return String(v ?? '').replace(/[\\()]/g, '\\$&').replace(/[\r\n]+/g, ' '); }
  function moneyV33(v){ try{return money(v)}catch{return 'R$ '+(Number(v||0)||0).toFixed(2).replace('.', ',')} }
  function dateV33(v){ try{return fmtBRDate(v)}catch{return String(v||'')} }
  function prepareV33(){
    try{ enforceAgendaRecebidoRules(); syncAgendaToAtendimentos(); (state.materiais||[]).forEach(calcularMaterial); (state.atendimentos||[]).forEach(calcularAtendimento); }catch{}
    const mk=currentMonthKey();
    const atend=(state.atendimentos||[]).filter(a=>monthKey(a.data)===mk);
    const receitaExtras=(state.receitasExtras||[]).filter(r=>monthKey(r.data)===mk).reduce((s,r)=>s+num(r.valor),0);
    const receita=atend.reduce((s,a)=>s+num(a.recebido),0)+receitaExtras;
    const custos=atend.reduce((s,a)=>s+num(a.custoMaterial)+num(a.maoObra),0);
    const despesas=(state.despesas||[]).reduce((s,d)=>s+num(d.valor),0);
    return {receita,custos,despesas,lucro:receita-custos-despesas, atendimentos:state.atendimentos||[], clientes:state.clientes||[], materiais:state.materiais||[], despesasLista:state.despesas||[], extras:state.receitasExtras||[]};
  }
  function makePdf(lines){
    const pageH=792, pageW=612, left=36, top=756, lineH=14;
    const pages=[];
    for(let i=0;i<lines.length;i+=48) pages.push(lines.slice(i,i+48));
    const objects=[];
    function add(s){ objects.push(s); return objects.length; }
    const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pageIds=[];
    for(const pageLines of pages){
      let y=top;
      const content='BT /F1 10 Tf '+pageLines.map(line=>{ const out=`1 0 0 1 ${left} ${y} Tm (${escPdf(line).slice(0,100)}) Tj`; y-=lineH; return out; }).join(' ')+' ET';
      const stream=add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const page=add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`);
      pageIds.push(page);
    }
    const pagesObj=add(`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`);
    for(const id of pageIds){ objects[id-1]=objects[id-1].replace('/Parent 0 0 R', `/Parent ${pagesObj} 0 R`); }
    const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
    let pdf='%PDF-1.4\n'; const xref=[0];
    objects.forEach((obj,i)=>{ xref.push(pdf.length); pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`; });
    const start=pdf.length;
    pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+xref.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')+'\n';
    pdf+=`trailer << /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${start}\n%%EOF`;
    return new Blob([pdf], {type:'application/pdf'});
  }
  function download(name, blob){ const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{a.remove(); URL.revokeObjectURL(u)},1000); }
  function exportPDFV33(){
    try{
      const d=prepareV33();
      const lines=[
        state.settings?.studioNome || 'Studio Sync Pro',
        'Relatorio financeiro - '+new Date().toLocaleString('pt-BR'),
        ' ',
        'Receita: '+moneyV33(d.receita),
        'Custos: '+moneyV33(d.custos),
        'Despesas: '+moneyV33(d.despesas),
        'Lucro liquido: '+moneyV33(d.lucro),
        ' ',
        'ATENDIMENTOS'
      ];
      (d.atendimentos||[]).slice(0,120).forEach(a=>lines.push(`${dateV33(a.data)} | ${a.cliente||''} | ${a.procedimento||''} | ${moneyV33(a.recebido)}`));
      lines.push(' ', 'DESPESAS');
      (d.despesasLista||[]).slice(0,120).forEach(x=>lines.push(`${dateV33(x.data)} | ${x.tipo||''} | ${x.desc||''} | ${moneyV33(x.valor)}`));
      download(`studio-sync-pro-relatorio-${todayISO()}.pdf`, makePdf(lines));
    }catch(e){ console.error(e); alert('Erro ao exportar PDF: '+(e?.message||e)); }
  }
  function csvCell(v){ return '"'+String(v??'').replace(/"/g,'""')+'"'; }
  function exportExcelV33(){
    try{
      const d=prepareV33();
      const sections=[];
      sections.push(['RESUMO'], ['Receita', moneyV33(d.receita)], ['Custos', moneyV33(d.custos)], ['Despesas', moneyV33(d.despesas)], ['Lucro', moneyV33(d.lucro)], []);
      sections.push(['ATENDIMENTOS'], ['Data','Cliente','Procedimento','Recebido','Custo Material','Mão de Obra','Lucro']);
      (d.atendimentos||[]).forEach(a=>sections.push([dateV33(a.data),a.cliente,a.procedimento,moneyV33(a.recebido),moneyV33(a.custoMaterial),moneyV33(a.maoObra),moneyV33(a.lucro)]));
      sections.push([], ['CLIENTES'], ['Nome','WhatsApp','Telefone','Nascimento','Alergia','Gestante','Molde','Obs']);
      (d.clientes||[]).forEach(c=>sections.push([c.nome,c.wpp,c.tel,c.nasc,c.alergia,c.gestante,c.molde,c.obs]));
      sections.push([], ['MATERIAIS'], ['Material','Qtd total','Unidade','Valor compra','Custo unitário','Qtd cliente','Rendimento','Custo cliente']);
      (d.materiais||[]).forEach(m=>sections.push([m.nome||m.material||'',m.qtdTotal,m.unidade,moneyV33(m.valorCompra),m.custoUnit,m.qtdCliente,m.rendimento,m.custoCliente]));
      sections.push([], ['DESPESAS'], ['Data','Tipo','Descrição','Valor']);
      (d.despesasLista||[]).forEach(x=>sections.push([dateV33(x.data),x.tipo,x.desc,moneyV33(x.valor)]));
      const csv='\ufeff'+sections.map(r=>r.map(csvCell).join(';')).join('\n');
      download(`studio-sync-pro-relatorio-${todayISO()}.csv`, new Blob([csv], {type:'text/csv;charset=utf-8'}));
    }catch(e){ console.error(e); alert('Erro ao exportar Excel: '+(e?.message||e)); }
  }
  function bindV33(){
    try{ bindPlanModal(); applyPlanUI(); }catch(e){ console.warn('plan bind:', e); }
    const pdf=byId('btnExportPDF'), excel=byId('btnExportExcel');
    if(pdf) pdf.onclick=(e)=>{e.preventDefault(); e.stopPropagation(); exportPDFV33();};
    if(excel) excel.onclick=(e)=>{e.preventDefault(); e.stopPropagation(); exportExcelV33();};
  }
  document.addEventListener('click', function(e){
    const b=e.target?.closest?.('#btnExportPDF,#btnExportExcel');
    if(!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(b.id==='btnExportPDF') exportPDFV33(); else exportExcelV33();
  }, true);
  window.__SJM_EXPORT_PDF=exportPDFV33; window.__SJM_EXPORT_EXCEL=exportExcelV33;

  window.__SJM_PICK_GALLERY_FOR_AGENDA=function(ag){
    return new Promise((resolve)=>{
      const input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.style.position='fixed'; input.style.left='-9999px'; document.body.appendChild(input);
      input.onchange=async()=>{
        try{
          const file=input.files&&input.files[0]; if(!file){resolve(false); return;}
          if(file.size>3_500_000){ alert('Foto muito pesada. Escolha uma imagem menor, até aproximadamente 3,5 MB.'); resolve(false); return; }
          const b64=await new Promise((res,rej)=>{const r=new FileReader(); r.onload=()=>res(String(r.result||'')); r.onerror=rej; r.readAsDataURL(file);});
          saveAgendaProcedurePhoto(ag,b64); saveSoft();
          try{ syncAgendaToAtendimentos(); renderAgendaHard(); renderCalendar(); renderClientes(); renderClientPhotoPanel(); renderAtendimentosHard(); renderDashboard(); scheduleSync(); }catch{}
          const at=getAtendimentoByAgendaId(ag.id)||ag; const txt=gratitudeMsgForAtendimento(at); const phone=clientWpp(ag.cliente);
          if(phone){ await copyToClipboardSafe(txt); const link=waLink(phone,txt); setTimeout(()=>{ window.open(link,'_blank','noopener,noreferrer'); },150); alert('Foto salva na pasta da cliente ✅\nA mensagem foi copiada. O WhatsApp será aberto para enviar à cliente.'); }
          else alert('Foto salva na pasta da cliente ✅\nCliente sem WhatsApp cadastrado.');
          resolve(true);
        }catch(e){ console.error(e); alert('Erro ao salvar foto: '+(e?.message||e)); resolve(false); }
        finally{ try{input.remove()}catch{} }
      };
      input.click();
    });
  };
  window.handleCalendarRealizadoComFoto=function(ag){
    if(!ag) return;
    ag.status='Realizado'; ag.recebido=procPrice(ag.procedimento, ag.data); saveSoft();
    try{ syncAgendaToAtendimentos(); renderAgendaHard(); renderCalendar(); renderDashboard(); scheduleSync(); }catch{}
    if(!canUseFeature('fotos')){ alert('Atendimento marcado como realizado ✅'); return; }
    const enviarFoto=confirm('Atendimento marcado como realizado ✅\n\nDeseja enviar uma foto?');
    if(enviarFoto) window.__SJM_PICK_GALLERY_FOR_AGENDA(ag);
  };
  setTimeout(bindV33,50); setTimeout(bindV33,800); setTimeout(bindV33,1800);
})();

/* =========================================================
   ✅ v34: Correções de planos, desenvolvedor protegido, cadastro/recuperação
   - Plano real não vira Desenvolvedor.
   - Desenvolvedor exige senha e é modo temporário.
   - Mudar de plano salva e atualiza o botão superior.
   ========================================================= */
const SJM_DEV_PASSWORD = ""; // removido na versão cliente
const SJM_ALLOWED_PLANS = ["basic", "pro", "premium"];

function normalizePlanV34(plan){
  const p = String(plan || "premium").toLowerCase().trim();
  return SJM_ALLOWED_PLANS.includes(p) ? p : "premium";
}

function getStoredPlanV34(){
  try{
    if(!state.settings || typeof state.settings !== "object") state.settings = {};
    const fixed = normalizePlanV34(state.settings.plano);
    if(state.settings.plano !== fixed) state.settings.plano = fixed;
    return fixed;
  }catch{
    return "premium";
  }
}

function getCurrentPlan(){
  if(window.__SJM_DEV_UNLOCKED === true) return "developer";
  return getStoredPlanV34();
}

function canAccessRoute(route){
  const r = String(route || "").toLowerCase();
  if(r === "desenvolvedor") return window.__SJM_DEV_UNLOCKED === true;
  const plan = getStoredPlanV34();
  return (PLAN_FEATURES[plan] || PLAN_FEATURES.premium).includes(r);
}

function planNeededForRoute(route){
  const r = String(route || "").toLowerCase();
  if(r === "desenvolvedor") return "developer";
  if(PLAN_FEATURES.basic.includes(r)) return "basic";
  if(PLAN_FEATURES.pro.includes(r)) return "pro";
  return "premium";
}

function planUpgradeMessage(route){
  const needed = planNeededForRoute(route);
  if(needed === "developer") return "Área exclusiva do Desenvolvedor. Entre com a senha de suporte.";
  return `Recurso disponível no Plano ${PLAN_LABELS[needed] || needed}.`;
}

function canUseFeature(feature){
  if(window.__SJM_DEV_UNLOCKED === true) return true;
  const f = String(feature || "").toLowerCase();
  const plan = getStoredPlanV34();
  return (PLAN_FEATURES[plan] || []).includes(f);
}

function requireFeature(feature){
  if(canUseFeature(feature)) return true;
  alert(`Recurso disponível em plano superior.`);
  return false;
}

function applyPlanUI(){
  const stored = getStoredPlanV34();
  const label = PLAN_LABELS[stored] || stored;
  safeText("currentPlanBadge", window.__SJM_DEV_UNLOCKED === true ? `Plano ${label} + Dev` : `Plano ${label}`);
  safeValue("cfgPlano", stored);

  $$(".tab").forEach(btn=>{
    const route = String(btn.dataset.tab || "").toLowerCase();
    if(route === "desenvolvedor"){
      btn.classList.toggle("devHidden", window.__SJM_DEV_UNLOCKED !== true);
    }
    const locked = !canAccessRoute(route);
    btn.classList.toggle("locked", locked);
    btn.title = locked ? planUpgradeMessage(route) : "";
  });

  $$("[data-feature]").forEach(el=>{
    const feature = String(el.dataset.feature || "").toLowerCase();
    el.classList.toggle("featureLocked", !canUseFeature(feature));
  });

  const devPlanInfo = byId("devPlanInfo");
  if(devPlanInfo) devPlanInfo.textContent = `Plano real: ${label}`;
}

function renderPlanCards(){
  const box = byId("planCards");
  if(!box) return;
  const current = getStoredPlanV34();
  const plans = ["basic", "pro", "premium"];
  box.innerHTML = plans.map(plan => {
    const active = current === plan;
    const features = (PLAN_DESCRIPTIONS[plan] || []).map(x=>`<li>${x}</li>`).join("");
    const btn = active
      ? `<button class="btn btn--ghost" disabled>Plano atual</button>`
      : `<button class="btn" type="button" data-change-plan="${plan}">Mudar para este plano</button>`;
    return `<div class="planCard ${active ? "active" : ""}">
      <div class="planCard__top"><b>${PLAN_LABELS[plan]}</b><span>${PLAN_PRICES[plan]}</span></div>
      <ul>${features}</ul>
      ${btn}
    </div>`;
  }).join("") + `
    <div class="planCard devAccessBox">
      <div class="planCard__top"><b>Desenvolvedor</b><span>Acesso interno</span></div>
      <ul><li>Suporte às profissionais</li><li>Diagnóstico</li><li>Controle de planos</li><li>Ferramentas para futuras melhorias</li></ul>
      <button class="btn btn--ghost" type="button" id="btnUnlockDev">Entrar como desenvolvedor</button>
      <small class="hint">Esse modo não altera o plano da profissional.</small>
    </div>`;
}

function openPlanModal(){
  renderPlanCards();
  const m = byId("planModal");
  if(m) m.hidden = false;
}

function closePlanModal(){
  const m = byId("planModal");
  if(m) m.hidden = true;
}

function changePlan(plan){
  const newPlan = normalizePlanV34(plan);
  if(!SJM_ALLOWED_PLANS.includes(newPlan)) return;
  if(!state.settings || typeof state.settings !== "object") state.settings = {};
  const old = getStoredPlanV34();
  state.settings.plano = newPlan;
  saveSoft();
  scheduleSync();
  applyPlanUI();
  renderPlanCards();
  safeValue("cfgPlano", newPlan);
  alert(`Plano alterado de ${PLAN_LABELS[old] || old} para ${PLAN_LABELS[newPlan] || newPlan}.\n\nNenhum dado foi apagado. Clientes, agenda, fotos e financeiro continuam salvos.`);
}

function unlockDeveloperV34(){
  alert("Área de desenvolvedor removida desta versão cliente.");
  window.__SJM_DEV_UNLOCKED = false;
  window.__SJM_IS_DEVELOPER = false;
  return;
}

function lockDeveloperV34(){
  window.__SJM_DEV_UNLOCKED = false;
  window.__SJM_IS_DEVELOPER = false;
  applyPlanUI();
  setRoute("dashboard");
}

function bindPlanModal(){
  const badge = byId("currentPlanBadge");
  if(badge){
    badge.style.cursor = "pointer";
    badge.title = "Ver planos";
    badge.onclick = openPlanModal;
    badge.onkeydown = (e)=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); openPlanModal(); } };
  }
  onClick("btnOpenPlans", openPlanModal);
  onClick("btnClosePlanModal", closePlanModal);
}

document.addEventListener("click", (e)=>{
  const changeBtn = e.target?.closest?.("[data-change-plan]");
  if(changeBtn){
    e.preventDefault();
    e.stopPropagation();
    changePlan(changeBtn.dataset.changePlan);
    return;
  }

  const devBtn = e.target?.closest?.("#btnUnlockDev");
  if(devBtn){
    e.preventDefault();
    e.stopPropagation();
    unlockDeveloperV34();
    return;
  }

  const devTab = e.target?.closest?.('.tab[data-tab="desenvolvedor"]');
  if(devTab && window.__SJM_DEV_UNLOCKED !== true){
    e.preventDefault();
    e.stopPropagation();
    unlockDeveloperV34();
  }
}, true);

function applySignupDefaultsV34(){
  try{
    const p = window.__SJM_PENDING_SIGNUP;
    if(!p || !state) return;
    state.settings = state.settings || {};
    state.settings.studioNome = p.studioNome || state.settings.studioNome;
    state.settings.studioWpp = p.studioWpp || state.settings.studioWpp;
    state.settings.plano = p.plano || "basic";
    window.__SJM_PENDING_SIGNUP = null;
    saveSoft();
    scheduleSync();
    renderAll();
  }catch(e){ console.warn("signup defaults v34:", e); }
}

function normalizePlanOnLoadV34(){
  try{
    const old = String(state?.settings?.plano || "").toLowerCase();
    const fixed = getStoredPlanV34();
    if(old !== fixed){ saveSoft(); scheduleSync(); }
    const cfg = byId("cfgPlano");
    if(cfg){
      Array.from(cfg.options || []).forEach(opt=>{ if(opt.value === "developer") opt.remove(); });
      cfg.value = fixed;
    }
    applyPlanUI();
    applySignupDefaultsV34();
  }catch(e){ console.warn("normalize plan v34:", e); }
}

// Reforça as correções depois que o app terminar os renders iniciais.
setTimeout(()=>{ bindPlanModal(); normalizePlanOnLoadV34(); }, 100);
setTimeout(()=>{ bindPlanModal(); normalizePlanOnLoadV34(); }, 900);
setTimeout(()=>{ bindPlanModal(); normalizePlanOnLoadV34(); }, 2200);

window.__SJM_UNLOCK_DEVELOPER = unlockDeveloperV34;
window.__SJM_LOCK_DEVELOPER = lockDeveloperV34;


/* =========================================================
   ✅ v40 ESTÁVEL — Correção de base
   - Persistência real por usuário sem sobrescrever com vazio.
   - Rodapé limpo para usuárias.
   - Horários do WhatsApp salvos imediatamente.
   - Suporte visível.
   - Desenvolvedor protegido continua separado do plano real.
   ========================================================= */
(function(){
  const PUBLIC_FOOTER = "";
  const LAST_GOOD_KEY = KEY + "__last_good_v44";
  const LEGACY_LAST_KEYS = [KEY + "__last_good_v40", KEY + "__last_good_v39", KEY + "__ultimo_estado_bom"];

  function parseState(raw){
    try { return raw ? sanitizeState(JSON.parse(raw)) : null; } catch { return null; }
  }

  function arrLen(s,k){ return Array.isArray(s?.[k]) ? s[k].length : 0; }

  function photoCount(s){
    let n = 0;
    try{
      (s?.clientes||[]).forEach(c=>{ if(Array.isArray(c.fotos)) n += c.fotos.length; });
      (s?.agenda||[]).forEach(a=>{ if(a.foto || (Array.isArray(a.fotos)&&a.fotos.length)) n += (a.fotos?.length || (a.foto?1:0)); });
      (s?.atendimentos||[]).forEach(a=>{ if(a.foto || (Array.isArray(a.fotos)&&a.fotos.length)) n += (a.fotos?.length || (a.foto?1:0)); });
    }catch{}
    return n;
  }

  function usefulScore(s){
    if(!s || typeof s !== "object") return 0;
    let score = 0;
    score += arrLen(s,"agenda") * 1000;
    score += arrLen(s,"clientes") * 900;
    score += arrLen(s,"atendimentos") * 900;
    score += arrLen(s,"materiais") * 400;
    score += arrLen(s,"despesas") * 400;
    score += arrLen(s,"receitasExtras") * 350;
    score += arrLen(s,"wppQueue") * 120;
    score += arrLen(s,"crmQueue") * 120;
    score += photoCount(s) * 500;

    const settings = s.settings || {};
    const wpp = s.wpp || {};
    if(String(settings.studioNome||"").trim() && settings.studioNome !== "Studio Jaqueline Mendanha") score += 80;
    if(String(settings.studioWpp||"").trim()) score += 70;
    if(String(settings.logoUrl||"").trim()) score += 40;
    if(String(settings.plano||"").trim()) score += 20;
    if(String(wpp.horaLembrete||"").trim() && wpp.horaLembrete !== "09:00") score += 60;
    if(String(wpp.horaRelatorio||"").trim() && wpp.horaRelatorio !== "20:00") score += 90;
    ["tplConfirmacao","tplLembrete","tplAgradecimento","tplFotoProcedimento","tplFidelidade","tplAniversario","tplReativacao","tplRelatorio"].forEach(k=>{
      const v = String(wpp[k] || "").trim();
      if(v) score += Math.min(40, v.length/20);
    });
    return score;
  }

  function fresh(s){
    const t = Number(s?.meta?.updatedAt || 0);
    return Number.isFinite(t) ? t : 0;
  }

  function bestState(list){
    let best = null, bestScore = -1, bestFresh = -1;
    for(const item of list){
      const s = item ? sanitizeState(item) : null;
      if(!s) continue;
      const sc = usefulScore(s);
      const fr = fresh(s);
      if(sc > bestScore || (sc === bestScore && fr > bestFresh)){
        best = s; bestScore = sc; bestFresh = fr;
      }
    }
    return best;
  }

  function userScopedKeys(userInfo){
    const keys = [];
    if(userInfo?.uid) keys.push(storageKeyForUser(userInfo.uid));
    if(userInfo?.email) keys.push(storageKeyForUser(userInfo.email));
    if(userInfo && typeof userInfo === "string") keys.push(storageKeyForUser(userInfo));
    if(window.__SJM_CURRENT_USER?.uid) keys.push(storageKeyForUser(window.__SJM_CURRENT_USER.uid));
    if(window.__SJM_CURRENT_USER?.email) keys.push(storageKeyForUser(window.__SJM_CURRENT_USER.email));
    return [...new Set(keys.filter(Boolean))];
  }

  function readCandidates(userInfo){
    const keys = new Set([ACTIVE_STORAGE_KEY, KEY, LAST_GOOD_KEY, ...LEGACY_LAST_KEYS]);
    userScopedKeys(userInfo).forEach(k=>keys.add(k));

    // Lê chaves antigas, mas NUNCA grava em todas elas. Isso evita apagar contas com estado vazio.
    try{
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k && (k === KEY || k === LAST_GOOD_KEY || k.startsWith(KEY + "__user__") || k.includes("last_good") || k.includes("ultimo_estado"))){
          keys.add(k);
        }
      }
    }catch{}

    const list = [];
    keys.forEach(k=>{
      try{
        const st = parseState(localStorage.getItem(k));
        if(st) list.push(st);
      }catch{}
    });
    // estado atual entra por último; se estiver vazio, não vence estado útil salvo.
    list.push(state);
    return list;
  }

  function persistScoped(userInfo){
    try{
      ensureMeta(state);
      const json = JSON.stringify(state);
      const keys = new Set([ACTIVE_STORAGE_KEY, KEY]);
      userScopedKeys(userInfo || window.__SJM_CURRENT_USER || null).forEach(k=>keys.add(k));
      keys.forEach(k=>{ if(k) try{ localStorage.setItem(k, json); }catch{} });
      if(usefulScore(state) > 0){
        try{ localStorage.setItem(LAST_GOOD_KEY, json); }catch{}
      }
    }catch(e){ console.warn("v40 persistScoped:", e); }
  }

  function cleanFooter(){
    safeText("buildInfo", PUBLIC_FOOTER);
    const sync = byId("syncInfo");
    if(sync){ sync.textContent = ""; sync.style.display = "none"; }
  }

  const oldSetStatus = window.__SJM_SET_SYNC_STATUS;
  window.__SJM_SET_SYNC_STATUS = function(){ cleanFooter(); };

  const oldApplyTheme = applyTheme;
  applyTheme = function(){
    try{ oldApplyTheme(); }catch(e){ console.warn("applyTheme antigo:", e); }
    cleanFooter();
  };

  const originalSaveSoft = saveSoft;
  saveSoft = function(){
    try{
      if(!__SJM_IS_SYNCING) bumpRev();
      try{ localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state)); }catch{}
      try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch{}
      persistScoped();
      if(!__SJM_IS_SYNCING) scheduleCloudPush();
    }catch(e){
      console.warn("v40 saveSoft fallback:", e);
      try{ originalSaveSoft(); }catch{}
    }
  };

  window.__SJM_ON_AUTH_USER = function(userInfo){
    try{
      window.__SJM_CURRENT_USER = userInfo || window.__SJM_CURRENT_USER || null;
      ACTIVE_STORAGE_KEY = userInfo?.uid ? storageKeyForUser(userInfo.uid) : (userInfo?.email ? storageKeyForUser(userInfo.email) : KEY);

      const chosen = bestState(readCandidates(userInfo)) || defaultState();
      state = sanitizeState(chosen);
      ensureMeta(state);

      // Primeiro cadastro: aplica dados informados sem apagar o restante.
      const pending = window.__SJM_PENDING_SIGNUP;
      if(pending){
        state.settings = state.settings || {};
        state.settings.studioNome = pending.studioNome || state.settings.studioNome;
        state.settings.studioWpp = pending.studioWpp || state.settings.studioWpp;
        state.settings.plano = pending.plano || state.settings.plano || "basic";
        window.__SJM_PENDING_SIGNUP = null;
      }

      persistScoped(userInfo);
      applyTheme();
      renderAllHard();
      setTimeout(()=>{ try{ bindWppUI(); cleanFooter(); }catch{} },0);
      scheduleCloudPush();
      cleanFooter();
    }catch(e){
      console.error("v40 auth load:", e);
      cleanFooter();
    }
  };

  window.__SJM_APPLY_REMOTE_STATE = function(remoteState){
    const incoming = sanitizeState(remoteState);
    ensureMeta(incoming); ensureMeta(state);

    const remoteScore = usefulScore(incoming);
    const localScore = usefulScore(state);
    const remoteFresh = fresh(incoming);
    const localFresh = fresh(state);

    // Firebase vazio ou menos completo nunca pode apagar dados locais.
    if(localScore > 0 && remoteScore === 0){ persistScoped(); scheduleCloudPush(); cleanFooter(); return; }
    if(localScore > remoteScore){ persistScoped(); scheduleCloudPush(); cleanFooter(); return; }
    if(localScore === remoteScore && remoteFresh < localFresh){ persistScoped(); scheduleCloudPush(); cleanFooter(); return; }
    if(incoming?.meta?.clientId === CLIENT_ID && incoming?.meta?.rev <= state?.meta?.rev){ cleanFooter(); return; }

    state = incoming;
    try{
      enforceAgendaRecebidoRules();
      syncAgendaToAtendimentos();
      state.materiais.forEach(calcularMaterial);
      state.atendimentos.forEach(calcularAtendimento);
    }catch(e){ console.warn("v40 derived:", e); }

    persistScoped();
    applyTheme();
    renderAllHard();
    cleanFooter();
  };

  // Horários WhatsApp: aceita 23, 23:00, 08:30 e salva imediatamente.
  normalizeHora = function(v, fallback="20:00"){
    const raw = String(v ?? "").trim();
    if(!raw) return fallback;
    let m = raw.match(/^(\d{1,2})$/);
    if(m){
      const h = Math.max(0, Math.min(23, Number(m[1])));
      return String(h).padStart(2,"0") + ":00";
    }
    m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if(m){
      const h = Number(m[1]), min = Number(m[2]);
      if(Number.isFinite(h) && Number.isFinite(min) && h>=0 && h<=23 && min>=0 && min<=59){
        return String(h).padStart(2,"0") + ":" + String(min).padStart(2,"0");
      }
    }
    return fallback;
  };

  function saveWppHours(){
    state.wpp = state.wpp && typeof state.wpp === "object" ? state.wpp : {};
    const l = byId("wppHoraLembrete");
    const r = byId("wppHoraRelatorio");
    if(l) state.wpp.horaLembrete = normalizeHora(l.value, state.wpp.horaLembrete || "09:00");
    if(r) state.wpp.horaRelatorio = normalizeHora(r.value, state.wpp.horaRelatorio || "20:00");
    if(l) l.value = state.wpp.horaLembrete;
    if(r) r.value = state.wpp.horaRelatorio;
    saveSoft();
  }

  const oldBindWpp = bindWppUI;
  bindWppUI = function(){
    try{ oldBindWpp(); }catch(e){ console.warn("bindWpp antigo:", e); }
    const l = byId("wppHoraLembrete");
    const r = byId("wppHoraRelatorio");
    if(l) l.value = normalizeHora(state.wpp?.horaLembrete || l.value || "09:00", "09:00");
    if(r) r.value = normalizeHora(state.wpp?.horaRelatorio || r.value || "20:00", "20:00");
  };

  document.addEventListener("change", (e)=>{
    if(e.target?.id === "wppHoraLembrete" || e.target?.id === "wppHoraRelatorio") saveWppHours();
  }, true);
  document.addEventListener("blur", (e)=>{
    if(e.target?.id === "wppHoraLembrete" || e.target?.id === "wppHoraRelatorio") saveWppHours();
  }, true);

  function bindSupport(){
    const btn = byId("btnSupport");
    const modal = byId("supportModal");
    const close = byId("btnCloseSupport");
    if(btn && modal) btn.onclick = ()=>{ modal.hidden = false; };
    if(close && modal) close.onclick = ()=>{ modal.hidden = true; };
    if(modal && !modal.__boundV40){
      modal.__boundV40 = true;
      modal.addEventListener("click", (e)=>{ if(e.target === modal) modal.hidden = true; });
    }
    const rep = byId("btnReportProblem");
    if(rep) rep.onclick = ()=>{
      const text = encodeURIComponent("Olá! Quero reportar um problema no Studio Sync Pro.\n\nErro encontrado:");
      window.open(`https://wa.me/5517999999999?text=${text}`, "_blank", "noopener");
    };
    const printBtn = byId("btnSupportPrint");
    if(printBtn) printBtn.onclick = ()=>{
      const text = encodeURIComponent("Olá! Preciso de suporte no Studio Sync Pro. Vou enviar um print da tela agora.");
      window.open(`https://wa.me/5517999999999?text=${text}`, "_blank", "noopener");
    };
    const faqBtn = byId("btnSupportFaq");
    if(faqBtn) faqBtn.onclick = ()=>{
      alert("Manual rápido:\n\n1. Agenda: crie e acompanhe horários.\n2. Clientes: cadastre e consulte histórico.\n3. WhatsApp: use confirmação, lembrete e agradecimento.\n4. CRM: veja clientes para manutenção e remarketing.\n5. Configurações: altere logo, cores, plano e backup.");
    };
  }

  document.addEventListener("DOMContentLoaded", ()=>{ cleanFooter(); bindSupport(); });
  setTimeout(()=>{ try{ cleanFooter(); bindSupport(); if(window.__SJM_CURRENT_USER) window.__SJM_ON_AUTH_USER(window.__SJM_CURRENT_USER); }catch{} }, 50);
  setTimeout(()=>{ try{ cleanFooter(); bindSupport(); persistScoped(); }catch{} }, 600);
  setTimeout(()=>{ try{ cleanFooter(); bindSupport(); }catch{} }, 1600);
  window.addEventListener("beforeunload", ()=>{ try{ persistScoped(); }catch{} });
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState === "hidden") try{ persistScoped(); }catch{} });

  window.__SJM_V40_SAVE_NOW = persistScoped;
  window.__SJM_V40_BEST_SCORE = usefulScore;
})();

/* =========================================================
   Studio Sync Pro v41 — Roadmap 2.0 + 2.5 integrado
   - Financeiro completo básico
   - Autoagendamento configurável
   - Equipe/comissões
   - Fidelidade
   - Galeria por cliente
   - Marketing/retenção
   - Relatórios avançados
   - Permissões para secretária/funções
   ========================================================= */
(function(){
  const V41_ROUTES = [
    ['autoagendamento','Autoagendamento'],
    ['fidelidade','Fidelidade'],
  ];

  const PLAN_FEATURES_V41 = {
    basic: ['calendario','agenda','whatsapp','procedimentos','clientes','config'],
    pro: ['dashboard','calendario','agenda','whatsapp','crm','procedimentos','clientes','materiais','despesas','autoagendamento','config','export'],
    premium: ['dashboard','calendario','agenda','whatsapp','crm','procedimentos','clientes','materiais','despesas','autoagendamento','fidelidade','config','export','fotos','suporte'],
    developer: ['dashboard','calendario','agenda','whatsapp','crm','procedimentos','clientes','materiais','despesas','autoagendamento','fidelidade','config','desenvolvedor','export','fotos','suporte','dev']
  };

  function patchPlanFeatures(){
    try{
      Object.keys(PLAN_FEATURES_V41).forEach(k=>{
        if(window.PLAN_FEATURES && PLAN_FEATURES[k]){
          PLAN_FEATURES[k] = [...new Set([...(PLAN_FEATURES[k]||[]), ...PLAN_FEATURES_V41[k]])];
        }
      });
    }catch{}
  }

  function ensureV41State(){
    state.financeiro = state.financeiro && typeof state.financeiro === 'object' ? state.financeiro : {};
    state.financeiro.metaMensal = num(state.financeiro.metaMensal || 0);
    state.financeiro.diaFechamento = num(state.financeiro.diaFechamento || 1) || 1;
    state.financeiro.caixas = Array.isArray(state.financeiro.caixas) ? state.financeiro.caixas : [];

    state.autoagendamento = state.autoagendamento && typeof state.autoagendamento === 'object' ? state.autoagendamento : {};
    state.autoagendamento.slug = state.autoagendamento.slug || slugify(state.settings?.studioNome || 'studio');
    if(typeof state.autoagendamento.ativo !== 'boolean') state.autoagendamento.ativo = true;
    state.autoagendamento.horaIni = state.autoagendamento.horaIni || '08:00';
    state.autoagendamento.horaFim = state.autoagendamento.horaFim || '18:00';
    state.autoagendamento.intervalo = num(state.autoagendamento.intervalo || 15);
    state.autoagendamento.pixPct = num(state.autoagendamento.pixPct || 0);
    state.autoagendamento.pixChave = state.autoagendamento.pixChave || '';

    state.profissionais = Array.isArray(state.profissionais) ? state.profissionais : [];
    if(!state.profissionais.length){
      state.profissionais.push({id:uid(), nome:'Profissional principal', funcao:'Proprietária', comissaoPct:0, ativo:true, permissao:'dono'});
    }

    state.fidelidade = state.fidelidade && typeof state.fidelidade === 'object' ? state.fidelidade : {};
    state.fidelidade.selos = num(state.fidelidade.selos || 10) || 10;
    state.fidelidade.iniciais = num(state.fidelidade.iniciais || 2);
    state.fidelidade.resetDias = num(state.fidelidade.resetDias || 31);
    state.fidelidade.recompensa = state.fidelidade.recompensa || '1 manutenção grátis';

    state.marketing = state.marketing && typeof state.marketing === 'object' ? state.marketing : {};
    state.marketing.waitlist = Array.isArray(state.marketing.waitlist) ? state.marketing.waitlist : [];
    state.marketing.pacotes = Array.isArray(state.marketing.pacotes) ? state.marketing.pacotes : [];
    state.marketing.indicacoes = Array.isArray(state.marketing.indicacoes) ? state.marketing.indicacoes : [];
    state.marketing.satisfacao = Array.isArray(state.marketing.satisfacao) ? state.marketing.satisfacao : [];

    state.permissoes = state.permissoes && typeof state.permissoes === 'object' ? state.permissoes : {
      dono:['tudo'],
      profissional:['agenda','clientes','whatsapp',],
      secretaria:['calendario','agenda','clientes','whatsapp']
    };

    (state.clientes||[]).forEach(c=>{ if(!Array.isArray(c.fotos)) c.fotos = []; });
  }

  function slugify(s){
    return String(s||'studio').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'studio';
  }

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function csvCell(v){ return '"' + String(v ?? '').replace(/"/g,'""') + '"'; }
  function downloadText(filename, text, mime='text/plain;charset=utf-8'){
    const blob = new Blob([text], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function currentMonth(){ return todayISO().slice(0,7); }
  function sameMonth(iso, ym=currentMonth()){ return String(iso||'').slice(0,7) === ym; }

  function addRouteTabs(){
    const tabs = byId('tabs'); if(!tabs) return;
    V41_ROUTES.forEach(([id,label])=>{
      if(tabs.querySelector(`[data-tab="${id}"]`)) return;
      const b=document.createElement('button');
      b.className='tab'; b.dataset.tab=id; b.innerHTML=`${label}<span class="lockMark"> 🔒</span>`;
      b.addEventListener('click', ()=> setRoute(id));
      tabs.appendChild(b);
    });
  }

  function renderFinanceiro(){
    ensureV41State();
    const ym=currentMonth();
    const atend=(state.atendimentos||[]).filter(a=>sameMonth(a.data,ym));
    const recAt=atend.reduce((s,a)=>s+num(a.recebido),0);
    const recExtra=(state.receitasExtras||[]).filter(r=>sameMonth(r.data,ym)).reduce((s,r)=>s+num(r.valor),0);
    const desp=(state.despesas||[]).filter(d=>sameMonth(d.data,ym)).reduce((s,d)=>s+num(d.valor),0);
    const custos=atend.reduce((s,a)=>s+num(a.custoMaterial)+num(a.maoObra),0);
    safeText('finReceitaMes', money(recAt+recExtra));
    safeText('finDespesaMes', money(desp));
    safeText('finLucroMes', money(recAt+recExtra-desp-custos));
    safeText('finMetaMes', money(state.financeiro.metaMensal));
    safeValue('finMetaInput', state.financeiro.metaMensal || '');
    safeValue('finDiaFechamento', state.financeiro.diaFechamento || 1);
    const box=byId('finCaixasList');
    if(box){
      box.innerHTML = (state.financeiro.caixas||[]).slice().reverse().map(c=>`<div class="simpleItem"><b>${fmtBRDate(c.data)}</b> — Receita ${money(c.receita)} • Despesas ${money(c.despesas)} • Lucro ${money(c.lucro)}</div>`).join('') || '<div class="hint">Nenhum fechamento salvo.</div>';
    }
  }

  function bindFinanceiro(){
    onClick('btnSalvarFinanceiroConfig', ()=>{
      ensureV41State();
      state.financeiro.metaMensal=num(byId('finMetaInput')?.value);
      state.financeiro.diaFechamento=num(byId('finDiaFechamento')?.value)||1;
      saveSoft(); renderFinanceiro(); alert('Financeiro salvo ✅');
    });
    onClick('btnFecharCaixaV41', ()=>{
      ensureV41State();
      const d=todayISO();
      const atend=(state.atendimentos||[]).filter(a=>a.data===d);
      const receita=atend.reduce((s,a)=>s+num(a.recebido),0)+(state.receitasExtras||[]).filter(r=>r.data===d).reduce((s,r)=>s+num(r.valor),0);
      const despesas=(state.despesas||[]).filter(x=>x.data===d).reduce((s,x)=>s+num(x.valor),0);
      const custos=atend.reduce((s,a)=>s+num(a.custoMaterial)+num(a.maoObra),0);
      const obj={id:uid(), data:d, receita, despesas, custos, lucro:receita-despesas-custos, criadoEm:Date.now()};
      state.financeiro.caixas.push(obj); saveSoft(); renderFinanceiro(); alert('Caixa do dia fechado ✅');
    });
    onClick('btnAddReceitaExtraV41', ()=>{
      const desc=prompt('Descrição da receita extra:'); if(!desc) return;
      const valor=num(prompt('Valor:')||0);
      state.receitasExtras = Array.isArray(state.receitasExtras)?state.receitasExtras:[];
      state.receitasExtras.push({id:uid(), data:todayISO(), descricao:desc, valor});
      saveSoft(); renderFinanceiro(); renderDashboard();
    });
    onClick('btnFinanceiroCsvV41', ()=>{
      const rows=[['Data','Tipo','Descrição','Valor']];
      (state.atendimentos||[]).forEach(a=>rows.push([a.data,'Atendimento',`${a.cliente} - ${a.procedimento}`,num(a.recebido)]));
      (state.receitasExtras||[]).forEach(r=>rows.push([r.data,'Receita extra',r.descricao,num(r.valor)]));
      (state.despesas||[]).forEach(d=>rows.push([d.data,'Despesa',d.desc,num(d.valor)*-1]));
      downloadText(`financeiro-${todayISO()}.csv`, rows.map(r=>r.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8');
    });
  }

  function renderAutoAg(){
    ensureV41State();
    const a=state.autoagendamento;
    safeValue('agSlug', a.slug); safeValue('agAtivo', String(a.ativo !== false)); safeValue('agHoraIni', a.horaIni); safeValue('agHoraFim', a.horaFim); safeValue('agIntervalo', a.intervalo); safeValue('agPixPct', a.pixPct); safeValue('agPixChave', a.pixChave);
    const link=`https://app.jaquelinemendanha.com/agendar/${a.slug}`;
    safeValue('agLink', a.ativo === false ? 'Autoagenda desativada' : link);
    const prev=byId('agPreview');
    if(prev){
      if(a.ativo === false){
        prev.innerHTML = `<div class="simpleItem"><b>Status:</b> Autoagenda desativada. O link público fica bloqueado e clientes não conseguem agendar sozinhas.</div>`;
      }else{
        prev.innerHTML = `<div class="simpleItem"><b>Status:</b> Autoagenda ativada.</div><div class="simpleItem"><b>Cliente escolhe:</b> serviço, profissional e horário livre.</div><div class="simpleItem"><b>Sinal Pix:</b> ${a.pixPct}% • Chave: ${esc(a.pixChave||'não definida')}</div><div class="simpleItem"><b>Link:</b> ${esc(link)}</div>`;
      }
    }
  }
  function bindAutoAg(){
    onClick('btnSalvarAutoAg', ()=>{
      ensureV41State(); const a=state.autoagendamento;
      a.ativo=(byId('agAtivo')?.value !== 'false');
      a.slug=slugify(byId('agSlug')?.value || state.settings?.studioNome || 'studio');
      a.horaIni=byId('agHoraIni')?.value || '08:00'; a.horaFim=byId('agHoraFim')?.value || '18:00';
      a.intervalo=num(byId('agIntervalo')?.value); a.pixPct=num(byId('agPixPct')?.value); a.pixChave=byId('agPixChave')?.value||'';
      saveSoft(); renderAutoAg(); alert('Autoagendamento salvo ✅');
    });
    onClick('btnCopiarLinkAg', async()=>{ ensureV41State(); if(state.autoagendamento?.ativo === false){ alert('Autoagenda está desativada. Ative antes de copiar o link.'); return; } await copyToClipboardSafe(byId('agLink')?.value||''); alert('Link copiado ✅'); });
  }

  function renderEquipe(){
    ensureV41State();
    const body=document.querySelector('#tblEquipeV41 tbody'); if(!body) return;
    body.innerHTML=state.profissionais.map(p=>{
      const total=(state.atendimentos||[]).filter(a=>(a.profissional||'Profissional principal')===p.nome).reduce((s,a)=>s+num(a.recebido),0);
      const com=total*num(p.comissaoPct)/100;
      return `<tr data-id="${p.id}"><td><input class="mini" data-k="nome" value="${esc(p.nome)}"></td><td><select class="mini" data-k="funcao"><option ${p.funcao==='Proprietária'?'selected':''}>Proprietária</option><option ${p.funcao==='Profissional'?'selected':''}>Profissional</option><option ${p.funcao==='Secretária'?'selected':''}>Secretária</option></select></td><td><input class="mini money" data-k="comissaoPct" type="number" step="0.01" value="${num(p.comissaoPct)}"></td><td><select class="mini" data-k="ativo"><option value="true" ${p.ativo!==false?'selected':''}>Sim</option><option value="false" ${p.ativo===false?'selected':''}>Não</option></select></td><td>${money(com)}</td><td><button class="iconBtn" data-del>✕</button></td></tr>`;
    }).join('');
    body.querySelectorAll('tr').forEach(tr=>{
      const p=state.profissionais.find(x=>x.id===tr.dataset.id); if(!p) return;
      tr.querySelectorAll('[data-k]').forEach(el=>el.addEventListener('change',()=>{ const k=el.dataset.k; p[k]= k==='comissaoPct'?num(el.value):(k==='ativo'?el.value==='true':el.value); saveSoft(); renderEquipe(); }));
      tr.querySelector('[data-del]')?.addEventListener('click',()=>{ if(!confirmDel('este profissional')) return; state.profissionais=state.profissionais.filter(x=>x.id!==p.id); saveSoft(); renderEquipe(); });
    });
  }
  function bindEquipe(){ onClick('btnAddProfV41',()=>{ ensureV41State(); state.profissionais.push({id:uid(), nome:'Nova profissional', funcao:'Profissional', comissaoPct:40, ativo:true, permissao:'profissional'}); saveSoft(); renderEquipe(); }); }

  function loyaltyForClient(name){
    ensureV41State();
    const atend=(state.atendimentos||[]).filter(a=>(a.cliente||'').trim().toLowerCase()===String(name||'').trim().toLowerCase()).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
    const total=state.fidelidade.iniciais + atend.length;
    const selos=state.fidelidade.selos||10;
    const atual=total % selos || (total?selos:state.fidelidade.iniciais);
    const faltam=atual>=selos?0:selos-atual;
    const ultima=atend.length?atend[atend.length-1].data:'';
    return {total, atual, faltam, ultima};
  }
  function renderFidelidade(){
    ensureV41State();
    safeValue('fidSelos', state.fidelidade.selos); safeValue('fidIniciais', state.fidelidade.iniciais); safeValue('fidResetDias', state.fidelidade.resetDias); safeValue('fidRecompensa', state.fidelidade.recompensa);
    const body=document.querySelector('#tblFidelidade tbody');
    if(body){
      body.innerHTML=(state.clientes||[]).map(c=>{ const f=loyaltyForClient(c.nome); return `<tr><td>${esc(c.nome)}</td><td>${'⭐'.repeat(Math.min(f.atual,10))} <b>${f.atual}/${state.fidelidade.selos}</b></td><td>${f.faltam}</td><td>${f.ultima?fmtBRDate(f.ultima):'—'}</td><td><button class="btn btn--ghost" data-wpp="${esc(c.nome)}">WhatsApp</button></td></tr>`; }).join('') || '<tr><td colspan="5">Nenhuma cliente cadastrada.</td></tr>';
      body.querySelectorAll('[data-wpp]').forEach(btn=>btn.addEventListener('click',()=>{ const nome=btn.dataset.wpp; const c=findClientByName(nome); const f=loyaltyForClient(nome); const txt=(state.wpp?.tplFidelidade||'Parabéns, {cliente}! Você ganhou mais um selo.').replaceAll('{cliente}',nome).replaceAll('{studio}',state.settings?.studioNome||'Studio').replaceAll('{selo}',String(f.atual)).replaceAll('{faltam}',String(f.faltam)); if(c?.wpp||c?.tel) window.open(waLink(c.wpp||c.tel,txt),'_blank'); else alert('Cliente sem WhatsApp.'); }));
    }
    const resumo=byId('fidResumo'); if(resumo){ const arr=(state.clientes||[]).map(c=>({c,f:loyaltyForClient(c.nome)})).filter(x=>x.f.faltam<=2).slice(0,5); resumo.innerHTML=arr.map(x=>`<div class="simpleItem"><b>${esc(x.c.nome)}</b> faltam ${x.f.faltam} selo(s).</div>`).join('')||'<div class="hint">Nenhuma cliente próxima da recompensa.</div>'; }
    const ind=byId('indList'); if(ind){ ind.innerHTML=(state.marketing?.indicacoes||[]).map(x=>`<div class="simpleItem"><b>${esc(x.cliente)}</b> indicou ${esc(x.amiga)}</div>`).join('') || '<div class="hint">Sem indicações registradas.</div>'; }
  }
  function bindFidelidade(){ onClick('btnSalvarFidelidade',()=>{ ensureV41State(); state.fidelidade.selos=num(byId('fidSelos')?.value)||10; state.fidelidade.iniciais=num(byId('fidIniciais')?.value)||0; state.fidelidade.resetDias=num(byId('fidResetDias')?.value)||31; state.fidelidade.recompensa=byId('fidRecompensa')?.value||'1 manutenção grátis'; saveSoft(); renderFidelidade(); alert('Fidelidade salva ✅'); }); }

  function renderGaleria(){
    ensureV41State();
    const q=String(byId('galBusca')?.value||'').toLowerCase();
    const box=byId('galeriaClientes'); if(!box) return;
    const clientes=(state.clientes||[]).filter(c=>!q || String(c.nome||'').toLowerCase().includes(q));
    box.innerHTML=clientes.map(c=>{
      const fotos=(c.fotos||[]).concat((state.atendimentos||[]).filter(a=>a.cliente===c.nome && a.foto).map(a=>({data:a.data, procedimento:a.procedimento, imagem:a.foto})));
      return `<div class="photoClient"><h3>📁 ${esc(c.nome||'Cliente')}</h3><div class="hint">${fotos.length} foto(s) salvas</div><div class="photoMiniWrap">${fotos.slice(-6).reverse().map(f=>`<a href="${esc(f.imagem)}" target="_blank"><img src="${esc(f.imagem)}" alt="Foto"></a>`).join('') || '<span class="hint">Sem fotos ainda.</span>'}</div></div>`;
    }).join('') || '<div class="hint">Nenhuma cliente encontrada.</div>';
  }
  function bindGaleria(){ const b=byId('galBusca'); if(b && !b.__v41){ b.__v41=true; b.addEventListener('input', renderGaleria); } }

  function renderMarketing(){
    ensureV41State();
    const set=(id, arr, fmt)=>{ const el=byId(id); if(el) el.innerHTML=arr.map(fmt).join('') || '<div class="hint">Sem registros.</div>'; };
    set('waitList', state.marketing.waitlist, x=>`<div class="simpleItem"><b>${esc(x.cliente)}</b> quer ${esc(x.desejo)} <button class="iconBtn" data-waitdel="${x.id}">✕</button></div>`);
    set('pkgList', state.marketing.pacotes, x=>`<div class="simpleItem"><b>${esc(x.nome)}</b> — ${money(x.valor)}</div>`);
    set('indList', state.marketing.indicacoes, x=>`<div class="simpleItem"><b>${esc(x.cliente)}</b> indicou ${esc(x.amiga)}</div>`);
    set('satList', state.marketing.satisfacao.slice(-10).reverse(), x=>`<div class="simpleItem"><b>${esc(x.cliente)}</b> — nota ${x.nota}/5<br><small>${esc(x.comentario)}</small></div>`);
    document.querySelectorAll('[data-waitdel]').forEach(b=>b.addEventListener('click',()=>{ state.marketing.waitlist=state.marketing.waitlist.filter(x=>x.id!==b.dataset.waitdel); saveSoft(); renderMarketing(); }));
  }
  function bindMarketing(){
    onClick('btnAddWait',()=>{ ensureV41State(); const cliente=byId('waitCliente')?.value||''; const desejo=byId('waitDesejo')?.value||''; if(!cliente) return alert('Informe a cliente.'); state.marketing.waitlist.push({id:uid(), cliente, desejo, data:todayISO()}); saveSoft(); renderMarketing(); });
    onClick('btnAddPkg',()=>{ ensureV41State(); const nome=byId('pkgNome')?.value||''; if(!nome) return alert('Informe o nome do pacote.'); state.marketing.pacotes.push({id:uid(), nome, valor:num(byId('pkgValor')?.value), data:todayISO()}); saveSoft(); renderMarketing(); });
    onClick('btnAddIndicacao',()=>{ ensureV41State(); const cliente=byId('indCliente')?.value||''; const amiga=byId('indAmiga')?.value||''; if(!cliente||!amiga) return alert('Preencha cliente e indicada.'); state.marketing.indicacoes.push({id:uid(), cliente, amiga, data:todayISO()}); saveSoft(); renderMarketing(); renderFidelidade(); });
    onClick('btnAddSat',()=>{ ensureV41State(); const cliente=byId('satCliente')?.value||''; if(!cliente) return alert('Informe a cliente.'); state.marketing.satisfacao.push({id:uid(), cliente, nota:num(byId('satNota')?.value), comentario:byId('satComentario')?.value||'', data:todayISO()}); saveSoft(); renderMarketing(); });
  }

  function groupSum(arr, keyFn, valFn){ const m=new Map(); arr.forEach(x=>{ const k=keyFn(x)||'—'; m.set(k,(m.get(k)||0)+num(valFn(x))); }); return [...m.entries()].sort((a,b)=>b[1]-a[1]); }
  function renderRelatorios(){
    const atend=state.atendimentos||[];
    const topClientes=groupSum(atend,a=>a.cliente,a=>a.recebido).slice(0,10);
    const topServ=groupSum(atend,a=>a.procedimento,a=>a.recebido).slice(0,10);
    const lucro=groupSum(atend,a=>a.procedimento,a=>num(a.recebido)-num(a.custoMaterial)-num(a.maoObra)).slice(0,10);
    const totalAg=(state.agenda||[]).length, faltas=(state.agenda||[]).filter(a=>['Cancelado','Falta da cliente'].includes(a.status)).length;
    const put=(id, html)=>{ const el=byId(id); if(el) el.innerHTML=html||'<div class="hint">Sem dados.</div>'; };
    put('relTopClientes', topClientes.map((x,i)=>`<div class="simpleItem">${i+1}. <b>${esc(x[0])}</b> — ${money(x[1])}</div>`).join(''));
    put('relTopServicos', topServ.map((x,i)=>`<div class="simpleItem">${i+1}. <b>${esc(x[0])}</b> — ${money(x[1])}</div>`).join(''));
    put('relFaltas', `<div class="simpleItem"><b>${faltas}</b> faltas/cancelamentos de ${totalAg} agendamentos (${totalAg?((faltas/totalAg)*100).toFixed(1):0}%).</div>`);
    put('relLucroServico', lucro.map((x,i)=>`<div class="simpleItem">${i+1}. <b>${esc(x[0])}</b> — ${money(x[1])}</div>`).join(''));
  }
  function bindRelatorios(){ onClick('btnRelCsv',()=>{ const rows=[['Relatório','Nome','Valor']]; groupSum(state.atendimentos||[],a=>a.cliente,a=>a.recebido).forEach(x=>rows.push(['Top clientes',x[0],x[1]])); groupSum(state.atendimentos||[],a=>a.procedimento,a=>a.recebido).forEach(x=>rows.push(['Top serviços',x[0],x[1]])); downloadText(`relatorios-${todayISO()}.csv`, rows.map(r=>r.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8'); }); }

  function renderPermissoes(){
    const el=byId('permResumo'); if(!el) return;
    el.innerHTML = `
      <div class="simpleItem"><b>Dono/Proprietária:</b> acesso completo ao sistema, financeiro, planos, relatórios e equipe.</div>
      <div class="simpleItem"><b>Profissional:</b> agenda própria, clientes, fotos, WhatsApp e histórico permitido.</div>
      <div class="simpleItem"><b>Secretária:</b> agenda de todas, marcar, confirmar, reagendar e cancelar; sem financeiro sensível.</div>
      <div class="simpleItem"><b>Desenvolvedor:</b> acesso temporário via senha para suporte e diagnóstico.</div>`;
  }

  function renderV41All(){
    try{ patchPlanFeatures(); ensureV41State(); addRouteTabs(); renderFinanceiro(); renderAutoAg(); renderEquipe(); renderFidelidade(); renderGaleria(); renderMarketing(); renderRelatorios(); renderPermissoes(); applyPlanUI?.(); }catch(e){ console.warn('v41 render:',e); }
  }
  function bindV41All(){
    try{ bindFinanceiro(); bindAutoAg(); bindEquipe(); bindFidelidade(); bindGaleria(); bindMarketing(); bindRelatorios(); }catch(e){ console.warn('v41 bind:',e); }
  }

  // integra ao render geral sem quebrar o que já existe
  const oldRenderAllHardV41 = renderAllHard;
  renderAllHard = function(){
    try{ oldRenderAllHardV41(); }catch(e){ console.warn('renderAllHard antigo:',e); }
    renderV41All();
  };

  const oldSaveSoftV41 = saveSoft;
  saveSoft = function(){ ensureV41State(); return oldSaveSoftV41(); };

  document.addEventListener('DOMContentLoaded',()=>{ bindV41All(); renderV41All(); });
  setTimeout(()=>{ bindV41All(); renderV41All(); },200);
  setTimeout(()=>{ bindV41All(); renderV41All(); },1200);

  window.__SJM_V41_RENDER = renderV41All;
})();

/* v41 final — libera rotas novas nos planos corretos */
(function(){
  try{
    const add = (plan, items)=>{ if(PLAN_FEATURES[plan]) PLAN_FEATURES[plan] = [...new Set([...(PLAN_FEATURES[plan]||[]), ...items])]; };
    add('pro', ['autoagendamento']);
    add('premium', ['autoagendamento','fidelidade',]);
    add('developer', ['autoagendamento','fidelidade',]);
    if(PLAN_DESCRIPTIONS?.pro) PLAN_DESCRIPTIONS.pro = [...new Set([...PLAN_DESCRIPTIONS.pro, 'Autoagendamento', 'Financeiro completo', 'Relatórios CSV'])];
    applyPlanUI?.();
  }catch(e){ console.warn('v41 final plan patch:', e); }
})();


/* =========================================================
   v44 VERIFICADO — ajustes finais de estabilidade
   - Expõe planos no window para patches futuros.
   - Garante rotas 2.0/2.5 nos planos corretos.
   - Reaplica rodapé limpo e botão suporte.
   - Mantém modo Desenvolvedor separado do plano real.
   ========================================================= */
(function(){
  try{
    window.PLAN_FEATURES = PLAN_FEATURES;
    window.PLAN_LABELS = PLAN_LABELS;
    const add = (plan, items)=>{
      if(!PLAN_FEATURES[plan]) return;
      PLAN_FEATURES[plan] = [...new Set([...(PLAN_FEATURES[plan]||[]), ...items])];
    };
    add('basic', ['calendario','agenda','whatsapp','procedimentos','clientes','config']);
    add('pro', ['dashboard','calendario','agenda','whatsapp','crm','procedimentos','clientes','materiais','despesas','autoagendamento','config','export']);
    add('premium', ['dashboard','calendario','agenda','whatsapp','crm','procedimentos','clientes','materiais','despesas','autoagendamento','fidelidade','config','export','fotos','suporte']);
    add('developer', ['dashboard','calendario','agenda','whatsapp','crm','procedimentos','clientes','materiais','despesas','autoagendamento','fidelidade','config','desenvolvedor','export','fotos','suporte','dev']);

    const publicFooter = '';
    const clean = ()=>{
      try{
        const build = document.getElementById('buildInfo');
        if(build) build.textContent = publicFooter;
        const sync = document.getElementById('syncInfo');
        if(sync){ sync.textContent=''; sync.style.display='none'; }
      }catch{}
    };
    clean();
    document.addEventListener('DOMContentLoaded', clean);
    setTimeout(clean, 100);
    setTimeout(clean, 1000);

    const support = ()=>{
      const btn = document.getElementById('btnSupport');
      const modal = document.getElementById('supportModal');
      const close = document.getElementById('btnCloseSupport');
      if(btn && modal) btn.onclick = ()=>{ modal.hidden = false; };
      if(close && modal) close.onclick = ()=>{ modal.hidden = true; };
    };
    support();
    document.addEventListener('DOMContentLoaded', support);
    setTimeout(support, 300);

    // Reforça render das permissões e planos depois que todos os módulos carregarem.
    setTimeout(()=>{ try{ applyPlanUI(); window.__SJM_V41_RENDER?.(); }catch(e){ console.warn('v44 final render:', e); } }, 500);
  }catch(e){ console.warn('v44 final patch:', e); }
})();


/* =========================================================
   Studio Sync Pro v45 — Dashboard central financeiro
   - Aba Financeiro removida do menu
   - Financeiro completo dentro do Dashboard
   - Resumo visual: hoje, meta, próximos horários e alertas
   ========================================================= */
(function(){
  function el(id){ return document.getElementById(id); }
  function n(v){ return Number(String(v ?? 0).replace('R$','').replace(/\./g,'').replace(',','.')) || 0; }
  function brMoney(v){
    try{ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
    catch{ return 'R$ 0,00'; }
  }
  function isoToday(){
    const d=new Date();
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function ymToday(){ return isoToday().slice(0,7); }
  function sameYM(date, ym){ return String(date||'').slice(0,7)===ym; }
  function setText(id, txt){ const x=el(id); if(x) x.textContent=txt; }

  function removeFinanceiroMenu(){
    try{
      document.querySelectorAll('[data-tab="financeiro"], .tab[data-tab="financeiro"], button[data-route="financeiro"], a[href="#financeiro"]').forEach(x=>x.remove());
      if(location.hash==='#financeiro') location.hash='#dashboard';
    }catch{}
  }

  function calcFinance(){
    const ym=ymToday();
    const atend=(state?.atendimentos||[]).filter(a=>sameYM(a.data,ym));
    const agenda=(state?.agenda||[]);
    const receitasExtras=(state?.receitasExtras||[]).filter(r=>sameYM(r.data,ym));
    const despesas=(state?.despesas||[]).filter(d=>sameYM(d.data,ym));
    const receita=atend.reduce((s,a)=>s+n(a.recebido),0)+receitasExtras.reduce((s,r)=>s+n(r.valor),0);
    const custos=atend.reduce((s,a)=>s+n(a.custoMaterial)+n(a.maoObra),0);
    const desp=despesas.reduce((s,d)=>s+n(d.valor),0);
    const meta=n(state?.financeiro?.metaMensal || 0);
    const hoje=isoToday();
    const hojeAgenda=agenda.filter(a=>String(a.data||'')===hoje);
    const hojeAtend=atend.filter(a=>String(a.data||'')===hoje);
    const hojeReceitaPrev=hojeAgenda.reduce((s,a)=>s+n(a.valor||a.recebido),0);
    const hojeRecebido=hojeAtend.reduce((s,a)=>s+n(a.recebido),0);
    return {receita,custos,desp,lucro:receita-custos-desp,meta,hojeAgenda,hojeAtend,hojeReceitaPrev,hojeRecebido};
  }

  function renderDashboardVisualV44(){
    try{
      removeFinanceiroMenu();
      const f=calcFinance();
      setText('dashHojeAtend', String(f.hojeAgenda.length || f.hojeAtend.length || 0));
      setText('dashHojeReceita', brMoney(f.hojeReceitaPrev));
      setText('dashHojeRecebido', brMoney(f.hojeRecebido));

      const pct=f.meta>0 ? Math.min(100, Math.round((f.receita/f.meta)*100)) : 0;
      setText('dashMetaTexto', `${brMoney(f.receita)} / ${brMoney(f.meta)}`);
      setText('dashMetaPct', `${pct}%`);
      const bar=el('dashMetaBar'); if(bar) bar.style.width=pct+'%';

      const now=new Date();
      const upcoming=(state?.agenda||[])
        .filter(a=>!['Cancelado','Realizado'].includes(String(a.status||'')))
        .map(a=>({a, t:new Date(`${a.data||isoToday()}T${a.hora||'00:00'}`)}))
        .filter(x=>!isNaN(x.t) && x.t>=new Date(now.getTime()-60*60000))
        .sort((x,y)=>x.t-y.t).slice(0,5);
      const next=el('dashNextList');
      if(next){
        next.innerHTML = upcoming.length ? upcoming.map(x=>`<div class="simpleItem"><b>${String(x.a.hora||'--:--')}</b> — ${String(x.a.cliente||'Cliente')}<br><small>${String(x.a.procedimento||'Procedimento')} • ${brMoney(n(x.a.valor||x.a.recebido))}</small></div>`).join('') : '<div class="hint">Nenhum próximo horário agendado.</div>';
      }

      const alerts=[];
      const materiais=(state?.materiais||[]);
      materiais.forEach(m=>{
        const qtd=n(m.qtdTotal ?? m.qtd ?? m.total);
        const uso=n(m.qtdCliente ?? m.usoCliente ?? m.qtdPorCliente);
        const rendimento=uso>0 ? qtd/uso : n(m.rendimento);
        if((uso>0 && rendimento<=5) || qtd<=0) alerts.push(`Estoque baixo: ${String(m.nome||m.material||'material')}`);
      });
      const crm=(state?.clientes||[]).length ? '' : 'Cadastre clientes para ativar CRM e fidelidade.';
      if(crm) alerts.push(crm);
      if(f.meta<=0) alerts.push('Defina uma meta mensal para acompanhar crescimento.');
      const al=el('dashAlertList');
      if(al){ al.innerHTML = alerts.length ? alerts.slice(0,5).map(a=>`<div class="simpleItem">⚠️ ${a}</div>`).join('') : '<div class="simpleItem">✅ Sem alertas importantes agora.</div>'; }
    }catch(e){ console.warn('dashboard v44:', e); }
  }

  const oldSetRouteV44 = window.setRoute;
  if(typeof oldSetRouteV44 === 'function'){
    window.setRoute = function(route){
      if(route==='financeiro') route='dashboard';
      return oldSetRouteV44(route);
    };
  }

  const oldRenderDashV44 = window.renderDashboard;
  if(typeof oldRenderDashV44 === 'function'){
    window.renderDashboard = function(){
      const r=oldRenderDashV44.apply(this, arguments);
      try{ if(typeof window.renderFinanceiro==='function') window.renderFinanceiro(); }catch{}
      renderDashboardVisualV44();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', ()=>setTimeout(renderDashboardVisualV44, 150));
  setTimeout(renderDashboardVisualV44, 500);
  setTimeout(renderDashboardVisualV44, 1500);
  window.__SJM_RENDER_DASHBOARD_VISUAL_V44 = renderDashboardVisualV44;
})();


/* =========================================================
   Studio Sync Pro v45 — correções de dashboard/CRM/persistência
   - Meta mensal salva e atualiza o dashboard na hora.
   - Aba Relatórios removida do menu; indicadores foram para o CRM.
   - Proteção extra para login não sobrescrever dados locais com base vazia.
   ========================================================= */
(function(){
  function $id(id){ return document.getElementById(id); }
  function toNum(v){ return Number(String(v ?? 0).replace('R$','').replace(/\./g,'').replace(',','.')) || 0; }
  function brl(v){ try{return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}catch{return 'R$ 0,00';} }
  function today(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function ym(){ return today().slice(0,7); }
  function sameMonth(d){ return String(d||'').slice(0,7)===ym(); }
  function safeArray(v){ return Array.isArray(v) ? v : []; }
  function dataScoreV45(s){
    try{
      if(!s || typeof s!=='object') return 0;
      let photoCount=0;
      safeArray(s.clientes).forEach(c=>{ photoCount += safeArray(c.fotos).length; });
      return safeArray(s.agenda).length*4 + safeArray(s.clientes).length*4 + safeArray(s.atendimentos).length*5 + safeArray(s.materiais).length*2 + safeArray(s.despesas).length*2 + safeArray(s.receitasExtras).length*2 + safeArray(s.crmQueue).length + photoCount*2;
    }catch{return 0;}
  }
  function newer(a,b){ return Number(a?.meta?.updatedAt||0) >= Number(b?.meta?.updatedAt||0); }
  function byIdMap(arr){ const m=new Map(); safeArray(arr).forEach(x=>{ if(x && x.id) m.set(String(x.id), x); }); return m; }
  function mergeById(localArr, remoteArr){
    const m=byIdMap(remoteArr);
    safeArray(localArr).forEach(x=>{ if(x && x.id) m.set(String(x.id), x); });
    const noId=[...safeArray(remoteArr),...safeArray(localArr)].filter(x=>x && !x.id);
    return [...m.values(), ...noId];
  }
  function mergeStatesV45(local, remote){
    const l = (typeof sanitizeState==='function') ? sanitizeState(local||{}) : (local||{});
    const r = (typeof sanitizeState==='function') ? sanitizeState(remote||{}) : (remote||{});
    const ls=dataScoreV45(l), rs=dataScoreV45(r);
    if(rs===0 && ls>0) return l;
    if(ls===0 && rs>0) return r;
    const base = newer(l,r) ? structuredClone(l) : structuredClone(r);
    const other = base===l ? r : l;
    base.settings = {...(other.settings||{}), ...(base.settings||{})};
    base.wpp = {...(other.wpp||{}), ...(base.wpp||{})};
    base.financeiro = {...(other.financeiro||{}), ...(base.financeiro||{})};
    ['agenda','clientes','atendimentos','materiais','despesas','receitasExtras','wppQueue','crmQueue','profissionais'].forEach(k=>{ base[k]=mergeById(base[k], other[k]); });
    if(!base.meta) base.meta={};
    base.meta.updatedAt = Math.max(Number(l?.meta?.updatedAt||0), Number(r?.meta?.updatedAt||0), Date.now());
    return (typeof sanitizeState==='function') ? sanitizeState(base) : base;
  }
  function currentUserKeyV45(userInfo){
    try{ return (typeof storageKeyForUser==='function') ? storageKeyForUser(userInfo) : null; }catch{return null;}
  }
  function persistEverywhereV45(){
    try{
      if(typeof ensureV41State==='function') ensureV41State();
      if(typeof ensureMeta==='function') ensureMeta(state);
      const raw=JSON.stringify(state);
      localStorage.setItem(typeof ACTIVE_STORAGE_KEY!=='undefined' ? ACTIVE_STORAGE_KEY : 'studio_sync_pro_state', raw);
      if(typeof KEY!=='undefined') localStorage.setItem(KEY, raw);
      const u=window.__SJM_CURRENT_USER;
      const k=currentUserKeyV45(u);
      if(k) localStorage.setItem(k, raw);
      const email=(u?.email||'').toLowerCase().trim();
      if(email) localStorage.setItem('studio_sync_backup_email_'+email, raw);
      const uid=(u?.uid||'').trim();
      if(uid) localStorage.setItem('studio_sync_backup_uid_'+uid, raw);
    }catch(e){ console.warn('v45 persist:',e); }
  }

  // Mantém backup local forte antes de sair ou trocar de aba.
  window.addEventListener('beforeunload', persistEverywhereV45);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') persistEverywhereV45(); });

  // Reforço no login: sempre mescla em vez de trocar por estado vazio.
  const previousAuthHandler = window.__SJM_ON_AUTH_USER;
  window.__SJM_ON_AUTH_USER = function(userInfo){
    try{
      const userKey=currentUserKeyV45(userInfo);
      const candidates=[];
      try{ if(typeof state==='object') candidates.push(state); }catch{}
      try{ if(userKey && localStorage.getItem(userKey)) candidates.push(JSON.parse(localStorage.getItem(userKey))); }catch{}
      try{ if(typeof KEY!=='undefined' && localStorage.getItem(KEY)) candidates.push(JSON.parse(localStorage.getItem(KEY))); }catch{}
      try{ const email=(userInfo?.email||'').toLowerCase().trim(); if(email && localStorage.getItem('studio_sync_backup_email_'+email)) candidates.push(JSON.parse(localStorage.getItem('studio_sync_backup_email_'+email))); }catch{}
      try{ const uid=(userInfo?.uid||'').trim(); if(uid && localStorage.getItem('studio_sync_backup_uid_'+uid)) candidates.push(JSON.parse(localStorage.getItem('studio_sync_backup_uid_'+uid))); }catch{}
      let merged=candidates[0] || (typeof defaultState==='function' ? defaultState() : {});
      candidates.slice(1).forEach(c=>{ merged=mergeStatesV45(merged,c); });
      if(userKey && typeof ACTIVE_STORAGE_KEY!=='undefined') ACTIVE_STORAGE_KEY=userKey;
      state = (typeof sanitizeState==='function') ? sanitizeState(merged) : merged;
      persistEverywhereV45();
      if(typeof applyTheme==='function') applyTheme();
      if(typeof renderAllHard==='function') renderAllHard();
      if(typeof scheduleCloudPush==='function') scheduleCloudPush();
      window.__SJM_SET_SYNC_STATUS?.('Sync: dados preservados ✅');
    }catch(e){
      console.warn('v45 auth merge falhou, usando handler anterior:', e);
      try{ previousAuthHandler?.(userInfo); }catch{}
    }
  };

  // Remoto do Firebase nunca apaga uma base local mais completa.
  const previousRemoteApply = window.__SJM_APPLY_REMOTE_STATE;
  window.__SJM_APPLY_REMOTE_STATE = function(remoteState){
    try{
      const localScore=dataScoreV45(state);
      const remoteScore=dataScoreV45(remoteState);
      if(localScore>0 && remoteScore===0){
        window.__SJM_SET_SYNC_STATUS?.('Sync: remoto vazio ignorado ✅');
        if(typeof scheduleCloudPush==='function') scheduleCloudPush();
        return;
      }
      const merged=mergeStatesV45(state, remoteState);
      state=(typeof sanitizeState==='function') ? sanitizeState(merged) : merged;
      persistEverywhereV45();
      if(typeof enforceAgendaRecebidoRules==='function') enforceAgendaRecebidoRules();
      if(typeof syncAgendaToAtendimentos==='function') syncAgendaToAtendimentos();
      if(typeof renderAllHard==='function') renderAllHard();
      window.__SJM_SET_SYNC_STATUS?.('Sync: atualizado sem perda ✅');
    }catch(e){
      console.warn('v45 remote merge falhou:', e);
      try{ previousRemoteApply?.(remoteState); }catch{}
    }
  };
  window.__SJM_SET_STATE_FROM_CLOUD = function(remoteState){
    if(window.__SJM_IS_EDITING){ window.__SJM_PENDING_REMOTE=remoteState; return; }
    window.__SJM_APPLY_REMOTE_STATE(remoteState);
  };

  function updateDashboardMetaV45(){
    try{
      if(!state.financeiro) state.financeiro={};
      const receita = safeArray(state.atendimentos).filter(a=>sameMonth(a.data)).reduce((s,a)=>s+toNum(a.recebido),0) + safeArray(state.receitasExtras).filter(r=>sameMonth(r.data)).reduce((s,r)=>s+toNum(r.valor),0);
      const meta=toNum(state.financeiro.metaMensal||0);
      const pct=meta>0 ? Math.min(100, Math.round((receita/meta)*100)) : 0;
      const txt=$id('dashMetaTexto'); if(txt) txt.textContent=`${brl(receita)} / ${brl(meta)}`;
      const pctEl=$id('dashMetaPct'); if(pctEl) pctEl.textContent=pct+'%';
      const bar=$id('dashMetaBar'); if(bar) bar.style.width=pct+'%';
      const metaInput=$id('finMetaInput'); if(metaInput && document.activeElement!==metaInput) metaInput.value = meta || '';
      const diaInput=$id('finDiaFechamento'); if(diaInput && document.activeElement!==diaInput) diaInput.value = state.financeiro.diaFechamento || 1;
    }catch(e){ console.warn('v45 meta:',e); }
  }
  function bindCaixaV45(){
    const btn=$id('btnSalvarFinanceiroConfig');
    if(btn && !btn.__v45Bound){
      btn.__v45Bound=true;
      btn.addEventListener('click', ()=>{
        state.financeiro = state.financeiro || {};
        state.financeiro.metaMensal = toNum($id('finMetaInput')?.value);
        state.financeiro.diaFechamento = Math.max(1, Math.min(31, Math.round(toNum($id('finDiaFechamento')?.value)||1)));
        if(typeof saveSoft==='function') saveSoft();
        persistEverywhereV45();
        updateDashboardMetaV45();
        alert('Configuração de caixa salva ✅');
      }, true);
    }
  }

  function groupSumV45(arr, keyFn, valFn){
    const m=new Map();
    safeArray(arr).forEach(x=>{ const k=String(keyFn(x)||'—').trim()||'—'; m.set(k,(m.get(k)||0)+toNum(valFn(x))); });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }
  function renderListV45(id, rows, empty='Sem dados ainda.'){ const el=$id(id); if(el) el.innerHTML = rows.length ? rows.map((r,i)=>`<div class="simpleItem"><b>${i+1}. ${String(r[0])}</b> — ${typeof r[1]==='number'?brl(r[1]):r[1]}</div>`).join('') : `<div class="hint">${empty}</div>`; }
  function renderCrmReportsV45(){
    try{
      const atend=safeArray(state.atendimentos);
      const agenda=safeArray(state.agenda);
      renderListV45('crmTopClientes', groupSumV45(atend, a=>a.cliente, a=>a.recebido).slice(0,5));
      renderListV45('crmTopServicos', groupSumV45(atend, a=>a.procedimento, a=>a.recebido).slice(0,5));
      const totalAg=agenda.length;
      const faltas=agenda.filter(a=>['Cancelado','Falta','Faltou'].includes(String(a.status||''))).length;
      const taxa=totalAg ? ((faltas/totalAg)*100).toFixed(1)+'%' : '0%';
      const tx=$id('crmTaxaFaltas'); if(tx) tx.innerHTML=`<div class="simpleItem"><b>${faltas}</b> faltas/cancelamentos de ${totalAg} agendamentos (${taxa}).</div>`;
      renderListV45('crmLucroServico', groupSumV45(atend, a=>a.procedimento, a=>a.lucro).slice(0,5));
    }catch(e){ console.warn('v45 crm reports:', e); }
  }
  function removeRelatoriosV45(){
    try{
      document.querySelectorAll('[data-tab="relatorios"], .tab[data-tab="relatorios"], button[data-route="relatorios"], a[href="#relatorios"]').forEach(x=>x.remove());
      document.querySelectorAll('.panel[data-route="relatorios"]').forEach(x=>x.remove());
      if(location.hash==='#relatorios') location.hash='#crm';
      ['pro','premium','developer'].forEach(p=>{ if(window.PLAN_FEATURES?.[p]) PLAN_FEATURES[p]=PLAN_FEATURES[p].filter(x=>x!=='relatorios'); });
    }catch(e){ console.warn('v45 remove relatorios:',e); }
  }

  const oldRenderAllV45 = window.renderAllHard;
  if(typeof oldRenderAllV45==='function' && !window.__SJM_V45_RENDER_PATCHED){
    window.__SJM_V45_RENDER_PATCHED=true;
    window.renderAllHard=function(){
      const r=oldRenderAllV45.apply(this, arguments);
      removeRelatoriosV45(); bindCaixaV45(); updateDashboardMetaV45(); renderCrmReportsV45();
      return r;
    };
  }
  const oldRenderDashV45=window.renderDashboard;
  if(typeof oldRenderDashV45==='function'){
    window.renderDashboard=function(){ const r=oldRenderDashV45.apply(this,arguments); bindCaixaV45(); updateDashboardMetaV45(); return r; };
  }
  const oldRenderCrmV45=window.renderCRM;
  if(typeof oldRenderCrmV45==='function'){
    window.renderCRM=function(){ const r=oldRenderCrmV45.apply(this,arguments); renderCrmReportsV45(); return r; };
  }

  function bootV45(){ removeRelatoriosV45(); bindCaixaV45(); updateDashboardMetaV45(); renderCrmReportsV45(); persistEverywhereV45(); }
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(bootV45,100));
  setTimeout(bootV45,500);
  setTimeout(bootV45,1500);
  window.__SJM_V45_PERSIST_NOW = persistEverywhereV45;
})();


/* =========================================================
   Studio Sync Pro v46 — correções de estabilidade e visual
   - Configuração de caixa atualiza meta imediatamente
   - CRM com resumo comercial seguro (sem lucro absurdo)
   - Aba Relatórios removida de vez
   - Cores removidas da tela Config
   - Persistência reforçada entre versões/login/localStorage
   - Clientes/WhatsApp com validação visual
   ========================================================= */
(function(){
  const V46 = true;
  const esc = (v)=>String(v??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const arr = (v)=>Array.isArray(v)?v:[];
  const saneMoney = (v)=>{
    let n = Number(v||0);
    if(!Number.isFinite(n)) n = 0;
    if(Math.abs(n) > 100000000) n = 0;
    return n;
  };
  const safeList = (id, rows, empty='Sem dados ainda.')=>{
    const el = byId(id); if(!el) return;
    el.innerHTML = rows && rows.length ? rows.map((r,i)=>`<div class="simpleItem"><b>${i+1}. ${esc(r[0])}</b> — ${typeof r[1]==='number'?money(saneMoney(r[1])):esc(r[1])}</div>`).join('') : `<div class="hint">${empty}</div>`;
  };
  function sumBy(list, keyFn, valFn){
    const m=new Map();
    arr(list).forEach(x=>{ const k=String(keyFn(x)||'—').trim()||'—'; const val=saneMoney(valFn(x)); m.set(k,(m.get(k)||0)+val); });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }
  function monthNow(){ return todayISO().slice(0,7); }
  function sameMonth(iso, ym=monthNow()){ return String(iso||'').slice(0,7)===ym; }
  function calcSafeProfit(a){
    const recebido = saneMoney(a?.recebido);
    const custoMaterial = saneMoney(a?.custoMaterial);
    const maoObra = saneMoney(a?.maoObra);
    let lucro = recebido - custoMaterial - maoObra;
    if(!Number.isFinite(lucro) || Math.abs(lucro)>100000000) lucro = 0;
    return lucro;
  }

  // remove visualmente e funcionalmente a aba Relatórios
  function removeRelatorios(){
    document.querySelectorAll('[data-tab="relatorios"], .tab[data-tab="relatorios"], button[data-route="relatorios"], a[href="#relatorios"]').forEach(x=>x.remove());
    document.querySelectorAll('.panel[data-route="relatorios"]').forEach(x=>x.remove());
    if(location.hash==='#relatorios') location.hash='#crm';
    try{ ['basic','pro','premium','developer'].forEach(p=>{ if(PLAN_FEATURES[p]) PLAN_FEATURES[p]=PLAN_FEATURES[p].filter(x=>x!=='relatorios'); }); }catch{}
  }

  // mantido como no-op: a tela de cores deve continuar visível e funcional.
  function removeConfigColors(){ return; }

  // evita os números absurdos do CRM e mantém o resumo dentro do CRM
  function renderCrmReportsV46(){
    try{
      const atend=arr(state.atendimentos).filter(a=>String(a.status||'')!=='Cancelado');
      safeList('crmTopClientes', sumBy(atend, a=>a.cliente, a=>a.recebido).slice(0,5));
      safeList('crmTopServicos', sumBy(atend, a=>a.procedimento, a=>a.recebido).slice(0,5));
      safeList('crmLucroServico', sumBy(atend, a=>a.procedimento, calcSafeProfit).slice(0,5));
      const agenda=arr(state.agenda);
      const total=agenda.length;
      const faltas=agenda.filter(a=>['Cancelado','Falta','Faltou'].includes(String(a.status||''))).length;
      const taxa=total?((faltas/total)*100).toFixed(1):'0.0';
      const tx=byId('crmTaxaFaltas'); if(tx) tx.innerHTML=`<div class="simpleItem"><b>${faltas}</b> faltas/cancelamentos de ${total} agendamentos (${taxa}%).</div>`;
    }catch(e){ console.warn('v46 CRM reports', e); }
  }

  // Configuração de caixa: meta deve refletir na hora nos cards
  function updateGoalFromFinance(){
    try{
      state.financeiro = state.financeiro && typeof state.financeiro==='object' ? state.financeiro : {};
      const meta = saneMoney(state.financeiro.metaMensal || 0);
      const ym=monthNow();
      const receitaAtend=arr(state.atendimentos).filter(a=>sameMonth(a.data,ym)).reduce((s,a)=>s+saneMoney(a.recebido),0);
      const receitaExtra=arr(state.receitasExtras).filter(r=>sameMonth(r.data,ym)).reduce((s,r)=>s+saneMoney(r.valor),0);
      const total = receitaAtend + receitaExtra;
      const pct = meta>0 ? Math.max(0, Math.min(100, Math.round((total/meta)*100))) : 0;
      safeText('dashMetaTexto', `${money(total)} / ${money(meta)}`);
      safeText('dashMetaPct', `${pct}%`);
      const bar=byId('dashMetaBar'); if(bar) bar.style.width = pct+'%';
      const metaInput=byId('finMetaInput'); if(metaInput && document.activeElement!==metaInput) metaInput.value = meta || '';
      const diaInput=byId('finDiaFechamento'); if(diaInput && document.activeElement!==diaInput) diaInput.value = state.financeiro.diaFechamento || 1;
    }catch(e){ console.warn('v46 meta', e); }
  }
  function bindCaixaV46(){
    const btn=byId('btnSalvarFinanceiro');
    if(btn && !btn.__v46Bound){
      btn.__v46Bound=true;
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        state.financeiro = state.financeiro && typeof state.financeiro==='object' ? state.financeiro : {};
        state.financeiro.metaMensal = saneMoney(byId('finMetaInput')?.value);
        state.financeiro.diaFechamento = Math.max(1, Math.min(31, Math.round(saneMoney(byId('finDiaFechamento')?.value)||1)));
        saveSoft();
        updateGoalFromFinance();
        try{ renderDashboard(); }catch{}
        alert('Configuração de caixa salva ✅');
      }, true);
    }
  }

  // backup/merge automático: procura estados antigos e usa o mais completo para não perder dados ao trocar versão/login
  function stateScoreV46(s){
    try{
      if(!s||typeof s!=='object') return 0;
      return arr(s.agenda).length*1000 + arr(s.clientes).length*1000 + arr(s.atendimentos).length*1200 + arr(s.materiais).length*300 + arr(s.despesas).length*300 + arr(s.receitasExtras).length*300 + arr(s.crmQueue).length*50 + arr(s.wppQueue).length*50 + arr(s.marketing?.waitlist).length*80 + arr(s.marketing?.pacotes).length*80;
    }catch{return 0;}
  }
  function updatedV46(s){ return Number(s?.meta?.updatedAt||0)||0; }
  function readStateKey(k){ try{ const raw=localStorage.getItem(k); if(!raw) return null; const parsed=JSON.parse(raw); return sanitizeState(parsed); }catch{return null;} }
  function allLocalStates(){
    const out=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith('sjm_sync_pro_v1')){
          const s=readStateKey(k); if(s) out.push({key:k,state:s});
        }
      }
    }catch{}
    return out;
  }
  function chooseBestV46(states){
    let best=null, bs=-1, bt=-1;
    states.forEach(item=>{ const s=item.state||item; const sc=stateScoreV46(s), t=updatedV46(s); if(sc>bs || (sc===bs && t>bt)){ best=s; bs=sc; bt=t; } });
    return best;
  }
  function preserveBestLocal(){
    try{
      const candidates=[{state:sanitizeState(state)}, ...allLocalStates()];
      const best=chooseBestV46(candidates);
      if(best && stateScoreV46(best) > stateScoreV46(state)){
        state = sanitizeState(best);
      }
      localStorage.setItem('sjm_sync_pro_v1', JSON.stringify(state));
      if(typeof ACTIVE_STORAGE_KEY!=='undefined') localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
    }catch(e){ console.warn('v46 preserve', e); }
  }
  const oldAuth = window.__SJM_ON_AUTH_USER;
  window.__SJM_ON_AUTH_USER = function(userInfo){
    try{
      const before=sanitizeState(state);
      if(typeof oldAuth==='function') oldAuth(userInfo);
      const after=sanitizeState(state);
      const best=chooseBestV46([{state:before},{state:after},...allLocalStates()]);
      if(best) state=sanitizeState(best);
      localStorage.setItem('sjm_sync_pro_v1', JSON.stringify(state));
      if(typeof ACTIVE_STORAGE_KEY!=='undefined') localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
      try{ renderAllHard(); renderDashboard(); renderCrmReportsV46(); }catch{}
    }catch(e){ console.warn('v46 auth preserve', e); }
  };

  // WhatsApp visualmente obrigatório para cliente; evita linha parecer completa sem telefone
  function markClientPhoneRequired(){
    try{
      document.querySelectorAll('#tblCli tbody tr').forEach(tr=>{
        const nome=tr.querySelector('td:nth-child(1) input')?.value?.trim();
        const wpp=tr.querySelector('td:nth-child(2) input');
        if(nome && wpp && !wpp.value.trim()){
          wpp.placeholder='Obrigatório p/ WhatsApp';
          wpp.classList.add('inputWarn');
        }else if(wpp){
          wpp.classList.remove('inputWarn');
        }
      });
    }catch{}
  }

  // pequenos lembretes úteis no dashboard (aniversário/manutenção) sem criar nova aba
  function enhanceDashboardAlerts(){
    try{
      const box=byId('dashAlertList'); if(!box) return;
      const extra=[];
      const now=new Date(); const mm=String(now.getMonth()+1).padStart(2,'0');
      const birthdays=arr(state.clientes).filter(c=>String(c.nasc||'').slice(5,7)===mm).slice(0,3);
      birthdays.forEach(c=>extra.push(`🎂 Aniversário este mês: <b>${esc(c.nome)}</b>`));
      const manuts=arr(state.atendimentos).filter(a=>a.data && a.cliente).map(a=>{
        const d=new Date(a.data+'T00:00:00'); d.setDate(d.getDate()+20);
        return {cliente:a.cliente, data:d.toISOString().slice(0,10)};
      }).filter(x=>x.data>=todayISO() && x.data<=addDaysISO(todayISO(),7)).slice(0,3);
      manuts.forEach(x=>extra.push(`💅 Próxima manutenção: <b>${esc(x.cliente)}</b> em ${fmtBRDate(x.data)}`));
      if(extra.length){
        box.innerHTML += extra.map(x=>`<div class="simpleItem">${x}</div>`).join('');
      }
    }catch(e){ console.warn('v46 alerts', e); }
  }

  // Patch em renderização principal
  const oldRenderAll = window.renderAllHard;
  if(typeof oldRenderAll==='function'){
    window.renderAllHard = function(){
      const r = oldRenderAll.apply(this, arguments);
      removeRelatorios(); removeConfigColors(); bindCaixaV46(); updateGoalFromFinance(); renderCrmReportsV46(); markClientPhoneRequired(); enhanceDashboardAlerts();
      return r;
    };
  }
  const oldRenderDash = window.renderDashboard;
  if(typeof oldRenderDash==='function'){
    window.renderDashboard = function(){
      const r=oldRenderDash.apply(this, arguments);
      bindCaixaV46(); updateGoalFromFinance(); enhanceDashboardAlerts();
      return r;
    };
  }
  const oldRenderClientes = window.renderClientes;
  if(typeof oldRenderClientes==='function'){
    window.renderClientes = function(){ const r=oldRenderClientes.apply(this, arguments); markClientPhoneRequired(); return r; };
  }
  const oldRenderCRM = window.renderCRM;
  if(typeof oldRenderCRM==='function'){
    window.renderCRM = function(){ const r=oldRenderCRM.apply(this, arguments); renderCrmReportsV46(); return r; };
  }

  function boot(){
    preserveBestLocal();
    removeRelatorios(); removeConfigColors(); bindCaixaV46(); updateGoalFromFinance(); renderCrmReportsV46(); markClientPhoneRequired(); enhanceDashboardAlerts();
    try{ renderDashboard(); }catch{}
  }
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(boot,80));
  setTimeout(boot,300); setTimeout(boot,1000); setTimeout(boot,2000);
  window.addEventListener('beforeunload', preserveBestLocal);
})();


/* =========================================================
   Studio Sync Pro v47 — limpeza visual e correções finais
   - Métricas do dashboard e gráfico do CRM corrigidos
   - Remove legenda do calendário, limpar agenda, Galeria e Permissões da barra
   - Galeria compacta dentro de Clientes
   - Marketing sem lista de espera e sem pesquisa de satisfação
   - Materiais com rótulo claro: quantidade comprada
   ========================================================= */
(function(){
  function v47Num(v){ const n=Number(String(v??'').replace(',','.')); return Number.isFinite(n)?n:0; }
  function v47Money(v){ try{return money(v47Num(v));}catch{return 'R$ '+v47Num(v).toFixed(2).replace('.',',');} }
  function v47CssVar(k,fb){ try{ return getComputedStyle(document.documentElement).getPropertyValue(k).trim() || fb; }catch{return fb;} }
  function v47ClearCanvas(canvas){
    if(!canvas) return null;
    const ctx=canvas.getContext('2d');
    const ratio=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    const W=Math.max(260, Math.floor((rect.width||canvas.clientWidth||420)*ratio));
    const H=Math.max(150, Math.floor((rect.height||canvas.clientHeight||180)*ratio));
    canvas.width=W; canvas.height=H;
    ctx.clearRect(0,0,W,H);
    return {ctx,W,H,ratio};
  }

  // Substitui o gráfico de barras antigo. Agora aceita valores negativos e sempre desenha algo legível.
  window.drawBars = function(canvas, labels, values){
    const c=v47ClearCanvas(canvas); if(!c) return;
    const {ctx,W,H,ratio}=c;
    const vals=(values||[]).map(v47Num);
    const labs=(labels||[]).map(x=>String(x||''));
    if(!vals.length){
      ctx.fillStyle='#6b7280'; ctx.font=`${12*ratio}px system-ui`; ctx.fillText('Nenhum dado disponível.', 24*ratio, 50*ratio); return;
    }
    const padL=34*ratio, padR=20*ratio, padT=18*ratio, padB=38*ratio;
    const maxAbs=Math.max(...vals.map(v=>Math.abs(v)),1);
    const zeroY=(H-padB+padT)/2;
    const slot=(W-padL-padR)/vals.length;
    const barW=Math.max(18*ratio, slot*0.52);
    ctx.strokeStyle='#e6e7eb'; ctx.lineWidth=1.5*ratio;
    ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(W-padR, zeroY); ctx.stroke();
    vals.forEach((v,i)=>{
      const x=padL+i*slot+(slot-barW)/2;
      const h=(H-padT-padB)/2*(Math.abs(v)/maxAbs);
      const y=v>=0?zeroY-h:zeroY;
      const g=ctx.createLinearGradient(0,y,0,y+h);
      g.addColorStop(0, v47CssVar('--a','#F72585'));
      g.addColorStop(1, v47CssVar('--p','#7B2CBF'));
      ctx.fillStyle=g; ctx.fillRect(x,y,barW,Math.max(2*ratio,h));
      ctx.fillStyle='#2B2D42'; ctx.font=`${10*ratio}px system-ui`;
      const label=labs[i]||'';
      ctx.save();
      ctx.translate(x, H-12*ratio); ctx.rotate(-0.18);
      ctx.fillText(label.replace(' (mês)',''),0,0);
      ctx.restore();
    });
  };

  function v47FixTabs(){
    document.querySelectorAll('[data-tab="galeria"],[data-tab="permissoes"],[data-tab="relatorios"],[data-tab="financeiro"]').forEach(el=>el.remove());
    document.querySelectorAll('[data-route="galeria"],[data-route="permissoes"],[data-route="relatorios"],[data-route="financeiro"]').forEach(el=>el.remove());
    const clear=document.getElementById('btnClearAgenda'); if(clear) clear.remove();
    document.querySelectorAll('.statusLegend').forEach(el=>el.remove());
    const build=document.getElementById('buildInfo'); if(build) build.textContent='';
    const sync=document.getElementById('syncInfo'); if(sync){ sync.textContent=''; sync.style.display='none'; }
  }

  function v47RenderClientPhotoPanel(){
    const box=document.getElementById('clientPhotoPanel'); if(!box || !window.state) return;
    const clientes=Array.isArray(state.clientes)?state.clientes:[];
    if(!clientes.length){ box.innerHTML='<div class="hint">Nenhuma cliente cadastrada.</div>'; return; }
    box.innerHTML='<div class="folderCompactGrid">'+clientes.map(c=>{
      const fotos=(Array.isArray(c.fotos)?c.fotos:[]).concat((Array.isArray(state.atendimentos)?state.atendimentos:[]).filter(a=>String(a.cliente||'').trim().toLowerCase()===String(c.nome||'').trim().toLowerCase() && a.foto).map(a=>({imagem:a.foto,data:a.data,procedimento:a.procedimento})));
      return `<button type="button" class="folderChip" data-client-folder="${(c.id||'').replace(/"/g,'')}">📁 ${String(c.nome||'Cliente').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))} <b>(${fotos.length})</b></button>`;
    }).join('')+'</div><div class="hint">As fotos ficam salvas por cliente, sem ocupar espaço na agenda.</div>';
  }
  window.renderClientPhotoPanel = v47RenderClientPhotoPanel;

  function v47RenderMarketingClean(){
    if(!window.state) return;
    const set=(id,arr,fmt)=>{ const el=document.getElementById(id); if(el) el.innerHTML=(arr||[]).map(fmt).join('') || '<div class="hint">Sem registros.</div>'; };
    if(state.marketing){
      set('pkgList', state.marketing.pacotes||[], x=>`<div class="simpleItem"><b>${String(x.nome||'')}</b> — ${v47Money(x.valor)}</div>`);
      set('indList', state.marketing.indicacoes||[], x=>`<div class="simpleItem"><b>${String(x.cliente||'')}</b> indicou ${String(x.amiga||'')}</div>`);
    }
    ['waitList','satList'].forEach(id=>{ const el=document.getElementById(id); if(el) el.closest('.box')?.remove(); });
  }
  window.renderMarketing = v47RenderMarketingClean;

  function v47ImproveTables(){
    document.querySelectorAll('#tblMat thead th').forEach(th=>{ if(th.textContent.trim()==='Qtd total') th.textContent='Qtd comprada'; });
  }

  function v47Boot(){
    v47FixTabs();
    v47ImproveTables();
    try{ v47RenderClientPhotoPanel(); }catch(e){ console.warn('v47 fotos',e); }
    try{ v47RenderMarketingClean(); }catch(e){ console.warn('v47 marketing',e); }
    try{ if(typeof renderDashboard==='function') renderDashboard(); }catch(e){ console.warn('v47 dashboard',e); }
    try{ if(typeof renderCRM==='function') renderCRM(); }catch(e){ console.warn('v47 crm',e); }
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(v47Boot,80));
  setTimeout(v47Boot,200);
  setTimeout(v47Boot,900);
  setTimeout(v47Boot,1800);
})();

/* =========================================================
   ✅ v51 — Desenvolvedor Master por LOGIN, sem botão público
   - O card/botão "Entrar como desenvolvedor" não aparece para usuárias.
   - Somente o login de desenvolvedor libera a rota Dev.
   - Dev pode ver/alterar valores dos planos, alterar plano da profissional,
     consultar telefones/e-mails da equipe, responder suporte e registrar bugs.
   ========================================================= */
(function(){
  const DEV_EMAIL = ""; // removido na versão cliente

  function escV51(v){
    return String(v ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
  function digitsV51(v){ return String(v||'').replace(/\D/g,''); }
  function priceTextV51(v, fallback){
    const s = String(v ?? '').trim();
    return s || fallback;
  }
  function ensureDevV51(){
    state.dev = state.dev && typeof state.dev === 'object' ? state.dev : {};
    state.dev.planPrices = state.dev.planPrices && typeof state.dev.planPrices === 'object' ? state.dev.planPrices : {};
    state.dev.planPrices.basic = priceTextV51(state.dev.planPrices.basic, PLAN_PRICES.basic || 'R$ 29,90/mês');
    state.dev.planPrices.pro = priceTextV51(state.dev.planPrices.pro, PLAN_PRICES.pro || 'R$ 59,90/mês');
    state.dev.planPrices.premium = priceTextV51(state.dev.planPrices.premium, PLAN_PRICES.premium || 'R$ 99,90/mês');
    state.dev.supportTickets = Array.isArray(state.dev.supportTickets) ? state.dev.supportTickets : [];
    state.dev.bugNotes = Array.isArray(state.dev.bugNotes) ? state.dev.bugNotes : [];
    state.profissionais = Array.isArray(state.profissionais) ? state.profissionais : [];
    if(!state.profissionais.length){
      state.profissionais.push({id:uid(), nome:'Profissional principal', funcao:'Proprietária', whatsapp: state.settings?.studioWpp || '', email:'', comissaoPct:0, ativo:true, permissao:'dono'});
    }else{
      state.profissionais.forEach(p=>{ if(!('whatsapp' in p)) p.whatsapp=''; if(!('email' in p)) p.email=''; });
    }
    PLAN_PRICES.basic = state.dev.planPrices.basic;
    PLAN_PRICES.pro = state.dev.planPrices.pro;
    PLAN_PRICES.premium = state.dev.planPrices.premium;
  }
  window.__SJM_ENSURE_DEV_V51 = ensureDevV51;

  const oldGetCurrentPlanV51 = getCurrentPlan;
  getCurrentPlan = function(){
    if(false){
      window.__SJM_DEV_UNLOCKED = true;
      window.__SJM_IS_DEVELOPER = true;
      return 'developer';
    }
    try{ return oldGetCurrentPlanV51(); }catch{ return 'premium'; }
  };

  const oldCanAccessRouteV51 = canAccessRoute;
  canAccessRoute = function(route){
    const r = String(route||'').toLowerCase();
    if(r === 'desenvolvedor') return getCurrentPlan() === 'developer';
    try{ return oldCanAccessRouteV51(route); }catch{ return true; }
  };

  const oldApplyPlanUIV51 = applyPlanUI;
  applyPlanUI = function(){
    ensureDevV51();
    try{ oldApplyPlanUIV51(); }catch(e){ console.warn('applyPlanUI v51:', e); }
    document.querySelectorAll('.tab[data-tab="desenvolvedor"]').forEach(btn=>{
      btn.classList.toggle('devHidden', getCurrentPlan() !== 'developer');
      btn.hidden = getCurrentPlan() !== 'developer';
    });
    safeText('currentPlanBadge', getCurrentPlan()==='developer' ? 'Desenvolvedor' : `Plano ${PLAN_LABELS[getStoredPlanV34?.() || state.settings?.plano || 'premium'] || 'Premium'}`);
  };

  renderPlanCards = function(){
    ensureDevV51();
    const box = byId('planCards');
    if(!box) return;
    const current = getStoredPlanV34 ? getStoredPlanV34() : String(state.settings?.plano||'premium');
    const plans = ['basic','pro','premium'];
    box.innerHTML = plans.map(plan=>{
      const active = current === plan;
      const features = (PLAN_DESCRIPTIONS[plan] || []).map(x=>`<li>${escV51(x)}</li>`).join('');
      const btn = active ? `<button class="btn btn--ghost" disabled>Plano atual</button>` : `<button class="btn" type="button" data-change-plan="${plan}">Mudar para este plano</button>`;
      return `<div class="planCard ${active?'active':''}">
        <div class="planCard__top"><b>${PLAN_LABELS[plan]}</b><span>${escV51(PLAN_PRICES[plan])}</span></div>
        <ul>${features}</ul>
        ${btn}
      </div>`;
    }).join('');
  };

  function renderDevPanelV51(){
    ensureDevV51();
    const sec = document.querySelector('[data-route="desenvolvedor"]');
    if(!sec) return;
    const currentPlan = getStoredPlanV34 ? getStoredPlanV34() : String(state.settings?.plano||'premium');
    const profissionais = (state.profissionais||[]).map(p=>`
      <tr data-dev-prof="${escV51(p.id)}">
        <td><input data-k="nome" value="${escV51(p.nome||'')}"></td>
        <td><select data-k="funcao"><option ${p.funcao==='Proprietária'?'selected':''}>Proprietária</option><option ${p.funcao==='Profissional'?'selected':''}>Profissional</option><option ${p.funcao==='Secretária'?'selected':''}>Secretária</option></select></td>
        <td><input data-k="whatsapp" inputmode="tel" value="${escV51(p.whatsapp||'')}"></td>
        <td><input data-k="email" type="email" value="${escV51(p.email||'')}"></td>
        <td><input data-k="comissaoPct" type="number" value="${num(p.comissaoPct)}"></td>
        <td><select data-k="ativo"><option value="true" ${p.ativo!==false?'selected':''}>Sim</option><option value="false" ${p.ativo===false?'selected':''}>Não</option></select></td>
        <td><button class="btn btn--ghost" type="button" data-dev-wpp="${escV51(p.id)}">WhatsApp</button></td>
      </tr>`).join('') || '<tr><td colspan="7">Nenhum profissional cadastrado.</td></tr>';

    const tickets = (state.dev.supportTickets||[]).slice().reverse().map(t=>`
      <div class="simpleItem">
        <b>${escV51(t.nome||'Profissional')}</b> — ${escV51(t.tipo||'Suporte')}<br>
        <small>${escV51(t.texto||'')}</small><br>
        <small>${new Date(t.criadoEm||Date.now()).toLocaleString('pt-BR')}</small>
      </div>`).join('') || '<div class="hint">Nenhum chamado registrado nesta base.</div>';

    const bugs = (state.dev.bugNotes||[]).slice().reverse().map(b=>`
      <div class="simpleItem"><b>${escV51(b.titulo||'Bug')}</b><br><small>${escV51(b.texto||'')}</small></div>`).join('') || '<div class="hint">Nenhum bug anotado.</div>';

    sec.innerHTML = `
      <div class="panel__head">
        <h2>Desenvolvedor / Suporte Master</h2>
        <p>Acesso interno para suporte, planos, profissionais, diagnóstico e correção de bugs.</p>
      </div>
      <div class="cards">
        <div class="card card--accent"><div class="card__label">Modo</div><div class="card__value">Master</div></div>
        <div class="card"><div class="card__label">Login</div><div class="card__value smallValue">${escV51(window.__SJM_CURRENT_USER?.email || DEV_EMAIL)}</div></div>
        <div class="card"><div class="card__label">Plano da profissional</div><div class="card__value smallValue">${escV51(PLAN_LABELS[currentPlan]||currentPlan)}</div></div>
        <div class="card"><div class="card__label">Profissionais</div><div class="card__value smallValue">${(state.profissionais||[]).length}</div></div>
      </div>

      <div class="grid2">
        <div class="box">
          <h3>Controle de planos</h3>
          <label class="field"><span>Plano atual da profissional</span>
            <select id="devCurrentPlan"><option value="basic" ${currentPlan==='basic'?'selected':''}>Básico</option><option value="pro" ${currentPlan==='pro'?'selected':''}>Pro</option><option value="premium" ${currentPlan==='premium'?'selected':''}>Premium</option></select>
          </label>
          <div class="grid3 miniGrid">
            <label class="field"><span>Valor Básico</span><input id="devPriceBasic" value="${escV51(state.dev.planPrices.basic)}"></label>
            <label class="field"><span>Valor Pro</span><input id="devPricePro" value="${escV51(state.dev.planPrices.pro)}"></label>
            <label class="field"><span>Valor Premium</span><input id="devPricePremium" value="${escV51(state.dev.planPrices.premium)}"></label>
          </div>
          <div class="actions"><button class="btn" id="btnDevSavePlans" type="button">Salvar planos e valores</button><button class="btn btn--ghost" id="btnDevOpenPlans" type="button">Ver tela de planos</button></div>
          <small class="hint">Alterar plano aqui não apaga clientes, agenda, fotos, materiais ou financeiro.</small>
        </div>

        <div class="box">
          <h3>Diagnóstico e bugs</h3>
          <div class="actions">
            <button class="btn btn--ghost" id="btnDevDiag" type="button">Rodar diagnóstico</button>
            <button class="btn btn--ghost" onclick="window.__SJM_EXPORT_PDF && window.__SJM_EXPORT_PDF()" type="button">Exportar relatório</button>
          </div>
          <label class="field"><span>Anotar bug/melhoria</span><input id="devBugTitle" placeholder="Ex.: cálculo de material"></label>
          <label class="field"><span>Descrição</span><textarea id="devBugText" placeholder="Descreva o erro encontrado..."></textarea></label>
          <button class="btn" id="btnDevSaveBug" type="button">Salvar anotação</button>
          <div class="simpleList">${bugs}</div>
        </div>
      </div>

      <div class="box" style="margin-top:12px;">
        <h3>Profissionais cadastrados</h3>
        <div class="tableScroll"><table class="dataTable"><thead><tr><th>Nome</th><th>Função</th><th>WhatsApp</th><th>Email</th><th>Comissão %</th><th>Ativo</th><th>Ação</th></tr></thead><tbody>${profissionais}</tbody></table></div>
        <div class="actions"><button class="btn" id="btnDevAddProf" type="button">+ Profissional</button><button class="btn btn--ghost" id="btnDevSaveProf" type="button">Salvar profissionais</button></div>
      </div>

      <div class="grid2" style="margin-top:12px;">
        <div class="box">
          <h3>Responder suporte</h3>
          <label class="field"><span>Profissional</span><select id="devSupportProf">${(state.profissionais||[]).map(p=>`<option value="${escV51(p.id)}">${escV51(p.nome||'Profissional')}</option>`).join('')}</select></label>
          <label class="field"><span>Mensagem</span><textarea id="devSupportMsg">Olá! Sou do suporte do Studio Sync Pro. Vi seu chamado e vou te ajudar.</textarea></label>
          <div class="actions"><button class="btn" id="btnDevSupportWpp" type="button">Responder no WhatsApp</button><button class="btn btn--ghost" id="btnDevSupportMail" type="button">Responder por e-mail</button></div>
        </div>
        <div class="box">
          <h3>Chamados / histórico de suporte</h3>
          <label class="field"><span>Registrar chamado</span><input id="devTicketTitle" placeholder="Ex.: problema ao salvar"></label>
          <label class="field"><span>Descrição</span><textarea id="devTicketText"></textarea></label>
          <button class="btn" id="btnDevAddTicket" type="button">Registrar chamado</button>
          <div class="simpleList">${tickets}</div>
        </div>
      </div>
    `;
    bindDevPanelV51();
  }

  function collectDevProfissionais(){
    document.querySelectorAll('[data-dev-prof]').forEach(tr=>{
      const id = tr.dataset.devProf;
      const p = (state.profissionais||[]).find(x=>String(x.id)===String(id));
      if(!p) return;
      tr.querySelectorAll('[data-k]').forEach(el=>{
        const k = el.dataset.k;
        p[k] = k==='comissaoPct' ? num(el.value) : (k==='ativo' ? el.value==='true' : el.value);
      });
    });
  }
  function bindDevPanelV51(){
    onClick('btnDevSavePlans', ()=>{
      ensureDevV51();
      state.dev.planPrices.basic = byId('devPriceBasic')?.value || 'R$ 29,90/mês';
      state.dev.planPrices.pro = byId('devPricePro')?.value || 'R$ 59,90/mês';
      state.dev.planPrices.premium = byId('devPricePremium')?.value || 'R$ 99,90/mês';
      state.settings.plano = normalizePlanV34(byId('devCurrentPlan')?.value || state.settings.plano || 'premium');
      PLAN_PRICES.basic = state.dev.planPrices.basic;
      PLAN_PRICES.pro = state.dev.planPrices.pro;
      PLAN_PRICES.premium = state.dev.planPrices.premium;
      saveSoft(); scheduleSync(); applyPlanUI(); renderDevPanelV51();
      alert('Planos, valores e plano da profissional salvos ✅');
    });
    onClick('btnDevOpenPlans', openPlanModal);
    onClick('btnDevDiag', ()=>{
      ensureDevV51();
      const msg = [
        `Build: ${APP_BUILD}`,
        `Clientes: ${(state.clientes||[]).length}`,
        `Agenda: ${(state.agenda||[]).length}`,
        `Atendimentos: ${(state.atendimentos||[]).length}`,
        `Materiais: ${(state.materiais||[]).length}`,
        `Profissionais: ${(state.profissionais||[]).length}`,
        `Plano: ${state.settings?.plano}`,
        `LocalStorage: ${typeof localStorage !== 'undefined' ? 'ativo' : 'indisponível'}`
      ].join('\n');
      alert('Diagnóstico do sistema:\n\n'+msg);
    });
    onClick('btnDevSaveBug', ()=>{
      ensureDevV51();
      const titulo = byId('devBugTitle')?.value || 'Bug/melhoria';
      const texto = byId('devBugText')?.value || '';
      state.dev.bugNotes.push({id:uid(), titulo, texto, criadoEm:Date.now()});
      saveSoft(); renderDevPanelV51();
    });
    onClick('btnDevAddProf', ()=>{
      ensureDevV51();
      collectDevProfissionais();
      state.profissionais.push({id:uid(), nome:'Nova profissional', funcao:'Profissional', whatsapp:'', email:'', comissaoPct:0, ativo:true, permissao:'profissional'});
      saveSoft(); renderDevPanelV51();
    });
    onClick('btnDevSaveProf', ()=>{
      ensureDevV51(); collectDevProfissionais(); saveSoft(); scheduleSync(); renderDevPanelV51(); alert('Profissionais salvos ✅');
    });
    document.querySelectorAll('[data-dev-wpp]').forEach(btn=>btn.addEventListener('click', ()=>{
      collectDevProfissionais();
      const p=(state.profissionais||[]).find(x=>String(x.id)===String(btn.dataset.devWpp));
      const phone=digitsV51(p?.whatsapp || state.settings?.studioWpp || '');
      if(!phone) return alert('Profissional sem WhatsApp cadastrado.');
      window.open(waLink(phone, 'Olá! Sou do suporte do Studio Sync Pro.'), '_blank');
    }));
    onClick('btnDevSupportWpp', ()=>{
      collectDevProfissionais();
      const id=byId('devSupportProf')?.value;
      const p=(state.profissionais||[]).find(x=>String(x.id)===String(id));
      const phone=digitsV51(p?.whatsapp || state.settings?.studioWpp || '');
      const msg=byId('devSupportMsg')?.value || 'Olá! Sou do suporte do Studio Sync Pro.';
      if(!phone) return alert('Profissional sem WhatsApp cadastrado.');
      window.open(waLink(phone,msg),'_blank');
    });
    onClick('btnDevSupportMail', ()=>{
      collectDevProfissionais();
      const id=byId('devSupportProf')?.value;
      const p=(state.profissionais||[]).find(x=>String(x.id)===String(id));
      const email=String(p?.email||'').trim();
      const msg=encodeURIComponent(byId('devSupportMsg')?.value || 'Olá! Sou do suporte do Studio Sync Pro.');
      if(!email) return alert('Profissional sem e-mail cadastrado.');
      window.location.href=`mailto:${encodeURIComponent(email)}?subject=Suporte Studio Sync Pro&body=${msg}`;
    });
    onClick('btnDevAddTicket', ()=>{
      ensureDevV51();
      const id=byId('devSupportProf')?.value;
      const p=(state.profissionais||[]).find(x=>String(x.id)===String(id));
      state.dev.supportTickets.push({id:uid(), nome:p?.nome||'Profissional', tipo:byId('devTicketTitle')?.value||'Suporte', texto:byId('devTicketText')?.value||'', criadoEm:Date.now()});
      saveSoft(); renderDevPanelV51();
    });
  }

  const oldRenderEquipeV51 = window.renderEquipe || (typeof renderEquipe==='function' ? renderEquipe : null);
  window.renderEquipe = renderEquipe = function(){
    ensureDevV51();
    const body = document.querySelector('#tblEquipe tbody');
    if(!body){ try{ oldRenderEquipeV51 && oldRenderEquipeV51(); }catch{} return; }
    const table = body.closest('table');
    const head = table?.querySelector('thead tr');
    if(head) head.innerHTML = '<th>Nome</th><th>Função</th><th>WhatsApp</th><th>E-mail</th><th>Comissão %</th><th>Agenda ativa</th><th>Comissão estimada</th><th></th>';
    body.innerHTML = (state.profissionais||[]).map(p=>{
      const atend=(state.atendimentos||[]).filter(a=>a.profissional===p.nome || (!a.profissional && p.funcao==='Proprietária'));
      const com=atend.reduce((s,a)=>s+(num(a.recebido)*num(p.comissaoPct)/100),0);
      return `<tr data-id="${escV51(p.id)}">
        <td><input data-k="nome" value="${escV51(p.nome||'')}"></td>
        <td><select data-k="funcao"><option ${p.funcao==='Proprietária'?'selected':''}>Proprietária</option><option ${p.funcao==='Profissional'?'selected':''}>Profissional</option><option ${p.funcao==='Secretária'?'selected':''}>Secretária</option></select></td>
        <td><input data-k="whatsapp" inputmode="tel" value="${escV51(p.whatsapp||'')}"></td>
        <td><input data-k="email" type="email" value="${escV51(p.email||'')}"></td>
        <td><input data-k="comissaoPct" type="number" value="${num(p.comissaoPct)}"></td>
        <td><select data-k="ativo"><option value="true" ${p.ativo!==false?'selected':''}>Sim</option><option value="false" ${p.ativo===false?'selected':''}>Não</option></select></td>
        <td>${money(com)}</td><td><button class="iconBtn" data-del>×</button></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('tr').forEach(tr=>{
      const p=(state.profissionais||[]).find(x=>String(x.id)===String(tr.dataset.id)); if(!p) return;
      tr.querySelectorAll('[data-k]').forEach(el=>el.addEventListener('change',()=>{ const k=el.dataset.k; p[k]= k==='comissaoPct'?num(el.value):(k==='ativo'?el.value==='true':el.value); saveSoft(); }));
      tr.querySelector('[data-del]')?.addEventListener('click',()=>{ if(!confirmDel('este profissional')) return; state.profissionais=state.profissionais.filter(x=>x.id!==p.id); saveSoft(); renderEquipe(); });
    });
  };

  const oldRenderAllHardV51 = renderAllHard;
  renderAllHard = function(){
    try{ oldRenderAllHardV51(); }catch(e){ console.warn('renderAllHard v51 old:', e); }
    try{ ensureDevV51(); applyPlanUI(); if(getCurrentPlan()==='developer') renderDevPanelV51(); }catch(e){ console.warn('render dev v51:', e); }
  };

  const oldSetRouteV51 = window.__SJM_SET_ROUTE;
  if(oldSetRouteV51){
    window.__SJM_SET_ROUTE = function(route){
      const r=String(route||'').toLowerCase();
      if(r==='desenvolvedor' && getCurrentPlan()!=='developer'){
        alert('Área exclusiva do desenvolvedor. Entre com o login de desenvolvedor.');
        return oldSetRouteV51('dashboard');
      }
      oldSetRouteV51(route);
      if(r==='desenvolvedor') setTimeout(renderDevPanelV51,0);
    };
  }

  function bootV51(){
    try{ ensureDevV51(); applyPlanUI(); if(getCurrentPlan()==='developer') renderDevPanelV51(); }catch(e){ console.warn('boot v51:', e); }
  }
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(bootV51, 120));
  setTimeout(bootV51, 500);
  setTimeout(bootV51, 1500);

  window.__SJM_DEV_MASTER_INFO = {
    email: DEV_EMAIL,
    recursos: ['alterar valores dos planos','alterar plano da profissional','ver telefone/e-mail da equipe','responder suporte','registrar bugs','rodar diagnóstico','exportar relatório']
  };
})();


/* =========================================================
   ✅ v52 — Desenvolvedor Master completo
   - Oculto para clientes comuns; aparece apenas no login dev.
   - Sem card de total de agendamentos no painel DEV.
   - Inclui planos, valores, limites, status, teste, suporte, bugs,
     logs, histórico, backup e entrada assistida como profissional.
   ========================================================= */
(function(){
  const DEV_EMAIL_V52 = ""; // removido na versão cliente
  function esc52(v){ return String(v ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function dg52(v){ return String(v||'').replace(/\D/g,''); }
  function n52(v){ try{ return typeof num==='function' ? num(v) : Number(String(v||'0').replace(',','.'))||0; }catch{ return 0; } }
  function br52(v){ try{ return typeof money==='function' ? money(n52(v)) : n52(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }catch{ return 'R$ 0,00'; } }
  function id52(){ try{ return uid(); }catch{ return 'id_'+Date.now()+'_'+Math.random().toString(16).slice(2); } }
  function today52(){ return new Date().toISOString().slice(0,10); }
  function safeArr52(x){ return Array.isArray(x) ? x : []; }
  function currentRealPlan52(){ try{ return typeof getStoredPlanV34==='function' ? getStoredPlanV34() : String(state.settings?.plano||'premium').toLowerCase(); }catch{ return String(state.settings?.plano||'premium').toLowerCase(); } }
  function addHistory52(tipo, detalhe){
    ensureDev52();
    state.dev.history.unshift({ id:id52(), tipo, detalhe, criadoEm:Date.now(), usuario: window.__SJM_CURRENT_USER?.email || DEV_EMAIL_V52 });
    state.dev.history = state.dev.history.slice(0,120);
  }
  function addLog52(tipo, detalhe){
    ensureDev52();
    state.dev.logs.unshift({ id:id52(), tipo, detalhe, criadoEm:Date.now() });
    state.dev.logs = state.dev.logs.slice(0,120);
  }
  function ensureDev52(){
    state.dev = state.dev && typeof state.dev === 'object' ? state.dev : {};
    state.dev.planPrices = state.dev.planPrices && typeof state.dev.planPrices === 'object' ? state.dev.planPrices : {};
    state.dev.planPrices.basic = String(state.dev.planPrices.basic || PLAN_PRICES.basic || 'R$ 29,90/mês');
    state.dev.planPrices.pro = String(state.dev.planPrices.pro || PLAN_PRICES.pro || 'R$ 59,90/mês');
    state.dev.planPrices.premium = String(state.dev.planPrices.premium || PLAN_PRICES.premium || 'R$ 99,90/mês');
    PLAN_PRICES.basic = state.dev.planPrices.basic;
    PLAN_PRICES.pro = state.dev.planPrices.pro;
    PLAN_PRICES.premium = state.dev.planPrices.premium;
    state.dev.planLimits = state.dev.planLimits && typeof state.dev.planLimits === 'object' ? state.dev.planLimits : {};
    state.dev.planLimits.basic = state.dev.planLimits.basic || {clientes:100, fotos:50, crm:false, equipe:false, export:false};
    state.dev.planLimits.pro = state.dev.planLimits.pro || {clientes:500, fotos:200, crm:true, equipe:false, export:true};
    state.dev.planLimits.premium = state.dev.planLimits.premium || {clientes:9999, fotos:9999, crm:true, equipe:true, export:true};
    state.dev.history = safeArr52(state.dev.history);
    state.dev.logs = safeArr52(state.dev.logs);
    state.dev.bugNotes = safeArr52(state.dev.bugNotes);
    state.dev.supportTickets = safeArr52(state.dev.supportTickets);
    state.dev.professionalStatus = state.dev.professionalStatus || 'ativo';
    state.dev.trialDays = Number(state.dev.trialDays || 0);
    state.dev.trialStart = state.dev.trialStart || today52();
    state.dev.lastBackupAt = state.dev.lastBackupAt || '';
    state.profissionais = safeArr52(state.profissionais);
    if(!state.profissionais.length){
      state.profissionais.push({id:id52(), nome:'Profissional principal', funcao:'Proprietária', whatsapp: state.settings?.studioWpp || '', email:'', comissaoPct:0, ativo:true, status:'ativo'});
    }
    state.profissionais.forEach(p=>{
      if(!p.id) p.id=id52();
      if(!('whatsapp' in p)) p.whatsapp='';
      if(!('email' in p)) p.email='';
      if(!('status' in p)) p.status = p.ativo===false ? 'bloqueado' : 'ativo';
    });
  }
  function parsePrice52(v){
    const clean = String(v||'').replace(/[^0-9,\.]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');
    return Number(clean)||0;
  }
  function mrr52(){
    const plan = currentRealPlan52();
    return parsePrice52(state.dev?.planPrices?.[plan] || PLAN_PRICES[plan] || 0);
  }
  function planCounts52(){
    const out = {basic:0, pro:0, premium:0};
    const p = currentRealPlan52();
    if(out[p] !== undefined) out[p] = 1;
    return out;
  }
  function trialEnd52(){
    const d = Number(state.dev?.trialDays||0);
    if(!d) return 'Sem teste ativo';
    const start = new Date(state.dev.trialStart || today52());
    start.setDate(start.getDate()+d);
    return start.toLocaleDateString('pt-BR');
  }
  function backupJson52(){
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-studio-sync-pro-${today52()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
    state.dev.lastBackupAt = new Date().toLocaleString('pt-BR');
    addHistory52('Backup', 'Backup baixado pelo desenvolvedor.');
    try{ saveSoft(); scheduleSync && scheduleSync(); }catch{}
  }
  function exportDevReport52(){
    const lines = [
      ['Relatório Desenvolvedor', new Date().toLocaleString('pt-BR')],
      ['Build', String(typeof APP_BUILD!=='undefined' ? APP_BUILD : '')],
      ['Profissionais', state.profissionais?.length||0],
      ['Clientes', state.clientes?.length||0],
      ['Plano', currentRealPlan52()],
      ['Receita recorrente estimada', br52(mrr52())],
      ['Status', state.dev.professionalStatus],
      ['Teste vence em', trialEnd52()],
      ['Bugs registrados', state.dev.bugNotes?.length||0],
      ['Chamados registrados', state.dev.supportTickets?.length||0],
      ['Logs', state.dev.logs?.length||0]
    ];
    const csv = lines.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='relatorio-desenvolvedor.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  function renderDevPanelV52(){
    ensureDev52();
    if(currentRealPlan52()==='developer') state.settings.plano='premium';
    const sec = document.querySelector('[data-route="desenvolvedor"]');
    if(!sec || (typeof getCurrentPlan==='function' && getCurrentPlan()!=='developer')) return;
    const plan = currentRealPlan52();
    const counts = planCounts52();
    const bugRows = state.dev.bugNotes.slice().map(b=>`
      <div class="simpleItem devBugItem">
        <b>${esc52(b.titulo||'Bug/melhoria')}</b> <span class="pill">${esc52(b.status||'Aberto')}</span> <span class="pill">${esc52(b.prioridade||'Média')}</span><br>
        <small>${esc52(b.texto||'')}</small><br><small>${new Date(b.criadoEm||Date.now()).toLocaleString('pt-BR')}</small>
      </div>`).join('') || '<div class="hint">Nenhum bug anotado.</div>';
    const tickets = state.dev.supportTickets.slice().map(t=>`
      <div class="simpleItem"><b>${esc52(t.nome||'Profissional')}</b> — ${esc52(t.tipo||'Suporte')} <span class="pill">${esc52(t.status||'Aberto')}</span><br><small>${esc52(t.texto||'')}</small><br><small>${new Date(t.criadoEm||Date.now()).toLocaleString('pt-BR')}</small></div>`).join('') || '<div class="hint">Nenhum chamado registrado.</div>';
    const history = state.dev.history.slice(0,10).map(h=>`<div class="simpleItem"><b>${esc52(h.tipo)}</b><br><small>${esc52(h.detalhe)}</small><br><small>${new Date(h.criadoEm||Date.now()).toLocaleString('pt-BR')}</small></div>`).join('') || '<div class="hint">Nenhuma alteração registrada.</div>';
    const logs = state.dev.logs.slice(0,10).map(l=>`<div class="simpleItem"><b>${esc52(l.tipo)}</b><br><small>${esc52(l.detalhe)}</small><br><small>${new Date(l.criadoEm||Date.now()).toLocaleString('pt-BR')}</small></div>`).join('') || '<div class="hint">Nenhum log registrado nesta sessão.</div>';
    const profRows = state.profissionais.map(p=>`
      <tr data-dev52-prof="${esc52(p.id)}">
        <td><input data-k="nome" value="${esc52(p.nome||'')}"></td>
        <td><select data-k="funcao"><option ${p.funcao==='Proprietária'?'selected':''}>Proprietária</option><option ${p.funcao==='Profissional'?'selected':''}>Profissional</option><option ${p.funcao==='Secretária'?'selected':''}>Secretária</option></select></td>
        <td><input data-k="whatsapp" inputmode="tel" value="${esc52(p.whatsapp||'')}"></td>
        <td><input data-k="email" type="email" value="${esc52(p.email||'')}"></td>
        <td><input data-k="comissaoPct" type="number" value="${n52(p.comissaoPct)}"></td>
        <td><select data-k="status"><option value="ativo" ${p.status==='ativo'?'selected':''}>Ativo</option><option value="teste" ${p.status==='teste'?'selected':''}>Teste</option><option value="bloqueado" ${p.status==='bloqueado'?'selected':''}>Bloqueado</option><option value="suspenso" ${p.status==='suspenso'?'selected':''}>Suspenso</option></select></td>
        <td><button class="btn btn--ghost" type="button" data-dev52-wpp="${esc52(p.id)}">WhatsApp</button> <button class="btn btn--ghost" type="button" data-dev52-enter="${esc52(p.id)}">Entrar</button></td>
      </tr>`).join('');
    const limitBlock = (key, label)=>{
      const l = state.dev.planLimits[key];
      return `<div class="box miniPlanLimit"><h4>${label}</h4>
        <label class="field"><span>Máx. clientes</span><input id="lim_${key}_clientes" type="number" value="${esc52(l.clientes)}"></label>
        <label class="field"><span>Máx. fotos</span><input id="lim_${key}_fotos" type="number" value="${esc52(l.fotos)}"></label>
        <label class="checkLine"><input id="lim_${key}_crm" type="checkbox" ${l.crm?'checked':''}> CRM</label>
        <label class="checkLine"><input id="lim_${key}_equipe" type="checkbox" ${l.equipe?'checked':''}> Equipe</label>
        <label class="checkLine"><input id="lim_${key}_export" type="checkbox" ${l.export?'checked':''}> Exportação</label>
      </div>`;
    };
    sec.innerHTML = `
      <div class="panel__head"><h2>Desenvolvedor / Suporte Master</h2><p>Acesso interno para suporte, planos, profissionais, diagnóstico, backups, logs e correção de bugs.</p></div>
      <div class="cards devCards">
        <div class="card card--accent"><div class="card__label">Modo</div><div class="card__value">Master</div></div>
        <div class="card"><div class="card__label">Profissionais</div><div class="card__value smallValue">${state.profissionais.length}</div></div>
        <div class="card"><div class="card__label">Clientes cadastrados</div><div class="card__value smallValue">${state.clientes?.length||0}</div></div>
        <div class="card"><div class="card__label">Planos</div><div class="card__value smallValue">Básico ${counts.basic} • Pro ${counts.pro} • Premium ${counts.premium}</div></div>
        <div class="card"><div class="card__label">Receita SaaS estimada</div><div class="card__value smallValue">${br52(mrr52())}/mês</div></div>
        <div class="card"><div class="card__label">Status da profissional</div><div class="card__value smallValue">${esc52(state.dev.professionalStatus)}</div></div>
      </div>

      <div class="grid2">
        <div class="box"><h3>Controle de planos e assinatura</h3>
          <div class="grid2">
            <label class="field"><span>Plano atual da profissional</span><select id="dev52CurrentPlan"><option value="basic" ${plan==='basic'?'selected':''}>Básico</option><option value="pro" ${plan==='pro'?'selected':''}>Pro</option><option value="premium" ${plan==='premium'?'selected':''}>Premium</option></select></label>
            <label class="field"><span>Status</span><select id="dev52Status"><option value="ativo" ${state.dev.professionalStatus==='ativo'?'selected':''}>Ativo</option><option value="teste" ${state.dev.professionalStatus==='teste'?'selected':''}>Teste</option><option value="bloqueado" ${state.dev.professionalStatus==='bloqueado'?'selected':''}>Bloqueado</option><option value="suspenso" ${state.dev.professionalStatus==='suspenso'?'selected':''}>Suspenso</option></select></label>
          </div>
          <div class="grid3 miniGrid"><label class="field"><span>Valor Básico</span><input id="dev52PriceBasic" value="${esc52(state.dev.planPrices.basic)}"></label><label class="field"><span>Valor Pro</span><input id="dev52PricePro" value="${esc52(state.dev.planPrices.pro)}"></label><label class="field"><span>Valor Premium</span><input id="dev52PricePremium" value="${esc52(state.dev.planPrices.premium)}"></label></div>
          <div class="grid2"><label class="field"><span>Dias de teste</span><input id="dev52TrialDays" type="number" value="${esc52(state.dev.trialDays)}"></label><label class="field"><span>Início do teste</span><input id="dev52TrialStart" type="date" value="${esc52(state.dev.trialStart)}"></label></div>
          <div class="hint">Vencimento do teste: <b>${esc52(trialEnd52())}</b></div>
          <div class="actions"><button class="btn" id="btnDev52SavePlans" type="button">Salvar planos, valores e status</button><button class="btn btn--ghost" id="btnDev52OpenPlans" type="button">Ver tela de planos</button></div>
        </div>
        <div class="box"><h3>Diagnóstico, logs e backup</h3>
          <div class="actions"><button class="btn btn--ghost" id="btnDev52Diag" type="button">Rodar diagnóstico</button><button class="btn btn--ghost" id="btnDev52ExportReport" type="button">Exportar relatório</button><button class="btn btn--ghost" id="btnDev52Backup" type="button">Baixar backup</button></div>
          <label class="field"><span>Restaurar backup JSON</span><input id="dev52ImportBackup" type="file" accept="application/json"></label>
          <small class="hint">Último backup: ${esc52(state.dev.lastBackupAt || 'nenhum')}</small>
          <h4>Logs recentes</h4><div class="simpleList">${logs}</div>
        </div>
      </div>

      <div class="box" style="margin-top:12px;"><h3>Limites e recursos por plano</h3><div class="grid3">${limitBlock('basic','Básico')}${limitBlock('pro','Pro')}${limitBlock('premium','Premium')}</div><button class="btn" id="btnDev52SaveLimits" type="button">Salvar limites dos planos</button></div>

      <div class="box" style="margin-top:12px;"><h3>Profissionais cadastrados</h3><div class="tableWrap"><table class="table"><thead><tr><th>Nome</th><th>Função</th><th>WhatsApp</th><th>Email</th><th>Comissão %</th><th>Status</th><th>Ação</th></tr></thead><tbody>${profRows}</tbody></table></div><div class="actions"><button class="btn" id="btnDev52AddProf" type="button">+ Profissional</button><button class="btn btn--ghost" id="btnDev52SaveProf" type="button">Salvar profissionais</button></div></div>

      <div class="grid2" style="margin-top:12px;">
        <div class="box"><h3>Responder suporte</h3><label class="field"><span>Profissional</span><select id="dev52SupportProf">${state.profissionais.map(p=>`<option value="${esc52(p.id)}">${esc52(p.nome||'Profissional')}</option>`).join('')}</select></label><label class="field"><span>Mensagem</span><textarea id="dev52SupportMsg">Olá! Sou do suporte do Studio Sync Pro. Vi seu chamado e vou te ajudar.</textarea></label><div class="actions"><button class="btn" id="btnDev52SupportWpp" type="button">Responder no WhatsApp</button><button class="btn btn--ghost" id="btnDev52SupportMail" type="button">Responder por e-mail</button></div></div>
        <div class="box"><h3>Chamados / histórico de suporte</h3><label class="field"><span>Registrar chamado</span><input id="dev52TicketTitle" placeholder="Ex.: problema ao salvar"></label><label class="field"><span>Descrição</span><textarea id="dev52TicketText"></textarea></label><label class="field"><span>Status</span><select id="dev52TicketStatus"><option>Aberto</option><option>Em análise</option><option>Respondido</option><option>Resolvido</option></select></label><button class="btn" id="btnDev52AddTicket" type="button">Registrar chamado</button><div class="simpleList">${tickets}</div></div>
      </div>

      <div class="grid2" style="margin-top:12px;">
        <div class="box"><h3>Central de bugs</h3><label class="field"><span>Título</span><input id="dev52BugTitle" placeholder="Ex.: cálculo de material"></label><label class="field"><span>Descrição</span><textarea id="dev52BugText" placeholder="Descreva o erro encontrado..."></textarea></label><div class="grid2"><label class="field"><span>Prioridade</span><select id="dev52BugPriority"><option>Baixa</option><option selected>Média</option><option>Alta</option><option>Crítica</option></select></label><label class="field"><span>Status</span><select id="dev52BugStatus"><option>Aberto</option><option>Em análise</option><option>Corrigido</option></select></label></div><button class="btn" id="btnDev52SaveBug" type="button">Salvar bug</button><div class="simpleList">${bugRows}</div></div>
        <div class="box"><h3>Histórico de alterações</h3><div class="simpleList">${history}</div></div>
      </div>
    `;
    bindDevPanelV52();
  }
  function collectProf52(){
    ensureDev52();
    document.querySelectorAll('[data-dev52-prof]').forEach(tr=>{
      const p = state.profissionais.find(x=>String(x.id)===String(tr.dataset.dev52Prof)); if(!p) return;
      tr.querySelectorAll('[data-k]').forEach(el=>{
        const k=el.dataset.k;
        p[k] = k==='comissaoPct' ? n52(el.value) : el.value;
        if(k==='status') p.ativo = el.value==='ativo' || el.value==='teste';
      });
    });
  }
  function savePlanLimits52(){
    ['basic','pro','premium'].forEach(k=>{
      state.dev.planLimits[k] = {
        clientes: n52(document.getElementById(`lim_${k}_clientes`)?.value),
        fotos: n52(document.getElementById(`lim_${k}_fotos`)?.value),
        crm: !!document.getElementById(`lim_${k}_crm`)?.checked,
        equipe: !!document.getElementById(`lim_${k}_equipe`)?.checked,
        export: !!document.getElementById(`lim_${k}_export`)?.checked
      };
    });
  }
  function bindDevPanelV52(){
    const click = (id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
    click('btnDev52SavePlans',()=>{
      ensureDev52();
      const oldPlan = currentRealPlan52();
      state.dev.planPrices.basic = document.getElementById('dev52PriceBasic')?.value || 'R$ 29,90/mês';
      state.dev.planPrices.pro = document.getElementById('dev52PricePro')?.value || 'R$ 59,90/mês';
      state.dev.planPrices.premium = document.getElementById('dev52PricePremium')?.value || 'R$ 99,90/mês';
      PLAN_PRICES.basic=state.dev.planPrices.basic; PLAN_PRICES.pro=state.dev.planPrices.pro; PLAN_PRICES.premium=state.dev.planPrices.premium;
      state.settings.plano = document.getElementById('dev52CurrentPlan')?.value || state.settings.plano || 'premium';
      state.dev.professionalStatus = document.getElementById('dev52Status')?.value || 'ativo';
      state.dev.trialDays = n52(document.getElementById('dev52TrialDays')?.value);
      state.dev.trialStart = document.getElementById('dev52TrialStart')?.value || today52();
      addHistory52('Plano/assinatura', `Plano ${oldPlan} → ${state.settings.plano}; status: ${state.dev.professionalStatus}; valores atualizados.`);
      addLog52('Planos', 'Planos, valores e status salvos pelo desenvolvedor.');
      try{ saveSoft(); scheduleSync && scheduleSync(); applyPlanUI && applyPlanUI(); }catch{}
      renderDevPanelV52(); alert('Planos, valores e status salvos ✅');
    });
    click('btnDev52OpenPlans',()=>{ try{ openPlanModal(); }catch{} });
    click('btnDev52Diag',()=>{
      const msg = [`Build: ${typeof APP_BUILD!=='undefined'?APP_BUILD:''}`,`Clientes: ${state.clientes?.length||0}`,`Materiais: ${state.materiais?.length||0}`,`Profissionais: ${state.profissionais?.length||0}`,`Plano: ${currentRealPlan52()}`,`Status: ${state.dev.professionalStatus}`,`LocalStorage: ${typeof localStorage!=='undefined'?'ativo':'indisponível'}`].join('\n');
      addLog52('Diagnóstico', msg.replace(/\n/g,' | ')); try{ saveSoft(); }catch{} alert('Diagnóstico do sistema:\n\n'+msg);
    });
    click('btnDev52ExportReport', exportDevReport52);
    click('btnDev52Backup', backupJson52);
    const imp=document.getElementById('dev52ImportBackup');
    if(imp) imp.onchange = e=>{
      const file=e.target.files?.[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=()=>{ try{ const data=JSON.parse(reader.result); Object.keys(state).forEach(k=>delete state[k]); Object.assign(state,data); ensureDev52(); addHistory52('Backup', 'Backup restaurado pelo desenvolvedor.'); saveSoft(); location.reload(); }catch(err){ alert('Backup inválido.'); } };
      reader.readAsText(file);
    };
    click('btnDev52SaveLimits',()=>{ ensureDev52(); savePlanLimits52(); addHistory52('Limites dos planos','Recursos e limites dos planos foram alterados.'); try{ saveSoft(); }catch{} renderDevPanelV52(); alert('Limites salvos ✅'); });
    click('btnDev52AddProf',()=>{ ensureDev52(); collectProf52(); state.profissionais.push({id:id52(), nome:'Nova profissional', funcao:'Profissional', whatsapp:'', email:'', comissaoPct:0, status:'ativo', ativo:true}); addHistory52('Profissional','Nova profissional adicionada.'); saveSoft(); renderDevPanelV52(); });
    click('btnDev52SaveProf',()=>{ collectProf52(); addHistory52('Profissionais','Dados dos profissionais foram salvos.'); try{ saveSoft(); scheduleSync&&scheduleSync(); }catch{} renderDevPanelV52(); alert('Profissionais salvos ✅'); });
    document.querySelectorAll('[data-dev52-wpp]').forEach(btn=>btn.onclick=()=>{ collectProf52(); const p=state.profissionais.find(x=>String(x.id)===String(btn.dataset.dev52Wpp)); const phone=dg52(p?.whatsapp || state.settings?.studioWpp || ''); if(!phone) return alert('Profissional sem WhatsApp cadastrado.'); window.open(waLink(phone,'Olá! Sou do suporte do Studio Sync Pro.'),'_blank'); });
    document.querySelectorAll('[data-dev52-enter]').forEach(btn=>btn.onclick=()=>{ const p=state.profissionais.find(x=>String(x.id)===String(btn.dataset.dev52Enter)); window.__SJM_IMPERSONATING_PROFESSIONAL = p?.id; addHistory52('Acesso assistido',`Desenvolvedor entrou para testar como ${p?.nome||'profissional'}.`); alert(`Acesso assistido ativado para: ${p?.nome||'profissional'}\n\nUse para testar telas e bugs sem pedir senha da profissional.`); try{ saveSoft(); window.__SJM_SET_ROUTE ? window.__SJM_SET_ROUTE('dashboard') : setRoute('dashboard'); }catch{} });
    click('btnDev52SupportWpp',()=>{ collectProf52(); const p=state.profissionais.find(x=>String(x.id)===String(document.getElementById('dev52SupportProf')?.value)); const phone=dg52(p?.whatsapp || state.settings?.studioWpp || ''); if(!phone) return alert('Profissional sem WhatsApp cadastrado.'); const msg=document.getElementById('dev52SupportMsg')?.value||'Olá! Sou do suporte do Studio Sync Pro.'; addHistory52('Suporte',`Resposta via WhatsApp para ${p?.nome||'profissional'}.`); try{ saveSoft(); }catch{} window.open(waLink(phone,msg),'_blank'); });
    click('btnDev52SupportMail',()=>{ collectProf52(); const p=state.profissionais.find(x=>String(x.id)===String(document.getElementById('dev52SupportProf')?.value)); if(!String(p?.email||'').trim()) return alert('Profissional sem e-mail cadastrado.'); const msg=encodeURIComponent(document.getElementById('dev52SupportMsg')?.value||'Olá! Sou do suporte do Studio Sync Pro.'); addHistory52('Suporte',`Resposta por e-mail para ${p?.nome||'profissional'}.`); try{ saveSoft(); }catch{} location.href=`mailto:${encodeURIComponent(p.email)}?subject=Suporte Studio Sync Pro&body=${msg}`; });
    click('btnDev52AddTicket',()=>{ const p=state.profissionais.find(x=>String(x.id)===String(document.getElementById('dev52SupportProf')?.value)); state.dev.supportTickets.unshift({id:id52(), nome:p?.nome||'Profissional', tipo:document.getElementById('dev52TicketTitle')?.value||'Suporte', texto:document.getElementById('dev52TicketText')?.value||'', status:document.getElementById('dev52TicketStatus')?.value||'Aberto', criadoEm:Date.now()}); addHistory52('Chamado','Chamado de suporte registrado.'); saveSoft(); renderDevPanelV52(); });
    click('btnDev52SaveBug',()=>{ state.dev.bugNotes.unshift({id:id52(), titulo:document.getElementById('dev52BugTitle')?.value||'Bug/melhoria', texto:document.getElementById('dev52BugText')?.value||'', prioridade:document.getElementById('dev52BugPriority')?.value||'Média', status:document.getElementById('dev52BugStatus')?.value||'Aberto', criadoEm:Date.now()}); addHistory52('Bug','Bug/melhoria registrado na central.'); addLog52('Bug', document.getElementById('dev52BugTitle')?.value||'Bug/melhoria'); saveSoft(); renderDevPanelV52(); });
  }
  const oldRenderAll52 = renderAllHard;
  renderAllHard = function(){ try{ oldRenderAll52(); }catch(e){ console.warn('render old v52',e); } try{ ensureDev52(); if(typeof applyPlanUI==='function') applyPlanUI(); if(typeof getCurrentPlan==='function' && getCurrentPlan()==='developer') renderDevPanelV52(); }catch(e){ console.warn('render dev v52',e); } };
  document.addEventListener('click', e=>{ const t=e.target?.closest?.('.tab[data-tab="desenvolvedor"]'); if(t) setTimeout(renderDevPanelV52,60); }, true);
  document.addEventListener('DOMContentLoaded',()=>{ setTimeout(()=>{ try{ ensureDev52(); if(typeof getCurrentPlan==='function' && getCurrentPlan()==='developer') renderDevPanelV52(); }catch{} },250); });
  setTimeout(()=>{ try{ ensureDev52(); if(typeof getCurrentPlan==='function' && getCurrentPlan()==='developer') renderDevPanelV52(); }catch{} },1200);
  window.__SJM_RENDER_DEV_V52 = renderDevPanelV52;
})();




/* =========================================================
   ✅ v54 — Área do Usuário + DEV sempre atualizado
   ========================================================= */
(function(){
  const BUILD_V54 = "v56-logout-dev-sem-travar";
  const DEV_EMAIL_V54 = ""; // removido na versão cliente
  const DEV_PASS_V54 = ""; // removido na versão cliente

  function esc54(v){ return String(v ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function getUser54(){
    const candidates = ["studio_sync_user","currentUser","user","authUser","SJM_CURRENT_USER"];
    for(const k of candidates){
      try{
        const raw = localStorage.getItem(k);
        if(raw){
          try { const obj = JSON.parse(raw); if(obj && typeof obj === "object") return obj; } catch { return {email: raw}; }
        }
      }catch(e){}
    }
    return window.__SJM_CURRENT_USER || {};
  }
  function userEmail54(){
    const u = getUser54();
    return String(u.email || window.__SJM_CURRENT_USER?.email || localStorage.getItem("studio_sync_email") || "");
  }
  function isDev54(){
    const email = userEmail54().toLowerCase();
    const role = String(localStorage.getItem("studio_sync_role") || localStorage.getItem("role") || window.__SJM_CURRENT_USER?.role || "").toLowerCase();
    return false;
  }
  function saveUserChange54(tipo, detalhe){
    try{
      state.userChanges = Array.isArray(state.userChanges) ? state.userChanges : [];
      state.userChanges.unshift({id:(typeof uid==='function'?uid():Date.now()), tipo, detalhe, criadoEm:Date.now(), email:userEmail54()});
      state.userChanges = state.userChanges.slice(0,60);
      if(typeof saveSoft === "function") saveSoft();
      if(typeof scheduleSync === "function") scheduleSync();
    }catch(e){}
  }

  async function cleanOldCache54(){
    try{
      if("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => !String(k).includes("v56-logout-dev-sem-travar")).map(k => caches.delete(k)));
      }
      if("serviceWorker" in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update().catch(()=>{})));
      }
    }catch(e){}
  }

  function renderDevFresh54(){
    try{
      if(!isDev54()) return;
      if(location.hash !== "#desenvolvedor" && location.hash !== "#dev") return;
      if(typeof window.__SJM_RENDER_DEV_V52 === "function"){
        window.__SJM_RENDER_DEV_V52();
      }
    }catch(e){ console.warn("dev fresh v54", e); }
  }

  function forceDevFreshLoop54(){
    if(!isDev54()) return;
    const times = [20,80,180,400,800,1400,2400];
    times.forEach(t => setTimeout(renderDevFresh54, t));
  }

  // Corrige o erro: login entra na tela DEV antiga e só atualiza depois de trocar de aba.
  window.addEventListener("load", function(){
    cleanOldCache54();
    forceDevFreshLoop54();
  });
  window.addEventListener("hashchange", forceDevFreshLoop54);
  document.addEventListener("click", function(e){
    if(e.target && e.target.closest && e.target.closest('.tab[data-tab="desenvolvedor"], [href="#desenvolvedor"], [data-route="desenvolvedor"]')){
      forceDevFreshLoop54();
    }
  }, true);

  // Envolve funções antigas de rota/render sem quebrar o projeto.
  ["renderAllHard","renderApp","render","showRoute","setRoute"].forEach(name=>{
    try{
      const old = window[name] || (typeof globalThis[name] === "function" ? globalThis[name] : null);
      if(typeof old === "function" && !old.__v54Wrapped){
        const wrapped = function(){
          const out = old.apply(this, arguments);
          forceDevFreshLoop54();
          return out;
        };
        wrapped.__v54Wrapped = true;
        window[name] = wrapped;
        try{ globalThis[name] = wrapped; }catch(e){}
      }
    }catch(e){}
  });

  function openUserModal54(){
    const email = userEmail54() || "não identificado";
    const studio = (state?.settings?.studioNome || state?.settings?.nomeStudio || document.getElementById("studioTitle")?.textContent || "Studio Sync Pro");
    const plan = (state?.settings?.plano || "premium");
    const dev = isDev54();
    const changes = (Array.isArray(state?.userChanges) ? state.userChanges : []).slice(0,8).map(c =>
      `<div class="userChangeList"><b>${esc54(c.tipo)}</b> — ${esc54(c.detalhe)}<br><small>${new Date(c.criadoEm||Date.now()).toLocaleString('pt-BR')}</small></div>`
    ).join("<hr>") || '<div class="hint">Nenhuma alteração registrada.</div>';

    const overlay = document.createElement("div");
    overlay.className = "userModalOverlay";
    overlay.innerHTML = `
      <div class="userModal" role="dialog" aria-modal="true">
        <div class="userModal__head">
          <div>
            <h2>Área do Usuário</h2>
            <p class="hint">Dados de acesso, segurança, alterações e saída do sistema.</p>
          </div>
          <button class="userClose" type="button" data-user-close>×</button>
        </div>

        <div class="userGrid">
          <div class="userBox">
            <h3>Dados pessoais</h3>
            <label class="field"><span>Nome do Studio</span><input id="userStudioName54" value="${esc54(studio)}"></label>
            <label class="field"><span>Email cadastrado</span><input id="userEmail54" type="email" value="${esc54(email)}" ${dev?'':'readonly'}></label>
            <label class="field"><span>Plano atual</span><input value="${esc54(plan)}" readonly></label>
            <button class="btn" type="button" id="btnSaveUser54">Salvar dados</button>
          </div>

          <div class="userBox">
            <h3>Senha cadastrada</h3>
            <p class="hint">Por segurança, a senha aparece protegida.</p>
            <label class="field"><span>Senha atual</span><input type="password" value="********" readonly></label>
            <label class="field"><span>Nova senha</span><input id="userNewPass54" type="password" placeholder="Digite nova senha"></label>
            <label class="field"><span>Confirmar nova senha</span><input id="userNewPassConfirm54" type="password" placeholder="Confirme a senha"></label>
            <button class="btn" type="button" id="btnChangePass54">Alterar senha</button>
          </div>

          <div class="userBox">
            <h3>Alterações</h3>
            ${changes}
          </div>

          <div class="userBox">
            <h3>Conta e segurança</h3>
            <p><b>Tipo de acesso:</b> ${dev ? "Desenvolvedor" : "Profissional"}</p>
            ${dev ? `<p><b>Build:</b> ${BUILD_V54}</p>` : ``}
            <div class="userActions">
              <button class="btn btn--ghost" type="button" id="btnBackupUser54">Exportar backup</button>
              <button class="btn btn--ghost" type="button" id="btnImportUser54">Importar backup</button>
              <button class="btn btn--ghost" type="button" id="btnClearCache54">Limpar cache</button>
              <button class="btn userDanger" type="button" id="btnLogout54">Sair</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = ()=>overlay.remove();
    overlay.querySelector("[data-user-close]").onclick = close;
    overlay.addEventListener("click", e=>{ if(e.target === overlay) close(); });

    const btnSave = overlay.querySelector("#btnSaveUser54");
    if(btnSave) btnSave.onclick = ()=>{
      try{
        state.settings = state.settings || {};
        state.settings.studioNome = overlay.querySelector("#userStudioName54")?.value || state.settings.studioNome;
        if(dev){
          const newEmail = overlay.querySelector("#userEmail54")?.value || email;
          localStorage.setItem("studio_sync_email", newEmail);
        }
        saveUserChange54("Dados pessoais", "Dados do usuário atualizados.");
        if(typeof saveSoft==="function") saveSoft();
        if(typeof renderAllHard==="function") renderAllHard();
        alert("Dados salvos ✅");
        close();
      }catch(e){ alert("Não foi possível salvar os dados."); }
    };

    const btnPass = overlay.querySelector("#btnChangePass54");
    if(btnPass) btnPass.onclick = ()=>{
      const p1 = overlay.querySelector("#userNewPass54")?.value || "";
      const p2 = overlay.querySelector("#userNewPassConfirm54")?.value || "";
      if(p1.length < 6) return alert("A senha precisa ter pelo menos 6 caracteres.");
      if(p1 !== p2) return alert("As senhas não conferem.");
      try{
        if(dev && email.toLowerCase() === DEV_EMAIL_V54.toLowerCase()){
          localStorage.setItem("studio_sync_dev_password", p1);
        } else {
          localStorage.setItem("studio_sync_user_password_hint", "alterada");
        }
        saveUserChange54("Senha", "Senha alterada pelo usuário.");
        alert("Senha alterada ✅");
        close();
      }catch(e){ alert("Não foi possível alterar a senha."); }
    };

    const btnBackup = overlay.querySelector("#btnBackupUser54");
    if(btnBackup) btnBackup.onclick = ()=>{
      try{
        const blob = new Blob([JSON.stringify(state||{}, null, 2)], {type:"application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "backup-studio-sync-pro-usuario.json";
        document.body.appendChild(a); a.click(); a.remove();
        saveUserChange54("Backup", "Backup exportado pelo usuário.");
      }catch(e){ alert("Não foi possível exportar backup."); }
    };

    const btnImportUser = overlay.querySelector("#btnImportUser54");
    if(btnImportUser) btnImportUser.onclick = ()=>{
      const file = document.getElementById("fileImport");
      if(file){ file.click(); }
      else { alert("Importação disponível em Configuração > Backup."); }
    };

    const btnCache = overlay.querySelector("#btnClearCache54");
    if(btnCache) btnCache.onclick = async ()=>{
      await cleanOldCache54();
      saveUserChange54("Cache", "Cache antigo limpo.");
      alert("Cache limpo. A página será recarregada.");
      location.reload();
    };

    const btnLogout = overlay.querySelector("#btnLogout54");
    if(btnLogout) btnLogout.onclick = ()=>{
      try{
        ["studio_sync_user","currentUser","user","authUser","studio_sync_role","role"].forEach(k=>localStorage.removeItem(k));
        window.__SJM_IS_DEVELOPER = false;
        window.__SJM_CURRENT_USER = null;
        saveUserChange54("Saída", "Usuário saiu do sistema.");
      }catch(e){}
      location.href = location.pathname + "?logout=1";
    };
  }

  function ensureUserButton54(){
    let right = document.querySelector(".topbar__right");
    if(!right){
      const top = document.querySelector(".topbar") || document.querySelector("header") || document.body;
      right = document.createElement("div");
      right.className = "topbar__right";
      top.appendChild(right);
    }
    let btn = document.getElementById("btnUserArea");
    if(!btn){
      btn = document.createElement("button");
      btn.id = "btnUserArea";
      btn.type = "button";
      btn.className = "btn btn--ghost userTopBtn";
      btn.textContent = "Usuário";
      right.appendChild(btn);
    }
    btn.onclick = openUserModal54;
    btn.style.display = document.body.classList.contains("auth-locked") ? "none" : "";
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    ensureUserButton54();
    setTimeout(ensureUserButton54, 500);
    setTimeout(ensureUserButton54, 1500);
    forceDevFreshLoop54();
  });
  setInterval(ensureUserButton54, 2500);

  window.__SJM_USER_AREA_V54 = openUserModal54;
  window.__SJM_FORCE_DEV_FRESH_V54 = forceDevFreshLoop54;
})();


/* =========================================================
   ✅ v55 — Correções solicitadas
   1) Pastas de clientes sempre aparecem, mesmo sem foto.
   2) Materiais: cálculo e estoque baixo atualizam na hora.
   3) Troca de plano só com senha + aviso de cobrança na próxima fatura.
   ========================================================= */
(function(){
  const DEV_PASS_V55 = ""; // removido na versão cliente

  function esc55(v){ return String(v ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function n55(v){ try{ return typeof num==='function' ? num(v) : Number(String(v||'0').replace(',','.'))||0; }catch{ return 0; } }
  function id55(){ try{ return uid(); }catch{ return 'id_'+Date.now()+'_'+Math.random().toString(16).slice(2); } }
  function today55(){ try{ return todayISO(); }catch{ return new Date().toISOString().slice(0,10); } }
  function save55(){
    try{ if(typeof saveSoft === "function") saveSoft(); }catch(e){}
    try{ if(typeof scheduleSync === "function") scheduleSync(); }catch(e){}
  }
  function isDev55(){
    try{
      return window.__SJM_IS_DEVELOPER === true ||
        false;
    }catch(e){ return false; }
  }

  // ---------- PASTAS: todos os clientes aparecem ----------
  function ensureClientFolders55(){
    try{
      state.clientes = Array.isArray(state.clientes) ? state.clientes : [];
      state.clientes.forEach(c=>{
        if(!c.id) c.id = id55();
        if(!Array.isArray(c.fotos)) c.fotos = [];
      });
    }catch(e){}
  }

  window.renderClientPhotoPanel = renderClientPhotoPanel = function(){
    const box = document.getElementById("clientPhotoPanel");
    if(!box) return;
    ensureClientFolders55();

    const clientes = (state.clientes||[])
      .slice()
      .filter(c => String(c.nome||"").trim())
      .sort((a,b)=> String(a.nome||"").localeCompare(String(b.nome||""), "pt-BR"));

    if(!clientes.length){
      box.innerHTML = '<div class="hint">Cadastre uma cliente para criar a pasta de fotos.</div>';
      return;
    }

    box.innerHTML = `
      <div class="clientFolderGrid">
        ${clientes.map(c=>`
          <details class="photoFolder compactFolder">
            <summary>📁 ${esc55(c.nome||"Cliente")} <span class="hintInline">${Array.isArray(c.fotos)?c.fotos.length:0} foto(s)</span></summary>
            ${Array.isArray(c.fotos) && c.fotos.length ? `
              <div class="photoGrid">
                ${c.fotos.map(f=>`
                  <div class="photoCard">
                    ${f.imagem ? `<img src="${f.imagem}" alt="Foto do procedimento" />` : ''}
                    <div class="photoMeta">${typeof fmtBRDate==='function' ? fmtBRDate(f.data) : esc55(f.data||'')} • ${esc55(f.procedimento || 'Procedimento')}</div>
                  </div>`).join('')}
              </div>` : `<div class="hint">Pasta criada. Nenhuma foto salva ainda.</div>`}
          </details>`).join('')}
      </div>`;
  };

  // Garante pasta no cadastro/edição de cliente e atualiza painel
  const oldRenderClientes55 = typeof renderClientes === "function" ? renderClientes : null;
  if(oldRenderClientes55){
    window.renderClientes = renderClientes = function(){
      ensureClientFolders55();
      oldRenderClientes55();
      setTimeout(()=>{ try{ ensureClientFolders55(); renderClientPhotoPanel(); }catch(e){} }, 30);
    };
  }

  // ---------- MATERIAIS: cálculo + estoque ----------
  function calcMaterialV55(m){
    if(!m || typeof m !== "object") return m;
    if(!m.id) m.id = id55();
    if(m.nome === undefined && m.material !== undefined) m.nome = m.material;
    if(m.nome === undefined) m.nome = "";
    if(!m.unidade) m.unidade = "ml";

    // Modelo:
    // qtdPorUnidade = quanto vem em UMA unidade/embalagem (ml/g/kg/un)
    // valorUnidade = valor pago por UMA unidade/embalagem
    // unidadesCompradas = quantas unidades/embalagens comprou
    // qtdCliente = quanto usa por cliente
    m.qtdPorUnidade = n55(m.qtdPorUnidade);
    m.valorUnidade = n55(m.valorUnidade);
    m.unidadesCompradas = n55(m.unidadesCompradas);
    m.qtdCliente = n55(m.qtdCliente);
    m.estoqueMin = n55(m.estoqueMin);

    m.qtdTotal = m.qtdPorUnidade * m.unidadesCompradas;
    m.valorCompra = m.valorUnidade * m.unidadesCompradas;
    m.custoUnit = m.qtdPorUnidade > 0 ? (m.valorUnidade / m.qtdPorUnidade) : 0;
    m.custoCliente = m.custoUnit * m.qtdCliente;
    m.rendimento = m.qtdCliente > 0 ? (m.qtdTotal / m.qtdCliente) : 0;

    // consumo estimado por atendimentos realizados
    const realizados = (state.atendimentos||[]).filter(a => n55(a.recebido) > 0 || String(a.status||"").toLowerCase()==="realizado").length;
    m.consumoEstimado = m.qtdCliente * realizados;
    m.estoqueRestante = Math.max(0, m.qtdTotal - m.consumoEstimado);
    return m;
  }

  window.calcularMaterial = calcularMaterial = calcMaterialV55;

  window.renderMaterialAlerts = renderMaterialAlerts = function(){
    const box = document.getElementById('materialAlerts');
    if(!box) return;
    state.materiais = Array.isArray(state.materiais) ? state.materiais : [];
    state.materiais.forEach(calcMaterialV55);

    const baixo = state.materiais.filter(m=>{
      const restante = n55(m.estoqueRestante !== undefined ? m.estoqueRestante : m.qtdTotal);
      const minimo = n55(m.estoqueMin);
      return minimo > 0 && restante <= minimo;
    });
    const vencendo = state.materiais.filter(m => m.validade && m.validade <= (typeof addDaysISO==='function' ? addDaysISO(today55(), 30) : today55()));

    box.innerHTML = `
      <div class="miniCards">
        <div class="miniCard"><b>Estoque baixo</b><span>${baixo.length}</span></div>
        <div class="miniCard"><b>Validade em até 30 dias</b><span>${vencendo.length}</span></div>
        <div class="miniCard"><b>Itens cadastrados</b><span>${state.materiais.length}</span></div>
      </div>
      ${baixo.length
        ? `<small class="hint dangerText">Atenção: ${baixo.map(m=>esc55(m.nome||m.material||'Sem nome')).join(', ')}</small>`
        : `<small class="hint">Nenhum alerta de estoque baixo.</small>`}
    `;
  };

  const oldRenderMateriais55 = typeof renderMateriaisHard === "function" ? renderMateriaisHard : null;
  if(oldRenderMateriais55){
    window.renderMateriaisHard = renderMateriaisHard = function(){
      state.materiais = Array.isArray(state.materiais) ? state.materiais : [];
      state.materiais.forEach(calcMaterialV55);
      oldRenderMateriais55();

      // Atualiza números de alerta imediatamente durante edição.
      const body = document.querySelector('#tblMat tbody');
      if(body && !body.__v55MaterialBound){
        body.__v55MaterialBound = true;
        body.addEventListener('input', ()=>setTimeout(()=>{ try{ state.materiais.forEach(calcMaterialV55); renderMaterialAlerts(); }catch(e){} }, 60), true);
        body.addEventListener('change', ()=>setTimeout(()=>{ try{ state.materiais.forEach(calcMaterialV55); renderMaterialAlerts(); save55(); }catch(e){} }, 60), true);
      }
      renderMaterialAlerts();
    };
  }

  // ---------- TROCA DE PLANO COM SENHA ----------
  function getStoredPassword55(){
    try{
      return localStorage.getItem("studio_sync_dev_password") ||
             localStorage.getItem("studio_sync_user_password") ||
             localStorage.getItem("studio_sync_password") ||
             "";
    }catch(e){ return ""; }
  }

  window.changePlan = changePlan = function(plan){
    if(!PLAN_FEATURES[plan]) return;
    const old = state.settings?.plano || "premium";
    if(plan === old){
      alert("Este já é o plano atual.");
      return;
    }

    const senha = prompt("Digite a senha cadastrada para confirmar a alteração do plano:");
    if(!senha) return;

    const storedPassword55 = getStoredPassword55();
    const ok = !!storedPassword55 && senha === storedPassword55;
    if(!ok){
      alert("Senha incorreta. O plano não foi alterado.");
      return;
    }

    const msg = `Alterar de ${PLAN_LABELS[old] || old} para ${PLAN_LABELS[plan] || plan}?\n\nA cobrança será atualizada na próxima fatura.\nNenhum dado será apagado.`;
    if(!confirm(msg)) return;

    state.settings = state.settings || {};
    state.settings.plano = plan;
    state.settings.ultimaMudancaPlano = {
      de: old,
      para: plan,
      data: Date.now(),
      aviso: "Cobrança atualizada na próxima fatura"
    };

    try{
      state.userChanges = Array.isArray(state.userChanges) ? state.userChanges : [];
      state.userChanges.unshift({
        id:id55(),
        tipo:"Plano",
        detalhe:`Plano alterado de ${PLAN_LABELS[old]||old} para ${PLAN_LABELS[plan]||plan}. Cobrança na próxima fatura.`,
        criadoEm:Date.now()
      });
    }catch(e){}

    save55();
    try{ if(typeof applyPlanUI==="function") applyPlanUI(); }catch(e){}
    try{ if(typeof renderPlanCards==="function") renderPlanCards(); }catch(e){}
    try{ const el=document.getElementById("cfgPlano"); if(el) el.value=plan; }catch(e){}

    alert(`Plano alterado de ${PLAN_LABELS[old] || old} para ${PLAN_LABELS[plan] || plan}.\n\nA cobrança será atualizada na próxima fatura.\nNenhum dado foi apagado.`);
  };

  // Reforça o listener do modal para usar a função nova
  document.addEventListener("click", function(e){
    const btn = e.target?.closest?.("[data-change-plan]");
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.changePlan(btn.dataset.changePlan);
  }, true);

  // Boot v55
  function boot55(){
    try{
      ensureClientFolders55();
      state.materiais?.forEach(calcMaterialV55);
      renderClientPhotoPanel();
      renderMaterialAlerts();
    }catch(e){ console.warn("boot v55", e); }
  }
  document.addEventListener("DOMContentLoaded", ()=>setTimeout(boot55, 200));
  setTimeout(boot55, 800);
  setTimeout(boot55, 1800);
})();


/* =========================================================
   ✅ v56 — Correção logout + DEV sem travar digitação
   - Sair encerra Firebase/local e fica na tela de login.
   - DEV não re-renderiza enquanto o usuário está digitando/clicando em campo.
   - Remove o parâmetro logout da URL depois que a tela de login abre.
   ========================================================= */
(function(){
  const BUILD_V56 = "v56-logout-dev-sem-travar";
  window.__SJM_BUILD = BUILD_V56;

  function activeIsFieldV56(){
    const el = document.activeElement;
    return !!(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
  }
  function inDevRouteV56(){
    return String(location.hash||"").replace("#","").toLowerCase() === "desenvolvedor" ||
           !!document.querySelector('[data-route="desenvolvedor"]:not(.isHidden)');
  }
  function devBusyV56(){
    return inDevRouteV56() && activeIsFieldV56();
  }

  // Durante edição no DEV, não deixa render pesado roubar foco.
  const oldRenderDev52_v56 = window.__SJM_RENDER_DEV_V52 || window.renderDevPanelV52;
  if(typeof oldRenderDev52_v56 === "function" && !oldRenderDev52_v56.__v56Wrapped){
    const wrapped = function(){
      if(devBusyV56()) return;
      return oldRenderDev52_v56.apply(this, arguments);
    };
    wrapped.__v56Wrapped = true;
    window.__SJM_RENDER_DEV_V52 = wrapped;
    try{ window.renderDevPanelV52 = wrapped; }catch(e){}
    try{ globalThis.renderDevPanelV52 = wrapped; }catch(e){}
  }

  const oldRenderAll_v56 = window.renderAllHard || (typeof renderAllHard === "function" ? renderAllHard : null);
  if(typeof oldRenderAll_v56 === "function" && !oldRenderAll_v56.__v56Wrapped){
    const wrappedAll = function(){
      if(devBusyV56()){
        try{ if(typeof saveSoft === "function") saveSoft(); }catch(e){}
        return;
      }
      return oldRenderAll_v56.apply(this, arguments);
    };
    wrappedAll.__v56Wrapped = true;
    window.renderAllHard = wrappedAll;
    try{ renderAllHard = wrappedAll; }catch(e){}
    try{ globalThis.renderAllHard = wrappedAll; }catch(e){}
  }

  // No DEV, sync não re-renderiza a tela enquanto há campo ativo.
  const oldSchedule_v56 = window.scheduleSync || (typeof scheduleSync === "function" ? scheduleSync : null);
  if(typeof oldSchedule_v56 === "function" && !oldSchedule_v56.__v56Wrapped){
    const wrappedSchedule = function(){
      if(devBusyV56()){
        try{ if(typeof saveSoft === "function") saveSoft(); }catch(e){}
        return;
      }
      return oldSchedule_v56.apply(this, arguments);
    };
    wrappedSchedule.__v56Wrapped = true;
    window.scheduleSync = wrappedSchedule;
    try{ scheduleSync = wrappedSchedule; }catch(e){}
    try{ globalThis.scheduleSync = wrappedSchedule; }catch(e){}
  }

  // Marca edição por mais tempo para inputs/selects do DEV.
  document.addEventListener("focusin", (e)=>{
    if(activeIsFieldV56() && inDevRouteV56()) window.__SJM_IS_EDITING = true;
  }, true);
  document.addEventListener("focusout", ()=>{
    setTimeout(()=>{ window.__SJM_IS_EDITING = false; }, 900);
  }, true);
  document.addEventListener("input", ()=>{
    if(inDevRouteV56()) {
      window.__SJM_IS_EDITING = true;
      clearTimeout(window.__SJM_DEV_EDIT_TIMER_V56);
      window.__SJM_DEV_EDIT_TIMER_V56 = setTimeout(()=>{ window.__SJM_IS_EDITING = false; }, 1200);
    }
  }, true);

  async function doLogoutV56(){
    try{ window.__SJM_LOGGING_OUT = true; sessionStorage.setItem("sjm_force_logout","1"); }catch(e){}
    try{ if(typeof saveSoft === "function") saveSoft(); }catch(e){}

    // encerra login local/dev
    try{
      [
        "studio_sync_user","currentUser","user","authUser","studio_sync_role","role",
        "studio_sync_email","studio_sync_user_email","studio_sync_logged_in",
        "sjm_current_user","sjm_auth_user"
      ].forEach(k=>localStorage.removeItem(k));
    }catch(e){}

    try{
      window.__SJM_IS_DEVELOPER = false;
      window.__SJM_DEV_UNLOCKED = false;
      window.__SJM_CURRENT_USER = null;
      window.__SJM_IMPERSONATING_PROFESSIONAL = null;
    }catch(e){}

    // encerra Firebase de verdade
    try{
      if(typeof window.__SJM_SIGN_OUT === "function"){
        await window.__SJM_SIGN_OUT();
      }
    }catch(e){ console.warn("logout firebase:", e); }

    try{
      document.body?.classList.add("auth-locked");
      document.getElementById("loginEmail")?.focus({preventScroll:false});
      const msg = document.getElementById("authMsg");
      if(msg) msg.textContent = "Você saiu. Entre com outra conta.";
    }catch(e){}

    // usa replace para não voltar automaticamente com histórico/hash antigo
    const cleanPath = location.pathname + "?logout=1";
    location.replace(cleanPath);
  }

  window.__SJM_LOGOUT = doLogoutV56;

  // Intercepta qualquer botão de sair, inclusive o modal antigo.
  document.addEventListener("click", function(e){
    const btn = e.target?.closest?.("#btnLogout54,[data-logout],.logoutBtn");
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    doLogoutV56();
  }, true);

  // Se abriu com ?logout=1, força tela de login e não deixa voltar sozinho.
  document.addEventListener("DOMContentLoaded", ()=>{
    if(new URLSearchParams(location.search).get("logout") === "1" || sessionStorage.getItem("sjm_force_logout") === "1"){
      try{
        document.body?.classList.add("auth-locked");
        window.__SJM_IS_DEVELOPER = false;
        window.__SJM_DEV_UNLOCKED = false;
        window.__SJM_CURRENT_USER = null;
        const msg = document.getElementById("authMsg");
        if(msg) msg.textContent = "Você saiu. Entre com outra conta.";
        document.getElementById("loginEmail")?.focus({preventScroll:false});
      }catch(e){}
      setTimeout(()=>{ try{ history.replaceState(null, "", location.pathname); }catch(e){} }, 500);
    }
  });
})();



/* BLOCO v58 banco único removido na v81-limpa: substituído pelo salvamento central original + v62. */

/* =========================================================
   v60 - Ajuste pedido: remover Equipe por enquanto, mover Indicação para Fidelidade,
   remover Pacotes/Assinaturas e renomear Marketing para Promoções.
   ========================================================= */
(function(){
  function v60PatchMenu(){
    try{
      document.querySelectorAll('[data-tab="equipe"]').forEach(b=>b.remove());
      document.querySelectorAll('[data-route="equipe"]').forEach(p=>p.remove());
      document.querySelectorAll('[data-tab="marketing"]').forEach(b=>{ b.childNodes[0].nodeValue = 'Promoções'; });
    }catch(e){ console.warn('v60 menu', e); }
  }
  function v60PatchPlanFeatures(){
    try{
      if(typeof PLAN_FEATURES !== 'undefined'){
        Object.keys(PLAN_FEATURES).forEach(k=>{ PLAN_FEATURES[k]=(PLAN_FEATURES[k]||[]).filter(x=>x!=='equipe'); });
      }
      if(typeof ROUTES !== 'undefined'){
        for(let i=ROUTES.length-1;i>=0;i--){ if(ROUTES[i]?.id==='equipe') ROUTES.splice(i,1); }
        const m=ROUTES.find(r=>r.id==='marketing'); if(m) m.label='Promoções';
      }
    }catch(e){ console.warn('v60 features', e); }
  }
  function v60RenderIndicacoes(){
    try{
      const el=document.getElementById('indList');
      if(!el) return;
      const lista=(window.state?.marketing?.indicacoes || state?.marketing?.indicacoes || []);
      el.innerHTML = lista.length ? lista.map(x=>`<div class="simpleItem"><b>${String(x.cliente||'')}</b> indicou ${String(x.amiga||'')}</div>`).join('') : '<div class="hint">Sem indicações registradas.</div>';
    }catch(e){ console.warn('v60 indicacoes', e); }
  }
  function v60BindIndicacao(){
    const btn=document.getElementById('btnAddIndicacao');
    if(!btn || btn.__v60) return;
    btn.__v60=true;
    btn.addEventListener('click', ()=> setTimeout(v60RenderIndicacoes, 80));
  }
  function v60Run(){ v60PatchPlanFeatures(); v60PatchMenu(); v60RenderIndicacoes(); v60BindIndicacao(); }
  document.addEventListener('DOMContentLoaded', v60Run);
  window.addEventListener('load', ()=>{ v60Run(); setTimeout(v60Run,300); setTimeout(v60Run,1000); });
  document.addEventListener('click', ()=>setTimeout(v60Run,50), true);
})();



/* =========================================================
   LIMPEZA FINAL — CONFIG, IMPORTAÇÃO E BOOT ESTÁVEL
   Mantém apenas um fluxo para logo/cor/importar e evita binds duplicados.
   ========================================================= */
(function(){
  'use strict';
  function el(id){ return document.getElementById(id); }
  function currentState(){ return window.state || (typeof state !== 'undefined' ? state : null); }
  function setCurrentState(s){ try{ window.state = s; state = s; }catch{ window.state = s; } }
  function normalizeImportedState(parsed){
    if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Backup inválido');
    const clean = (typeof sanitizeState === 'function') ? sanitizeState(parsed) : parsed;
    clean.settings = clean.settings && typeof clean.settings === 'object' ? clean.settings : {};
    clean.settings.studioNome = clean.settings.studioNome || 'Studio Jaqueline Mendanha';
    clean.settings.logoUrl = clean.settings.logoUrl || '';
    clean.settings.corPrimaria = clean.settings.corPrimaria || '#7B2CBF';
    clean.settings.corAcento = clean.settings.corAcento || '#F72585';
    clean.settings.plano = clean.settings.plano || 'premium';
    ['clientes','agenda','atendimentos','materiais','despesas','procedimentos'].forEach(k=>{ if(!Array.isArray(clean[k])) clean[k] = []; });
    return clean;
  }
  async function importBackupFile(file){
    if(!file) return;
    try{
      const parsed = JSON.parse(await file.text());
      const clean = normalizeImportedState(parsed);
      setCurrentState(clean);
      try{ enforceAgendaRecebidoRules(); }catch{}
      try{ syncAgendaToAtendimentos(); }catch{}
      try{ state.materiais.forEach(calcularMaterial); }catch{}
      try{ state.atendimentos.forEach(calcularAtendimento); }catch{}
      try{ saveSoft(); }catch{}
      try{ applyTheme(); }catch{}
      try{ renderAllHard(); }catch{}
      try{ scheduleSync(); }catch{}
      alert('Backup importado ✅');
    }catch(err){
      console.error(err);
      alert('Arquivo de backup inválido. Importe um JSON exportado pelo próprio app.');
    }
  }
  function bindImportButton(){
    const file = el('fileImport');
    const btn = el('btnImportBackupFinal');
    if(btn && file && !btn.__sjmImportBound){
      btn.__sjmImportBound = true;
      btn.addEventListener('click', ()=> file.click());
    }
    if(file && !file.__sjmImportBound){
      file.__sjmImportBound = true;
      file.addEventListener('change', async (e)=>{
        await importBackupFile(e.target.files && e.target.files[0]);
        e.target.value = '';
      });
    }
  }
  function refreshConfigFields(){
    const s = currentState();
    if(!s || !s.settings) return;
    if(el('cfgStudioNome')) el('cfgStudioNome').value = s.settings.studioNome || '';
    if(el('cfgLogoUrl')) el('cfgLogoUrl').value = s.settings.logoUrl || '';
    if(el('cfgCorPrimaria')) el('cfgCorPrimaria').value = s.settings.corPrimaria || '#7B2CBF';
    if(el('cfgCorAcento')) el('cfgCorAcento').value = s.settings.corAcento || '#F72585';
    if(el('cfgStudioWpp')) el('cfgStudioWpp').value = s.settings.studioWpp || '';
    if(el('cfgPlano')) el('cfgPlano').value = s.settings.plano || 'premium';
  }
  function bootCleanFinal(){
    try{ bindImportButton(); }catch(e){ console.warn('bind import', e); }
    try{ refreshConfigFields(); }catch(e){ console.warn('refresh config', e); }
    try{ applyTheme(); }catch(e){ console.warn('theme', e); }
    try{ applyPlanUI(); }catch(e){ console.warn('plan ui', e); }
  }
  document.addEventListener('DOMContentLoaded', bootCleanFinal);
  window.addEventListener('load', bootCleanFinal);
  setTimeout(bootCleanFinal, 100);
  setTimeout(bootCleanFinal, 600);
  window.__SJM_IMPORT_BACKUP_FILE = importBackupFile;
})();

/* =========================================================
   v70 DEV PRO — Central profissional de desenvolvimento e controle
   Base: mantém o app funcionando e acrescenta gestão do SaaS.
   ========================================================= */
(function(){
  'use strict';
  const DEV_PRO_BUILD = 'v70-dev-pro-control-center';

  function $(id){ return document.getElementById(id); }
  function q(sel, root=document){ return root.querySelector(sel); }
  function qa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function num(v){ const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function money(v){ try{ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }catch{ return 'R$ 0,00'; } }
  function today(){ return new Date().toISOString().slice(0,10); }
  function nowBR(){ try{ return new Date().toLocaleString('pt-BR'); }catch{ return String(new Date()); } }
  function uid(){ return 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }
  function currentState(){ return (typeof state !== 'undefined' && state) ? state : (window.state || null); }
  function persist(){ try{ if(typeof saveSoft === 'function') saveSoft(); }catch(e){} try{ if(typeof scheduleSync === 'function') scheduleSync(); }catch(e){} try{ window.__SJM_PUSH_TO_CLOUD?.(currentState()); }catch(e){} }
  function realPlan(){ try{ return String(currentState()?.settings?.plano || 'premium').toLowerCase(); }catch{ return 'premium'; } }

  const DEFAULT_PLANS = {
    basic: { label:'Básico', price:'R$ 29,90/mês', trialDays:7, maxClientes:80, maxFotos:20, features:['Agenda','Clientes','WhatsApp','Procedimentos','Configurações'] },
    pro: { label:'Pro', price:'R$ 59,90/mês', trialDays:7, maxClientes:300, maxFotos:120, features:['Dashboard','CRM','Materiais','Despesas','Relatórios','Backup'] },
    premium: { label:'Premium', price:'R$ 99,90/mês', trialDays:7, maxClientes:9999, maxFotos:9999, features:['Fidelidade','Fotos','Exportações','Suporte prioritário','Recursos futuros'] }
  };

  function ensureDevPro(){
    const s = currentState();
    if(!s) return null;
    s.devPro = s.devPro && typeof s.devPro === 'object' ? s.devPro : {};
    const d = s.devPro;
    d.build = DEV_PRO_BUILD;
    d.maintenance = !!d.maintenance;
    d.forceUpdateVersion = d.forceUpdateVersion || '';
    d.plans = d.plans && typeof d.plans === 'object' ? d.plans : JSON.parse(JSON.stringify(DEFAULT_PLANS));
    Object.keys(DEFAULT_PLANS).forEach(k=>{ d.plans[k] = Object.assign({}, DEFAULT_PLANS[k], d.plans[k] || {}); });
    d.users = Array.isArray(d.users) ? d.users : [];
    d.tickets = Array.isArray(d.tickets) ? d.tickets : [];
    d.releases = Array.isArray(d.releases) ? d.releases : [];
    d.logs = Array.isArray(d.logs) ? d.logs : [];
    d.flags = d.flags && typeof d.flags === 'object' ? d.flags : { autoBackup:true, blockExpiredTrial:false, requireUpdate:false, supportChat:true, betaFeatures:false };
    d.integrations = d.integrations && typeof d.integrations === 'object' ? d.integrations : { firebase:'Configurado', whatsapp:'Manual', email:'mailto', payments:'Pendente' };
    d.security = d.security && typeof d.security === 'object' ? d.security : { devOnly:true, lastAudit:today(), rules:'Validar regras do Firestore antes de vender como SaaS.' };
    seedCurrentUser(d);
    return d;
  }

  function seedCurrentUser(d){
    const s = currentState(); if(!s) return;
    const auth = window.__SJM_CURRENT_USER || {};
    const email = auth.email || s.settings?.email || 'usuario-local@app';
    const id = auth.uid || 'local-user';
    let u = d.users.find(x => String(x.uid) === String(id) || String(x.email||'').toLowerCase() === String(email).toLowerCase());
    if(!u){
      u = { uid:id, studio:s.settings?.studioNome || 'Studio atual', owner:s.settings?.profissionalNome || s.settings?.nome || 'Profissional', email, whatsapp:s.settings?.studioWpp || '', plan:realPlan(), status:'ativo', trialStart:today(), trialDays:7, lastAccess:Date.now(), createdAt:Date.now() };
      d.users.unshift(u);
    }
    u.studio = s.settings?.studioNome || u.studio || 'Studio atual';
    u.owner = s.settings?.profissionalNome || s.settings?.nome || u.owner || 'Profissional';
    u.email = email;
    u.whatsapp = s.settings?.studioWpp || u.whatsapp || '';
    u.plan = realPlan() === 'developer' ? (s.settings?.plano || 'premium') : realPlan();
    u.lastAccess = Date.now();
  }

  function addLog(area, text, level='info'){
    const d = ensureDevPro(); if(!d) return;
    d.logs.unshift({ id:uid(), area, text, level, at:Date.now(), user:window.__SJM_CURRENT_USER?.email || 'local' });
    d.logs = d.logs.slice(0,120);
  }

  function appMetrics(){
    const s = currentState() || {};
    const d = ensureDevPro() || {users:[],tickets:[],releases:[]};
    const users = d.users || [];
    const inTrial = users.filter(u => String(u.status).toLowerCase() === 'teste').length;
    const active = users.filter(u => ['ativo','teste'].includes(String(u.status).toLowerCase())).length;
    const byPlan = { basic:0, pro:0, premium:0 };
    users.forEach(u=>{ const p=String(u.plan||'').toLowerCase(); if(byPlan[p] != null) byPlan[p]++; });
    const receita = (s.atendimentos||[]).reduce((a,x)=> a + num(x.recebido ?? x.valor), 0) + (s.receitasExtras||[]).reduce((a,x)=>a+num(x.valor),0);
    const agenda = s.agenda || [];
    const completed = agenda.filter(a=>String(a.status||'').toLowerCase()==='realizado').length;
    const cancelled = agenda.filter(a=>String(a.status||'').toLowerCase()==='cancelado').length;
    const conv = agenda.length ? Math.round((completed / agenda.length) * 100) : 0;
    return {
      clients:(s.clientes||[]).length,
      schedule:agenda.length,
      services:(s.atendimentos||[]).length,
      materials:(s.materiais||[]).length,
      expenses:(s.despesas||[]).length,
      photos:(s.fotos||[]).length,
      receita,
      users:users.length,
      active,
      inTrial,
      byPlan,
      ticketsOpen:(d.tickets||[]).filter(t=>String(t.status||'Aberto')!=='Resolvido').length,
      releases:(d.releases||[]).length,
      conversion:conv,
      cancelled
    };
  }

  function trialLeft(u){
    const days = num(u.trialDays || 7);
    const start = u.trialStart ? new Date(u.trialStart + 'T00:00:00') : new Date(u.createdAt || Date.now());
    const diff = Math.floor((Date.now() - start.getTime()) / 86400000);
    return Math.max(0, days - diff);
  }
  function statusBadge(status){
    const st=String(status||'ativo').toLowerCase();
    const cls = st==='ativo' ? 'ok' : st==='teste' ? 'warn' : st==='bloqueado' || st==='cancelado' ? 'danger' : '';
    return `<span class="devBadge ${cls}">${esc(status||'ativo')}</span>`;
  }

  function renderShell(active='visao'){
    const root = $('devProRoot') || q('[data-route="desenvolvedor"]');
    if(!root) return;
    const d = ensureDevPro();
    const m = appMetrics();
    const maintenance = d.maintenance;
    root.innerHTML = `
      <div class="devHero">
        <div class="devHero__title">
          <h2>Central do Desenvolvedor</h2>
          <p>Área profissional para controlar usuários, planos, atualizações, suporte, métricas e saúde do app.</p>
        </div>
        <div class="devStatusPill"><span class="devDot ${maintenance?'warn':''}"></span>${maintenance ? 'Modo manutenção ativo' : 'Sistema operacional'} · ${esc(DEV_PRO_BUILD)}</div>
      </div>
      <div class="devKpis">
        <div class="devKpi"><span>Usuários cadastrados</span><b>${m.users}</b></div>
        <div class="devKpi"><span>Teste 7 dias</span><b>${m.inTrial}</b></div>
        <div class="devKpi"><span>Chamados abertos</span><b>${m.ticketsOpen}</b></div>
        <div class="devKpi"><span>Conversão agenda</span><b>${m.conversion}%</b></div>
      </div>
      <div class="devTabs" role="tablist">
        ${[['visao','Visão geral'],['usuarios','Usuários e planos'],['atualizacoes','Atualizações'],['metricas','Métricas'],['suporte','Suporte'],['banco','Banco e backup'],['seguranca','Segurança'],['diagnostico','Diagnóstico']].map(x=>`<button class="devTab ${active===x[0]?'active':''}" data-dev-tab="${x[0]}" type="button">${x[1]}</button>`).join('')}
      </div>
      <div id="devProContent"></div>
    `;
    renderTab(active);
    bindShell();
  }

  function renderTab(tab){
    const box = $('devProContent'); if(!box) return;
    const d = ensureDevPro(); const m = appMetrics();
    if(tab==='visao') box.innerHTML = renderOverview(d,m);
    if(tab==='usuarios') box.innerHTML = renderUsers(d,m);
    if(tab==='atualizacoes') box.innerHTML = renderUpdates(d,m);
    if(tab==='metricas') box.innerHTML = renderMetrics(d,m);
    if(tab==='suporte') box.innerHTML = renderSupport(d,m);
    if(tab==='banco') box.innerHTML = renderDatabase(d,m);
    if(tab==='seguranca') box.innerHTML = renderSecurity(d,m);
    if(tab==='diagnostico') box.innerHTML = renderDiagnostic(d,m);
    bindTab(tab);
  }

  function renderOverview(d,m){
    return `
      <div class="devSplit">
        <div class="box"><h3>Resumo SaaS</h3>
          <div class="devThree">
            <div class="devKpi"><span>Básico</span><b>${m.byPlan.basic}</b></div>
            <div class="devKpi"><span>Pro</span><b>${m.byPlan.pro}</b></div>
            <div class="devKpi"><span>Premium</span><b>${m.byPlan.premium}</b></div>
          </div>
          <p class="hint">A contagem usa os usuários registrados nesta base. Para todos os clientes reais, a publicação precisa estar ligada a uma coleção global no Firebase.</p>
        </div>
        <div class="box"><h3>Controle rápido</h3>
          <div class="devToolbar">
            <button class="btn" id="devBtnNewRelease" type="button">Publicar atualização</button>
            <button class="btn btn--ghost" id="devBtnMaintenance" type="button">${d.maintenance?'Desativar':'Ativar'} manutenção</button>
            <button class="btn btn--ghost" id="devBtnExportCsv" type="button">Exportar CSV</button>
          </div>
          <div class="devNotice"><b>Atenção:</b> o painel está pronto para operação profissional no app. Para uma venda SaaS segura, as regras do Firebase precisam separar dados de cada cliente e dados globais do desenvolvedor.</div>
        </div>
      </div>
      <div class="box"><h3>Últimas atividades</h3>${renderLogs(d.logs, 8)}</div>
    `;
  }

  function renderUsers(d,m){
    const rows = (d.users||[]).map(u=>`
      <tr data-dev-user="${esc(u.uid)}">
        <td><input class="devInput" data-k="studio" value="${esc(u.studio)}"></td>
        <td><input class="devInput" data-k="owner" value="${esc(u.owner)}"></td>
        <td><input class="devInput" data-k="email" value="${esc(u.email)}"></td>
        <td><select class="devSelect" data-k="plan"><option value="basic" ${u.plan==='basic'?'selected':''}>Básico</option><option value="pro" ${u.plan==='pro'?'selected':''}>Pro</option><option value="premium" ${u.plan==='premium'?'selected':''}>Premium</option></select></td>
        <td><select class="devSelect" data-k="status"><option ${u.status==='teste'?'selected':''}>teste</option><option ${u.status==='ativo'?'selected':''}>ativo</option><option ${u.status==='bloqueado'?'selected':''}>bloqueado</option><option ${u.status==='cancelado'?'selected':''}>cancelado</option></select></td>
        <td><input class="devInput devMini" data-k="trialDays" type="number" value="${esc(u.trialDays||7)}"></td>
        <td>${String(u.status).toLowerCase()==='teste' ? trialLeft(u)+' dias' : '—'}</td>
        <td><button class="btn btn--ghost" type="button" data-dev-impersonate="${esc(u.uid)}">Testar</button></td>
      </tr>`).join('') || `<tr><td colspan="8">Nenhum usuário cadastrado.</td></tr>`;
    const planCards = Object.entries(d.plans).map(([k,p])=>`
      <div class="box"><h3>Plano ${esc(p.label)}</h3>
        <label class="field"><span>Valor</span><input class="devInput" id="plan_${k}_price" value="${esc(p.price)}"></label>
        <label class="field"><span>Dias de teste</span><input class="devInput" id="plan_${k}_trial" type="number" value="${esc(p.trialDays)}"></label>
        <label class="field"><span>Limite de clientes</span><input class="devInput" id="plan_${k}_clients" type="number" value="${esc(p.maxClientes)}"></label>
        <label class="field"><span>Limite de fotos</span><input class="devInput" id="plan_${k}_photos" type="number" value="${esc(p.maxFotos)}"></label>
      </div>`).join('');
    return `
      <div class="box"><h3>Usuários, planos e testes</h3>
        <div class="devToolbar"><button class="btn" id="devBtnAddUser" type="button">Adicionar usuário</button><button class="btn btn--ghost" id="devBtnSaveUsers" type="button">Salvar usuários</button></div>
        <div class="devTableWrap"><table class="devTable"><thead><tr><th>Studio</th><th>Responsável</th><th>Email</th><th>Plano</th><th>Status</th><th>Teste</th><th>Restante</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>
      <div class="devThree">${planCards}</div>
      <div class="devToolbar"><button class="btn" id="devBtnSavePlans" type="button">Salvar valores e limites dos planos</button></div>
    `;
  }

  function renderUpdates(d,m){
    const releases = (d.releases||[]).map(r=>`<div class="devReleaseCard"><b>${esc(r.version)} — ${esc(r.title)}</b><div class="devSmall">${esc(new Date(r.at||Date.now()).toLocaleString('pt-BR'))} · Status: ${esc(r.status||'publicado')} · Obrigatória: ${r.required?'Sim':'Não'}</div><p>${esc(r.notes||'')}</p></div>`).join('') || '<p class="hint">Nenhuma atualização publicada.</p>';
    return `
      <div class="devSplit">
        <div class="box"><h3>Publicar atualização para o app</h3>
          <label class="field"><span>Versão</span><input class="devInput" id="relVersion" placeholder="Ex: v2.1.0"></label>
          <label class="field"><span>Título da atualização</span><input class="devInput" id="relTitle" placeholder="Ex: Correção de backup e cores"></label>
          <label class="field"><span>O que mudou</span><textarea class="devTextarea" id="relNotes" placeholder="Liste as correções e melhorias..."></textarea></label>
          <label class="check"><input type="checkbox" id="relRequired"> Atualização obrigatória</label>
          <div class="devToolbar"><button class="btn" id="devBtnPublishRelease" type="button">Publicar atualização</button><button class="btn btn--ghost" id="devBtnRequireUpdate" type="button">${d.flags.requireUpdate?'Desmarcar':'Exigir'} atualização</button></div>
          <p class="hint">A atualização é registrada no controle do app. Para todos os usuários receberem automaticamente, use um documento global no Firebase, por exemplo: platform/releases/latest.</p>
        </div>
        <div class="box"><h3>Feature flags</h3>
          ${Object.keys(d.flags).map(k=>`<label class="check"><input type="checkbox" data-dev-flag="${esc(k)}" ${d.flags[k]?'checked':''}> ${esc(k)}</label>`).join('')}
          <button class="btn btn--ghost" id="devBtnSaveFlags" type="button">Salvar flags</button>
        </div>
      </div>
      <div class="box"><h3>Histórico de versões</h3>${releases}</div>
    `;
  }

  function renderMetrics(d,m){
    return `
      <div class="devKpis">
        <div class="devKpi"><span>Clientes no app</span><b>${m.clients}</b></div>
        <div class="devKpi"><span>Agendamentos</span><b>${m.schedule}</b></div>
        <div class="devKpi"><span>Atendimentos</span><b>${m.services}</b></div>
        <div class="devKpi"><span>Receita registrada</span><b>${money(m.receita)}</b></div>
      </div>
      <div class="devSplit">
        <div class="box"><h3>Desempenho operacional</h3>
          <div class="devTableWrap"><table class="devTable"><tbody>
            <tr><th>Conversão realizados/agendados</th><td>${m.conversion}%</td></tr>
            <tr><th>Cancelamentos</th><td>${m.cancelled}</td></tr>
            <tr><th>Materiais cadastrados</th><td>${m.materials}</td></tr>
            <tr><th>Despesas cadastradas</th><td>${m.expenses}</td></tr>
            <tr><th>Fotos cadastradas</th><td>${m.photos}</td></tr>
          </tbody></table></div>
        </div>
        <div class="box"><h3>Saúde técnica</h3>
          <div class="devTableWrap"><table class="devTable"><tbody>
            <tr><th>Build</th><td>${esc(typeof APP_BUILD !== 'undefined' ? APP_BUILD : '—')}</td></tr>
            <tr><th>Dev build</th><td>${esc(DEV_PRO_BUILD)}</td></tr>
            <tr><th>LocalStorage</th><td>${storageSize()} KB</td></tr>
            <tr><th>Firebase</th><td>${typeof window.__SJM_PUSH_TO_CLOUD === 'function' ? statusBadge('ativo') : statusBadge('pendente')}</td></tr>
          </tbody></table></div>
        </div>
      </div>
    `;
  }

  function renderSupport(d,m){
    const tickets = (d.tickets||[]).map(t=>`<div class="devTicketCard" data-ticket="${esc(t.id)}"><b>${esc(t.title)}</b><div class="devSmall">${esc(t.user||'Usuário')} · ${esc(t.status||'Aberto')} · Prioridade ${esc(t.priority||'Média')} · ${esc(new Date(t.at||Date.now()).toLocaleString('pt-BR'))}</div><p>${esc(t.text||'')}</p><div class="devToolbar"><button class="btn btn--ghost" type="button" data-ticket-status="${esc(t.id)}" data-status="Em análise">Em análise</button><button class="btn btn--ghost" type="button" data-ticket-status="${esc(t.id)}" data-status="Resolvido">Resolver</button></div></div>`).join('') || '<p class="hint">Nenhum chamado aberto.</p>';
    return `
      <div class="devSplit">
        <div class="box"><h3>Novo chamado interno</h3>
          <label class="field"><span>Título</span><input class="devInput" id="ticketTitle" placeholder="Ex: Erro ao salvar cor"></label>
          <label class="field"><span>Usuário</span><input class="devInput" id="ticketUser" placeholder="Nome ou email"></label>
          <label class="field"><span>Prioridade</span><select class="devSelect" id="ticketPriority"><option>Baixa</option><option selected>Média</option><option>Alta</option><option>Crítica</option></select></label>
          <label class="field"><span>Descrição</span><textarea class="devTextarea" id="ticketText"></textarea></label>
          <button class="btn" id="devBtnAddTicket" type="button">Registrar chamado</button>
        </div>
        <div class="box"><h3>Central de resposta rápida</h3>
          <label class="field"><span>Mensagem padrão</span><textarea class="devTextarea" id="supportMsg">Olá! Sou do suporte do Studio Sync Pro. Estou verificando seu chamado e retorno com a solução.</textarea></label>
          <div class="devToolbar"><button class="btn btn--ghost" id="devBtnCopySupport" type="button">Copiar mensagem</button><button class="btn btn--ghost" id="devBtnOpenMail" type="button">Abrir e-mail</button></div>
        </div>
      </div>
      <div class="box"><h3>Chamados</h3>${tickets}</div>
    `;
  }

  function renderDatabase(d,m){
    return `
      <div class="devSplit">
        <div class="box"><h3>Banco de dados e backup</h3>
          <p class="hint">Ferramentas para exportar, importar, validar e organizar os dados sem apagar o app.</p>
          <div class="devToolbar"><button class="btn" id="devBtnExportJson" type="button">Exportar JSON completo</button><button class="btn btn--ghost" id="devBtnExportCsv2" type="button">Exportar relatório CSV</button><button class="btn btn--ghost" id="devBtnValidateDb" type="button">Validar banco</button></div>
          <input id="devImportJson" type="file" accept="application/json" hidden>
          <button class="btn btn--ghost" id="devBtnImportJson" type="button">Importar JSON para análise</button>
        </div>
        <div class="box"><h3>Ordem e integridade</h3>
          <div class="devToolbar"><button class="btn btn--ghost" id="devBtnSortData" type="button">Ordenar dados por data</button><button class="btn btn--ghost" id="devBtnRecalc" type="button">Recalcular financeiro</button></div>
          <div class="devNotice">Importações profissionais devem mesclar por ID/data, não substituir tudo. Essa versão preserva o app atual e oferece validação antes de qualquer alteração pesada.</div>
        </div>
      </div>
      <div class="box"><h3>Mapa da base atual</h3>${renderDbMap()}</div>
    `;
  }

  function renderSecurity(d,m){
    return `
      <div class="devSplit">
        <div class="box"><h3>Segurança do app</h3>
          <div class="devTableWrap"><table class="devTable"><tbody>
            <tr><th>Acesso dev</th><td>${window.__SJM_DEV_UNLOCKED || window.__SJM_IS_DEVELOPER ? statusBadge('ativo') : statusBadge('bloqueado')}</td></tr>
            <tr><th>Usuário atual</th><td>${esc(window.__SJM_CURRENT_USER?.email || 'local')}</td></tr>
            <tr><th>Auditoria</th><td>${esc(d.security.lastAudit || today())}</td></tr>
            <tr><th>Regras Firebase</th><td>${esc(d.security.rules)}</td></tr>
          </tbody></table></div>
        </div>
        <div class="box"><h3>Checklist antes de vender</h3>
          <label class="check"><input type="checkbox" checked> Login separado por cliente</label>
          <label class="check"><input type="checkbox" checked> Backup local funcionando</label>
          <label class="check"><input type="checkbox"> Painel global de todos os usuários no Firebase</label>
          <label class="check"><input type="checkbox"> Cobrança automática integrada</label>
          <label class="check"><input type="checkbox"> Regras Firestore revisadas</label>
          <button class="btn btn--ghost" id="devBtnAudit" type="button">Registrar auditoria de hoje</button>
        </div>
      </div>
    `;
  }

  function renderDiagnostic(d,m){
    const diag = buildDiagnostic();
    return `
      <div class="box"><h3>Diagnóstico técnico</h3>
        <div class="devToolbar"><button class="btn" id="devBtnRunDiag" type="button">Rodar diagnóstico</button><button class="btn btn--ghost" id="devBtnClearCache" type="button">Limpar cache do app</button><button class="btn btn--ghost" id="devBtnDownloadDiag" type="button">Baixar diagnóstico</button></div>
        <pre class="devLogCard" id="devDiagText">${esc(diag)}</pre>
      </div>
      <div class="box"><h3>Logs internos</h3>${renderLogs(d.logs, 40)}</div>
    `;
  }

  function renderLogs(logs, limit){
    const arr = (logs||[]).slice(0,limit);
    if(!arr.length) return '<p class="hint">Sem logs registrados.</p>';
    return arr.map(l=>`<div class="devLogCard"><b>${esc(l.area)}</b><div class="devSmall">${esc(new Date(l.at||Date.now()).toLocaleString('pt-BR'))} · ${esc(l.level||'info')}</div><p>${esc(l.text)}</p></div>`).join('');
  }

  function renderDbMap(){
    const s=currentState()||{};
    const keys=['clientes','agenda','atendimentos','materiais','despesas','procedimentos','fotos','receitasExtras','crmQueue','wppQueue'];
    return `<div class="devTableWrap"><table class="devTable"><thead><tr><th>Coleção</th><th>Registros</th></tr></thead><tbody>${keys.map(k=>`<tr><td>${esc(k)}</td><td>${Array.isArray(s[k])?s[k].length:0}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function bindShell(){
    qa('[data-dev-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      qa('[data-dev-tab]').forEach(b=>b.classList.toggle('active', b===btn));
      renderTab(btn.dataset.devTab);
    }));
  }

  function bindTab(tab){
    const d = ensureDevPro();
    if($('devBtnMaintenance')) $('devBtnMaintenance').onclick = ()=>{ d.maintenance=!d.maintenance; addLog('Sistema', d.maintenance?'Modo manutenção ativado':'Modo manutenção desativado','warn'); persist(); renderShell('visao'); };
    if($('devBtnExportCsv')) $('devBtnExportCsv').onclick = exportCsv;
    if($('devBtnExportCsv2')) $('devBtnExportCsv2').onclick = exportCsv;
    if($('devBtnNewRelease')) $('devBtnNewRelease').onclick = ()=>renderShell('atualizacoes');
    if($('devBtnAddUser')) $('devBtnAddUser').onclick = ()=>{ d.users.unshift({uid:uid(), studio:'Novo Studio', owner:'Profissional', email:'', whatsapp:'', plan:'basic', status:'teste', trialStart:today(), trialDays:7, createdAt:Date.now(), lastAccess:Date.now()}); addLog('Usuários','Usuário adicionado manualmente.'); persist(); renderShell('usuarios'); };
    if($('devBtnSaveUsers')) $('devBtnSaveUsers').onclick = saveUsers;
    if($('devBtnSavePlans')) $('devBtnSavePlans').onclick = savePlans;
    qa('[data-dev-impersonate]').forEach(b=>b.onclick=()=>{ window.__SJM_IMPERSONATING_PROFESSIONAL=b.dataset.devImpersonate; addLog('Acesso assistido','Modo teste ativado para usuário '+b.dataset.devImpersonate); persist(); alert('Modo de teste ativado para esse usuário. Use apenas para suporte e conferência de telas.'); });
    if($('devBtnPublishRelease')) $('devBtnPublishRelease').onclick = publishRelease;
    if($('devBtnRequireUpdate')) $('devBtnRequireUpdate').onclick = ()=>{ d.flags.requireUpdate=!d.flags.requireUpdate; addLog('Atualização', d.flags.requireUpdate?'Atualização obrigatória ativada':'Atualização obrigatória desativada'); persist(); renderShell('atualizacoes'); };
    if($('devBtnSaveFlags')) $('devBtnSaveFlags').onclick = ()=>{ qa('[data-dev-flag]').forEach(i=>d.flags[i.dataset.devFlag]=!!i.checked); addLog('Flags','Feature flags atualizadas.'); persist(); alert('Flags salvas.'); };
    if($('devBtnAddTicket')) $('devBtnAddTicket').onclick = addTicket;
    qa('[data-ticket-status]').forEach(b=>b.onclick=()=>{ const t=d.tickets.find(x=>x.id===b.dataset.ticketStatus); if(t){ t.status=b.dataset.status; t.updatedAt=Date.now(); addLog('Suporte',`Chamado ${t.title} alterado para ${t.status}.`); persist(); renderShell('suporte'); } });
    if($('devBtnCopySupport')) $('devBtnCopySupport').onclick = async()=>{ const msg=$('supportMsg')?.value||''; try{ await navigator.clipboard.writeText(msg); alert('Mensagem copiada.'); }catch{ prompt('Copie a mensagem:', msg); } };
    if($('devBtnOpenMail')) $('devBtnOpenMail').onclick = ()=>{ location.href='mailto:suporte@jaquelinemendanha.com?subject=Suporte Studio Sync Pro&body='+encodeURIComponent($('supportMsg')?.value||''); };
    if($('devBtnExportJson')) $('devBtnExportJson').onclick = exportJson;
    if($('devBtnValidateDb')) $('devBtnValidateDb').onclick = ()=>alert(buildDiagnostic());
    if($('devBtnSortData')) $('devBtnSortData').onclick = sortData;
    if($('devBtnRecalc')) $('devBtnRecalc').onclick = recalcData;
    if($('devBtnImportJson')) $('devBtnImportJson').onclick = ()=>$('devImportJson')?.click();
    if($('devImportJson')) $('devImportJson').onchange = importJsonAnalysis;
    if($('devBtnAudit')) $('devBtnAudit').onclick = ()=>{ d.security.lastAudit=today(); addLog('Segurança','Auditoria registrada em '+today()); persist(); renderShell('seguranca'); };
    if($('devBtnRunDiag')) $('devBtnRunDiag').onclick = ()=>{ addLog('Diagnóstico','Diagnóstico executado.'); persist(); const t=$('devDiagText'); if(t) t.textContent=buildDiagnostic(); };
    if($('devBtnDownloadDiag')) $('devBtnDownloadDiag').onclick = ()=>downloadText('diagnostico-studio-sync-pro.txt', buildDiagnostic(), 'text/plain');
    if($('devBtnClearCache')) $('devBtnClearCache').onclick = clearAppCache;
  }

  function saveUsers(){
    const d=ensureDevPro();
    qa('[data-dev-user]').forEach(tr=>{
      const id=tr.dataset.devUser; const u=d.users.find(x=>String(x.uid)===String(id)); if(!u) return;
      qa('[data-k]', tr).forEach(el=>{ const k=el.dataset.k; u[k] = k==='trialDays' ? num(el.value) : el.value; });
      u.updatedAt=Date.now();
    });
    addLog('Usuários','Lista de usuários e planos salva.'); persist(); alert('Usuários salvos.'); renderShell('usuarios');
  }
  function savePlans(){
    const d=ensureDevPro();
    Object.keys(d.plans).forEach(k=>{
      d.plans[k].price = $(`plan_${k}_price`)?.value || d.plans[k].price;
      d.plans[k].trialDays = num($(`plan_${k}_trial`)?.value || d.plans[k].trialDays);
      d.plans[k].maxClientes = num($(`plan_${k}_clients`)?.value || d.plans[k].maxClientes);
      d.plans[k].maxFotos = num($(`plan_${k}_photos`)?.value || d.plans[k].maxFotos);
      try{ if(typeof PLAN_PRICES !== 'undefined') PLAN_PRICES[k] = d.plans[k].price; }catch(e){}
    });
    addLog('Planos','Valores, testes e limites dos planos atualizados.'); persist(); alert('Planos salvos.'); renderShell('usuarios');
  }
  function publishRelease(){
    const d=ensureDevPro();
    const version=($('relVersion')?.value||'v'+new Date().toISOString().slice(0,10)).trim();
    const title=($('relTitle')?.value||'Atualização do app').trim();
    const notes=($('relNotes')?.value||'Melhorias e correções internas.').trim();
    const required=!!$('relRequired')?.checked;
    d.releases.unshift({id:uid(),version,title,notes,required,status:'publicado',at:Date.now()});
    d.forceUpdateVersion = required ? version : d.forceUpdateVersion;
    d.flags.requireUpdate = required || d.flags.requireUpdate;
    addLog('Atualização',`Publicada ${version}: ${title}`);
    persist(); alert('Atualização registrada no painel do desenvolvedor.'); renderShell('atualizacoes');
  }
  function addTicket(){
    const d=ensureDevPro();
    d.tickets.unshift({id:uid(), title:$('ticketTitle')?.value||'Chamado de suporte', user:$('ticketUser')?.value||'Usuário', priority:$('ticketPriority')?.value||'Média', text:$('ticketText')?.value||'', status:'Aberto', at:Date.now()});
    addLog('Suporte','Novo chamado registrado.'); persist(); renderShell('suporte');
  }
  function sortData(){
    const s=currentState(); if(!s) return;
    const getDate=x=>String(x.data || x.date || x.criadoEm || x.createdAt || '9999-12-31');
    ['agenda','atendimentos','despesas','receitasExtras'].forEach(k=>{ if(Array.isArray(s[k])) s[k].sort((a,b)=>getDate(a).localeCompare(getDate(b))); });
    addLog('Banco','Dados ordenados por data.'); persist(); try{ renderAllHard(); }catch(e){} alert('Dados ordenados por data.'); renderShell('banco');
  }
  function recalcData(){
    const s=currentState(); if(!s) return;
    try{ (s.materiais||[]).forEach(x=> typeof calcularMaterial==='function' && calcularMaterial(x)); }catch(e){}
    try{ (s.atendimentos||[]).forEach(x=> typeof calcularAtendimento==='function' && calcularAtendimento(x)); }catch(e){}
    try{ typeof syncAgendaToAtendimentos==='function' && syncAgendaToAtendimentos(); }catch(e){}
    addLog('Banco','Financeiro recalculado.'); persist(); try{ renderAllHard(); }catch(e){} alert('Financeiro recalculado.'); renderShell('banco');
  }
  async function importJsonAnalysis(e){
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const parsed=JSON.parse(await file.text());
      const count=Object.keys(parsed||{}).filter(k=>Array.isArray(parsed[k])).map(k=>`${k}: ${parsed[k].length}`).join('\n') || 'JSON válido, sem coleções principais.';
      addLog('Banco','JSON importado para análise: '+file.name); persist(); alert('Arquivo válido para análise:\n\n'+count+'\n\nNada foi substituído automaticamente.');
    }catch(err){ alert('JSON inválido.'); }
    e.target.value='';
  }
  function buildDiagnostic(){
    const s=currentState()||{}; const d=ensureDevPro()||{}; const m=appMetrics();
    const problems=[];
    if(!s.settings) problems.push('settings ausente');
    if(!Array.isArray(s.clientes)) problems.push('clientes não é lista');
    if(!Array.isArray(s.agenda)) problems.push('agenda não é lista');
    if(!Array.isArray(s.atendimentos)) problems.push('atendimentos não é lista');
    if(typeof window.__SJM_PUSH_TO_CLOUD !== 'function') problems.push('Firebase push global não exposto nesta sessão');
    return [
      'STUDIO SYNC PRO — DIAGNÓSTICO DEV',
      'Data: '+nowBR(),
      'Build app: '+(typeof APP_BUILD !== 'undefined' ? APP_BUILD : '—'),
      'Build dev: '+DEV_PRO_BUILD,
      'Usuário: '+(window.__SJM_CURRENT_USER?.email || 'local'),
      'Plano real: '+realPlan(),
      'Clientes: '+m.clients,
      'Agenda: '+m.schedule,
      'Atendimentos: '+m.services,
      'Usuários painel: '+m.users,
      'Teste 7 dias: '+m.inTrial,
      'Chamados abertos: '+m.ticketsOpen,
      'LocalStorage: '+storageSize()+' KB',
      'Manutenção: '+(d.maintenance?'sim':'não'),
      'Problemas: '+(problems.length?problems.join('; '):'nenhum erro estrutural encontrado')
    ].join('\n');
  }
  function storageSize(){
    try{ let total=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); total += k.length + String(localStorage.getItem(k)||'').length; } return Math.round(total/1024); }catch{ return 0; }
  }
  function downloadText(name, text, type='text/csv'){
    const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function exportJson(){ downloadText('studio-sync-pro-dev-backup-'+today()+'.json', JSON.stringify(currentState(), null, 2), 'application/json'); addLog('Backup','JSON completo exportado.'); persist(); }
  function exportCsv(){
    const d=ensureDevPro();
    const lines=[['studio','responsavel','email','plano','status','teste_restante','ultimo_acesso'].join(';')];
    (d.users||[]).forEach(u=>lines.push([u.studio,u.owner,u.email,u.plan,u.status,trialLeft(u),u.lastAccess?new Date(u.lastAccess).toLocaleString('pt-BR'):''].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')));
    downloadText('relatorio-usuarios-studio-sync-pro-'+today()+'.csv', lines.join('\n'), 'text/csv'); addLog('Relatório','CSV de usuários exportado.'); persist();
  }
  function clearAppCache(){
    if(!confirm('Limpar cache do navegador e service worker? Os dados salvos no banco/localStorage serão preservados.')) return;
    try{ if('caches' in window) caches.keys().then(keys=>keys.forEach(k=>caches.delete(k))); }catch(e){}
    try{ navigator.serviceWorker?.getRegistrations?.().then(rs=>rs.forEach(r=>r.update())); }catch(e){}
    addLog('Cache','Cache solicitado para limpeza.'); persist(); alert('Cache limpo/atualizado. Reabra o app para garantir a nova versão.');
  }

  function showIfDevRoute(){
    const active = q('[data-route="desenvolvedor"].active') || String(location.hash||'').replace('#','') === 'desenvolvedor';
    if(active) renderShell('visao');
  }

  function install(){
    try{ ensureDevPro(); }catch(e){ console.warn('devpro ensure', e); }
    const oldSet = window.__SJM_SET_ROUTE;
    if(typeof oldSet === 'function' && !oldSet.__devProWrapped){
      const wrapped = function(route){ const r=oldSet.apply(this, arguments); if(String(route).toLowerCase()==='desenvolvedor') setTimeout(()=>renderShell('visao'),40); return r; };
      wrapped.__devProWrapped = true;
      window.__SJM_SET_ROUTE = wrapped;
    }
    document.addEventListener('click', (e)=>{ if(e.target?.closest?.('[data-tab="desenvolvedor"]')) setTimeout(()=>renderShell('visao'),80); }, true);
    showIfDevRoute();
  }
  document.addEventListener('DOMContentLoaded', install);
  window.addEventListener('load', ()=>{ install(); setTimeout(install,250); setTimeout(install,900); });
  setTimeout(install,120);
  setTimeout(install,1200);
  window.__SJM_RENDER_DEV_PRO = renderShell;
})();

/* =========================================================
   v71 DEV MASTER COMPLETO — Painel SaaS profissional
   Acrescenta: Studios, usuários, assinaturas, financeiro,
   relatórios, logs, backups, atualizações, segurança, IA,
   ferramentas e importação CSV/JSON sem remover o app atual.
   ========================================================= */
(function(){
  'use strict';
  const BUILD='v71-dev-master-completo';
  const $=id=>document.getElementById(id);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid=()=> 'devm_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
  const today=()=>new Date().toISOString().slice(0,10);
  const br=()=>{try{return new Date().toLocaleString('pt-BR')}catch{return String(new Date())}};
  const n=v=>{let s=String(v??'').replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.'); const x=Number(s); return Number.isFinite(x)?x:0};
  const money=v=>{try{return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}catch{return 'R$ 0,00'}};
  function st(){ return (typeof state!=='undefined'&&state)?state:(window.state||{}); }
  function save(){ try{saveSoft&&saveSoft()}catch{} try{scheduleSync&&scheduleSync()}catch{} }
  function dl(name,text,type='text/plain'){ const b=new Blob([text],{type}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); }
  function ensure(){ const s=st(); s.devPro=s.devPro&&typeof s.devPro==='object'?s.devPro:{}; const d=s.devPro; d.build=BUILD;
    d.plans=d.plans&&typeof d.plans==='object'?d.plans:{basic:{label:'Básico',price:'R$ 29,90/mês',trialDays:7,maxClientes:100,maxFotos:50,features:['Agenda','Clientes','WhatsApp']},pro:{label:'Pro',price:'R$ 59,90/mês',trialDays:7,maxClientes:500,maxFotos:200,features:['CRM','Equipe','Exportação']},premium:{label:'Premium',price:'R$ 99,90/mês',trialDays:7,maxClientes:9999,maxFotos:9999,features:['Tudo liberado','Suporte prioritário','Recursos futuros']}};
    d.studios=Array.isArray(d.studios)?d.studios:[]; d.users=Array.isArray(d.users)?d.users:[]; d.subscriptions=Array.isArray(d.subscriptions)?d.subscriptions:[]; d.payments=Array.isArray(d.payments)?d.payments:[]; d.tickets=Array.isArray(d.tickets)?d.tickets:[]; d.bugs=Array.isArray(d.bugs)?d.bugs:[]; d.releases=Array.isArray(d.releases)?d.releases:[]; d.logs=Array.isArray(d.logs)?d.logs:[]; d.flags=d.flags&&typeof d.flags==='object'?d.flags:{agenda:true,crm:true,financeiro:true,fidelidade:true,materiais:true,autoagendamento:true,ia:false,pix:false,marketplace:false,manutencao:false,atualizacaoObrigatoria:false}; d.security=d.security&&typeof d.security==='object'?d.security:{twoFactor:false,devAudit:true,lastAudit:today(),rules:'Separar dados por studioId antes de vender em escala.'}; d.global=d.global&&typeof d.global==='object'?d.global:{appName:'Studio Sync Pro',supportEmail:'suporte@jaquelinemendanha.com',supportWhatsapp:'',currentVersion:BUILD,notice:''}; seed(d); return d; }
  function seed(d){ const s=st(), email=(window.__SJM_CURRENT_USER?.email||s.settings?.email||'local@app'), studio=s.settings?.studioNome||'Studio atual'; if(!d.studios.length){d.studios.push({id:'studio_local',name:studio,owner:s.settings?.profissionalNome||'Profissional principal',email,whatsapp:s.settings?.studioWpp||'',city:'',state:'',plan:String(s.settings?.plano||'premium').toLowerCase(),status:'ativo',trialStart:today(),trialDays:7,dueDate:'',lastAccess:Date.now(),createdAt:Date.now(),notes:''});}
    if(!d.users.length){d.users.push({id:'user_local',studioId:d.studios[0].id,name:'Profissional principal',email,phone:s.settings?.studioWpp||'',role:'Proprietária',permission:'Administrador',status:'ativo',lastAccess:Date.now()});}
  }
  function log(area,text,level='info'){ const d=ensure(); d.logs.unshift({id:uid(),area,text,level,at:Date.now(),user:window.__SJM_CURRENT_USER?.email||'local'}); d.logs=d.logs.slice(0,300); save(); }
  function daysLeft(x){ const start=x.trialStart?new Date(x.trialStart+'T00:00:00'):new Date(x.createdAt||Date.now()); return Math.max(0,(Number(x.trialDays||7)-Math.floor((Date.now()-start.getTime())/86400000))); }
  function mrr(d){ return (d.studios||[]).filter(s=>['ativo','teste'].includes(String(s.status).toLowerCase())).reduce((a,s)=>a+n(d.plans?.[s.plan]?.price),0); }
  function metrics(){ const s=st(), d=ensure(), studios=d.studios||[]; return {studios:studios.length,active:studios.filter(x=>x.status==='ativo').length,trial:studios.filter(x=>x.status==='teste').length,blocked:studios.filter(x=>x.status==='bloqueado').length,canceled:studios.filter(x=>x.status==='cancelado').length,late:studios.filter(x=>x.status==='inadimplente').length,basic:studios.filter(x=>x.plan==='basic').length,pro:studios.filter(x=>x.plan==='pro').length,premium:studios.filter(x=>x.plan==='premium').length,mrr:mrr(d),clients:(s.clientes||[]).length,agenda:(s.agenda||[]).length,services:(s.atendimentos||[]).length,tickets:(d.tickets||[]).filter(t=>t.status!=='Resolvido').length,bugs:(d.bugs||[]).filter(b=>b.status!=='Resolvido').length}; }
  const badge=x=>`<span class="devBadge ${['ativo','pago','resolvido'].includes(String(x).toLowerCase())?'ok':['teste','aberto','em análise'].includes(String(x).toLowerCase())?'warn':['bloqueado','cancelado','inadimplente','crítico'].includes(String(x).toLowerCase())?'danger':''}">${esc(x)}</span>`;
  const TABS=[['dash','Dashboard'],['studios','Studios'],['usuarios','Usuários'],['assinaturas','Assinaturas'],['financeiro','Financeiro'],['relatorios','Relatórios'],['logs','Logs'],['suporte','Suporte'],['bugs','Bugs'],['backups','Backups'],['atualizacoes','Atualizações'],['seguranca','Segurança'],['ia','IA'],['ferramentas','Ferramentas']];
  function render(active='dash'){ const root=$('devProRoot')||document.querySelector('[data-route="desenvolvedor"]'); if(!root) return; const d=ensure(), m=metrics(); root.innerHTML=`<div class="devMaster"><div class="devHero"><div><h2>Central do Desenvolvedor / Super Admin</h2><p>Painel profissional para gerenciar o SaaS completo: studios, planos, assinaturas, suporte, atualizações, banco, logs e segurança.</p></div><div class="devStatusPill"><span class="devDot ${d.flags.manutencao?'warn':''}"></span>${d.flags.manutencao?'Manutenção ativa':'Sistema operacional'} · ${BUILD}</div></div><div class="devKpis"><div class="devKpi"><span>Studios</span><b>${m.studios}</b></div><div class="devKpi"><span>MRR estimado</span><b>${money(m.mrr)}</b></div><div class="devKpi"><span>Teste 7 dias</span><b>${m.trial}</b></div><div class="devKpi"><span>Inadimplentes</span><b>${m.late}</b></div><div class="devKpi"><span>Chamados</span><b>${m.tickets}</b></div><div class="devKpi"><span>Bugs</span><b>${m.bugs}</b></div></div><div class="devLayout"><aside class="devSide">${TABS.map(t=>`<button class="devSideBtn ${active===t[0]?'active':''}" data-v71-tab="${t[0]}" type="button">${t[1]}</button>`).join('')}</aside><section class="devMain" id="devV71Content"></section></div></div>`; tab(active); qa('[data-v71-tab]',root).forEach(b=>b.onclick=()=>render(b.dataset.v71Tab)); }
  function tab(t){ const box=$('devV71Content'); if(!box)return; const d=ensure(), m=metrics(); const map={dash:dash,studios:studios,usuarios:usuarios,assinaturas:assinaturas,financeiro:financeiro,relatorios:relatorios,logs:logs,suporte:suporte,bugs:bugs,backups:backups,atualizacoes:atualizacoes,seguranca:seguranca,ia:ia,ferramentas:ferramentas}; box.innerHTML=(map[t]||dash)(d,m); bind(t); }
  function dash(d,m){return `<div class="devGrid"><div class="box"><h3>Resumo geral</h3><div class="devThree"><div class="devKpi"><span>Básico</span><b>${m.basic}</b></div><div class="devKpi"><span>Pro</span><b>${m.pro}</b></div><div class="devKpi"><span>Premium</span><b>${m.premium}</b></div></div><div class="devTableWrap"><table class="devTable"><tbody><tr><th>Ativos</th><td>${m.active}</td></tr><tr><th>Teste</th><td>${m.trial}</td></tr><tr><th>Bloqueados</th><td>${m.blocked}</td></tr><tr><th>Cancelados</th><td>${m.canceled}</td></tr></tbody></table></div></div><div class="box"><h3>Ações rápidas</h3><div class="devToolbar"><button class="btn" data-go="studios">Novo studio</button><button class="btn btn--ghost" data-go="atualizacoes">Publicar atualização</button><button class="btn btn--ghost" id="v71ExportAll">Exportar backup</button><button class="btn btn--ghost" id="v71ToggleMaint">${d.flags.manutencao?'Desativar':'Ativar'} manutenção</button></div><div class="devNotice">Este painel fica dentro do app atual, mas separado por permissão de Desenvolvedor.</div></div></div><div class="box"><h3>Últimos logs</h3>${logList(d.logs,8)}</div>`}
  function studios(d){ const rows=d.studios.map(s=>`<tr data-studio="${esc(s.id)}"><td><input data-k="name" class="devInput" value="${esc(s.name)}"></td><td><input data-k="owner" class="devInput" value="${esc(s.owner)}"></td><td><input data-k="email" class="devInput" value="${esc(s.email)}"></td><td><input data-k="whatsapp" class="devInput" value="${esc(s.whatsapp)}"></td><td><select data-k="plan" class="devSelect"><option value="basic" ${s.plan==='basic'?'selected':''}>Básico</option><option value="pro" ${s.plan==='pro'?'selected':''}>Pro</option><option value="premium" ${s.plan==='premium'?'selected':''}>Premium</option></select></td><td><select data-k="status" class="devSelect"><option ${s.status==='teste'?'selected':''}>teste</option><option ${s.status==='ativo'?'selected':''}>ativo</option><option ${s.status==='inadimplente'?'selected':''}>inadimplente</option><option ${s.status==='bloqueado'?'selected':''}>bloqueado</option><option ${s.status==='cancelado'?'selected':''}>cancelado</option></select></td><td><input data-k="dueDate" type="date" class="devInput" value="${esc(s.dueDate||'')}"></td><td>${s.status==='teste'?daysLeft(s)+' dias':'—'}</td><td><button class="btn btn--ghost" data-enter-studio="${esc(s.id)}">Entrar</button><button class="btn btn--ghost" data-del-studio="${esc(s.id)}">Excluir</button></td></tr>`).join(''); return `<div class="box"><h3>Studios cadastrados</h3><div class="devToolbar"><button class="btn" id="v71AddStudio">+ Studio</button><button class="btn btn--ghost" id="v71SaveStudios">Salvar studios</button><button class="btn btn--ghost" id="v71ExportStudios">Exportar studios</button><button class="btn btn--ghost" id="v71ImportStudiosBtn">Importar studios</button><input type="file" id="v71ImportStudios" accept=".json,.csv,application/json,text/csv" hidden></div><div class="devTableWrap"><table class="devTable"><thead><tr><th>Studio</th><th>Proprietária</th><th>Email</th><th>WhatsApp</th><th>Plano</th><th>Status</th><th>Vencimento</th><th>Teste</th><th>Ações</th></tr></thead><tbody>${rows||'<tr><td colspan="9">Nenhum studio.</td></tr>'}</tbody></table></div></div>`}
  function usuarios(d){ const rows=d.users.map(u=>`<tr data-user="${esc(u.id)}"><td><input data-k="name" class="devInput" value="${esc(u.name)}"></td><td><input data-k="email" class="devInput" value="${esc(u.email)}"></td><td><input data-k="phone" class="devInput" value="${esc(u.phone)}"></td><td><select data-k="studioId" class="devSelect">${d.studios.map(s=>`<option value="${esc(s.id)}" ${u.studioId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></td><td><select data-k="permission" class="devSelect"><option ${u.permission==='Administrador'?'selected':''}>Administrador</option><option ${u.permission==='Funcionário'?'selected':''}>Funcionário</option><option ${u.permission==='Recepção'?'selected':''}>Recepção</option><option ${u.permission==='Desenvolvedor'?'selected':''}>Desenvolvedor</option></select></td><td><select data-k="status" class="devSelect"><option ${u.status==='ativo'?'selected':''}>ativo</option><option ${u.status==='bloqueado'?'selected':''}>bloqueado</option></select></td><td><button class="btn btn--ghost" data-del-user="${esc(u.id)}">Excluir</button></td></tr>`).join(''); return `<div class="box"><h3>Usuários e permissões</h3><div class="devToolbar"><button class="btn" id="v71AddUser">+ Usuário</button><button class="btn btn--ghost" id="v71SaveUsers">Salvar usuários</button><button class="btn btn--ghost" id="v71ImportUsersBtn">Importar usuários</button><input type="file" id="v71ImportUsers" accept=".json,.csv" hidden></div><div class="devTableWrap"><table class="devTable"><thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Studio</th><th>Permissão</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows||'<tr><td colspan="7">Nenhum usuário.</td></tr>'}</tbody></table></div></div>`}
  function assinaturas(d){ const cards=Object.entries(d.plans).map(([k,p])=>`<div class="box"><h3>${esc(p.label)}</h3><label class="field"><span>Preço</span><input id="pl_${k}_price" class="devInput" value="${esc(p.price)}"></label><label class="field"><span>Dias de teste</span><input id="pl_${k}_trial" class="devInput" type="number" value="${esc(p.trialDays)}"></label><label class="field"><span>Máx. clientes</span><input id="pl_${k}_maxc" class="devInput" type="number" value="${esc(p.maxClientes)}"></label><label class="field"><span>Máx. fotos</span><input id="pl_${k}_maxf" class="devInput" type="number" value="${esc(p.maxFotos)}"></label><label class="field"><span>Recursos</span><textarea id="pl_${k}_features" class="devTextarea">${esc((p.features||[]).join('\n'))}</textarea></label></div>`).join(''); return `<div class="devThree">${cards}</div><div class="box"><h3>Controle de cobrança</h3><div class="devToolbar"><button class="btn" id="v71SavePlans">Salvar planos</button><button class="btn btn--ghost" id="v71GeneratePayments">Gerar cobrança mensal simulada</button></div><p class="hint">Aqui você controla valores, teste grátis, limites e recursos de cada plano.</p></div>`}
  function financeiro(d,m){ return `<div class="devKpis"><div class="devKpi"><span>MRR</span><b>${money(m.mrr)}</b></div><div class="devKpi"><span>Ativos</span><b>${m.active}</b></div><div class="devKpi"><span>Inadimplentes</span><b>${m.late}</b></div><div class="devKpi"><span>Cancelados</span><b>${m.canceled}</b></div></div><div class="box"><h3>Pagamentos</h3><div class="devToolbar"><button class="btn" id="v71AddPayment">+ Pagamento</button><button class="btn btn--ghost" id="v71ExportPayments">Exportar financeiro</button></div><div class="devTableWrap"><table class="devTable"><thead><tr><th>Data</th><th>Studio</th><th>Plano</th><th>Valor</th><th>Status</th></tr></thead><tbody>${(d.payments||[]).map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(p.studio)}</td><td>${esc(p.plan)}</td><td>${money(p.value)}</td><td>${badge(p.status)}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum pagamento registrado.</td></tr>'}</tbody></table></div></div>`}
  function relatorios(d,m){ return `<div class="box"><h3>Relatórios executivos</h3><div class="devToolbar"><button class="btn" id="v71ReportSaas">Baixar relatório SaaS</button><button class="btn btn--ghost" id="v71ReportStudios">Baixar studios CSV</button><button class="btn btn--ghost" id="v71ReportLogs">Baixar logs CSV</button></div><pre class="devLogCard">Studios: ${m.studios}\nMRR: ${money(m.mrr)}\nAtivos: ${m.active}\nTeste: ${m.trial}\nInadimplentes: ${m.late}\nChamados: ${m.tickets}\nBugs: ${m.bugs}</pre></div>`}
  function logs(d){ return `<div class="box"><h3>Logs e auditoria</h3><div class="devToolbar"><button class="btn btn--ghost" id="v71ClearLogs">Limpar logs</button><button class="btn btn--ghost" id="v71ExportLogs">Exportar logs</button></div>${logList(d.logs,200)}</div>`}
  function suporte(d){return `<div class="devSplit"><div class="box"><h3>Novo chamado</h3><input id="tkTitle" class="devInput" placeholder="Título"><input id="tkStudio" class="devInput" placeholder="Studio/email"><select id="tkPriority" class="devSelect"><option>Baixa</option><option selected>Média</option><option>Alta</option><option>Crítica</option></select><textarea id="tkText" class="devTextarea" placeholder="Descrição"></textarea><button class="btn" id="v71AddTicket">Registrar chamado</button></div><div class="box"><h3>Resposta rápida</h3><textarea id="v71SupportMsg" class="devTextarea">Olá! Sou do suporte do Studio Sync Pro. Vou verificar seu chamado e te ajudar.</textarea><button class="btn btn--ghost" id="v71CopySupport">Copiar resposta</button></div></div><div class="box"><h3>Chamados</h3>${(d.tickets||[]).map(t=>`<div class="devTicketCard"><b>${esc(t.title)}</b><div class="devSmall">${esc(t.studio||t.user||'')} · ${badge(t.status||'Aberto')} · ${esc(t.priority||'Média')} · ${esc(new Date(t.at||Date.now()).toLocaleString('pt-BR'))}</div><p>${esc(t.text||'')}</p><button class="btn btn--ghost" data-resolve-ticket="${esc(t.id)}">Resolver</button></div>`).join('')||'<p class="hint">Nenhum chamado.</p>'}</div>`}
  function bugs(d){return `<div class="devSplit"><div class="box"><h3>Central de bugs</h3><input id="bugTitle" class="devInput" placeholder="Ex.: cálculo de material"><textarea id="bugText" class="devTextarea" placeholder="Descreva o erro"></textarea><select id="bugPriority" class="devSelect"><option>Baixa</option><option selected>Média</option><option>Alta</option><option>Crítica</option></select><button class="btn" id="v71AddBug">Salvar bug</button></div><div class="box"><h3>Bugs registrados</h3>${(d.bugs||[]).map(b=>`<div class="devTicketCard"><b>${esc(b.title)}</b><div class="devSmall">${badge(b.status||'Aberto')} · ${esc(b.priority||'Média')}</div><p>${esc(b.text||'')}</p><button class="btn btn--ghost" data-resolve-bug="${esc(b.id)}">Resolver</button></div>`).join('')||'<p class="hint">Nenhum bug anotado.</p>'}</div></div>`}
  function backups(){return `<div class="box"><h3>Backups e importação</h3><div class="devToolbar"><button class="btn" id="v71ExportAll2">Exportar backup completo</button><button class="btn btn--ghost" id="v71ImportAllBtn">Importar backup JSON</button><button class="btn btn--ghost" id="v71Validate">Validar banco</button><button class="btn btn--ghost" id="v71SortDates">Ordenar por data</button><input type="file" id="v71ImportAll" accept="application/json,.json" hidden></div><div class="devNotice">O importar aqui mescla dados do painel Dev quando possível. Para backup total do app, use também o backup da Configuração.</div></div><div class="box"><h3>Mapa da base</h3>${dbMap()}</div>`}
  function atualizacoes(d){return `<div class="devSplit"><div class="box"><h3>Publicar atualização</h3><input id="relV" class="devInput" placeholder="Versão ex.: v2.5"><input id="relT" class="devInput" placeholder="Título"><textarea id="relN" class="devTextarea" placeholder="O que mudou"></textarea><label class="check"><input id="relReq" type="checkbox"> Atualização obrigatória</label><button class="btn" id="v71Publish">Publicar</button></div><div class="box"><h3>Feature flags</h3>${Object.keys(d.flags).map(k=>`<label class="check"><input type="checkbox" data-flag="${esc(k)}" ${d.flags[k]?'checked':''}> ${esc(k)}</label>`).join('')}<button class="btn btn--ghost" id="v71SaveFlags">Salvar recursos</button></div></div><div class="box"><h3>Histórico</h3>${(d.releases||[]).map(r=>`<div class="devReleaseCard"><b>${esc(r.version)} — ${esc(r.title)}</b><div class="devSmall">${esc(new Date(r.at||Date.now()).toLocaleString('pt-BR'))} · Obrigatória: ${r.required?'Sim':'Não'}</div><p>${esc(r.notes)}</p></div>`).join('')||'<p class="hint">Nenhuma atualização publicada.</p>'}</div>`}
  function seguranca(d){return `<div class="devSplit"><div class="box"><h3>Segurança</h3><label class="check"><input id="sec2fa" type="checkbox" ${d.security.twoFactor?'checked':''}> Exigir 2 fatores no Dev</label><label class="check"><input id="secAudit" type="checkbox" ${d.security.devAudit?'checked':''}> Registrar auditoria de ações</label><label class="field"><span>Regras/observações</span><textarea id="secRules" class="devTextarea">${esc(d.security.rules)}</textarea></label><button class="btn" id="v71SaveSecurity">Salvar segurança</button></div><div class="box"><h3>Checklist SaaS</h3><label class="check"><input type="checkbox" checked> Acesso Dev separado</label><label class="check"><input type="checkbox" checked> Exportar/importar dados</label><label class="check"><input type="checkbox"> Cobrança automática real</label><label class="check"><input type="checkbox"> Regras Firebase por studioId revisadas</label><label class="check"><input type="checkbox"> Termos de uso e política de privacidade</label></div></div>`}
  function ia(){return `<div class="box"><h3>IA e automações futuras</h3><div class="devNotice">Área preparada para recursos Premium futuros.</div><label class="check"><input type="checkbox"> Resumo automático do dia</label><label class="check"><input type="checkbox"> Sugestão de mensagens para clientes</label><label class="check"><input type="checkbox"> Análise de clientes inativas</label><label class="check"><input type="checkbox"> Assistente de suporte interno</label></div>`}
  function ferramentas(d){return `<div class="devSplit"><div class="box"><h3>Configurações globais</h3><input id="glApp" class="devInput" value="${esc(d.global.appName)}" placeholder="Nome do app"><input id="glEmail" class="devInput" value="${esc(d.global.supportEmail)}" placeholder="Email suporte"><input id="glWpp" class="devInput" value="${esc(d.global.supportWhatsapp)}" placeholder="WhatsApp suporte"><input id="glVer" class="devInput" value="${esc(d.global.currentVersion)}" placeholder="Versão atual"><textarea id="glNotice" class="devTextarea" placeholder="Aviso global">${esc(d.global.notice)}</textarea><button class="btn" id="v71SaveGlobal">Salvar globais</button></div><div class="box"><h3>Ferramentas técnicas</h3><div class="devToolbar"><button class="btn btn--ghost" id="v71Recalc">Recalcular financeiro</button><button class="btn btn--ghost" id="v71ClearCache">Limpar cache</button><button class="btn btn--ghost" id="v71Diag">Rodar diagnóstico</button></div><pre class="devLogCard" id="v71DiagText">${esc(diag())}</pre></div></div>`}
  function logList(a,l){ a=(a||[]).slice(0,l); return a.length?a.map(x=>`<div class="devLogCard"><b>${esc(x.area)}</b><div class="devSmall">${esc(new Date(x.at||Date.now()).toLocaleString('pt-BR'))} · ${esc(x.level||'info')}</div><p>${esc(x.text)}</p></div>`).join(''):'<p class="hint">Sem logs registrados.</p>'; }
  function dbMap(){ const s=st(), d=ensure(), keys=['clientes','agenda','atendimentos','materiais','despesas','procedimentos','receitasExtras']; return `<div class="devTableWrap"><table class="devTable"><tbody>${keys.map(k=>`<tr><th>${k}</th><td>${Array.isArray(s[k])?s[k].length:0}</td></tr>`).join('')}<tr><th>dev.studios</th><td>${d.studios.length}</td></tr><tr><th>dev.users</th><td>${d.users.length}</td></tr><tr><th>dev.logs</th><td>${d.logs.length}</td></tr></tbody></table></div>`; }
  function diag(){ const s=st(), d=ensure(), m=metrics(); return [`DIAGNÓSTICO STUDIO SYNC PRO`, `Data: ${br()}`, `Build Dev: ${BUILD}`, `Studios: ${m.studios}`, `Usuários: ${d.users.length}`, `Clientes locais: ${m.clients}`, `Agenda local: ${m.agenda}`, `Atendimentos locais: ${m.services}`, `MRR estimado: ${money(m.mrr)}`, `LocalStorage: ${storageKB()} KB`, `Status: estrutura carregada`].join('\n'); }
  function storageKB(){try{let t=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);t+=k.length+String(localStorage.getItem(k)||'').length}return Math.round(t/1024)}catch{return 0}}
  function csv(arr, cols){ return [cols.join(';')].concat(arr.map(o=>cols.map(c=>'"'+String(o[c]??'').replace(/"/g,'""')+'"').join(';'))).join('\n'); }
  function parseCSV(text){ const lines=String(text||'').split(/\r?\n/).filter(Boolean); if(!lines.length)return[]; const split=l=>l.split(';').map(x=>x.replace(/^"|"$/g,'').replace(/""/g,'"').trim()); const h=split(lines[0]); return lines.slice(1).map(l=>{const v=split(l),o={}; h.forEach((k,i)=>o[k]=v[i]||''); return o;}); }
  async function importFile(file,type){ if(!file)return; const d=ensure(), text=await file.text(); let data=[]; if(file.name.toLowerCase().endsWith('.csv')) data=parseCSV(text); else { const j=JSON.parse(text); data=Array.isArray(j)?j:(j[type]||j.devPro?.[type]||[]); } if(type==='studios'){ data.forEach(x=>{ const email=x.email||x.Email||''; let s=d.studios.find(a=>a.email&&a.email===email); if(!s){s={id:x.id||uid(),createdAt:Date.now()}; d.studios.push(s);} Object.assign(s,{name:x.name||x.studio||x.Studio||s.name||'Studio importado',owner:x.owner||x.responsavel||x.Proprietaria||s.owner||'',email,whatsapp:x.whatsapp||x.WhatsApp||s.whatsapp||'',plan:x.plan||x.plano||s.plan||'basic',status:x.status||s.status||'teste',dueDate:x.dueDate||x.vencimento||s.dueDate||'',trialStart:x.trialStart||today(),trialDays:x.trialDays||7}); }); }
    if(type==='users'){ data.forEach(x=>{ let u=d.users.find(a=>a.email&&a.email===(x.email||x.Email)); if(!u){u={id:x.id||uid(),createdAt:Date.now()}; d.users.push(u);} Object.assign(u,{name:x.name||x.nome||u.name||'Usuário importado',email:x.email||x.Email||u.email||'',phone:x.phone||x.telefone||u.phone||'',permission:x.permission||x.permissao||u.permission||'Funcionário',status:x.status||u.status||'ativo',studioId:x.studioId||u.studioId||d.studios[0]?.id||''}); }); }
    log('Importação',`Importado ${type}: ${data.length} registro(s).`); save(); alert(`Importação concluída: ${data.length} registro(s).`); render(type==='studios'?'studios':'usuarios'); }
  function bind(){ const d=ensure(); qa('[data-go]').forEach(b=>b.onclick=()=>render(b.dataset.go)); const exp=()=>dl('studio-sync-pro-dev-master-'+today()+'.json',JSON.stringify(st(),null,2),'application/json'); ['v71ExportAll','v71ExportAll2'].forEach(id=>{if($(id))$(id).onclick=exp}); if($('v71ToggleMaint'))$('v71ToggleMaint').onclick=()=>{d.flags.manutencao=!d.flags.manutencao;log('Sistema',d.flags.manutencao?'Manutenção ativada':'Manutenção desativada','warn');render('dash')};
    if($('v71AddStudio'))$('v71AddStudio').onclick=()=>{d.studios.unshift({id:uid(),name:'Novo Studio',owner:'',email:'',whatsapp:'',plan:'basic',status:'teste',trialStart:today(),trialDays:7,createdAt:Date.now(),lastAccess:Date.now()});log('Studios','Novo studio criado.');render('studios')}; if($('v71SaveStudios'))$('v71SaveStudios').onclick=()=>{qa('[data-studio]').forEach(tr=>{let s=d.studios.find(x=>x.id===tr.dataset.studio); if(s)qa('[data-k]',tr).forEach(i=>s[i.dataset.k]=i.value)});log('Studios','Studios salvos.');alert('Studios salvos.');save();render('studios')}; qa('[data-del-studio]').forEach(b=>b.onclick=()=>{if(confirm('Excluir este studio do painel Dev?')){d.studios=d.studios.filter(x=>x.id!==b.dataset.delStudio);log('Studios','Studio excluído.');save();render('studios')}}); qa('[data-enter-studio]').forEach(b=>b.onclick=()=>{window.__SJM_IMPERSONATING_STUDIO=b.dataset.enterStudio;log('Acesso assistido','Entrar/testar studio '+b.dataset.enterStudio);alert('Modo de teste do studio ativado para suporte.')}); if($('v71ExportStudios'))$('v71ExportStudios').onclick=()=>dl('studios.csv',csv(d.studios,['name','owner','email','whatsapp','plan','status','dueDate']),'text/csv'); if($('v71ImportStudiosBtn'))$('v71ImportStudiosBtn').onclick=()=>$('v71ImportStudios').click(); if($('v71ImportStudios'))$('v71ImportStudios').onchange=e=>importFile(e.target.files[0],'studios');
    if($('v71AddUser'))$('v71AddUser').onclick=()=>{d.users.unshift({id:uid(),name:'Novo usuário',email:'',phone:'',studioId:d.studios[0]?.id||'',permission:'Funcionário',status:'ativo'});log('Usuários','Novo usuário criado.');render('usuarios')}; if($('v71SaveUsers'))$('v71SaveUsers').onclick=()=>{qa('[data-user]').forEach(tr=>{let u=d.users.find(x=>x.id===tr.dataset.user); if(u)qa('[data-k]',tr).forEach(i=>u[i.dataset.k]=i.value)});log('Usuários','Usuários salvos.');alert('Usuários salvos.');save();render('usuarios')}; qa('[data-del-user]').forEach(b=>b.onclick=()=>{d.users=d.users.filter(x=>x.id!==b.dataset.delUser);log('Usuários','Usuário excluído.');save();render('usuarios')}); if($('v71ImportUsersBtn'))$('v71ImportUsersBtn').onclick=()=>$('v71ImportUsers').click(); if($('v71ImportUsers'))$('v71ImportUsers').onchange=e=>importFile(e.target.files[0],'users');
    if($('v71SavePlans'))$('v71SavePlans').onclick=()=>{Object.keys(d.plans).forEach(k=>{let p=d.plans[k];p.price=$(`pl_${k}_price`).value;p.trialDays=n($(`pl_${k}_trial`).value);p.maxClientes=n($(`pl_${k}_maxc`).value);p.maxFotos=n($(`pl_${k}_maxf`).value);p.features=$(`pl_${k}_features`).value.split(/\n/).filter(Boolean)});log('Planos','Planos atualizados.');alert('Planos salvos.');save();render('assinaturas')}; if($('v71GeneratePayments'))$('v71GeneratePayments').onclick=()=>{d.studios.filter(s=>s.status==='ativo').forEach(s=>d.payments.unshift({id:uid(),date:today(),studio:s.name,plan:s.plan,value:n(d.plans[s.plan]?.price),status:'pendente'}));log('Financeiro','Cobranças simuladas geradas.');save();render('financeiro')}; if($('v71AddPayment'))$('v71AddPayment').onclick=()=>{const s=d.studios[0]||{};d.payments.unshift({id:uid(),date:today(),studio:s.name||'Studio',plan:s.plan||'basic',value:n(d.plans?.[s.plan]?.price||0),status:'pago'});log('Financeiro','Pagamento manual registrado.');save();render('financeiro')}; if($('v71ExportPayments'))$('v71ExportPayments').onclick=()=>dl('financeiro.csv',csv(d.payments,['date','studio','plan','value','status']),'text/csv');
    if($('v71ReportSaas'))$('v71ReportSaas').onclick=()=>dl('relatorio-saas.txt',diag(),'text/plain'); if($('v71ReportStudios'))$('v71ReportStudios').onclick=()=>dl('studios.csv',csv(d.studios,['name','owner','email','whatsapp','plan','status']),'text/csv'); if($('v71ReportLogs'))$('v71ReportLogs').onclick=()=>dl('logs.csv',csv(d.logs,['area','text','level','at','user']),'text/csv'); if($('v71ClearLogs'))$('v71ClearLogs').onclick=()=>{if(confirm('Limpar logs?')){d.logs=[];save();render('logs')}}; if($('v71ExportLogs'))$('v71ExportLogs').onclick=()=>dl('logs.csv',csv(d.logs,['area','text','level','at','user']),'text/csv');
    if($('v71AddTicket'))$('v71AddTicket').onclick=()=>{d.tickets.unshift({id:uid(),title:$('tkTitle').value||'Chamado',studio:$('tkStudio').value||'',priority:$('tkPriority').value,status:'Aberto',text:$('tkText').value||'',at:Date.now()});log('Suporte','Chamado registrado.');save();render('suporte')}; qa('[data-resolve-ticket]').forEach(b=>b.onclick=()=>{let t=d.tickets.find(x=>x.id===b.dataset.resolveTicket);if(t)t.status='Resolvido';log('Suporte','Chamado resolvido.');save();render('suporte')}); if($('v71CopySupport'))$('v71CopySupport').onclick=async()=>{try{await navigator.clipboard.writeText($('v71SupportMsg').value);alert('Resposta copiada.')}catch{prompt('Copie:',$('v71SupportMsg').value)}};
    if($('v71AddBug'))$('v71AddBug').onclick=()=>{d.bugs.unshift({id:uid(),title:$('bugTitle').value||'Bug',priority:$('bugPriority').value,status:'Aberto',text:$('bugText').value||'',at:Date.now()});log('Bugs','Bug registrado.');save();render('bugs')}; qa('[data-resolve-bug]').forEach(b=>b.onclick=()=>{let x=d.bugs.find(y=>y.id===b.dataset.resolveBug);if(x)x.status='Resolvido';log('Bugs','Bug resolvido.');save();render('bugs')});
    if($('v71ImportAllBtn'))$('v71ImportAllBtn').onclick=()=>$('v71ImportAll').click(); if($('v71ImportAll'))$('v71ImportAll').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const j=JSON.parse(await f.text()); if(j.devPro){st().devPro=Object.assign(ensure(),j.devPro); log('Backup','Backup Dev importado.'); alert('Backup Dev importado.'); save(); render('backups')}else alert('JSON válido, mas não encontrei devPro.')}catch{alert('JSON inválido.')}}; if($('v71Validate'))$('v71Validate').onclick=()=>alert(diag()); if($('v71SortDates'))$('v71SortDates').onclick=()=>{['agenda','atendimentos','despesas','receitasExtras'].forEach(k=>Array.isArray(st()[k])&&st()[k].sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))));log('Banco','Dados ordenados por data.');save();alert('Ordenado.');};
    if($('v71Publish'))$('v71Publish').onclick=()=>{d.releases.unshift({id:uid(),version:$('relV').value||BUILD,title:$('relT').value||'Atualização',notes:$('relN').value||'',required:$('relReq').checked,at:Date.now()});d.flags.atualizacaoObrigatoria=!!$('relReq').checked;log('Atualizações','Atualização publicada.');save();render('atualizacoes')}; if($('v71SaveFlags'))$('v71SaveFlags').onclick=()=>{qa('[data-flag]').forEach(i=>d.flags[i.dataset.flag]=i.checked);log('Flags','Recursos globais salvos.');save();alert('Recursos salvos.');render('atualizacoes')};
    if($('v71SaveSecurity'))$('v71SaveSecurity').onclick=()=>{d.security.twoFactor=$('sec2fa').checked;d.security.devAudit=$('secAudit').checked;d.security.rules=$('secRules').value;d.security.lastAudit=today();log('Segurança','Configurações de segurança salvas.');save();alert('Segurança salva.')}; if($('v71SaveGlobal'))$('v71SaveGlobal').onclick=()=>{d.global.appName=$('glApp').value;d.global.supportEmail=$('glEmail').value;d.global.supportWhatsapp=$('glWpp').value;d.global.currentVersion=$('glVer').value;d.global.notice=$('glNotice').value;log('Globais','Configurações globais salvas.');save();alert('Globais salvas.')}; if($('v71Recalc'))$('v71Recalc').onclick=()=>{try{syncAgendaToAtendimentos&&syncAgendaToAtendimentos()}catch{} log('Ferramentas','Recalcular executado.');alert('Recalcular executado.')}; if($('v71ClearCache'))$('v71ClearCache').onclick=()=>{try{caches?.keys?.().then(keys=>keys.forEach(k=>caches.delete(k)))}catch{} log('Cache','Limpeza de cache solicitada.');alert('Cache limpo. Reabra o app.')}; if($('v71Diag'))$('v71Diag').onclick=()=>{$('v71DiagText').textContent=diag();log('Diagnóstico','Diagnóstico executado.')}; }
  function install(){ try{ensure()}catch(e){console.warn(e)} document.addEventListener('click',e=>{if(e.target?.closest?.('[data-tab="desenvolvedor"]'))setTimeout(()=>render('dash'),180)},true); if(document.querySelector('[data-route="desenvolvedor"].active')||location.hash==='#desenvolvedor') render('dash'); }
  document.addEventListener('DOMContentLoaded',install); window.addEventListener('load',()=>{install();setTimeout(()=>render('dash'),1400)}); setTimeout(install,1500); window.__SJM_RENDER_DEV_PRO=render;
})();


/* =========================================================
   STUDIO SYNC PRO v72 FINAL
   Correções reais em cima da v71:
   1) Fidelidade avançada: ativar/desativar cartão, indicação e cashback.
   2) Recompensa aparece no Dashboard quando cliente completa selos.
   3) Autoagendamento desativado esconde regras, Pix, link e prévia.
   4) Área do usuário recebe Importar backup.
   5) Cores aplicam na hora e salvam sem quebrar logo.
   6) Desenvolvedor Master completo com métricas SaaS, planos, suporte,
      erros, auditoria, monitoramento, financeiro e crescimento.
   ========================================================= */
(function(){
  const DEV_PASS = ""; // removido na versão cliente
  const $id = (id)=>document.getElementById(id);
  const $$q = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const moneyV72 = (v)=> (Number(v||0)).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const escV72 = (v)=> String(v ?? "").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const normV72 = (v)=> String(v||"").trim();
  const todayV72 = ()=> new Date().toISOString().slice(0,10);
  const boolV72 = (v, def=true)=>{
    if(v === true || v === false) return v;
    const t = String(v ?? '').trim().toLowerCase();
    if(['false','0','nao','não','desativado','off'].includes(t)) return false;
    if(['true','1','sim','ativado','on'].includes(t)) return true;
    return def;
  };
  const daysBetweenV72 = (a,b=new Date())=>{
    if(!a) return null;
    const da = new Date(String(a).slice(0,10)+"T00:00:00");
    const db = new Date(b.toISOString().slice(0,10)+"T00:00:00");
    if(isNaN(da)) return null;
    return Math.floor((db-da)/86400000);
  };

  function stV72(){
    try{ return typeof state !== "undefined" ? state : window.state; }catch(e){ return window.state; }
  }

  function saveV72(reason){
    const s = stV72(); if(!s) return;
    s.meta = s.meta || {};
    s.meta.updatedAt = Date.now();
    s.meta.reason = reason || "v72";
    try{
      const raw = JSON.stringify(s);
      ["sjm_sync_pro_v1","studio_sync_pro_db","studio_sync_pro_unico_v1","studioSyncState","studio_sync_pro_db__last_good"].forEach(k=>{
        try{ localStorage.setItem(k, raw); }catch(e){}
      });
      try{ if(typeof ACTIVE_STORAGE_KEY !== "undefined") localStorage.setItem(ACTIVE_STORAGE_KEY, raw); }catch(e){}
      try{ if(typeof KEY !== "undefined") localStorage.setItem(KEY, raw); }catch(e){}
    }catch(e){}
    try{ if(typeof saveSoft === "function") saveSoft(); }catch(e){}
    try{ if(typeof scheduleSync === "function") scheduleSync(); }catch(e){}
    try{ if(typeof scheduleCloudPush === "function") scheduleCloudPush(); }catch(e){}
  }

  function ensureV72(){
    const s = stV72(); if(!s) return null;
    s.settings = s.settings || {};
    s.settings.plano = String(s.settings.plano || "premium").toLowerCase();
    s.fidelidade = s.fidelidade && typeof s.fidelidade === "object" ? s.fidelidade : {};
    s.fidelidade.campanhaCartaoAtiva = boolV72(s.fidelidade.campanhaCartaoAtiva, true);
    s.fidelidade.programaIndicacaoAtivo = boolV72(s.fidelidade.programaIndicacaoAtivo, true);
    s.fidelidade.cashbackAtivo = boolV72(s.fidelidade.cashbackAtivo, false);
    s.fidelidade.selos = Number(s.fidelidade.selos || 10) || 10;
    s.fidelidade.iniciais = Number(s.fidelidade.iniciais ?? 2) || 0;
    s.fidelidade.resetDias = Number(s.fidelidade.resetDias || 31) || 31;
    s.fidelidade.recompensa = s.fidelidade.recompensa || "1 manutenção grátis";
    s.fidelidade.validadeInicio = s.fidelidade.validadeInicio || "";
    s.fidelidade.validadeFim = s.fidelidade.validadeFim || "";
    s.fidelidade.tipoRecompensa = s.fidelidade.tipoRecompensa || "Serviço gratuito";
    s.fidelidade.regraRecompensa = s.fidelidade.regraRecompensa || "Recompensa válida quando completar todos os selos.";
    s.fidelidade.premiados = Array.isArray(s.fidelidade.premiados) ? s.fidelidade.premiados : [];
    s.fidelidade.historicoRecompensas = Array.isArray(s.fidelidade.historicoRecompensas) ? s.fidelidade.historicoRecompensas : [];
    s.marketing = s.marketing && typeof s.marketing === "object" ? s.marketing : {};
    s.marketing.indicacoes = Array.isArray(s.marketing.indicacoes) ? s.marketing.indicacoes : [];
    s.autoagendamento = s.autoagendamento && typeof s.autoagendamento === "object" ? s.autoagendamento : {};
    if(typeof s.autoagendamento.ativo !== "boolean") s.autoagendamento.ativo = true;

    s.dev = s.dev && typeof s.dev === "object" ? s.dev : {};
    s.dev.trialDias = Number(s.dev.trialDias || 7) || 7;
    s.dev.planos = s.dev.planos && typeof s.dev.planos === "object" ? s.dev.planos : {
      basic:{nome:"Básico", preco:29.90, maxUsuarios:1, maxClientes:100, recursos:["agenda","clientes","whatsapp","procedimentos"]},
      pro:{nome:"Pro", preco:59.90, maxUsuarios:3, maxClientes:500, recursos:["agenda","clientes","whatsapp","crm","materiais","despesas","exportacao"]},
      premium:{nome:"Premium", preco:99.90, maxUsuarios:10, maxClientes:5000, recursos:["agenda","clientes","whatsapp","crm","materiais","despesas","fidelidade","autoagendamento","exportacao","suporte"]}
    };
    s.dev.profissionaisSaaS = Array.isArray(s.dev.profissionaisSaaS) ? s.dev.profissionaisSaaS : [];
    s.dev.suporte = Array.isArray(s.dev.suporte) ? s.dev.suporte : [];
    s.dev.bugs = Array.isArray(s.dev.bugs) ? s.dev.bugs : [];
    s.dev.logs = Array.isArray(s.dev.logs) ? s.dev.logs : [];
    s.dev.campanhas = Array.isArray(s.dev.campanhas) ? s.dev.campanhas : [];
    s.dev.featureFlags = s.dev.featureFlags && typeof s.dev.featureFlags === "object" ? s.dev.featureFlags : {
      fidelidade:true, autoagendamento:true, crm:true, exportacao:true, firebase:true, whatsapp:true
    };
    return s;
  }

  function logDevV72(action, details){
    const s = ensureV72(); if(!s) return;
    s.dev.logs.unshift({data:new Date().toISOString(), action, details:details||""});
    s.dev.logs = s.dev.logs.slice(0,200);
    saveV72("dev-log");
  }

  function loyaltyForV72(nome){
    const s = ensureV72();
    const at = (s.atendimentos||[]).filter(a => String(a.cliente||"").toLowerCase() === String(nome||"").toLowerCase());
    const selos = Number(s.fidelidade.selos||10) || 10;
    const iniciais = Number(s.fidelidade.iniciais||0) || 0;
    const totalAt = at.length;
    let atual = Math.min(selos, iniciais + totalAt);
    const ultima = at.map(a=>a.data).filter(Boolean).sort().pop() || "";
    const faltam = Math.max(0, selos - atual);
    return {atual, faltam, ultima, totalAt, completo: faltam===0};
  }

  function rewardAlertsV72(){
    const s = ensureV72();
    if(!s || s.fidelidade.campanhaCartaoAtiva === false) return [];
    return (s.clientes||[]).map(c=>{
      const f = loyaltyForV72(c.nome);
      return {cliente:c, ...f};
    }).filter(x=>x.completo);
  }

  function patchDashboardRewardsV72(){
    const s = ensureV72(); if(!s) return;
    const alertsRoot = Array.from(document.querySelectorAll(".box,.card,.panel")).find(el=>{
      const h = el.querySelector("h3,h2");
      return h && /alertas rápidos|alertas rapidos/i.test(h.textContent||"");
    });
    if(!alertsRoot) return;
    const rewards = rewardAlertsV72();
    alertsRoot.querySelectorAll(".sjmRewardAlert").forEach(x=>x.remove());
    if(rewards.length){
      const wrap = document.createElement("div");
      wrap.className = "sjmRewardAlert";
      wrap.innerHTML = `🎁 <b>${rewards.length} cliente(s) com recompensa pendente:</b><br>` +
        rewards.slice(0,6).map(x=>`${escV72(x.cliente.nome)} — ${escV72(s.fidelidade.recompensa)}`).join("<br>");
      alertsRoot.insertBefore(wrap, alertsRoot.children[1] || null);
    }
  }

  function renderFidelidadeV72(){
    const s = ensureV72(); if(!s) return;
    const sec = document.querySelector('[data-route="fidelidade"]');
    if(!sec) return;
    sec.innerHTML = `
      <div class="panel__head"><h2>Fidelidade e Indicações</h2><p>Campanhas, cartão de selos, recompensas, WhatsApp e programa de indicação.</p></div>
      <div class="grid2">
        <div class="box">
          <h3>Configuração do cartão</h3>
          <div class="row">
            <label class="field"><span>Cartão fidelidade</span><select id="fidCampanhaAtiva"><option value="true">Ativado</option><option value="false">Desativado</option></select></label>
            <label class="field"><span>Tipo de recompensa</span><select id="fidTipoRecompensa"><option>Serviço gratuito</option><option>Desconto</option><option>Brinde</option><option>Selo extra</option></select></label>
            <label class="field"><span>Data de início</span><input id="fidInicio" type="date"></label>
            <label class="field"><span>Data final</span><input id="fidFim" type="date"></label>
            <label class="field"><span>Selos necessários</span><input id="fidSelos" type="number" min="1"></label>
            <label class="field"><span>Selos iniciais</span><input id="fidIniciais" type="number" min="0"></label>
            <label class="field"><span>Reiniciar após dias sem atendimento</span><input id="fidResetDias" type="number" min="0"></label>
            <label class="field"><span>Recompensa</span><input id="fidRecompensa"></label>
            <label class="field" style="grid-column:1/-1"><span>Regra da recompensa</span><textarea id="fidRegraRecompensa" rows="3"></textarea></label>
          </div>
          <div class="actions"><button class="btn" id="btnSalvarFidelidade" type="button">Salvar fidelidade</button></div>
          <div id="fidStatusV72" class="hint"></div>
        </div>
        <div class="box"><h3>Clientes próximas da recompensa</h3><div id="fidResumo" class="simpleList"></div><h3 style="margin-top:14px">Clientes premiadas</h3><div id="fidPremiados" class="simpleList"></div></div>
      </div>
      <div class="grid2" style="margin-top:12px">
        <div class="box"><h3>Programa de indicação</h3>
          <label class="field"><span>Programa de indicação</span><select id="fidIndicacaoAtiva"><option value="true">Ativado</option><option value="false">Desativado</option></select></label>
          <div class="row"><input id="indCliente" placeholder="Cliente que indicou"><input id="indAmiga" placeholder="Cliente indicada"></div>
          <div class="actions"><button class="btn" id="btnAddIndicacao" type="button">Registrar indicação</button></div>
          <div id="indList" class="simpleList"></div>
        </div>
        <div class="box"><h3>Campanha extra / Cashback</h3>
          <label class="field"><span>Cashback</span><select id="fidCashbackAtivo"><option value="false">Desativado</option><option value="true">Ativado</option></select></label>
          <label class="field"><span>Recompensa para quem mais indica</span><input id="fidPremioIndicacao" placeholder="Brinde, desconto ou selo extra"></label>
          <label class="field"><span>Regras definidas pela profissional</span><textarea id="fidRegrasIndicacao" rows="4"></textarea></label>
          <div class="simpleList"><div class="simpleItem">Use indicações para premiar clientes que trazem novas clientes.</div><div class="simpleItem">Exemplo: indicou 3 clientes = ganha desconto, brinde ou selo extra.</div></div>
        </div>
      </div>
      <div class="tableWrap" style="margin-top:12px"><table class="table" id="tblFidelidade"><thead><tr><th>Cliente</th><th>Selos</th><th>Faltam</th><th>Último atendimento</th><th>Status</th><th>Ação</th></tr></thead><tbody></tbody></table></div>
    `;
    bindFidelidadeV72();
    fillFidelidadeV72();
  }

  function fillFidelidadeV72(){
    const s = ensureV72(); if(!s) return;
    const set = (id,v)=>{ const el=$id(id); if(el) el.value = v ?? ""; };
    set("fidCampanhaAtiva", String(s.fidelidade.campanhaCartaoAtiva !== false));
    set("fidIndicacaoAtiva", String(s.fidelidade.programaIndicacaoAtivo !== false));
    set("fidCashbackAtivo", String(s.fidelidade.cashbackAtivo === true));
    set("fidTipoRecompensa", s.fidelidade.tipoRecompensa || "Serviço gratuito");
    set("fidInicio", s.fidelidade.validadeInicio || "");
    set("fidFim", s.fidelidade.validadeFim || "");
    set("fidSelos", s.fidelidade.selos);
    set("fidIniciais", s.fidelidade.iniciais);
    set("fidResetDias", s.fidelidade.resetDias);
    set("fidRecompensa", s.fidelidade.recompensa);
    set("fidRegraRecompensa", s.fidelidade.regraRecompensa);
    set("fidPremioIndicacao", s.fidelidade.premioIndicacao || "Brinde, desconto ou selo extra");
    set("fidRegrasIndicacao", s.fidelidade.regrasIndicacao || "A indicação só conta após a cliente indicada realizar o primeiro atendimento.");

    const cardActive = s.fidelidade.campanhaCartaoAtiva !== false;
    const indActive = s.fidelidade.programaIndicacaoAtivo !== false;
    const status = $id("fidStatusV72");
    if(status) status.innerHTML = `${cardActive ? "✅ Cartão fidelidade ativo." : "⚠️ Cartão fidelidade desativado."} ${indActive ? "✅ Programa de indicação ativo." : "⚠️ Programa de indicação desativado."}`;

    const body = document.querySelector("#tblFidelidade tbody");
    if(body){
      if(!cardActive){
        body.innerHTML = '<tr><td colspan="6">Cartão fidelidade desativado. Ative para listar selos e recompensas.</td></tr>';
      }else{
        body.innerHTML = (s.clientes||[]).map(c=>{
          const f = loyaltyForV72(c.nome);
          const status = f.completo ? `🎁 Recompensa pendente` : (f.faltam <= 2 ? "Perto da recompensa" : "Em andamento");
          return `<tr><td>${escV72(c.nome)}</td><td>${"⭐".repeat(Math.min(f.atual,10))} <b>${f.atual}/${s.fidelidade.selos}</b></td><td>${f.faltam}</td><td>${f.ultima?fmtBRDate(f.ultima):"—"}</td><td>${status}</td><td><button class="btn btn--ghost" data-wpp-fid="${escV72(c.nome)}">WhatsApp</button></td></tr>`;
        }).join("") || '<tr><td colspan="6">Nenhuma cliente cadastrada.</td></tr>';
      }
    }

    const resumo = $id("fidResumo");
    if(resumo){
      if(!cardActive) resumo.innerHTML = '<div class="hint">Cartão fidelidade desativado.</div>';
      else resumo.innerHTML = (s.clientes||[]).map(c=>({c,f:loyaltyForV72(c.nome)})).filter(x=>x.f.faltam<=2).slice(0,8).map(x=>`<div class="simpleItem"><b>${escV72(x.c.nome)}</b> faltam ${x.f.faltam} selo(s).</div>`).join("") || '<div class="hint">Nenhuma cliente próxima da recompensa.</div>';
    }
    const prem = $id("fidPremiados");
    if(prem){
      const rewards = rewardAlertsV72();
      prem.innerHTML = rewards.slice(0,8).map(x=>`<div class="simpleItem">🎁 <b>${escV72(x.cliente.nome)}</b> — ${escV72(s.fidelidade.recompensa)}</div>`).join("") || '<div class="hint">Nenhuma cliente premiada agora.</div>';
    }
    const indList = $id("indList");
    if(indList){
      if(!indActive) indList.innerHTML = '<div class="hint">Programa de indicação desativado.</div>';
      else {
        const counts = {};
        (s.marketing.indicacoes||[]).forEach(x=>{ counts[x.cliente] = (counts[x.cliente]||0)+1; });
        const ranking = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,q],i)=>`<div class="simpleItem"><b>${i+1}. ${escV72(n)}</b> — ${q} indicação(ões)</div>`).join("");
        indList.innerHTML = (s.marketing.indicacoes||[]).map(x=>`<div class="simpleItem"><b>${escV72(x.cliente)}</b> indicou ${escV72(x.amiga)}</div>`).join("") + (ranking ? `<h4>Ranking de indicações</h4>${ranking}` : "") || '<div class="hint">Sem indicações registradas.</div>';
      }
    }
    $$q("[data-wpp-fid]").forEach(btn=>{
      if(btn.__fidWpp) return; btn.__fidWpp=true;
      btn.addEventListener("click", ()=>{
        const nome = btn.dataset.wppFid;
        const c = (s.clientes||[]).find(x=>String(x.nome).toLowerCase()===String(nome).toLowerCase());
        const f = loyaltyForV72(nome);
        const txt = (s.wpp?.tplFidelidade || "Parabéns, {cliente}! Você ganhou mais um selo.").replaceAll("{cliente}", nome).replaceAll("{studio}", s.settings?.studioNome||"Studio").replaceAll("{selo}", String(f.atual)).replaceAll("{faltam}", String(f.faltam));
        if(c?.wpp || c?.tel) window.open(waLink(c.wpp||c.tel, txt), "_blank");
        else alert("Cliente sem WhatsApp.");
      });
    });
  }

  function bindFidelidadeV72(){
    const save = $id("btnSalvarFidelidade");
    if(save && !save.__v72){
      save.__v72 = true;
      save.addEventListener("click", ()=>{
        const s = ensureV72();
        s.fidelidade.campanhaCartaoAtiva = $id("fidCampanhaAtiva")?.value !== "false";
        s.fidelidade.programaIndicacaoAtivo = $id("fidIndicacaoAtiva")?.value !== "false";
        s.fidelidade.cashbackAtivo = $id("fidCashbackAtivo")?.value === "true";
        s.fidelidade.tipoRecompensa = $id("fidTipoRecompensa")?.value || "Serviço gratuito";
        s.fidelidade.validadeInicio = $id("fidInicio")?.value || "";
        s.fidelidade.validadeFim = $id("fidFim")?.value || "";
        s.fidelidade.selos = Number($id("fidSelos")?.value || 10) || 10;
        s.fidelidade.iniciais = Number($id("fidIniciais")?.value || 0) || 0;
        s.fidelidade.resetDias = Number($id("fidResetDias")?.value || 31) || 31;
        s.fidelidade.recompensa = $id("fidRecompensa")?.value || "1 manutenção grátis";
        s.fidelidade.regraRecompensa = $id("fidRegraRecompensa")?.value || "";
        s.fidelidade.premioIndicacao = $id("fidPremioIndicacao")?.value || "";
        s.fidelidade.regrasIndicacao = $id("fidRegrasIndicacao")?.value || "";
        saveV72("fidelidade-save");
        fillFidelidadeV72();
        patchDashboardRewardsV72();
        alert("Fidelidade salva ✅");
      });
    }
    const add = $id("btnAddIndicacao");
    if(add && !add.__v72){
      add.__v72 = true;
      add.addEventListener("click", ()=>{
        const s = ensureV72();
        if(s.fidelidade.programaIndicacaoAtivo === false){ alert("Programa de indicação está desativado."); return; }
        const cliente = normV72($id("indCliente")?.value);
        const amiga = normV72($id("indAmiga")?.value);
        if(!cliente || !amiga){ alert("Preencha quem indicou e a cliente indicada."); return; }
        s.marketing.indicacoes.unshift({cliente, amiga, data: todayV72(), status:"registrada"});
        saveV72("indicacao");
        fillFidelidadeV72();
      });
    }
  }

  function patchAutoAgV72(){
    const s = ensureV72(); if(!s) return;
    const sec = document.querySelector('[data-route="autoagendamento"]');
    if(!sec) return;
    const select = $id("agAtivo");
    const isActive = select ? select.value !== "false" : s.autoagendamento.ativo !== false;
    const boxes = $$q(".box", sec);
    const linkBox = boxes[0];
    const rulesBox = boxes[1];
    const previewBox = boxes[2];

    if(rulesBox) rulesBox.classList.toggle("hiddenHard", !isActive);
    if(previewBox) previewBox.classList.toggle("hiddenHard", !isActive);

    const link = $id("agLink");
    if(!isActive){
      if(link) link.value = "Autoagendamento desativado";
      if(!sec.querySelector(".sjmAutoDisabledBox")){
        const msg = document.createElement("div");
        msg.className = "sjmAutoDisabledBox";
        msg.textContent = "Autoagendamento desativado. O link público, regras, Pix e prévia ficam ocultos.";
        (linkBox || sec).appendChild(msg);
      }
    }else{
      sec.querySelectorAll(".sjmAutoDisabledBox").forEach(x=>x.remove());
      if(link) link.value = `https://app.jaquelinemendanha.com/agendar/${$id("agSlug")?.value || s.autoagendamento.slug || "studio"}`;
    }
  }

  function bindAutoAgV72(){
    const sel = $id("agAtivo");
    if(sel && !sel.__v72){
      sel.__v72 = true;
      sel.addEventListener("change", patchAutoAgV72);
    }
    const save = $id("btnSalvarAutoAg");
    if(save && !save.__v72){
      save.__v72 = true;
      save.addEventListener("click", ()=>{
        setTimeout(()=>{
          const s = ensureV72();
          s.autoagendamento.ativo = $id("agAtivo")?.value !== "false";
          saveV72("autoagendamento-save");
          patchAutoAgV72();
        },40);
      }, true);
    }
    patchAutoAgV72();
  }

  function applyColorsV72(p,a){
    const s = ensureV72(); if(!s) return;
    p = p || s.settings.corPrimaria || "#7B2CBF";
    a = a || s.settings.corAcento || "#F72585";
    document.documentElement.style.setProperty("--p", p);
    document.documentElement.style.setProperty("--a", a);
    document.documentElement.style.setProperty("--primary", p);
    document.documentElement.style.setProperty("--accent", a);
    document.documentElement.style.setProperty("--brand-primary", p);
    document.documentElement.style.setProperty("--brand-accent", a);
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content", p);
  }

  function bindConfigV72(){
    const s = ensureV72(); if(!s) return;
    const c1 = $id("cfgCorPrimaria"), c2 = $id("cfgCorAcento"), save=$id("btnSaveConfig"), logo=$id("cfgLogoUrl"), file=$id("cfgLogoFile");
    if(c1 && !c1.__v72){
      c1.__v72 = true;
      c1.value = s.settings.corPrimaria || "#7B2CBF";
      c1.addEventListener("input", ()=>applyColorsV72(c1.value, c2?.value), true);
      c1.addEventListener("change", ()=>{ s.settings.corPrimaria = c1.value; saveV72("color-primary"); applyColorsV72(c1.value, c2?.value); }, true);
    }
    if(c2 && !c2.__v72){
      c2.__v72 = true;
      c2.value = s.settings.corAcento || "#F72585";
      c2.addEventListener("input", ()=>applyColorsV72(c1?.value, c2.value), true);
      c2.addEventListener("change", ()=>{ s.settings.corAcento = c2.value; saveV72("color-accent"); applyColorsV72(c1?.value, c2.value); }, true);
    }
    if(file && !file.__v72){
      file.__v72 = true;
      file.addEventListener("change", (e)=>{
        const f = file.files && file.files[0]; if(!f) return;
        if(!String(f.type||"").startsWith("image/")){ alert("Escolha uma imagem válida."); return; }
        const r = new FileReader();
        r.onload = ()=>{
          const data = String(r.result||"");
          if(!data.startsWith("data:image/")) return;
          s.settings.logoUrl = data;
          if(logo) logo.value = "Logo carregada";
          saveV72("logo-upload");
          try{ if(typeof applyTheme === "function") applyTheme(); }catch(err){}
          alert("Logo carregada e salva ✅");
        };
        r.readAsDataURL(f);
      }, true);
    }
    if(save && !save.__v72){
      save.__v72 = true;
      save.addEventListener("click", (e)=>{
        setTimeout(()=>{
          const currentLogo = String(s.settings.logoUrl || "");
          const lv = String(logo?.value || "").trim();
          if(lv === "Logo carregada" && currentLogo.startsWith("data:image/")) s.settings.logoUrl = currentLogo;
          else if(lv.startsWith("data:image/") || lv.startsWith("http") || lv === "") s.settings.logoUrl = lv;
          if(c1?.value) s.settings.corPrimaria = c1.value;
          if(c2?.value) s.settings.corAcento = c2.value;
          applyColorsV72(s.settings.corPrimaria, s.settings.corAcento);
          saveV72("config-v72");
        },50);
      }, true);
    }
    applyColorsV72();
  }

  function bindImportV72(){
    const file = $id("fileImport");
    function addImportButton(root, afterBtn){
      if(!root || !file || root.querySelector("#btnUserImportBackupV72")) return;
      const b = document.createElement("button");
      b.id = "btnUserImportBackupV72";
      b.type = "button";
      b.className = afterBtn?.className || "btn btn--ghost";
      b.textContent = "Importar backup";
      b.onclick = (e)=>{ e.preventDefault(); file.click(); };
      if(afterBtn) afterBtn.insertAdjacentElement("afterend", b);
      else root.appendChild(b);
    }
    const cfgBtn = $id("btnImportBackupFinal");
    if(cfgBtn && file && !cfgBtn.__v72){ cfgBtn.__v72=true; cfgBtn.onclick=(e)=>{e.preventDefault(); file.click();}; }

    const userModal = Array.from(document.querySelectorAll(".modal,.dialog,.userModal,.box")).find(el=>/Área do Usuário|Area do Usuario|Conta e segurança/i.test(el.textContent||""));
    if(userModal){
      const exportBtn = Array.from(userModal.querySelectorAll("button")).find(b=>/Exportar backup/i.test(b.textContent||""));
      addImportButton(userModal, exportBtn);
    }
    if(file && !file.__v72){
      file.__v72 = true;
      file.addEventListener("change", async ()=>{
        const f = file.files && file.files[0]; if(!f) return;
        try{
          const parsed = JSON.parse(await f.text());
          if(!parsed || typeof parsed !== "object") throw new Error("JSON inválido");
          let newState = parsed;
          try{ if(typeof sanitizeState === "function") newState = sanitizeState(parsed); }catch(e){}
          window.state = newState;
          try{ state = newState; }catch(e){}
          ensureV72();
          saveV72("import-backup");
          try{ if(typeof applyTheme === "function") applyTheme(); }catch(e){}
          try{ if(typeof renderAllHard === "function") renderAllHard(); }catch(e){}
          setTimeout(bootV72,150);
          alert("Backup importado ✅");
        }catch(e){
          alert("Arquivo de backup inválido.");
        }finally{ file.value = ""; }
      }, true);
    }
  }

  function planKeyV72(p){
    p = String(p||"premium").toLowerCase();
    if(p.includes("basic") || p.includes("básico") || p.includes("basico")) return "basic";
    if(p.includes("pro")) return "pro";
    if(p.includes("premium")) return "premium";
    return "premium";
  }

  function buildSaaSUsersV72(){
    const s = ensureV72();
    const base = [];
    const current = {
      id:"studio_atual",
      nome:s.settings.studioNome || "Studio atual",
      email:(window.__SJM_CURRENT_USER?.email)||"sacjaquelinemendanha@gmail.com",
      plano: planKeyV72(s.settings.plano),
      status:"ativo",
      testeDias:0,
      criadoEm:s.meta?.createdAt || todayV72(),
      ultimoLogin: new Date().toISOString(),
      clientes:(s.clientes||[]).length,
      agendamentos:(s.agenda||[]).length,
      cidade:"",
      versao:"v72"
    };
    base.push(current);
    (s.dev.profissionaisSaaS||[]).forEach(u=>base.push(u));
    return base;
  }

  function devMetricsV72(){
    const s = ensureV72();
    const users = buildSaaSUsersV72();
    const planos = s.dev.planos;
    const byPlan = {basic:{q:0, valor:0}, pro:{q:0, valor:0}, premium:{q:0, valor:0}, trial:{q:0, valor:0}, bloqueado:{q:0, valor:0}};
    users.forEach(u=>{
      const status = String(u.status||"ativo").toLowerCase();
      const key = status.includes("teste") || Number(u.testeDias||0)>0 ? "trial" : (status.includes("bloq") ? "bloqueado" : planKeyV72(u.plano));
      if(!byPlan[key]) byPlan[key]={q:0,valor:0};
      byPlan[key].q++;
      if(key!=="trial" && key!=="bloqueado") byPlan[key].valor += Number(planos[key]?.preco || 0);
    });
    const mrr = byPlan.basic.valor + byPlan.pro.valor + byPlan.premium.valor;
    const most = Object.entries(byPlan).filter(([k])=>["basic","pro","premium"].includes(k)).sort((a,b)=>b[1].q-a[1].q)[0] || ["premium",{q:0,valor:0}];
    const errors = {};
    (s.dev.bugs||[]).forEach(b=>{ const k=b.titulo||b.categoria||"Erro sem título"; errors[k]=(errors[k]||0)+1; });
    const topError = Object.entries(errors).sort((a,b)=>b[1]-a[1])[0];
    return {users, byPlan, mrr, arr:mrr*12, mostPlan:most[0], topError};
  }

  function renderDevV72(){
    const s = ensureV72(); if(!s) return;
    const root = $id("devProRoot") || document.querySelector('[data-route="desenvolvedor"]');
    if(!root) return;
    const m = devMetricsV72();
    const planLabel = {basic:"Básico",pro:"Pro",premium:"Premium",trial:"Teste",bloqueado:"Bloqueado"};
    root.innerHTML = `
      <div class="panel__head"><h2>Desenvolvedor / Suporte Master</h2><p>Painel SaaS interno para clientes, planos, financeiro, suporte, monitoramento, logs, atualizações e segurança.</p></div>
      <div class="sjmDevNav" id="devNavV72">
        ${["dashboard","clientes","planos","financeiro","suporte","erros","monitoramento","marketing","seguranca","config"].map((x,i)=>`<button type="button" data-devtab="${x}" class="${i===0?"active":""}">${({dashboard:"Dashboard",clientes:"Clientes",planos:"Planos",financeiro:"Financeiro",suporte:"Suporte",erros:"Erros",monitoramento:"Monitoramento",marketing:"Marketing",seguranca:"Segurança",config:"Globais"}[x])}</button>`).join("")}
      </div>

      <div class="sjmDevSection active" data-devsection="dashboard">
        <div class="sjmDevGrid">
          <div class="sjmDevCard"><h3>Total de profissionais</h3><div class="sjmDevBig">${m.users.length}</div></div>
          <div class="sjmDevCard"><h3>Clientes cadastrados</h3><div class="sjmDevBig">${(s.clientes||[]).length}</div></div>
          <div class="sjmDevCard"><h3>MRR</h3><div class="sjmDevBig">${moneyV72(m.mrr)}</div></div>
          <div class="sjmDevCard"><h3>ARR</h3><div class="sjmDevBig">${moneyV72(m.arr)}</div></div>
          <div class="sjmDevCard"><h3>Plano mais vendido</h3><div class="sjmDevBig">${planLabel[m.mostPlan]}</div></div>
          <div class="sjmDevCard"><h3>Teste 7 dias</h3><div class="sjmDevBig">${m.byPlan.trial.q}</div></div>
          <div class="sjmDevCard"><h3>Bloqueados</h3><div class="sjmDevBig">${m.byPlan.bloqueado.q}</div></div>
          <div class="sjmDevCard"><h3>Erro mais reclamado</h3><div class="sjmDevBig">${m.topError?escV72(m.topError[0]):"—"}</div></div>
        </div>
        <div class="sjmDevGrid3">
          <div class="sjmDevCard"><h3>Crescimento</h3><p>Novos cadastros: <b>${m.users.filter(u=>daysBetweenV72(u.criadoEm)<=30).length}</b> nos últimos 30 dias.</p><p>Taxa estimada: <b>${m.users.length?Math.round((m.users.filter(u=>u.status==="ativo").length/m.users.length)*100):0}% ativos</b></p></div>
          <div class="sjmDevCard"><h3>Receita por plano</h3>${["basic","pro","premium"].map(k=>`<div class="sjmFeatureLine"><span>${planLabel[k]}: ${m.byPlan[k].q} profissional(is)</span><b>${moneyV72(m.byPlan[k].valor)}</b></div>`).join("")}</div>
          <div class="sjmDevCard"><h3>Status do sistema</h3><div class="sjmFeatureLine"><span>Firebase</span><b>Pronto</b></div><div class="sjmFeatureLine"><span>WhatsApp</span><b>Link ativo</b></div><div class="sjmFeatureLine"><span>Backup</span><b>Disponível</b></div><div class="sjmFeatureLine"><span>Versão</span><b>v72</b></div></div>
        </div>
      </div>

      <div class="sjmDevSection" data-devsection="clientes">
        <div class="sjmDevCard"><h3>Gerenciamento de clientes/profissionais SaaS</h3>
          <div class="row"><input id="devNovoNome" placeholder="Nome do studio/profissional"><input id="devNovoEmail" placeholder="E-mail"><select id="devNovoPlano"><option value="basic">Básico</option><option value="pro">Pro</option><option value="premium">Premium</option><option value="trial">Teste 7 dias</option></select><button class="btn" id="devCriarCliente" type="button">Criar cliente</button></div>
          <table class="sjmMiniTable"><thead><tr><th>Nome</th><th>E-mail</th><th>Plano</th><th>Status</th><th>Clientes</th><th>Último login</th><th>Ações</th></tr></thead><tbody>${m.users.map((u,i)=>`<tr><td>${escV72(u.nome)}</td><td>${escV72(u.email||"")}</td><td>${planLabel[planKeyV72(u.plano)]||u.plano}</td><td>${escV72(u.status||"ativo")}</td><td>${u.clientes||0}</td><td>${u.ultimoLogin?new Date(u.ultimoLogin).toLocaleString("pt-BR"):"—"}</td><td><button class="btn btn--ghost" data-dev-act="toggle" data-i="${i}">${u.status==="bloqueado"?"Ativar":"Bloquear"}</button> <button class="btn btn--ghost" data-dev-act="reset" data-i="${i}">Reset senha</button> <button class="btn btn--ghost" data-dev-act="login" data-i="${i}">Entrar</button></td></tr>`).join("")}</tbody></table>
        </div>
      </div>

      <div class="sjmDevSection" data-devsection="planos">
        <div class="sjmDevGrid3">${["basic","pro","premium"].map(k=>`<div class="sjmDevCard"><h3>Plano ${planLabel[k]}</h3><label class="field"><span>Preço mensal</span><input type="number" step="0.01" id="devPreco_${k}" value="${s.dev.planos[k].preco}"></label><label class="field"><span>Limite de usuários</span><input type="number" id="devUsers_${k}" value="${s.dev.planos[k].maxUsuarios}"></label><label class="field"><span>Limite de clientes</span><input type="number" id="devClientes_${k}" value="${s.dev.planos[k].maxClientes}"></label><label class="field"><span>Recursos</span><textarea id="devRecursos_${k}" rows="4">${(s.dev.planos[k].recursos||[]).join(", ")}</textarea></label></div>`).join("")}</div>
        <div class="sjmDevCard"><label class="field"><span>Período de teste padrão</span><input id="devTrialDias" type="number" value="${s.dev.trialDias}"></label><button class="btn" id="devSalvarPlanos" type="button">Salvar planos e limites</button></div>
      </div>

      <div class="sjmDevSection" data-devsection="financeiro">
        <div class="sjmDevGrid"><div class="sjmDevCard"><h3>Receita mensal</h3><div class="sjmDevBig">${moneyV72(m.mrr)}</div></div><div class="sjmDevCard"><h3>Pagamentos recebidos</h3><div class="sjmDevBig">${moneyV72(m.mrr)}</div></div><div class="sjmDevCard"><h3>Cancelados</h3><div class="sjmDevBig">${m.users.filter(u=>u.status==="cancelado").length}</div></div><div class="sjmDevCard"><h3>Inadimplentes</h3><div class="sjmDevBig">${m.users.filter(u=>u.status==="inadimplente").length}</div></div></div>
        <div class="sjmDevCard"><h3>Base de dados por grupo/plano</h3><table class="sjmMiniTable"><thead><tr><th>Plano</th><th>Profissionais</th><th>Valor mensal</th><th>Valor anual</th></tr></thead><tbody>${["basic","pro","premium","trial","bloqueado"].map(k=>`<tr><td>${planLabel[k]}</td><td>${m.byPlan[k].q}</td><td>${moneyV72(m.byPlan[k].valor)}</td><td>${moneyV72(m.byPlan[k].valor*12)}</td></tr>`).join("")}</tbody></table></div>
      </div>

      <div class="sjmDevSection" data-devsection="suporte">
        <div class="sjmDevGrid3"><div class="sjmDevCard"><h3>Chamados abertos</h3><div class="sjmDevBig">${s.dev.suporte.filter(x=>x.status!=="Resolvido").length}</div></div><div class="sjmDevCard"><h3>Tempo médio</h3><div class="sjmDevBig">—</div></div><div class="sjmDevCard"><h3>Histórico</h3><div class="sjmDevBig">${s.dev.suporte.length}</div></div></div>
        <div class="sjmDevCard"><h3>Registrar chamado</h3><input id="devChamadoTitulo" placeholder="Título"><textarea id="devChamadoDesc" placeholder="Descrição do atendimento"></textarea><select id="devChamadoStatus"><option>Aberto</option><option>Em atendimento</option><option>Resolvido</option></select><button class="btn" id="devSalvarChamado">Registrar chamado</button></div>
        <div class="sjmDevCard"><h3>Chamados / histórico</h3>${s.dev.suporte.map(x=>`<div class="simpleItem"><b>${escV72(x.titulo)}</b> — ${escV72(x.status)}<br><small>${escV72(x.desc||"")}</small></div>`).join("") || '<div class="hint">Nenhum chamado registrado.</div>'}</div>
      </div>

      <div class="sjmDevSection" data-devsection="erros">
        <div class="sjmDevCard"><h3>Central de erros e reclamações</h3><input id="devBugTitulo" placeholder="Ex.: erro ao salvar cor"><textarea id="devBugDesc" placeholder="Descrição"></textarea><div class="row"><select id="devBugPrioridade"><option>Baixa</option><option selected>Média</option><option>Alta</option><option>Crítica</option></select><select id="devBugStatus"><option>Aberto</option><option>Em análise</option><option>Resolvido</option></select></div><button class="btn" id="devSalvarBug">Salvar bug</button></div>
        <div class="sjmDevCard"><h3>Principais erros reclamados</h3>${s.dev.bugs.length ? s.dev.bugs.map(x=>`<div class="simpleItem"><b>${escV72(x.titulo)}</b> — ${escV72(x.prioridade)} — ${escV72(x.status)}</div>`).join("") : '<div class="hint">Nenhum bug anotado.</div>'}</div>
      </div>

      <div class="sjmDevSection" data-devsection="monitoramento">
        <div class="sjmDevGrid"><div class="sjmDevCard"><h3>Usuários online</h3><div class="sjmDevBig">${m.users.filter(u=>u.status==="ativo").length}</div></div><div class="sjmDevCard"><h3>Últimos logins</h3><div class="sjmDevBig">${m.users.filter(u=>u.ultimoLogin).length}</div></div><div class="sjmDevCard"><h3>Uso de armazenamento</h3><div class="sjmDevBig">${Math.round((JSON.stringify(s).length/1024))} KB</div></div><div class="sjmDevCard"><h3>Banco de dados</h3><div class="sjmDevBig">${(s.clientes||[]).length + (s.agenda||[]).length + (s.atendimentos||[]).length}</div></div></div>
      </div>

      <div class="sjmDevSection" data-devsection="marketing">
        <div class="sjmDevCard"><h3>Marketing SaaS</h3><textarea id="devMsgTodos" placeholder="Mensagem para todos os clientes/profissionais"></textarea><button class="btn" id="devEnviarNotificacao">Registrar notificação</button></div>
        <div class="sjmDevCard"><h3>Feature flags</h3>${Object.entries(s.dev.featureFlags).map(([k,v])=>`<label class="sjmFeatureLine"><span>${escV72(k)}</span><input type="checkbox" data-flag="${escV72(k)}" ${v?"checked":""}></label>`).join("")}</div>
      </div>

      <div class="sjmDevSection" data-devsection="seguranca">
        <div class="sjmDevCard"><h3>Segurança e auditoria</h3><div class="sjmFeatureLine"><span>Autenticação em dois fatores</span><b>Preparado</b></div><div class="sjmFeatureLine"><span>Controle de permissões</span><b>Ativo</b></div><div class="sjmFeatureLine"><span>Backup e restauração</span><b>Ativo</b></div></div>
        <div class="sjmDevCard"><h3>Logs recentes</h3>${s.dev.logs.slice(0,25).map(x=>`<div class="simpleItem"><b>${new Date(x.data).toLocaleString("pt-BR")}</b> — ${escV72(x.action)} ${x.details?`<br><small>${escV72(x.details)}</small>`:""}</div>`).join("") || '<div class="hint">Nenhum log registrado.</div>'}</div>
      </div>

      <div class="sjmDevSection" data-devsection="config">
        <div class="sjmDevCard"><h3>Configurações globais</h3><label class="field"><span>Nome do aplicativo</span><input id="devAppNome" value="Studio Sync Pro"></label><label class="field"><span>E-mail do sistema</span><input id="devEmailSistema" value="${escV72(s.dev.emailSistema||"suporte@studiosyncpro.com")}"></label><label class="field"><span>Integrações</span><textarea id="devIntegracoes" rows="4">${escV72(s.dev.integracoes||"Firebase, WhatsApp, Pagamentos")}</textarea></label><button class="btn" id="devSalvarGlobais">Salvar globais</button></div>
      </div>
    `;
    bindDevV72();
  }

  function bindDevV72(){
    const root = $id("devProRoot") || document.querySelector('[data-route="desenvolvedor"]');
    if(!root || root.__v72) return;
    root.__v72 = true;
    root.addEventListener("click", (e)=>{
      const nav = e.target.closest("[data-devtab]");
      if(nav){
        const tab = nav.dataset.devtab;
        $$q("[data-devtab]", root).forEach(b=>b.classList.toggle("active", b===nav));
        $$q("[data-devsection]", root).forEach(s=>s.classList.toggle("active", s.dataset.devsection===tab));
        return;
      }
      const s = ensureV72();
      if(e.target.id==="devCriarCliente"){
        const nome = normV72($id("devNovoNome")?.value);
        if(!nome){ alert("Informe o nome."); return; }
        const plano = $id("devNovoPlano")?.value || "trial";
        s.dev.profissionaisSaaS.unshift({id:"dev_"+Date.now(), nome, email:$id("devNovoEmail")?.value||"", plano: plano==="trial"?"premium":plano, status: plano==="trial"?"teste":"ativo", testeDias: plano==="trial"?s.dev.trialDias:0, criadoEm:todayV72(), ultimoLogin:"", clientes:0, agendamentos:0, versao:"v72"});
        logDevV72("Cliente SaaS criado", nome);
        renderDevV72(); return;
      }
      const act = e.target.closest("[data-dev-act]");
      if(act){
        const users = buildSaaSUsersV72();
        const i = Number(act.dataset.i);
        const u = users[i];
        if(!u) return;
        if(u.id==="studio_atual"){ alert("Conta atual protegida."); return; }
        const real = s.dev.profissionaisSaaS.find(x=>x.id===u.id);
        if(!real) return;
        if(act.dataset.devAct==="toggle"){ real.status = real.status==="bloqueado"?"ativo":"bloqueado"; logDevV72("Status alterado", real.nome); }
        if(act.dataset.devAct==="reset"){ real.senhaResetadaEm = new Date().toISOString(); alert("Senha resetada ✅"); logDevV72("Senha resetada", real.nome); }
        if(act.dataset.devAct==="login"){ real.ultimoLoginComoAdmin = new Date().toISOString(); alert("Login como administrador registrado ✅"); logDevV72("Login como admin", real.nome); }
        saveV72("dev-action"); renderDevV72(); return;
      }
      if(e.target.id==="devSalvarPlanos"){
        ["basic","pro","premium"].forEach(k=>{
          s.dev.planos[k].preco = Number($id("devPreco_"+k)?.value || s.dev.planos[k].preco);
          s.dev.planos[k].maxUsuarios = Number($id("devUsers_"+k)?.value || s.dev.planos[k].maxUsuarios);
          s.dev.planos[k].maxClientes = Number($id("devClientes_"+k)?.value || s.dev.planos[k].maxClientes);
          s.dev.planos[k].recursos = String($id("devRecursos_"+k)?.value || "").split(",").map(x=>x.trim()).filter(Boolean);
        });
        s.dev.trialDias = Number($id("devTrialDias")?.value || 7) || 7;
        logDevV72("Planos atualizados");
        renderDevV72(); alert("Planos salvos ✅"); return;
      }
      if(e.target.id==="devSalvarChamado"){
        s.dev.suporte.unshift({titulo:$id("devChamadoTitulo")?.value||"Chamado", desc:$id("devChamadoDesc")?.value||"", status:$id("devChamadoStatus")?.value||"Aberto", data:new Date().toISOString()});
        logDevV72("Chamado registrado");
        renderDevV72(); return;
      }
      if(e.target.id==="devSalvarBug"){
        s.dev.bugs.unshift({titulo:$id("devBugTitulo")?.value||"Bug", desc:$id("devBugDesc")?.value||"", prioridade:$id("devBugPrioridade")?.value||"Média", status:$id("devBugStatus")?.value||"Aberto", data:new Date().toISOString(), versao:"v72"});
        logDevV72("Bug registrado");
        renderDevV72(); return;
      }
      if(e.target.id==="devEnviarNotificacao"){
        s.dev.campanhas.unshift({tipo:"notificação", msg:$id("devMsgTodos")?.value||"", data:new Date().toISOString()});
        logDevV72("Notificação registrada");
        alert("Notificação registrada ✅"); return;
      }
      if(e.target.id==="devSalvarGlobais"){
        s.dev.emailSistema = $id("devEmailSistema")?.value||"";
        s.dev.integracoes = $id("devIntegracoes")?.value||"";
        logDevV72("Configurações globais salvas");
        alert("Configurações globais salvas ✅"); return;
      }
      if(e.target.matches("[data-flag]")){
        const flag = e.target.dataset.flag;
        s.dev.featureFlags[flag] = e.target.checked;
        logDevV72("Feature flag alterada", flag);
      }
    });
  }

  function ensureDevRouteV72(){
    const tabs = $id("tabs") || document.querySelector(".tabs");
    if(false && tabs && localStorage.getItem("studio_sync_role")==="developer"){
      let btn = tabs.querySelector('.tab[data-tab="desenvolvedor"]');
      if(!btn){
        btn = document.createElement("button");
        btn.className = "tab";
        btn.dataset.tab = "desenvolvedor";
        btn.textContent = "Dev";
        tabs.appendChild(btn);
      }
      btn.style.display = "";
    }
    document.addEventListener("click", function(e){
      const dev = e.target.closest && e.target.closest('.tab[data-tab="desenvolvedor"]');
      if(!dev) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      window.__SJM_DEV_UNLOCKED = false;
      window.__SJM_IS_DEVELOPER = false;
      alert("Área de desenvolvedor removida desta versão cliente.");
      return;
    }, true);
  }

  function bootV72(){
    ensureV72();
    bindConfigV72();
    bindImportV72();
    bindAutoAgV72();
    patchDashboardRewardsV72();
    ensureDevRouteV72();
    if(location.hash === "#fidelidade" || document.querySelector('[data-route="fidelidade"].active')) renderFidelidadeV72();
    if(location.hash === "#desenvolvedor" || document.querySelector('[data-route="desenvolvedor"].active')) renderDevV72();
  }

  document.addEventListener("DOMContentLoaded", ()=>[80,300].forEach(t=>setTimeout(bootV72,t)));
  window.addEventListener("load", ()=>[80,300].forEach(t=>setTimeout(bootV72,t)));
  /* Studio Sync Pro Limpa Estável: removido boot em todo clique para não travar digitação/edição */
  setInterval(()=>{ 
    patchDashboardRewardsV72(); 
    if(location.hash==="#autoagendamento") patchAutoAgV72();
  }, 2500);

  window.__SJM_V72_BOOT = bootV72;
  window.__SJM_V72_RENDER_DEV = renderDevV72;
  window.__SJM_V72_RENDER_FIDELIDADE = renderFidelidadeV72;
})();


/* =========================================================
   STUDIO SYNC PRO — LIMPA ESTÁVEL 1.0
   Patch final consolidado:
   - Fidelidade salva Ativado/Desativado sem re-render em clique.
   - Campanhas desativadas escondem listas, prévias e alertas.
   - Área Dev substituída por painel completo e estável.
   - Eventos delegados para evitar duplicação e travamento de digitação.
   ========================================================= */
(function(){
  const FINAL_BUILD = "Studio Sync Pro — Limpa Estável 1.0";
  window.__SJM_FINAL_BUILD = FINAL_BUILD;
  const $ = (id)=>document.getElementById(id);
  const qa = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
  const brl = (v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const esc = (v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n = (v)=>{ const x=Number(String(v??'').replace(',','.')); return Number.isFinite(x)?x:0; };
  const boolFinal = (v, def=true)=>{
    if(v === true || v === false) return v;
    const t = String(v ?? '').trim().toLowerCase();
    if(['false','0','nao','não','desativado','off'].includes(t)) return false;
    if(['true','1','sim','ativado','on'].includes(t)) return true;
    return def;
  };
  const today = ()=>new Date().toISOString().slice(0,10);
  const isActiveRoute = (r)=>location.hash===`#${r}` || document.querySelector(`[data-route="${r}"].active`);

  function getState(){ try{return state;}catch(e){return window.__SJM_GET_STATE?.() || window.state;} }
  function persist(reason){
    const s=getState(); if(!s) return;
    s.meta=s.meta||{}; s.meta.updatedAt=Date.now(); s.meta.build=FINAL_BUILD; s.meta.reason=reason||'final-stable';
    try{ if(typeof saveSoft==='function') saveSoft(); }catch(e){}
    try{ localStorage.setItem('studio_sync_pro_limpa_estavel_1', JSON.stringify(s)); }catch(e){}
    try{ if(typeof scheduleSync==='function') scheduleSync(); }catch(e){}
    try{ if(typeof scheduleCloudPush==='function') scheduleCloudPush(); }catch(e){}
  }
  function ensure(){
    const s=getState(); if(!s) return null;
    s.settings=s.settings||{};
    s.settings.plano=String(s.settings.plano||'premium').toLowerCase();
    s.fidelidade=(s.fidelidade&&typeof s.fidelidade==='object')?s.fidelidade:{};
    s.fidelidade.campanhaCartaoAtiva = boolFinal(s.fidelidade.campanhaCartaoAtiva, true);
    s.fidelidade.programaIndicacaoAtivo = boolFinal(s.fidelidade.programaIndicacaoAtivo, true);
    s.fidelidade.cashbackAtivo = boolFinal(s.fidelidade.cashbackAtivo, false);
    s.fidelidade.selos=n(s.fidelidade.selos)||10;
    s.fidelidade.iniciais=n(s.fidelidade.iniciais);
    if(!Number.isFinite(s.fidelidade.iniciais)) s.fidelidade.iniciais=2;
    s.fidelidade.resetDias=n(s.fidelidade.resetDias)||31;
    s.fidelidade.validadeInicio=s.fidelidade.validadeInicio||'';
    s.fidelidade.validadeFim=s.fidelidade.validadeFim||'';
    s.fidelidade.tipoRecompensa=s.fidelidade.tipoRecompensa||'Serviço gratuito';
    s.fidelidade.recompensa=s.fidelidade.recompensa||'1 manutenção grátis';
    s.fidelidade.regraRecompensa=s.fidelidade.regraRecompensa||'Recompensa válida quando completar todos os selos.';
    s.fidelidade.premiados=Array.isArray(s.fidelidade.premiados)?s.fidelidade.premiados:[];
    s.fidelidade.historicoRecompensas=Array.isArray(s.fidelidade.historicoRecompensas)?s.fidelidade.historicoRecompensas:[];
    s.marketing=(s.marketing&&typeof s.marketing==='object')?s.marketing:{};
    s.marketing.indicacoes=Array.isArray(s.marketing.indicacoes)?s.marketing.indicacoes:[];
    s.dev=(s.dev&&typeof s.dev==='object')?s.dev:{};
    s.dev.logs=Array.isArray(s.dev.logs)?s.dev.logs:[];
    s.dev.bugs=Array.isArray(s.dev.bugs)?s.dev.bugs:[];
    s.dev.suporte=Array.isArray(s.dev.suporte)?s.dev.suporte:[];
    s.dev.profissionaisSaaS=Array.isArray(s.dev.profissionaisSaaS)?s.dev.profissionaisSaaS:[];
    s.dev.trialDias=n(s.dev.trialDias)||7;
    s.dev.planos=s.dev.planos||{
      basic:{nome:'Básico',preco:29.90,maxClientes:100,maxFotos:50,crm:false,equipe:false,exportacao:false},
      pro:{nome:'Pro',preco:59.90,maxClientes:500,maxFotos:200,crm:true,equipe:false,exportacao:true},
      premium:{nome:'Premium',preco:99.90,maxClientes:5000,maxFotos:5000,crm:true,equipe:true,exportacao:true}
    };
    return s;
  }
  function log(action,detail){ const s=ensure(); if(!s) return; s.dev.logs.unshift({data:new Date().toISOString(),action,detail:detail||'',build:FINAL_BUILD}); s.dev.logs=s.dev.logs.slice(0,250); persist('log'); }

  function lastDoneFor(nome){
    const s=ensure(); const key=String(nome||'').trim().toLowerCase();
    const rows=(s.atendimentos||[]).filter(a=>String(a.cliente||'').trim().toLowerCase()===key);
    return rows.map(a=>a.data).filter(Boolean).sort().pop()||'';
  }
  function loyalty(nome){
    const s=ensure(); const key=String(nome||'').trim().toLowerCase();
    const atend=(s.atendimentos||[]).filter(a=>String(a.cliente||'').trim().toLowerCase()===key);
    const selos=n(s.fidelidade.selos)||10; const inic=n(s.fidelidade.iniciais)||0;
    const atual=Math.min(selos, inic+atend.length); const faltam=Math.max(0, selos-atual);
    return {atual,faltam,ultima:lastDoneFor(nome),completo:faltam===0};
  }
  function clearRewardAlerts(){ qa('.sjmRewardAlert,.finalRewardAlert').forEach(x=>x.remove()); }
  function patchDashboard(){
    const s=ensure(); if(!s) return; clearRewardAlerts();
    if(s.fidelidade.campanhaCartaoAtiva===false) return;
    const rewards=(s.clientes||[]).map(c=>({c,...loyalty(c.nome)})).filter(x=>x.completo);
    if(!rewards.length) return;
    const root=qa('.box,.card,.panel').find(el=>/alertas rápidos|alertas rapidos/i.test(el.textContent||''));
    if(!root) return;
    const div=document.createElement('div'); div.className='finalRewardAlert sjmRewardAlert';
    div.innerHTML=`🎁 <b>${rewards.length} cliente(s) com recompensa pendente:</b><br>${rewards.slice(0,8).map(x=>`${esc(x.c.nome)} — ${esc(s.fidelidade.recompensa)}`).join('<br>')}`;
    root.insertBefore(div, root.children[1]||null);
  }

  function renderFidelidadeFinal(){
    const s=ensure(); const sec=document.querySelector('[data-route="fidelidade"]'); if(!s||!sec) return;
    const cardOn=s.fidelidade.campanhaCartaoAtiva!==false;
    const indRaw=s.fidelidade.programaIndicacaoAtivo;
    const indOn=!(indRaw===false || String(indRaw).toLowerCase()==='false' || String(indRaw).toLowerCase()==='desativado');
    const cashOn=s.fidelidade.cashbackAtivo===true;
    const clientes=(s.clientes||[]).map(c=>({c,...loyalty(c.nome)}));
    const proximas=clientes.filter(x=>cardOn && x.faltam<=2).slice(0,12);
    const premiadas=clientes.filter(x=>cardOn && x.completo).slice(0,12);
    sec.innerHTML=`
      <div class="panel__head"><h2>Fidelidade e Indicações</h2><p>Campanhas, cartão de selos, recompensas, WhatsApp e programa de indicação.</p></div>
      <div class="grid2">
        <div class="box"><h3>Configuração do cartão</h3>
          <div class="row">
            <label class="field"><span>Cartão fidelidade</span><select id="fidCampanhaAtiva"><option value="true" ${cardOn?'selected':''}>Ativado</option><option value="false" ${!cardOn?'selected':''}>Desativado</option></select></label>
          </div>
          ${cardOn ? `
            <div class="row">
              <label class="field"><span>Tipo de recompensa</span><select id="fidTipoRecompensa"><option ${s.fidelidade.tipoRecompensa==='Serviço gratuito'?'selected':''}>Serviço gratuito</option><option ${s.fidelidade.tipoRecompensa==='Desconto'?'selected':''}>Desconto</option><option ${s.fidelidade.tipoRecompensa==='Brinde'?'selected':''}>Brinde</option><option ${s.fidelidade.tipoRecompensa==='Selo extra'?'selected':''}>Selo extra</option></select></label>
              <label class="field"><span>Data de início</span><input id="fidInicio" type="date" value="${esc(s.fidelidade.validadeInicio)}"></label>
            </div>
            <div class="row">
              <label class="field"><span>Data final</span><input id="fidFim" type="date" value="${esc(s.fidelidade.validadeFim)}"></label>
              <label class="field"><span>Selos necessários</span><input id="fidSelos" type="number" min="1" value="${esc(s.fidelidade.selos)}"></label>
            </div>
            <div class="row">
              <label class="field"><span>Selos iniciais</span><input id="fidIniciais" type="number" min="0" value="${esc(s.fidelidade.iniciais)}"></label>
              <label class="field"><span>Reiniciar após dias sem atendimento</span><input id="fidResetDias" type="number" min="1" value="${esc(s.fidelidade.resetDias)}"></label>
            </div>
            <label class="field"><span>Recompensa</span><input id="fidRecompensa" value="${esc(s.fidelidade.recompensa)}"></label>
            <label class="field"><span>Regra da recompensa</span><textarea id="fidRegraRecompensa" rows="3">${esc(s.fidelidade.regraRecompensa)}</textarea></label>
          ` : `<div class="hint">Cartão fidelidade desativado. Configurações, lista, alertas e tabela ficam ocultos.</div>`}
          <button class="btn" id="btnSalvarFidelidade" type="button">Salvar fidelidade</button>
          <p id="fidStatusLine" class="hint">${cardOn?'✅ Cartão fidelidade ativo.':'⚠️ Cartão fidelidade desativado.'} ${indOn?'✅ Programa de indicação ativo.':'⚠️ Programa de indicação desativado.'} ${cashOn?'✅ Cashback ativo.':'⚠️ Cashback desativado.'}</p>
        </div>
        <div class="box"><h3>Clientes próximas da recompensa</h3>
          ${cardOn ? (proximas.map(x=>`<div class="simpleItem"><b>${esc(x.c.nome)}</b> faltam ${x.faltam} selo(s).</div>`).join('') || '<div class="hint">Nenhuma cliente próxima da recompensa.</div>') : '<div class="hint">Cartão fidelidade desativado. Lista e alertas ocultos.</div>'}
          ${cardOn ? `<h3 style="margin-top:14px">Clientes premiadas</h3>${premiadas.map(x=>`<div class="simpleItem">🎁 <b>${esc(x.c.nome)}</b> — ${esc(s.fidelidade.recompensa)}</div>`).join('') || '<div class="hint">Nenhuma cliente premiada.</div>'}` : ''}
        </div>
      </div>
      <div class="grid2" style="margin-top:12px">
        <div class="box"><h3>Programa de indicação</h3>
          <label class="field"><span>Programa de indicação</span><select id="fidIndicacaoAtiva"><option value="true" ${indOn?'selected':''}>Ativado</option><option value="false" ${!indOn?'selected':''}>Desativado</option></select></label>
          ${indOn ? `<div class="row"><input id="indCliente" placeholder="Cliente que indicou"><input id="indAmiga" placeholder="Cliente indicada"></div><button class="btn" id="btnAddIndicacao" type="button">Registrar indicação</button><div id="indList" class="simpleList">${(s.marketing.indicacoes||[]).map(x=>`<div class="simpleItem"><b>${esc(x.cliente)}</b> indicou ${esc(x.amiga)}</div>`).join('') || '<div class="hint">Sem indicações registradas.</div>'}</div>` : '<div class="hint">Programa de indicação desativado. Campos e ranking ocultos.</div>'}
        </div>
        <div class="box"><h3>Campanha extra / Cashback</h3>
          <label class="field"><span>Cashback</span><select id="fidCashbackAtivo"><option value="true" ${cashOn?'selected':''}>Ativado</option><option value="false" ${!cashOn?'selected':''}>Desativado</option></select></label>
          ${cashOn ? `<label class="field"><span>Recompensa para quem mais indica</span><input id="fidPremioIndicacao" value="${esc(s.fidelidade.premioIndicacao||'Brinde, desconto ou selo extra')}"></label><label class="field"><span>Regras definidas pela profissional</span><textarea id="fidRegrasIndicacao" rows="4">${esc(s.fidelidade.regrasIndicacao||'A indicação só conta após a cliente indicada realizar o primeiro atendimento.')}</textarea></label>` : '<div class="hint">Cashback desativado. Regras e prévias ocultas.</div>'}
        </div>
      </div>
      <div class="tableWrap" style="margin-top:12px"><table class="table" id="tblFidelidade"><thead><tr><th>Cliente</th><th>Selos</th><th>Faltam</th><th>Último atendimento</th><th>Status</th><th>Ação</th></tr></thead><tbody>${cardOn ? clientes.map(x=>`<tr><td>${esc(x.c.nome)}</td><td>${'⭐'.repeat(Math.min(x.atual,10))} ${x.atual}/${s.fidelidade.selos}</td><td>${x.faltam}</td><td>${x.ultima||'—'}</td><td>${x.completo?'Recompensa pendente':'Em andamento'}</td><td><button class="btn btn--ghost" data-fid-wpp="${esc(x.c.nome)}">WhatsApp</button></td></tr>`).join('') : `<tr><td colspan="6">Cartão fidelidade desativado. Tabela oculta para a profissional.</td></tr>`}</tbody></table></div>`;
    bindFidelidadeFinal();
  }
  function bindFidelidadeFinal(){
    const sec=document.querySelector('[data-route="fidelidade"]'); if(!sec||sec.__finalFidBound) return; sec.__finalFidBound=true;
    sec.addEventListener('click',e=>{
      const s=ensure();
      if(e.target.id==='btnSalvarFidelidade'){
        s.fidelidade.campanhaCartaoAtiva=$('fidCampanhaAtiva')?.value==='true';
        if($('fidIndicacaoAtiva')) s.fidelidade.programaIndicacaoAtivo=$('fidIndicacaoAtiva')?.value==='true';
        if($('fidCashbackAtivo')) s.fidelidade.cashbackAtivo=$('fidCashbackAtivo')?.value==='true';
        if($('fidTipoRecompensa')) s.fidelidade.tipoRecompensa=$('fidTipoRecompensa')?.value||'Serviço gratuito';
        if($('fidInicio')) s.fidelidade.validadeInicio=$('fidInicio')?.value||'';
        if($('fidFim')) s.fidelidade.validadeFim=$('fidFim')?.value||'';
        if($('fidSelos')) s.fidelidade.selos=n($('fidSelos')?.value)||10;
        if($('fidIniciais')) s.fidelidade.iniciais=n($('fidIniciais')?.value)||0;
        if($('fidResetDias')) s.fidelidade.resetDias=n($('fidResetDias')?.value)||31;
        if($('fidRecompensa')) s.fidelidade.recompensa=$('fidRecompensa')?.value||'1 manutenção grátis';
        if($('fidRegraRecompensa')) s.fidelidade.regraRecompensa=$('fidRegraRecompensa')?.value||'';
        if($('fidPremioIndicacao')) s.fidelidade.premioIndicacao=$('fidPremioIndicacao')?.value||s.fidelidade.premioIndicacao||'';
        if($('fidRegrasIndicacao')) s.fidelidade.regrasIndicacao=$('fidRegrasIndicacao')?.value||s.fidelidade.regrasIndicacao||'';
        persist('fidelidade'); clearRewardAlerts(); renderFidelidadeFinal(); patchDashboard(); alert('Fidelidade salva ✅'); return;
      }
      if(e.target.id==='btnAddIndicacao'){
        if(s.fidelidade.programaIndicacaoAtivo===false){ alert('Programa de indicação está desativado.'); return; }
        const cliente=$('indCliente')?.value?.trim(); const amiga=$('indAmiga')?.value?.trim();
        if(!cliente||!amiga){ alert('Preencha cliente que indicou e cliente indicada.'); return; }
        s.marketing.indicacoes.unshift({cliente, amiga, data:today(), status:'registrada'}); persist('indicacao'); renderFidelidadeFinal(); return;
      }
      const w=e.target.closest('[data-fid-wpp]');
      if(w){ const nome=w.dataset.fidWpp; const c=(getState().clientes||[]).find(x=>String(x.nome||'').toLowerCase()===String(nome||'').toLowerCase()); const f=loyalty(nome); const txt=String(getState().wpp?.tplFidelidade||'Parabéns, {cliente}! Você ganhou mais um selo no cartão fidelidade de {studio}.').replaceAll('{cliente}',nome).replaceAll('{studio}',getState().settings?.studioNome||'Studio').replaceAll('{selo}',String(f.atual)).replaceAll('{faltam}',String(f.faltam)); const phone=c?.wpp||c?.tel||''; if(phone&&typeof waLink==='function') window.open(waLink(phone,txt),'_blank'); else alert('Cliente sem WhatsApp.'); }
    });
    sec.addEventListener('change', e=>{
      const s=ensure();
      if(e.target.id==='fidCampanhaAtiva'){
        s.fidelidade.campanhaCartaoAtiva = e.target.value === 'true';
        persist('fidelidade-toggle');
        renderFidelidadeFinal();
        patchDashboard();
      }
      if(e.target.id==='fidIndicacaoAtiva'){
        s.fidelidade.programaIndicacaoAtivo = e.target.value === 'true';
        persist('indicacao-toggle');
        renderFidelidadeFinal();
      }
      if(e.target.id==='fidCashbackAtivo'){
        s.fidelidade.cashbackAtivo = e.target.value === 'true';
        persist('cashback-toggle');
        renderFidelidadeFinal();
      }
    });
  }

  function devMetrics(){
    const s=ensure(); const receita=(s.atendimentos||[]).reduce((a,x)=>a+n(x.recebido||x.valor),0)+(s.receitasExtras||[]).reduce((a,x)=>a+n(x.valor),0); const despesas=(s.despesas||[]).reduce((a,x)=>a+n(x.valor),0); const custos=(s.atendimentos||[]).reduce((a,x)=>a+n(x.custoMaterial)+n(x.maoObra),0); const profs=[{nome:'Profissional principal',plano:s.settings.plano||'premium',status:'ativo',clientes:(s.clientes||[]).length,whatsapp:s.settings.whatsapp||s.settings.wpp||''},...(s.dev.profissionaisSaaS||[])];
    return {receita,despesas,custos,lucro:receita-despesas-custos,profs,storage:Math.round(JSON.stringify(s).length/1024)};
  }
  function renderDevFinal(){
    const s=ensure(); const sec=document.querySelector('[data-route="desenvolvedor"]'); if(!s||!sec) return; const m=devMetrics();
    sec.innerHTML=`
      <style>.devStableNav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.devStableNav button.active{background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff}.devGrid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px}.devCard{background:#fff;border:1px solid #edf0f5;border-radius:18px;padding:16px;box-shadow:0 6px 22px rgba(20,20,50,.06);margin-bottom:12px}.devBig{font-size:28px;font-weight:800}.devSection{display:none}.devSection.active{display:block}.devTable{width:100%;border-collapse:separate;border-spacing:0 8px}.devTable th{text-align:left;background:#263043;color:#fff;padding:10px}.devTable td{background:#f7f9fc;padding:10px}.devActions{display:flex;gap:8px;flex-wrap:wrap}.devStatus{display:inline-block;padding:4px 10px;border-radius:99px;background:#eef7ef;color:#17692d;font-weight:700}</style>
      <div class="panel__head"><h2>Desenvolvedor / Suporte Master</h2><p>Painel interno completo para planos, profissionais, diagnóstico, backups, logs, suporte, bugs e monitoramento.</p></div>
      <div class="devGrid"><div class="devCard"><b>Build</b><div class="devBig">1.0</div><small>${FINAL_BUILD}</small></div><div class="devCard"><b>Profissionais</b><div class="devBig">${m.profs.length}</div><small>${m.profs.filter(p=>p.status!=='bloqueado').length} ativos</small></div><div class="devCard"><b>Clientes cadastrados</b><div class="devBig">${(s.clientes||[]).length}</div><small>base atual</small></div><div class="devCard"><b>Receita SaaS estimada</b><div class="devBig">${brl((s.dev.planos?.premium?.preco||99.90)*m.profs.filter(p=>p.status!=='bloqueado').length)}</div><small>mensal</small></div></div>
      <div class="devStableNav"><button class="btn active" data-dev-final="visao">Visão geral</button><button class="btn btn--ghost" data-dev-final="planos">Planos</button><button class="btn btn--ghost" data-dev-final="profissionais">Profissionais</button><button class="btn btn--ghost" data-dev-final="suporte">Suporte</button><button class="btn btn--ghost" data-dev-final="bugs">Bugs</button><button class="btn btn--ghost" data-dev-final="diagnostico">Diagnóstico</button><button class="btn btn--ghost" data-dev-final="logs">Logs</button></div>
      <div class="devSection active" data-dev-section="visao"><div class="devGrid"><div class="devCard"><b>Receita do estúdio</b><div class="devBig">${brl(m.receita)}</div></div><div class="devCard"><b>Custos + despesas</b><div class="devBig">${brl(m.custos+m.despesas)}</div></div><div class="devCard"><b>Lucro estimado</b><div class="devBig">${brl(m.lucro)}</div></div><div class="devCard"><b>Banco local</b><div class="devBig">${m.storage} KB</div></div></div><div class="devCard"><h3>Status do sistema</h3><div class="simpleItem">Agenda: ${(s.agenda||[]).length} registros</div><div class="simpleItem">Atendimentos: ${(s.atendimentos||[]).length} registros</div><div class="simpleItem">Materiais: ${(s.materiais||[]).length} itens</div><div class="simpleItem">Despesas: ${(s.despesas||[]).length} registros</div><div class="simpleItem">Fidelidade: ${s.fidelidade.campanhaCartaoAtiva!==false?'ativa':'desativada'}</div></div></div>
      <div class="devSection" data-dev-section="planos"><div class="devCard"><h3>Controle de planos e limites</h3>${['basic','pro','premium'].map(k=>{const p=s.dev.planos[k]||{};return `<h4>${esc(p.nome||k)}</h4><div class="row"><label class="field"><span>Preço</span><input id="devPlanoPreco_${k}" type="number" step="0.01" value="${esc(p.preco||0)}"></label><label class="field"><span>Máx. clientes</span><input id="devPlanoClientes_${k}" type="number" value="${esc(p.maxClientes||0)}"></label><label class="field"><span>Máx. fotos</span><input id="devPlanoFotos_${k}" type="number" value="${esc(p.maxFotos||0)}"></label></div><div class="row"><label><input id="devPlanoCRM_${k}" type="checkbox" ${p.crm?'checked':''}> CRM</label><label><input id="devPlanoEquipe_${k}" type="checkbox" ${p.equipe?'checked':''}> Equipe</label><label><input id="devPlanoExport_${k}" type="checkbox" ${p.exportacao?'checked':''}> Exportação</label></div>`}).join('')}<label class="field"><span>Dias de teste</span><input id="devTrialDiasFinal" type="number" value="${esc(s.dev.trialDias)}"></label><button class="btn" id="devSalvarPlanosFinal">Salvar planos</button></div></div>
      <div class="devSection" data-dev-section="profissionais"><div class="devCard"><h3>Profissionais cadastrados</h3><table class="devTable"><thead><tr><th>Nome</th><th>Plano</th><th>Clientes</th><th>Status</th><th>Ação</th></tr></thead><tbody>${m.profs.map((p,i)=>`<tr><td>${esc(p.nome)}</td><td>${esc(p.plano||'premium')}</td><td>${esc(p.clientes||0)}</td><td><span class="devStatus">${esc(p.status||'ativo')}</span></td><td>${i===0?'Conta atual':`<button class="btn btn--ghost" data-dev-block="${i-1}">${p.status==='bloqueado'?'Ativar':'Bloquear'}</button>`}</td></tr>`).join('')}</tbody></table><h3>Novo profissional</h3><div class="row"><input id="devNovoProfNome" placeholder="Nome"><input id="devNovoProfEmail" placeholder="E-mail"><select id="devNovoProfPlano"><option value="basic">Básico</option><option value="pro">Pro</option><option value="premium" selected>Premium</option><option value="trial">Teste 7 dias</option></select></div><button class="btn" id="devAddProfFinal">Adicionar profissional</button></div></div>
      <div class="devSection" data-dev-section="suporte"><div class="devCard"><h3>Responder suporte</h3><textarea id="devRespostaFinal" rows="4">Olá! Sou do suporte do Studio Sync Pro. Vi seu chamado e vou te ajudar.</textarea><div class="devActions"><button class="btn" id="devWppSuporteFinal">Responder no WhatsApp</button><button class="btn btn--ghost" id="devEmailSuporteFinal">Responder por e-mail</button></div></div><div class="devCard"><h3>Chamados / histórico de suporte</h3><input id="devChamadoTituloFinal" placeholder="Ex.: problema ao salvar"><textarea id="devChamadoDescFinal" placeholder="Descrição"></textarea><select id="devChamadoStatusFinal"><option>Aberto</option><option>Em atendimento</option><option>Resolvido</option></select><button class="btn" id="devSalvarChamadoFinal">Registrar chamado</button>${s.dev.suporte.map(x=>`<div class="simpleItem"><b>${esc(x.titulo)}</b> — ${esc(x.status)}<br><small>${esc(x.desc)}</small></div>`).join('')||'<div class="hint">Nenhum chamado registrado.</div>'}</div></div>
      <div class="devSection" data-dev-section="bugs"><div class="devCard"><h3>Central de bugs</h3><input id="devBugTituloFinal" placeholder="Ex.: cálculo de material"><textarea id="devBugDescFinal" placeholder="Descreva o erro encontrado"></textarea><div class="row"><select id="devBugPrioridadeFinal"><option>Baixa</option><option selected>Média</option><option>Alta</option><option>Crítica</option></select><select id="devBugStatusFinal"><option>Aberto</option><option>Em análise</option><option>Corrigido</option></select></div><button class="btn" id="devSalvarBugFinal">Salvar bug</button>${s.dev.bugs.map(x=>`<div class="simpleItem"><b>${esc(x.titulo)}</b> — ${esc(x.prioridade)} — ${esc(x.status)}</div>`).join('')||'<div class="hint">Nenhum bug anotado.</div>'}</div></div>
      <div class="devSection" data-dev-section="diagnostico"><div class="devCard"><h3>Diagnóstico, logs e backup</h3><div class="devActions"><button class="btn" id="devDiagnosticoFinal">Rodar diagnóstico</button><button class="btn btn--ghost" id="devExportFinal">Exportar backup JSON</button><button class="btn btn--ghost" id="devLimparCacheFinal">Limpar cache</button></div><pre id="devDiagOut" style="white-space:pre-wrap;background:#f7f9fc;padding:12px;border-radius:12px;margin-top:10px">Pronto para diagnóstico.</pre></div></div>
      <div class="devSection" data-dev-section="logs"><div class="devCard"><h3>Histórico de alterações e logs recentes</h3>${s.dev.logs.slice(0,80).map(x=>`<div class="simpleItem"><b>${new Date(x.data).toLocaleString('pt-BR')}</b> — ${esc(x.action)} ${x.detail?`<br><small>${esc(x.detail)}</small>`:''}</div>`).join('')||'<div class="hint">Nenhum log registrado nesta sessão.</div>'}</div></div>`;
    bindDevFinal();
  }
  function bindDevFinal(){
    const sec=document.querySelector('[data-route="desenvolvedor"]'); if(!sec||sec.__finalDevBound) return; sec.__finalDevBound=true;
    sec.addEventListener('click',e=>{
      const s=ensure(); const nav=e.target.closest('[data-dev-final]');
      if(nav){ const tab=nav.dataset.devFinal; qa('[data-dev-final]',sec).forEach(b=>b.classList.toggle('active',b===nav)); qa('[data-dev-section]',sec).forEach(x=>x.classList.toggle('active',x.dataset.devSection===tab)); return; }
      if(e.target.id==='devSalvarPlanosFinal'){ ['basic','pro','premium'].forEach(k=>{s.dev.planos[k]=s.dev.planos[k]||{};s.dev.planos[k].preco=n($(`devPlanoPreco_${k}`)?.value);s.dev.planos[k].maxClientes=n($(`devPlanoClientes_${k}`)?.value);s.dev.planos[k].maxFotos=n($(`devPlanoFotos_${k}`)?.value);s.dev.planos[k].crm=!!$(`devPlanoCRM_${k}`)?.checked;s.dev.planos[k].equipe=!!$(`devPlanoEquipe_${k}`)?.checked;s.dev.planos[k].exportacao=!!$(`devPlanoExport_${k}`)?.checked;}); s.dev.trialDias=n($('devTrialDiasFinal')?.value)||7; log('Planos salvos','Limites e valores atualizados'); renderDevFinal(); alert('Planos salvos ✅'); return; }
      if(e.target.id==='devAddProfFinal'){ const nome=$('devNovoProfNome')?.value?.trim(); if(!nome){alert('Informe o nome.');return;} const plano=$('devNovoProfPlano')?.value||'premium'; s.dev.profissionaisSaaS.unshift({nome,email:$('devNovoProfEmail')?.value||'',plano:plano==='trial'?'premium':plano,status:plano==='trial'?'teste':'ativo',clientes:0,criadoEm:today()}); log('Profissional adicionado',nome); renderDevFinal(); return; }
      const block=e.target.closest('[data-dev-block]'); if(block){ const i=Number(block.dataset.devBlock); const p=s.dev.profissionaisSaaS[i]; if(p){p.status=p.status==='bloqueado'?'ativo':'bloqueado'; log('Status profissional alterado',p.nome); renderDevFinal();} return; }
      if(e.target.id==='devSalvarChamadoFinal'){ s.dev.suporte.unshift({titulo:$('devChamadoTituloFinal')?.value||'Chamado',desc:$('devChamadoDescFinal')?.value||'',status:$('devChamadoStatusFinal')?.value||'Aberto',data:new Date().toISOString()}); log('Chamado registrado'); renderDevFinal(); return; }
      if(e.target.id==='devSalvarBugFinal'){ s.dev.bugs.unshift({titulo:$('devBugTituloFinal')?.value||'Bug',desc:$('devBugDescFinal')?.value||'',prioridade:$('devBugPrioridadeFinal')?.value||'Média',status:$('devBugStatusFinal')?.value||'Aberto',data:new Date().toISOString(),build:FINAL_BUILD}); log('Bug salvo'); renderDevFinal(); return; }
      if(e.target.id==='devDiagnosticoFinal'){ const m=devMetrics(); $('devDiagOut').textContent=`${FINAL_BUILD}\nClientes: ${(s.clientes||[]).length}\nAgenda: ${(s.agenda||[]).length}\nAtendimentos: ${(s.atendimentos||[]).length}\nMateriais: ${(s.materiais||[]).length}\nDespesas: ${(s.despesas||[]).length}\nArmazenamento: ${m.storage} KB\nFidelidade: ${s.fidelidade.campanhaCartaoAtiva!==false?'ativa':'desativada'}\nStatus: OK`; log('Diagnóstico executado'); return; }
      if(e.target.id==='devExportFinal'){ const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`studio-sync-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); log('Backup exportado'); return; }
      if(e.target.id==='devLimparCacheFinal'){ try{caches?.keys?.().then(keys=>keys.forEach(k=>caches.delete(k)));}catch(e){} log('Cache limpo'); alert('Cache limpo. Reabra o app.'); return; }
      if(e.target.id==='devWppSuporteFinal'){ const txt=$('devRespostaFinal')?.value||''; window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank'); return; }
      if(e.target.id==='devEmailSuporteFinal'){ location.href=`mailto:?subject=Suporte Studio Sync Pro&body=${encodeURIComponent($('devRespostaFinal')?.value||'')}`; return; }
    });
  }

  function routeFinalRender(){
    if(isActiveRoute('fidelidade')) setTimeout(renderFidelidadeFinal,20);
    if(isActiveRoute('desenvolvedor')) setTimeout(renderDevFinal,20);
    setTimeout(patchDashboard,50);
  }
  if(typeof window.__SJM_SET_ROUTE==='function' && !window.__SJM_SET_ROUTE.__finalWrapped){
    const old=window.__SJM_SET_ROUTE;
    window.__SJM_SET_ROUTE=function(route){ const r=old(route); routeFinalRender(); return r; };
    window.__SJM_SET_ROUTE.__finalWrapped=true;
  }
  document.addEventListener('click',e=>{ if(e.target.closest('.tab')) setTimeout(routeFinalRender,80); },true);
  document.addEventListener('DOMContentLoaded',()=>[120,500,1200,2200,3300].forEach(t=>setTimeout(routeFinalRender,t)));
  window.addEventListener('load',()=>[120,500,1200,2200,3300].forEach(t=>setTimeout(routeFinalRender,t)));
  setInterval(()=>{ if(isActiveRoute('dashboard')) patchDashboard(); },3000);
  window.__SJM_RENDER_FIDELIDADE_FINAL=renderFidelidadeFinal;
  window.__SJM_RENDER_DEV_FINAL=renderDevFinal;
})();


/* Patch mínimo — fidelidade: seleção Ativado/Desativado reflete na hora e salva como booleano. */
(function(){
  function getStateSafe(){ try{return state;}catch(e){return window.__SJM_GET_STATE?.() || window.state;} }
  function asBool(v, def){
    if(v === true || v === false) return v;
    var t = String(v == null ? '' : v).trim().toLowerCase();
    if(['false','0','nao','não','desativado','off'].indexOf(t)>=0) return false;
    if(['true','1','sim','ativado','on'].indexOf(t)>=0) return true;
    return def;
  }
  function saveOnlyFidelity(){
    var s=getStateSafe(); if(!s) return;
    try{ if(typeof saveSoft==='function') saveSoft(); }catch(e){}
    try{ localStorage.setItem('studio_sync_pro_limpa_estavel_1', JSON.stringify(s)); }catch(e){}
    try{ if(typeof scheduleSync==='function') scheduleSync(); }catch(e){}
    try{ if(typeof scheduleCloudPush==='function') scheduleCloudPush(); }catch(e){}
  }
  function applyFidelityFlagsFromScreen(){
    var s=getStateSafe(); if(!s) return;
    s.fidelidade=s.fidelidade||{};
    var c=document.getElementById('fidCampanhaAtiva');
    var i=document.getElementById('fidIndicacaoAtiva');
    var cb=document.getElementById('fidCashbackAtivo');
    if(c) s.fidelidade.campanhaCartaoAtiva = c.value === 'true';
    if(i) s.fidelidade.programaIndicacaoAtivo = i.value === 'true';
    if(cb) s.fidelidade.cashbackAtivo = cb.value === 'true';
    var cardOn=asBool(s.fidelidade.campanhaCartaoAtiva,true);
    var indOn=asBool(s.fidelidade.programaIndicacaoAtivo,true);
    var cashOn=asBool(s.fidelidade.cashbackAtivo,false);
    var line=document.getElementById('fidStatusLine') || document.getElementById('fidStatusV72');
    if(line){
      line.innerHTML=(cardOn?'✅ Cartão fidelidade ativo.':'⚠️ Cartão fidelidade desativado.')+' '+
        (indOn?'✅ Programa de indicação ativo.':'⚠️ Programa de indicação desativado.')+' '+
        (cashOn?'✅ Cashback ativo.':'⚠️ Cashback desativado.');
    }
  }
  document.addEventListener('change', function(e){
    if(e.target && ['fidCampanhaAtiva','fidIndicacaoAtiva','fidCashbackAtivo'].indexOf(e.target.id)>=0){
      applyFidelityFlagsFromScreen();
      saveOnlyFidelity();
    }
  }, true);
  document.addEventListener('click', function(e){
    if(e.target && e.target.id==='btnSalvarFidelidade'){
      applyFidelityFlagsFromScreen();
      saveOnlyFidelity();
    }
  }, true);
})();

/* Ajuste mínimo definitivo — Fidelidade não pode voltar para Ativado sozinha. Não altera Dev. */
(function(){
  function st(){ try{return state;}catch(e){return window.__SJM_GET_STATE?.() || window.state || null;} }
  function boolFromSelect(id, fallback){
    var el=document.getElementById(id);
    if(el) return el.value === 'true';
    return !!fallback;
  }
  function writeAll(s){
    if(!s) return;
    try{ if(typeof saveSoft === 'function') saveSoft(); }catch(e){}
    try{
      var raw=JSON.stringify(s);
      var keys=['studio_sync_pro_limpa_estavel_1','sjm_sync_pro_v1','studio_sync_pro_db','studio_sync_pro_unico_v1','studioSyncState','studio_sync_pro_db__last_good'];
      try{ if(typeof ACTIVE_STORAGE_KEY !== 'undefined' && ACTIVE_STORAGE_KEY) keys.push(ACTIVE_STORAGE_KEY); }catch(e){}
      try{ if(typeof KEY !== 'undefined' && KEY) keys.push(KEY); }catch(e){}
      keys.forEach(function(k){ try{ localStorage.setItem(k, raw); }catch(e){} });
    }catch(e){}
    try{ if(typeof scheduleSync === 'function') scheduleSync(); }catch(e){}
    try{ if(typeof scheduleCloudPush === 'function') scheduleCloudPush(); }catch(e){}
  }
  function refreshLine(){
    var s=st(); if(!s) return;
    s.fidelidade=s.fidelidade||{};
    var card=boolFromSelect('fidCampanhaAtiva', s.fidelidade.campanhaCartaoAtiva !== false);
    var ind=boolFromSelect('fidIndicacaoAtiva', s.fidelidade.programaIndicacaoAtivo !== false);
    var cash=boolFromSelect('fidCashbackAtivo', s.fidelidade.cashbackAtivo === true);
    s.fidelidade.campanhaCartaoAtiva=card;
    s.fidelidade.programaIndicacaoAtivo=ind;
    s.fidelidade.cashbackAtivo=cash;
    var line=document.getElementById('fidStatusLine') || document.getElementById('fidStatusV72');
    if(line){
      line.innerHTML=(card?'✅ Cartão fidelidade ativo.':'⚠️ Cartão fidelidade desativado.')+' '+
        (ind?'✅ Programa de indicação ativo.':'⚠️ Programa de indicação desativado.')+' '+
        (cash?'✅ Cashback ativo.':'⚠️ Cashback desativado.');
    }
  }
  document.addEventListener('change', function(e){
    if(e.target && ['fidCampanhaAtiva','fidIndicacaoAtiva','fidCashbackAtivo'].indexOf(e.target.id) >= 0){
      refreshLine();
      writeAll(st());
    }
  }, true);
  document.addEventListener('click', function(e){
    if(e.target && e.target.id === 'btnSalvarFidelidade'){
      setTimeout(function(){
        refreshLine();
        writeAll(st());
        if(typeof window.__SJM_RENDER_FIDELIDADE_FINAL === 'function'){
          setTimeout(function(){ window.__SJM_RENDER_FIDELIDADE_FINAL(); }, 30);
        }
      }, 0);
    }
  }, true);
})();

/* =========================================================
   ✅ v64 — Fotos das clientes: lista com busca e galeria por cliente
   - Substitui a grade de pastas por um explorador simples.
   - Não altera Dev, planos, agenda, financeiro ou demais funções.
   ========================================================= */
(function(){
  function esc64(v){ return String(v ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function norm64(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function date64(v){ try{ return typeof fmtBRDate === 'function' ? fmtBRDate(v) : esc64(v||''); }catch(e){ return esc64(v||''); } }
  function getFotos64(c){
    const base = Array.isArray(c?.fotos) ? c.fotos : [];
    const nome = norm64(c?.nome);
    const ats = Array.isArray(window.state?.atendimentos) ? window.state.atendimentos : [];
    const extras = ats
      .filter(a => norm64(a?.cliente) === nome && a?.foto)
      .map(a => ({ imagem:a.foto, data:a.data, procedimento:a.procedimento || 'Procedimento' }));
    return base.concat(extras).filter(f => f && f.imagem);
  }

  window.__SJM_SELECTED_PHOTO_CLIENT = window.__SJM_SELECTED_PHOTO_CLIENT || '';

  window.renderClientPhotoPanel = renderClientPhotoPanel = function(){
    const box = document.getElementById('clientPhotoPanel');
    if(!box || !window.state) return;

    const clientes = (Array.isArray(state.clientes) ? state.clientes : [])
      .filter(c => String(c.nome||'').trim())
      .sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));

    if(!clientes.length){
      box.innerHTML = '<div class="hint">Cadastre uma cliente para aparecer a galeria de fotos.</div>';
      return;
    }

    let selectedId = window.__SJM_SELECTED_PHOTO_CLIENT;
    if(selectedId && !clientes.some(c => String(c.id) === String(selectedId))) selectedId = '';
    const selected = clientes.find(c => String(c.id) === String(selectedId));

    box.innerHTML = `
      <div class="photoExplorer">
        <div class="photoExplorerTop">
          <input class="photoSearch" id="photoClientSearch64" type="search" placeholder="Pesquisar cliente para ver fotos..." autocomplete="off">
          <span class="hint">${clientes.length} cliente(s)</span>
        </div>

        <div class="photoExplorerBody">
          <div class="photoClientList" id="photoClientList64">
            ${clientes.map(c=>{
              const fotos = getFotos64(c);
              const active = String(c.id) === String(selectedId) ? ' active' : '';
              return `<button type="button" class="photoClientRow${active}" data-photo-client-id="${esc64(c.id)}" data-photo-client-name="${esc64(c.nome)}">
                <span><b>${esc64(c.nome)}</b><small>${fotos.length} foto(s)</small></span>
                <strong>›</strong>
              </button>`;
            }).join('')}
          </div>

          <div class="photoViewer" id="photoViewer64">
            ${selected ? renderViewer64(selected) : `<div class="photoEmpty"><b>Selecione uma cliente</b><br><span class="hint">Use a busca ou clique no nome para abrir a galeria.</span></div>`}
          </div>
        </div>
      </div>`;

    const search = document.getElementById('photoClientSearch64');
    search?.addEventListener('input', ()=>{
      const q = norm64(search.value);
      document.querySelectorAll('#photoClientList64 .photoClientRow').forEach(btn=>{
        const name = norm64(btn.dataset.photoClientName);
        btn.style.display = !q || name.includes(q) ? '' : 'none';
      });
    });

    document.querySelectorAll('#photoClientList64 .photoClientRow').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        window.__SJM_SELECTED_PHOTO_CLIENT = btn.dataset.photoClientId || '';
        renderClientPhotoPanel();
      });
    });
  };

  function renderViewer64(c){
    const fotos = getFotos64(c);
    return `
      <div class="photoViewerHead">
        <div><h3>${esc64(c.nome || 'Cliente')}</h3><p class="hint">${fotos.length} foto(s) salva(s)</p></div>
      </div>
      ${fotos.length ? `<div class="photoGrid photoGridLarge">
        ${fotos.map(f=>`<a class="photoCard" href="${esc64(f.imagem)}" target="_blank" rel="noopener">
          <img src="${esc64(f.imagem)}" alt="Foto do procedimento">
          <div class="photoMeta">${date64(f.data)} • ${esc64(f.procedimento || 'Procedimento')}</div>
        </a>`).join('')}
      </div>` : `<div class="photoEmpty">Esta cliente ainda não tem fotos salvas.</div>`}
    `;
  }

  document.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-open-photos]');
    if(!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.dataset?.id || '';
    if(id) window.__SJM_SELECTED_PHOTO_CLIENT = id;
    setTimeout(()=>{
      try{ renderClientPhotoPanel(); }catch(e){}
      document.getElementById('clientPhotoPanel')?.scrollIntoView({behavior:'smooth', block:'start'});
    }, 80);
  }, true);

  document.addEventListener('DOMContentLoaded', ()=>{
    const title = document.querySelector('[data-route="clientes"] #clientPhotoPanel')?.closest('.box')?.querySelector('h3');
    if(title) title.textContent = '📷 Galeria de fotos por cliente';
    setTimeout(()=>{ try{ renderClientPhotoPanel(); }catch(e){} }, 250);
  });
})();

/* =========================================================
   v52 — Clientes cadastradas em painel compacto
   - Mantém os dados e campos atuais.
   - Troca a tabela grande por lista lateral com busca + ficha da cliente.
   - Não altera Dev, planos, financeiro, agenda ou galeria de fotos.
   ========================================================= */
(function(){
  function escV52(v){
    return String(v ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
  function attrV52(v){ return escV52(v).replace(/`/g,'&#96;'); }
  function clientesV52(){
    if(!window.state) return [];
    state.clientes = Array.isArray(state.clientes) ? state.clientes : [];
    state.clientes.forEach(c=>{ if(!Array.isArray(c.fotos)) c.fotos=[]; });
    return state.clientes;
  }
  function saveClientV52(){
    try{ saveSoft(); }catch{}
    try{ updateAgendaAutoCells(); }catch{}
    try{ updateAtendimentosAutoCells(); }catch{}
    try{ scheduleSync(); }catch{}
  }
  function ensureClientesCompactV52(){
    const tbl=document.getElementById('tblCli');
    if(!tbl) return null;
    const wrap=tbl.closest('.tableWrap');
    if(wrap) wrap.style.display='none';
    let box=document.getElementById('clientesCompactPanel');
    if(!box){
      box=document.createElement('div');
      box.id='clientesCompactPanel';
      box.className='clientesCompactPanel box';
      if(wrap && wrap.parentNode) wrap.parentNode.insertBefore(box, wrap);
      else tbl.parentNode?.insertBefore(box, tbl);
    }
    return box;
  }
  function clienteFotoCountV52(c){
    const nome=String(c?.nome||'').trim().toLowerCase();
    const fotosCliente=Array.isArray(c?.fotos)?c.fotos.length:0;
    const fotosAt=(Array.isArray(state.atendimentos)?state.atendimentos:[]).filter(a=>
      String(a?.cliente||'').trim().toLowerCase()===nome && a?.foto
    ).length;
    return fotosCliente+fotosAt;
  }
  function renderListaV52(clientes, filtro){
    const f=String(filtro||'').trim().toLowerCase();
    const lista=clientes.filter(c=>{
      const txt=[c.nome,c.wpp,c.tel,c.molde,c.obs].join(' ').toLowerCase();
      return !f || txt.includes(f);
    });
    if(!lista.length) return '<div class="hint compactEmpty">Nenhuma cliente encontrada.</div>';
    return lista.map(c=>{
      const active=window.__SJM_CLIENTE_SEL_V52===c.id;
      return `<button type="button" class="clienteListItem ${active?'active':''}" data-select-cliente-v52="${attrV52(c.id)}">
        <span><b>${escV52(c.nome||'Cliente sem nome')}</b><small>${escV52(c.wpp||c.tel||'Sem telefone')}</small></span>
        <em>${clienteFotoCountV52(c)} foto(s)</em>
      </button>`;
    }).join('');
  }
  function renderFichaV52(c){
    if(!c){
      return `<div class="clienteFichaEmpty"><b>Selecione uma cliente</b><span>Use a busca ou clique no nome para abrir o cadastro.</span></div>`;
    }
    return `<div class="clienteFichaHead">
        <div><h3>${escV52(c.nome||'Cliente sem nome')}</h3><p>${escV52(c.wpp||c.tel||'Sem telefone cadastrado')}</p></div>
        <button type="button" class="iconBtn" data-open-fotos-v52>📷 Fotos: ${clienteFotoCountV52(c)}</button>
      </div>
      <div class="clienteFichaGrid">
        <label>Cliente<input data-field-v52="nome" value="${attrV52(c.nome||'')}"></label>
        <label>WhatsApp<input data-field-v52="wpp" value="${attrV52(c.wpp||'')}"></label>
        <label>Telefone<input data-field-v52="tel" value="${attrV52(c.tel||'')}"></label>
        <label>Nascimento<input data-field-v52="nasc" type="date" value="${attrV52(c.nasc||'')}"></label>
        <label>Alergia<select data-field-v52="alergia"><option value="N" ${(c.alergia||'N')==='N'?'selected':''}>N</option><option value="S" ${(c.alergia||'N')==='S'?'selected':''}>S</option></select></label>
        <label>Quais alergias<input data-field-v52="quais" value="${attrV52(c.quais||'')}"></label>
        <label>Gestante<select data-field-v52="gestante"><option value="N" ${(c.gestante||'N')==='N'?'selected':''}>N</option><option value="S" ${(c.gestante||'N')==='S'?'selected':''}>S</option></select></label>
        <label>N° do molde<input data-field-v52="molde" value="${attrV52(c.molde||'')}"></label>
        <label class="clienteFichaFull">Observações<input data-field-v52="obs" value="${attrV52(c.obs||'')}"></label>
      </div>
      <div class="clienteFichaActions">
        <button type="button" class="btn btn--ghost" data-open-fotos-v52>Ver galeria da cliente</button>
        <button type="button" class="iconBtn danger" data-del-cliente-v52>Excluir cliente</button>
      </div>`;
  }
  window.renderClientes = function(){
    const box=ensureClientesCompactV52();
    if(!box) return;
    const clientes=clientesV52();
    if(clientes.length && !clientes.some(c=>c.id===window.__SJM_CLIENTE_SEL_V52)){
      window.__SJM_CLIENTE_SEL_V52=clientes[0].id;
    }
    const filtro=window.__SJM_CLIENTE_BUSCA_V52||'';
    const selecionada=clientes.find(c=>c.id===window.__SJM_CLIENTE_SEL_V52) || null;
    box.innerHTML=`
      <div class="clientesCompactTop">
        <div><h3>Clientes cadastradas</h3><p class="hint">${clientes.length} cliente(s). Use a busca lateral para encontrar e editar sem ocupar espaço.</p></div>
      </div>
      <div class="clientesCompactLayout">
        <aside class="clientesCompactSide">
          <input id="clientesCompactBusca" placeholder="Pesquisar cliente..." value="${attrV52(filtro)}">
          <div class="clientesCompactList">${renderListaV52(clientes,filtro)}</div>
        </aside>
        <section class="clienteFichaBox">${renderFichaV52(selecionada)}</section>
      </div>`;

    const busca=document.getElementById('clientesCompactBusca');
    busca?.addEventListener('input',()=>{ window.__SJM_CLIENTE_BUSCA_V52=busca.value; window.renderClientes(); });
    box.querySelectorAll('[data-select-cliente-v52]').forEach(btn=>{
      btn.addEventListener('click',()=>{ window.__SJM_CLIENTE_SEL_V52=btn.getAttribute('data-select-cliente-v52'); window.renderClientes(); });
    });
    if(selecionada){
      box.querySelectorAll('[data-field-v52]').forEach(el=>{
        const field=el.getAttribute('data-field-v52');
        const evt=(el.tagName==='SELECT'||el.type==='date')?'change':'input';
        el.addEventListener(evt,()=>{ selecionada[field]=el.value; saveClientV52(); if(field==='nome') try{ renderClientPhotoPanel(); }catch{}; });
      });
      box.querySelectorAll('[data-open-fotos-v52]').forEach(btn=>{
        btn.addEventListener('click',()=>{ try{ renderClientPhotoPanel(); }catch{}; document.getElementById('clientPhotoPanel')?.scrollIntoView({behavior:'smooth', block:'start'}); });
      });
      box.querySelector('[data-del-cliente-v52]')?.addEventListener('click',()=>{
        if(typeof confirmDel==='function' ? !confirmDel('esta cliente') : !confirm('Excluir esta cliente?')) return;
        state.clientes=clientes.filter(x=>x.id!==selecionada.id);
        window.__SJM_CLIENTE_SEL_V52=state.clientes[0]?.id || '';
        saveClientV52();
        window.renderClientes();
        try{ renderClientPhotoPanel(); }catch{}
      });
    }
  };

  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('btnAddCliente');
    btn?.addEventListener('click',()=>setTimeout(()=>{
      const c=clientesV52()[0];
      if(c) window.__SJM_CLIENTE_SEL_V52=c.id;
      window.renderClientes();
    },30));
    setTimeout(()=>{ try{ window.renderClientes(); }catch{} },120);
    setTimeout(()=>{ try{ window.renderClientes(); }catch{} },900);
  });
})();


/* =========================================================
   PATCH CLIENTE — remove senha/admin/desenvolvedor embutido
   ========================================================= */
(function(){
  try{
    window.__SJM_DEV_UNLOCKED = false;
    window.__SJM_IS_DEVELOPER = false;
    localStorage.removeItem('studio_sync_role');
    localStorage.removeItem('role');
    localStorage.removeItem('studio_sync_dev_password');
  }catch(e){}

  function hideDevClientPatch(){
    try{
      document.querySelectorAll('.tab[data-tab="desenvolvedor"], .devAccessBox').forEach(el=>{
        el.hidden = true;
        el.style.display = 'none';
        el.classList.add('devHidden');
      });
    }catch(e){}
  }

  window.unlockDeveloperV34 = function(){
    alert('Área de desenvolvedor removida desta versão cliente.');
    window.__SJM_DEV_UNLOCKED = false;
    window.__SJM_IS_DEVELOPER = false;
    hideDevClientPatch();
    return false;
  };

  const oldGetPlanClientPatch = typeof getCurrentPlan === 'function' ? getCurrentPlan : null;
  if(oldGetPlanClientPatch){
    window.getCurrentPlan = getCurrentPlan = function(){
      window.__SJM_DEV_UNLOCKED = false;
      window.__SJM_IS_DEVELOPER = false;
      try{ return typeof getStoredPlanV34 === 'function' ? getStoredPlanV34() : (state?.settings?.plano || 'premium'); }catch(e){ return 'premium'; }
    };
  }

  const oldCanAccessClientPatch = typeof canAccessRoute === 'function' ? canAccessRoute : null;
  if(oldCanAccessClientPatch){
    window.canAccessRoute = canAccessRoute = function(route){
      if(String(route||'').toLowerCase() === 'desenvolvedor') return false;
      return oldCanAccessClientPatch(route);
    };
  }

  document.addEventListener('click', function(e){
    const dev = e.target && e.target.closest && e.target.closest('.tab[data-tab="desenvolvedor"], #btnUnlockDev');
    if(!dev) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    alert('Área de desenvolvedor removida desta versão cliente.');
    hideDevClientPatch();
  }, true);

  document.addEventListener('DOMContentLoaded', hideDevClientPatch);
  window.addEventListener('load', hideDevClientPatch);
  setTimeout(hideDevClientPatch, 100);
  setTimeout(hideDevClientPatch, 800);
})();

/* ===== Correção final: Clientes igual Agenda + cores fáceis ===== */
(function(){
  function $c(id){ return document.getElementById(id); }
  function ehtml(v){ try{return escapeHTML(String(v??''));}catch{return String(v??'').replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[m]));} }
  function eattr(v){ return ehtml(v).replace(/"/g,'&quot;'); }
  function norm(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
  function saveNow(){ try{ saveSoft(); }catch{} try{ scheduleSyncDebounced(); }catch{} }
  function modeClientes(m){ window.__clienteViewMode=m; const f=$c('clienteFormPanel'), l=$c('clienteListPanel'); if(f) f.hidden=m!=='form'; if(l) l.hidden=m!=='list'; }
  function filteredClientes(){ const q=norm($c('clienteFiltroBusca')?.value||''); return (state.clientes||[]).filter(c=>!q || norm(`${c.nome||''} ${c.wpp||''} ${c.tel||''} ${c.obs||''}`).includes(q)); }
  function selectedCliente(items){ const ids=items.map(c=>c.id); if(!window.__clienteSelectedId || !ids.includes(window.__clienteSelectedId)) window.__clienteSelectedId=ids[0]||''; return (state.clientes||[]).find(c=>c.id===window.__clienteSelectedId) || items[0] || null; }
  function bindClienteTop(){
    const todos=$c('btnClientesTodos');
    if(todos && !todos.__cliBound){ todos.__cliBound=true; todos.addEventListener('click',()=>{ modeClientes('list'); renderClientesCompactFinal(); }); }
    const busca=$c('clienteFiltroBusca');
    if(busca && !busca.__cliBound){ busca.__cliBound=true; busca.addEventListener('input',()=>{ window.__clienteSelectedId=''; renderClientesCompactFinal(); }); }
  }
  window.renderClientesCompactFinal = function(){
    bindClienteTop();
    if(!window.__clienteViewMode) modeClientes('form'); else modeClientes(window.__clienteViewMode);
    const qtd=$c('clienteQtdResumo'); if(qtd) qtd.textContent=String((state.clientes||[]).length);
    const list=$c('clienteCompactList');
    const detail=$c('clienteCompactDetail');
    const items=filteredClientes();
    const cli=selectedCliente(items);
    if(list){
      list.innerHTML = items.length ? items.map(c=>`<button type="button" class="clienteItem${c.id===window.__clienteSelectedId?' isActive':''}" data-cliente-id="${eattr(c.id)}"><div><div class="clienteItem__name">${ehtml(c.nome||'Cliente sem nome')}</div><div class="clienteItem__meta">${ehtml(c.wpp||c.tel||'Sem telefone')}</div></div><div class="clienteItem__photos">${Array.isArray(c.fotos)?c.fotos.length:0} foto(s)</div></button>`).join('') : `<div class="hint" style="padding:16px;">Nenhuma cliente encontrada.</div>`;
      list.querySelectorAll('[data-cliente-id]').forEach(b=>b.addEventListener('click',()=>{ window.__clienteSelectedId=b.dataset.clienteId||''; modeClientes('form'); renderClientesCompactFinal(); }));
    }
    if(detail){
      if(!cli){ detail.innerHTML=`<div class="hint">Clique em + Nova cliente para cadastrar.</div>`; return; }
      detail.innerHTML = `<div class="clienteDetail__head"><div><h3>${ehtml(cli.nome||'Nova cliente')}</h3><div class="hint">Preencha os dados e confirme o cadastro.</div></div></div>
        <div class="clienteDetail__grid" data-cliente-id="${eattr(cli.id)}">
          <label class="field"><span>Cliente</span><input id="cliDetNome" value="${eattr(cli.nome||'')}" placeholder="Nome completo"></label>
          <label class="field"><span>WhatsApp</span><input id="cliDetWpp" value="${eattr(cli.wpp||'')}" placeholder="Ex: +55 17 99999-9999"></label>
          <label class="field"><span>Telefone</span><input id="cliDetTel" value="${eattr(cli.tel||'')}"></label>
          <label class="field"><span>Nascimento</span><input id="cliDetNasc" type="date" value="${eattr(cli.nasc||'')}"></label>
          <label class="field"><span>Alergia</span><select id="cliDetAlergia"><option value="N" ${String(cli.alergia||'N')==='N'?'selected':''}>Não</option><option value="S" ${String(cli.alergia||'N')==='S'?'selected':''}>Sim</option></select></label>
          <label class="field"><span>Quais alergias?</span><input id="cliDetQuais" value="${eattr(cli.quais||'')}"></label>
          <label class="field"><span>Gestante</span><select id="cliDetGestante"><option value="N" ${String(cli.gestante||'N')==='N'?'selected':''}>Não</option><option value="S" ${String(cli.gestante||'N')==='S'?'selected':''}>Sim</option></select></label>
          <label class="field"><span>N° do molde</span><input id="cliDetMolde" value="${eattr(cli.molde||'')}"></label>
          <label class="field clienteDetail__wide"><span>Observação</span><textarea id="cliDetObs" rows="3">${ehtml(cli.obs||'')}</textarea></label>
        </div>
        <div class="clienteDetail__actions"><button class="btn btn--ghost" id="cliDetFotos" type="button">📁 Fotos da cliente (${Array.isArray(cli.fotos)?cli.fotos.length:0})</button><button class="btn btn--ghost" id="cliDetDel" type="button">Excluir</button></div>`;
      const map=[['cliDetNome','nome','input'],['cliDetWpp','wpp','input'],['cliDetTel','tel','input'],['cliDetNasc','nasc','change'],['cliDetAlergia','alergia','change'],['cliDetQuais','quais','input'],['cliDetGestante','gestante','change'],['cliDetMolde','molde','input'],['cliDetObs','obs','input']];
      map.forEach(([id,key,ev])=>$c(id)?.addEventListener(ev,evn=>{ cli[key]=evn.target.value; saveNow(); if(key==='nome') setTimeout(renderClientesCompactFinal,80); }));
      $c('cliDetFotos')?.addEventListener('click',()=>{ try{ renderClientPhotoPanel(); }catch{} alert('As fotos continuam salvas na pasta da cliente.'); });
      $c('cliDetDel')?.addEventListener('click',()=>{ if(!confirm('Excluir esta cliente?')) return; state.clientes=(state.clientes||[]).filter(x=>x.id!==cli.id); window.__clienteSelectedId=''; saveNow(); try{ updateAgendaAutoCells(); updateAtendimentosAutoCells(); }catch{} renderClientesCompactFinal(); });
    }
  };
  const oldRender = window.renderClientes;
  window.renderClientes = renderClientes = function(){
    try{ if(oldRender && document.querySelector('#tblCli tbody')) oldRender(); }catch{}
    renderClientesCompactFinal();
  };
  document.addEventListener('click', function(e){
    const b=e.target && e.target.closest ? e.target.closest('#btnAddCliente') : null;
    if(!b) return;
    setTimeout(()=>{ const first=(state.clientes||[])[0]; if(first) window.__clienteSelectedId=first.id; modeClientes('form'); renderClientesCompactFinal(); },120);
  }, true);
})();

(function(){
  function $(id){return document.getElementById(id)}
  function validHex(v){ v=String(v||'').trim(); if(!v.startsWith('#')) v='#'+v; return /^#[0-9a-fA-F]{6}$/.test(v)?v.toUpperCase():null; }
  function syncColorInputs(){
    const p=$('cfgCorPrimaria'), a=$('cfgCorAcento'), ph=$('cfgCorPrimariaHex'), ah=$('cfgCorAcentoHex');
    if(ph && p) ph.value=(p.value||'#7B2CBF').toUpperCase();
    if(ah && a) ah.value=(a.value||'#F72585').toUpperCase();
  }
  function applyFromHex(){
    const p=$('cfgCorPrimaria'), a=$('cfgCorAcento'), ph=$('cfgCorPrimariaHex'), ah=$('cfgCorAcentoHex');
    const hp=validHex(ph?.value||p?.value), ha=validHex(ah?.value||a?.value);
    if(hp && p) p.value=hp; if(ha && a) a.value=ha;
    try{ state.settings.corPrimaria=p?.value||hp||state.settings.corPrimaria; state.settings.corAcento=a?.value||ha||state.settings.corAcento; applyTheme(); saveSoft(); scheduleSync(); }catch{}
    syncColorInputs();
  }
  function bindEasyColors(){
    const p=$('cfgCorPrimaria'), a=$('cfgCorAcento'), ph=$('cfgCorPrimariaHex'), ah=$('cfgCorAcentoHex'), btn=$('btnApplyColors');
    if(!p||!a) return;
    syncColorInputs();
    [p,a].forEach(el=>{ if(!el.__easyColor){ el.__easyColor=true; el.addEventListener('input',()=>{ syncColorInputs(); applyFromHex(); }); }});
    [ph,ah].forEach(el=>{ if(el && !el.__easyColor){ el.__easyColor=true; el.addEventListener('change',applyFromHex); el.addEventListener('blur',applyFromHex); }});
    if(btn && !btn.__easyColor){ btn.__easyColor=true; btn.addEventListener('click',applyFromHex); }
  }
  const oldBind = window.bindConfig;
  if(typeof oldBind==='function') window.bindConfig = bindConfig = function(){ const r=oldBind.apply(this,arguments); setTimeout(bindEasyColors,50); return r; };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bindEasyColors,500));
  setTimeout(bindEasyColors,1000);
})();


/* BLOCO v58 velocidade removido na v81-limpa: evitava sobrescrita de saveSoft/render. */

/* =========================================================
   v62 — Correção definitiva: salvar agendamentos + limpar procedimentos especiais
   Base: correcao_agenda_whatsapp. Não altera layout.
   ========================================================= */
(function(){
  'use strict';
  if(window.__SJM_SAVE_FIX_V62) return;
  window.__SJM_SAVE_FIX_V62 = true;

  function st(){ try{ return window.state || state; }catch(e){ return window.state; } }
  function setSt(s){ try{ window.state = s; state = s; }catch(e){ window.state = s; } }
  function uid62(){ try{ return typeof uid === 'function' ? uid() : ('id_'+Date.now()+'_'+Math.random().toString(36).slice(2)); }catch(e){ return 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2); } }
  function canonKey(v){
    return String(v||'')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]/gi,'')
      .toUpperCase();
  }
  const CANON = { MEDICO:'Médico', FOLGA:'Folga', COMPROMISSO:'Compromisso', REUNIAO:'Reunião' };
  function isCanon(k){ return Object.prototype.hasOwnProperty.call(CANON, k); }
  function normalizeSpecial(p, key){
    p = (p && typeof p === 'object') ? p : {};
    p.id = p.id || uid62();
    p.nome = CANON[key];
    p.preco = 0;
    p.precoBase = 0;
    p.reajuste = '';
    p.historico = [];
    p.categoria = 'Sistema';
    p.especial = true;
    p.ativo = p.ativo || 'S';
    p.duracaoMin = Number(p.duracaoMin || 60);
    if(!Number.isFinite(p.duracaoMin) || p.duracaoMin <= 0) p.duracaoMin = 60;
    return p;
  }
  function makeSpecial(key){ return normalizeSpecial({ id: uid62() }, key); }

  function cleanSpecials(s){
    if(!s || !Array.isArray(s.procedimentos)) return false;
    const before = JSON.stringify((s.procedimentos||[]).map(p=>[p&&p.id,p&&p.nome,p&&p.preco,p&&p.especial]));
    const normal = [];
    const found = {};
    (s.procedimentos || []).forEach(function(p){
      if(!p || typeof p !== 'object') return;
      const key = canonKey(p.nome);
      if(isCanon(key)){
        if(!found[key]) found[key] = normalizeSpecial(p, key);
        return;
      }
      normal.push(p);
    });
    ['MEDICO','FOLGA','COMPROMISSO','REUNIAO'].forEach(function(key){
      normal.push(found[key] ? normalizeSpecial(found[key], key) : makeSpecial(key));
    });
    s.procedimentos = normal;
    const after = JSON.stringify((s.procedimentos||[]).map(p=>[p&&p.id,p&&p.nome,p&&p.preco,p&&p.especial]));
    return before !== after;
  }

  function ensureAgendaShape(s){
    if(!s) return;
    s.agenda = Array.isArray(s.agenda) ? s.agenda : [];
    s.agenda.forEach(function(a){
      if(!a || typeof a !== 'object') return;
      a.id = a.id || uid62();
      a.data = a.data || (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0,10));
      a.hora = a.hora || '08:00';
      a.status = a.status || 'Agendado';
      a.cliente = a.cliente || '';
      a.procedimento = a.procedimento || '';
      a.obs = a.obs || '';
      if(a.recebido === undefined || a.recebido === null || a.recebido === '') a.recebido = 0;
    });
  }

  function localKeys(){
    const keys = new Set();
    try{ if(typeof ACTIVE_STORAGE_KEY !== 'undefined' && ACTIVE_STORAGE_KEY) keys.add(ACTIVE_STORAGE_KEY); }catch(e){}
    try{ if(typeof KEY !== 'undefined' && KEY) keys.add(KEY); }catch(e){}
    keys.add('sjm_sync_pro_v1');
    try{
      for(let i=0; i<localStorage.length; i++){
        const k = localStorage.key(i);
        if(!k) continue;
        if(k === 'sjm_sync_pro_v1' || k.indexOf('sjm_sync_pro_v1__user__') === 0) keys.add(k);
      }
    }catch(e){}
    return Array.from(keys);
  }

  let pushingTimer = null;
  function pushCloudDebounced(){
    clearTimeout(pushingTimer);
    pushingTimer = setTimeout(function(){
      const s = st();
      try{ if(typeof window.__SJM_PUSH_TO_CLOUD === 'function') window.__SJM_PUSH_TO_CLOUD(s); }catch(e){ console.warn('cloud push v62:', e); }
      try{ if(typeof scheduleCloudPush === 'function') scheduleCloudPush(); }catch(e){}
    }, 500);
  }

  function persist(reason, push){
    const s = st();
    if(!s) return;
    ensureAgendaShape(s);
    cleanSpecials(s);
    try{ if(typeof ensureMeta === 'function') ensureMeta(s); }catch(e){ s.meta = s.meta || {}; }
    try{
      s.meta = s.meta || {};
      s.meta.clientId = (typeof CLIENT_ID !== 'undefined' ? CLIENT_ID : (s.meta.clientId || 'local'));
      s.meta.rev = Number(s.meta.rev || 0) + 1;
      s.meta.updatedAt = Date.now();
    }catch(e){}
    setSt(s);
    const raw = JSON.stringify(s);
    localKeys().forEach(function(k){ try{ localStorage.setItem(k, raw); }catch(e){} });
    try{ sessionStorage.setItem('sjm_sync_pro_v1_last_good', raw); }catch(e){}
    if(push !== false) pushCloudDebounced();
  }

  // Salvar oficial: grava local imediato e envia remoto em lote.
  const oldSave = (typeof saveSoft === 'function') ? saveSoft : window.saveSoft;
  window.saveSoft = function(){
    persist('save', true);
    // Não dependemos do save antigo, mas mantemos compatibilidade sem permitir que erro interrompa.
    try{ if(oldSave && !oldSave.__v62) oldSave(); }catch(e){}
  };
  window.saveSoft.__v62 = true;
  try{ saveSoft = window.saveSoft; }catch(e){}
  try{ globalThis.saveSoft = window.saveSoft; }catch(e){}

  // Sync derivado não pode terminar sem salvar o estado atualizado.
  const oldSchedule = (typeof scheduleSync === 'function') ? scheduleSync : window.scheduleSync;
  window.scheduleSync = function(){
    try{ if(oldSchedule && !oldSchedule.__v62) oldSchedule(); }catch(e){}
    setTimeout(function(){
      try{ if(!window.__SJM_IS_EDITING) persist('schedule', true); }catch(e){}
    }, 260);
  };
  window.scheduleSync.__v62 = true;
  try{ scheduleSync = window.scheduleSync; }catch(e){}
  try{ globalThis.scheduleSync = window.scheduleSync; }catch(e){}

  // Quando remoto chegar antigo, não deixar apagar agenda recém salva.
  const oldApply = window.__SJM_APPLY_REMOTE_STATE;
  window.__SJM_APPLY_REMOTE_STATE = function(remoteState){
    try{ cleanSpecials(remoteState); ensureAgendaShape(remoteState); }catch(e){}
    const local = st();
    const rt = Number(remoteState?.meta?.updatedAt || 0);
    const lt = Number(local?.meta?.updatedAt || 0);
    const rAgenda = Array.isArray(remoteState?.agenda) ? remoteState.agenda.length : 0;
    const lAgenda = Array.isArray(local?.agenda) ? local.agenda.length : 0;
    if(local && (lt > rt || lAgenda > rAgenda)){
      persist('remote-ignored', true);
      try{ window.__SJM_SET_SYNC_STATUS && window.__SJM_SET_SYNC_STATUS('Sync: local preservado ✅'); }catch(e){}
      return;
    }
    if(typeof oldApply === 'function') return oldApply(remoteState);
    try{ setSt(remoteState); persist('remote-applied', false); if(typeof renderAllHard === 'function') renderAllHard(); }catch(e){}
  };

  // Agenda: garante persistência depois de qualquer input/change/click relevante.
  function isAgendaTarget(el){
    if(!el) return false;
    if(el.closest && (el.closest('#agendaCompactDetail') || el.closest('#tblAgenda') || el.closest('#agendaFormPanel') || el.closest('#agendaListPanel'))) return true;
    const id = String(el.id || '');
    return id.indexOf('agDet') === 0 || id.indexOf('agenda') === 0 || id === 'btnAddAgenda' || id === 'btnAgendaTodos';
  }
  ['input','change','blur'].forEach(function(ev){
    document.addEventListener(ev, function(e){
      if(!isAgendaTarget(e.target)) return;
      setTimeout(function(){ persist('agenda-'+ev, true); }, ev === 'input' ? 120 : 0);
    }, true);
  });
  document.addEventListener('click', function(e){
    const b = e.target && e.target.closest && e.target.closest('button');
    if(!b || !isAgendaTarget(b)) return;
    setTimeout(function(){ persist('agenda-click', true); }, 80);
  }, true);

  // Reforça criação de novo agendamento sem mexer no layout.
  const oldOpenEdit = (typeof openAgendaEditorById === 'function') ? openAgendaEditorById : window.openAgendaEditorById;
  if(typeof oldOpenEdit === 'function'){
    window.openAgendaEditorById = function(id){
      const r = oldOpenEdit.apply(this, arguments);
      setTimeout(function(){ persist('open-edit', true); }, 120);
      return r;
    };
    try{ openAgendaEditorById = window.openAgendaEditorById; }catch(e){}
  }

  // Inicialização: limpa duplicados e salva de verdade antes da primeira renderização seguinte.
  try{ persist('boot', false); }catch(e){ console.warn('boot v62:', e); }
  setTimeout(function(){ try{ persist('boot-late', true); if(typeof renderProcedimentos === 'function') renderProcedimentos(); }catch(e){} }, 350);
  window.addEventListener('beforeunload', function(){ try{ persist('beforeunload', true); }catch(e){} });
})();

/* =========================================================
   v73 — Ajustes solicitados Allan
   - Plano atual altera e atualiza em Configurações
   - Botão Concluir cadastro antes das fotos da cliente
   - Confirmação da agenda marca como Confirmado automaticamente
   - Procedimentos iniciam e ficam apenas com os fixos definidos
   ========================================================= */
(function(){
  'use strict';
  if(window.__SJM_ALLAN_FIX_V73) return;
  window.__SJM_ALLAN_FIX_V73 = true;

  const $ = (id)=>document.getElementById(id);
  const esc = (v)=>String(v??'').replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[m]));
  const n = (v)=>{ const x=Number(String(v??'').replace(',','.')); return Number.isFinite(x)?x:0; };
  const uidx = ()=>{ try{return uid();}catch(e){return 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2);} };
  function saveNow(){ try{ saveSoft(); }catch(e){} try{ scheduleSync(); }catch(e){} try{ scheduleSyncDebounced(); }catch(e){} }
  function rerender(){
    try{ applyPlanUI(); }catch(e){}
    try{ renderPlanCards(); }catch(e){}
    try{ renderProcedimentos(); }catch(e){}
    try{ renderAgendaHard(); }catch(e){}
    try{ renderCalendar(); }catch(e){}
    try{ renderClientes(); }catch(e){}
  }

  function setPlanV73(plan){
    plan = String(plan||'premium').toLowerCase();
    if(!['basic','pro','premium','developer'].includes(plan)) plan='premium';
    state.settings = state.settings || {};
    state.settings.plano = plan;
    try{ localStorage.setItem('sjm_current_plan_v34', plan); }catch(e){}
    try{ window.__SJM_STORED_PLAN = plan; }catch(e){}
    if($('cfgPlano')) $('cfgPlano').value = plan;
    const badge = $('currentPlanBadge');
    if(badge) badge.textContent = plan==='developer' ? 'Desenvolvedor' : `Plano ${(window.PLAN_LABELS?.[plan]) || ({basic:'Básico',pro:'Pro',premium:'Premium'}[plan]||plan)}`;
    saveNow();
    rerender();
  }

  // Plano: Configurações e cards sempre atualizam o plano atual.
  document.addEventListener('change', function(e){
    if(e.target && e.target.id === 'cfgPlano') setPlanV73(e.target.value);
  }, true);
  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest ? e.target.closest('[data-change-plan]') : null;
    if(!btn) return;
    e.preventDefault();
    setPlanV73(btn.getAttribute('data-change-plan'));
    try{ alert('Plano atualizado ✅'); }catch(_){}
  }, true);
  const oldCards = window.renderPlanCards;
  window.renderPlanCards = function(){
    try{ oldCards && oldCards(); }catch(e){}
    const box = $('planCards');
    if(!box) return;
    const current = String(state?.settings?.plano || 'premium').toLowerCase();
    box.querySelectorAll('[data-change-plan]').forEach(b=>{ b.disabled = false; b.classList.remove('btn--ghost'); });
    box.querySelectorAll('.planCard').forEach(card=>card.classList.remove('active'));
    box.querySelectorAll('button').forEach(b=>{
      if((b.textContent||'').includes('Plano atual')){
        const card = b.closest('.planCard');
        const title = (card?.querySelector('b')?.textContent || '').toLowerCase();
        const plan = title.includes('bás') || title.includes('bas') ? 'basic' : title.includes('pro') ? 'pro' : 'premium';
        b.disabled = false;
        b.classList.remove('btn--ghost');
        b.setAttribute('data-change-plan', plan);
        b.textContent = plan===current ? 'Manter este plano' : 'Mudar para este plano';
      }
    });
  };
  try{ renderPlanCards = window.renderPlanCards; }catch(e){}

  // Agenda: clicar em confirmação também muda status para Confirmado.
  function confirmAgendaV73(a){
    if(!a || String(a.status||'') === 'Bloqueio') return;
    a.status = 'Confirmado';
    if(a.recebido === undefined || a.recebido === null || a.recebido === '') a.recebido = 0;
    saveNow();
    try{ renderAgendaHard(); }catch(e){}
    try{ renderCalendar(); }catch(e){}
  }
  document.addEventListener('click', function(e){
    const b = e.target && e.target.closest ? e.target.closest('#agDetConf,[data-conf]') : null;
    if(!b) return;
    let id = '';
    const tr = b.closest('tr[data-id]');
    if(tr) id = tr.dataset.id || '';
    if(!id) id = window.__agendaSelectedId || '';
    const a = (state.agenda||[]).find(x=>x.id===id);
    if(a) setTimeout(()=>confirmAgendaV73(a), 30);
  }, true);

  // Procedimentos: corrigido em patch v79 no final do arquivo.
  // Clientes: botão Concluir cadastro antes de Fotos.
  function addConcluirCliente(){
    const actions = document.querySelector('.clienteDetail__actions');
    if(!actions || $('cliDetConcluir')) return;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'cliDetConcluir';
    btn.type = 'button';
    btn.textContent = '✅ Concluir cadastro';
    actions.insertBefore(btn, actions.firstChild);
    btn.addEventListener('click', function(){
      saveNow();
      try{ updateAgendaAutoCells(); updateAtendimentosAutoCells(); }catch(e){}
      try{ alert('Cadastro da cliente concluído e salvo ✅'); }catch(e){}
      try{ modeClientes && modeClientes('list'); }catch(e){ window.__clienteViewMode='list'; }
      try{ renderClientes(); }catch(e){}
    });
  }
  const oldCliCompact = window.renderClientesCompactFinal;
  if(typeof oldCliCompact === 'function'){
    window.renderClientesCompactFinal = function(){ const r = oldCliCompact.apply(this, arguments); addConcluirCliente(); return r; };
  }
  const oldCli = window.renderClientes;
  if(typeof oldCli === 'function'){
    window.renderClientes = function(){ const r = oldCli.apply(this, arguments); addConcluirCliente(); return r; };
    try{ renderClientes = window.renderClientes; }catch(e){}
  }

  setTimeout(function(){
    try{ ensureFixedProcedures(); }catch(e){}
    if($('cfgPlano')) $('cfgPlano').value = String(state?.settings?.plano || 'premium').toLowerCase();
    saveNow();
    rerender();
    addConcluirCliente();
  }, 400);
})();


/* =======================================================
   PATCH v79 - Procedimentos salvando de verdade
   - Sistema: apenas Médico, Folga, Reunião e Compromisso
   - Usuário pode criar quantos procedimentos quiser
   - Não substitui um procedimento pelo outro
   - Salva em state + localStorage + backup próprio
======================================================= */
(function(){
  'use strict';
  if(window.__SJM_PROCEDIMENTOS_V79) return;
  window.__SJM_PROCEDIMENTOS_V79 = true;

  const PROC_BACKUP_KEY = 'sjm_sync_pro_v1__procedimentos_backup_v79';

  const SISTEMA = [
    { nome:'Médico', duracaoMin:60 },
    { nome:'Folga', duracaoMin:60 },
    { nome:'Reunião', duracaoMin:60 },
    { nome:'Compromisso', duracaoMin:60 }
  ];

  const LEGACY_DEFAULTS = {
    'alongamento': { preco:130, duracaoMin:120 },
    'manutencao': { preco:90, duracaoMin:120 },
    'remocao + nova aplicacao': { preco:160, duracaoMin:150 },
    'remocao de alongamento': { preco:60, duracaoMin:60 }
  };

  function by(id){ return document.getElementById(id); }
  function norm(v){
    return String(v||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().trim().replace(/\s+/g,' ');
  }
  const sistemaNorm = new Set(SISTEMA.map(p=>norm(p.nome)));

  function esc(v){
    return String(v??'').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function n(v){
    try{ if(typeof num === 'function') return num(v); }catch(e){}
    const x = Number(String(v??'0').replace(',','.'));
    return Number.isFinite(x) ? x : 0;
  }
  function id(){
    try{ if(typeof uid === 'function') return uid(); }catch(e){}
    return 'proc_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  }
  function isSystem(p){
    return !!p && sistemaNorm.has(norm(p.nome));
  }
  function isLegacyDefault(p){
    if(!p || !p.nome) return false;
    const k = norm(p.nome);
    const d = LEGACY_DEFAULTS[k];
    if(!d) return false;
    if(p.userCreated || p.criadoPeloUsuario || p.manual) return false;
    const marcadoAntigo = !!p.fixado || !!p.especial || norm(p.categoria)==='sistema';
    const precoIgual = Math.abs(n(p.preco) - d.preco) < 0.001;
    const durIgual = Math.round(n(p.duracaoMin)||0) === d.duracaoMin;
    return marcadoAntigo || (precoIgual && durIgual);
  }
  function normalizeProc(p, systemFlag){
    return {
      ...(p || {}),
      id: (p && p.id) || id(),
      nome: String((p && p.nome) || '').trim(),
      preco: systemFlag ? 0 : n(p && p.preco),
      precoBase: systemFlag ? 0 : ((p && p.precoBase !== undefined) ? n(p.precoBase) : n(p && p.preco)),
      reajuste: systemFlag ? '' : String((p && p.reajuste) || ''),
      duracaoMin: Math.max(1, Math.round(n(p && p.duracaoMin) || 60)),
      historico: systemFlag ? [] : (Array.isArray(p && p.historico) ? p.historico : []),
      especial: !!systemFlag,
      fixado: !!systemFlag,
      categoria: systemFlag ? 'Sistema' : '',
      ativo: (p && p.ativo) || 'S',
      userCreated: !systemFlag
    };
  }

  function customFrom(list){
    const out = [];
    (Array.isArray(list) ? list : []).forEach(p=>{
      if(!p || !p.nome) return;
      if(isSystem(p)) return;
      if(isLegacyDefault(p)) return;
      out.push(normalizeProc(p, false));
    });
    return out;
  }

  function readJson(k){
    try{
      const raw = localStorage.getItem(k);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }

  function readProcedureBackup(){
    const b = readJson(PROC_BACKUP_KEY);
    if(Array.isArray(b)) return b;
    if(b && Array.isArray(b.procedimentos)) return b.procedimentos;
    return [];
  }

  function writeProcedureBackup(){
    try{
      localStorage.setItem(PROC_BACKUP_KEY, JSON.stringify(customFrom(state && state.procedimentos)));
    }catch(e){}
  }

  function allStoredProcedures(){
    const out = [];
    try{
      for(let i=0; i<localStorage.length; i++){
        const k = localStorage.key(i);
        if(!k) continue;
        if(k.indexOf('sjm_sync_pro_v1') !== 0 && k !== PROC_BACKUP_KEY) continue;
        const parsed = readJson(k);
        if(Array.isArray(parsed)) out.push(...parsed);
        else if(parsed && Array.isArray(parsed.procedimentos)) out.push(...parsed.procedimentos);
      }
    }catch(e){}
    out.push(...readProcedureBackup());
    return out;
  }

  function mergeCustomProcedures(primary, rescue){
    const result = [];
    const seenId = new Set();

    customFrom(primary).forEach(p=>{
      if(seenId.has(p.id)) p.id = id();
      seenId.add(p.id);
      result.push(p);
    });

    // Recupera procedimentos que estavam salvos em outra chave/back-up.
    customFrom(rescue).forEach(p=>{
      const sameId = result.some(x => x.id === p.id);
      const sameFull = result.some(x =>
        norm(x.nome) === norm(p.nome) &&
        Math.abs(n(x.preco)-n(p.preco)) < 0.001 &&
        Math.round(n(x.duracaoMin)) === Math.round(n(p.duracaoMin))
      );
      if(sameId || sameFull) return;
      if(seenId.has(p.id)) p.id = id();
      seenId.add(p.id);
      result.push(p);
    });

    return result;
  }

  function garantirProcedimentosV79(){
    // Usa o state real do app mesmo quando window.state ainda não foi exposto.
    try{ if(!window.state && typeof state !== 'undefined' && state) window.state = state; }catch(e){}
    const s = (typeof state !== 'undefined' && state) ? state : window.state;
    if(!s) return;
    try{ state = s; window.state = s; }catch(e){ window.state = s; }
    const atuais = Array.isArray(s.procedimentos) ? s.procedimentos : [];
    const rescue = allStoredProcedures();

    const sistema = SISTEMA.map(sp=>{
      const found = atuais.find(p => isSystem(p) && norm(p.nome) === norm(sp.nome)) || {};
      return normalizeProc({ ...found, nome:sp.nome, duracaoMin:found.duracaoMin || sp.duracaoMin }, true);
    });

    const personalizados = mergeCustomProcedures(atuais, rescue);
    state.procedimentos = sistema.concat(personalizados);
  }

  function salvarProcedimentosV79(){
    try{ if(!window.state && typeof state !== 'undefined' && state) window.state = state; }catch(e){}
    try{ garantirProcedimentosV79(); }catch(e){}
    try{ if(typeof ensureMeta === 'function') ensureMeta(state); }catch(e){}
    try{ if(typeof bumpRev === 'function') bumpRev(); }catch(e){}
    writeProcedureBackup();

    try{ localStorage.setItem('sjm_sync_pro_v1', JSON.stringify(state)); }catch(e){}
    try{
      if(typeof ACTIVE_STORAGE_KEY !== 'undefined'){
        localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
      }
    }catch(e){}
    try{ if(typeof saveSoft === 'function') saveSoft(); }catch(e){}
    try{ if(typeof scheduleCloudPush === 'function') scheduleCloudPush(); }catch(e){}
  }

  function proximoNome(){
    const nomes = new Set((state.procedimentos||[]).map(p=>norm(p.nome)));
    let i = 1;
    while(nomes.has(norm('Novo procedimento ' + i))) i++;
    return 'Novo procedimento ' + i;
  }

  function atualizarAgendaPorNome(antigo, novo){
    antigo = String(antigo||'').trim();
    novo = String(novo||'').trim();
    if(!antigo || !novo || norm(antigo) === norm(novo)) return;

    (state.agenda||[]).forEach(a=>{
      if(norm(a.procedimento) === norm(antigo)){
        a.procedimento = novo;
        try{
          const valor = isSystem({nome:novo}) ? 0 : n(procPrice(novo, a.data));
          if((a.status||'Agendado') !== 'Bloqueio') a.valor = valor;
          if((a.status||'Agendado') === 'Realizado') a.recebido = valor;
        }catch(e){}
      }
    });

    (state.atendimentos||[]).forEach(a=>{
      if(norm(a.procedimento) === norm(antigo)){
        a.procedimento = novo;
        try{
          const valor = isSystem({nome:novo}) ? 0 : n(procPrice(novo, a.data));
          a.valor = valor;
          if(a.recebido !== undefined) a.recebido = valor;
        }catch(e){}
      }
    });
  }

  window.renderProcedimentos = function(){
    garantirProcedimentosV79();

    const body = document.querySelector('#tblProc tbody');
    if(!body) return;

    body.innerHTML = (state.procedimentos||[]).map(p=>{
      const sistema = isSystem(p);
      return `
        <tr data-id="${esc(p.id)}">
          <td><input value="${esc(p.nome)}" ${sistema ? 'readonly' : ''}></td>
          <td><input class="money" type="number" step="0.01" inputmode="decimal" value="${n(p.preco).toFixed(2)}" ${sistema ? 'readonly' : ''}></td>
          <td><input type="date" value="${esc(p.reajuste||'')}" ${sistema ? 'readonly' : ''}></td>
          <td><input type="number" step="1" value="${Math.max(1, Math.round(n(p.duracaoMin)||60))}"></td>
          <td>${sistema ? '<span class="muted">Sistema</span>' : '<button class="iconBtn" data-del title="Excluir procedimento">✕</button>'}</td>
        </tr>`;
    }).join('');

    body.querySelectorAll('tr').forEach(tr=>{
      const p = (state.procedimentos||[]).find(x => String(x.id) === String(tr.dataset.id));
      if(!p) return;

      const sistema = isSystem(p);
      const inputs = tr.querySelectorAll('input');
      const inpNome = inputs[0];
      const inpPreco = inputs[1];
      const inpReaj = inputs[2];
      const inpDur = inputs[3];
      let nomeOriginal = p.nome || '';

      inpNome && inpNome.addEventListener('focus', ()=>{
        nomeOriginal = p.nome || inpNome.value || '';
      });

      inpNome && inpNome.addEventListener('input', ()=>{
        if(sistema){ inpNome.value = p.nome || ''; return; }
        p.nome = inpNome.value;
        p.userCreated = true;
        writeProcedureBackup();
        try{
          localStorage.setItem('sjm_sync_pro_v1', JSON.stringify(state));
          if(typeof ACTIVE_STORAGE_KEY !== 'undefined') localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
        }catch(e){}
      });

      inpNome && inpNome.addEventListener('change', ()=>{
        if(sistema){ inpNome.value = p.nome || ''; return; }
        const novo = inpNome.value.trim() || proximoNome();
        const antigo = nomeOriginal || p.nome || '';
        p.nome = novo;
        inpNome.value = novo;
        p.userCreated = true;
        atualizarAgendaPorNome(antigo, novo);
        salvarProcedimentosV79();
        renderProcedimentos();
        try{ renderAgendaHard(); }catch(e){}
        try{ renderAtendimentosHard(); }catch(e){}
        try{ renderCalendar(); }catch(e){}
        try{ renderDashboard(); }catch(e){}
      });

      inpPreco && inpPreco.addEventListener('input', ()=>{
        if(sistema){ p.preco = 0; inpPreco.value = '0.00'; return; }
        p.preco = n(inpPreco.value);
        if(!Array.isArray(p.historico) || !p.historico.length) p.precoBase = p.preco;
        p.userCreated = true;
        salvarProcedimentosV79();
        try{ updateAgendaAutoCells(); }catch(e){}
        try{ updateAtendimentosAutoCells(); }catch(e){}
      });

      inpReaj && inpReaj.addEventListener('change', ()=>{
        if(sistema){ p.reajuste = ''; inpReaj.value = ''; return; }
        p.reajuste = inpReaj.value || '';
        if(!Array.isArray(p.historico)) p.historico = [];
        if(p.reajuste){
          const entrada = { dataInicio:p.reajuste, valor:n(p.preco) };
          const idx = p.historico.findIndex(h => h.dataInicio === p.reajuste);
          if(idx >= 0) p.historico[idx] = entrada;
          else p.historico.push(entrada);
          p.historico.sort((a,b)=>String(a.dataInicio).localeCompare(String(b.dataInicio)));
        }
        p.userCreated = true;
        salvarProcedimentosV79();
        try{ renderAgendaHard(); }catch(e){}
        try{ renderAtendimentosHard(); }catch(e){}
        try{ renderCalendar(); }catch(e){}
      });

      inpDur && inpDur.addEventListener('input', ()=>{
        p.duracaoMin = Math.max(1, Math.round(n(inpDur.value)||60));
        if(!sistema) p.userCreated = true;
        salvarProcedimentosV79();
      });

      const del = tr.querySelector('[data-del]');
      del && del.addEventListener('click', ()=>{
        if(typeof confirmDel === 'function' && !confirmDel('este procedimento')) return;
        state.procedimentos = (state.procedimentos||[]).filter(x => String(x.id) !== String(p.id));
        salvarProcedimentosV79();
        renderProcedimentos();
        try{ renderAgendaHard(); }catch(e){}
        try{ renderAtendimentosHard(); }catch(e){}
        try{ renderCalendar(); }catch(e){}
      });
    });

    const add = by('btnAddProc');
    if(add){
      add.textContent = '+ Adicionar novo procedimento';
      add.title = 'Cadastrar um novo procedimento';
    }
    const reset = by('btnResetProc');
    if(reset) reset.style.display = 'none';
  };
  try{ renderProcedimentos = window.renderProcedimentos; }catch(e){}

  // Captura primeiro e impede listeners antigos de criar/restaurar procedimento errado.
  window.addEventListener('click', function(e){
    const add = e.target && e.target.closest ? e.target.closest('#btnAddProc') : null;
    if(!add) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    garantirProcedimentosV79();
    const novo = normalizeProc({
      id:id(),
      nome:proximoNome(),
      preco:0,
      precoBase:0,
      reajuste:'',
      duracaoMin:60,
      historico:[],
      userCreated:true
    }, false);

    state.procedimentos.push(novo);
    salvarProcedimentosV79();
    renderProcedimentos();

    setTimeout(()=>{
      try{
        const linha = document.querySelector('#tblProc tbody tr[data-id="' + CSS.escape(novo.id) + '"]');
        const input = linha ? linha.querySelector('input') : null;
        if(input){ input.focus(); input.select(); }
      }catch(e){}
    }, 30);
  }, true);

  window.addEventListener('click', function(e){
    const reset = e.target && e.target.closest ? e.target.closest('#btnResetProc') : null;
    if(!reset) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);

  // Procedimentos contam como dados importantes no anti-sobrescrita do Firebase.
  try{
    window.stateDataScore = function(s){
      try{
        if(!s || typeof s !== 'object') return 0;
        return (Array.isArray(s.procedimentos)?s.procedimentos.length*500:0)
          + (Array.isArray(s.agenda)?s.agenda.length*1000:0)
          + (Array.isArray(s.clientes)?s.clientes.length*1000:0)
          + (Array.isArray(s.atendimentos)?s.atendimentos.length*1200:0)
          + (Array.isArray(s.materiais)?s.materiais.length*300:0)
          + (Array.isArray(s.despesas)?s.despesas.length*300:0)
          + (Array.isArray(s.receitasExtras)?s.receitasExtras.length*300:0)
          + (Array.isArray(s.wppQueue)?s.wppQueue.length*50:0)
          + (Array.isArray(s.crmQueue)?s.crmQueue.length*50:0);
      }catch(e){ return 0; }
    };
    try{ stateDataScore = window.stateDataScore; }catch(e){}
  }catch(e){}

  // Se vier estado remoto antigo, preserva os procedimentos criados pelo usuário.
  try{
    const oldApply = window.__SJM_APPLY_REMOTE_STATE;
    if(typeof oldApply === 'function'){
      window.__SJM_APPLY_REMOTE_STATE = function(remoteState){
        try{
          const localCustom = customFrom((state && state.procedimentos) || []).concat(readProcedureBackup());
          if(remoteState && typeof remoteState === 'object'){
            const remoteCustom = customFrom(remoteState.procedimentos || []);
            remoteState.procedimentos = SISTEMA.map(sp => normalizeProc(sp, true)).concat(mergeCustomProcedures(remoteCustom, localCustom));
          }
        }catch(e){}
        return oldApply.apply(this, arguments);
      };
    }
  }catch(e){}

  // Inicialização final: roda depois dos patches antigos e salva a lista certa.
  function boot(){
    try{
      garantirProcedimentosV79();
      salvarProcedimentosV79();
      renderProcedimentos();
      try{ renderAgendaHard(); }catch(e){}
      try{ renderCalendar(); }catch(e){}
    }catch(e){ console.warn('Patch v79 procedimentos:', e); }
  }
  setTimeout(boot, 50);
  setTimeout(boot, 1700);
  window.addEventListener('beforeunload', function(){
    try{ salvarProcedimentosV79(); }catch(e){}
  });
})();



/* v81-limpa-base-v80: limpeza segura aplicada em app.js. */


/* =========================================================
   v82 base v80 — Autoagendamento público funcional
   - corrige link que não gerava página
   - cria rota #agendar/slug dentro do GitHub Pages/PWA
   - permite confirmação direta se o studio estiver logado
   - para visitante sem login, gera pedido pronto no WhatsApp do studio
   ========================================================= */
(function autoAgendamentoPublicoV82(){
  const BUILD_AUTO_PUBLIC = 'v82-autoagendamento-publico';
  const $ = (id)=>document.getElementById(id);
  const clean = (v)=>String(v ?? '').trim();
  const onlyDigits = (v)=>String(v ?? '').replace(/\D/g,'');
  const moneyBR = (v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const esc = (v)=>String(v ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const slugLocal = (v)=>String(v ?? 'studio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'studio';
  const nowId = ()=> 'pub_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  const publicHash = ()=>String(location.hash||'').replace(/^#/,'');
  const isPublicRoute = ()=> /^agendar(\/|$)/i.test(publicHash());
  const publicSlug = ()=> decodeURIComponent((publicHash().split('/')[1]||'studio').split('?')[0] || 'studio');
  const hashParams = ()=>{
    const raw = publicHash();
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?')+1) : '';
    return new URLSearchParams(q);
  };
  function baseUrl(){ return location.origin + location.pathname; }
  function getStudioPhone(){
    try{
      return onlyDigits(state?.settings?.studioWpp || state?.settings?.whatsapp || state?.settings?.wpp || state?.wpp?.studioWpp || hashParams().get('tel') || '');
    }catch(e){ return onlyDigits(hashParams().get('tel') || ''); }
  }
  function getStudioName(){
    try{ return clean(state?.settings?.studioNome) || 'Studio'; }catch(e){ return 'Studio'; }
  }
  function getAutoConfig(){
    try{
      state.autoagendamento = state.autoagendamento && typeof state.autoagendamento === 'object' ? state.autoagendamento : {};
      state.autoagendamento.slug = slugLocal(state.autoagendamento.slug || state.settings?.studioNome || 'studio');
      if(typeof state.autoagendamento.ativo !== 'boolean') state.autoagendamento.ativo = true;
      state.autoagendamento.horaIni = state.autoagendamento.horaIni || '08:00';
      state.autoagendamento.horaFim = state.autoagendamento.horaFim || '18:00';
      state.autoagendamento.intervalo = Number(state.autoagendamento.intervalo || 30) || 30;
      state.autoagendamento.pixPct = Number(state.autoagendamento.pixPct || 0) || 0;
      state.autoagendamento.pixChave = state.autoagendamento.pixChave || '';
      return state.autoagendamento;
    }catch(e){ return {slug:'studio',ativo:true,horaIni:'08:00',horaFim:'18:00',intervalo:30,pixPct:0,pixChave:''}; }
  }
  function publicLink(){
    const a = getAutoConfig();
    const tel = getStudioPhone();
    const extra = tel ? ('?tel=' + encodeURIComponent(tel)) : '';
    return baseUrl() + '#agendar/' + encodeURIComponent(slugLocal(a.slug || getStudioName())) + extra;
  }
  function minFromHHMM(h){ const m=String(h||'').match(/^(\d{1,2}):(\d{2})$/); return m ? (Number(m[1])*60+Number(m[2])) : 0; }
  function hhmmFromMin(m){ const h=String(Math.floor(m/60)).padStart(2,'0'); const mm=String(m%60).padStart(2,'0'); return h+':'+mm; }
  function procList(){
    try{
      const list = Array.isArray(state?.procedimentos) ? state.procedimentos : [];
      const out = list.filter(p=>p && String(p.nome||'').trim() && !/^(m[eé]dico|folga|reuni[aã]o|compromisso)$/i.test(String(p.nome||'').trim()));
      return out.length ? out : [{nome:'Procedimento',preco:0,duracaoMin:60}];
    }catch(e){ return [{nome:'Procedimento',preco:0,duracaoMin:60}]; }
  }
  function busyAt(date, time){
    try{
      return (state.agenda||[]).some(a => String(a.data||'')===String(date) && String(a.hora||'').slice(0,5)===String(time).slice(0,5) && String(a.status||'').toLowerCase() !== 'cancelado');
    }catch(e){ return false; }
  }
  function timeOptions(date){
    const a=getAutoConfig();
    const ini=minFromHHMM(a.horaIni||'08:00'), fim=minFromHHMM(a.horaFim||'18:00'), step=Math.max(5, Number(a.intervalo||30)||30);
    const opts=[];
    for(let m=ini; m<=fim; m+=step){
      const h=hhmmFromMin(m);
      if(!date || !busyAt(date,h)) opts.push(h);
    }
    return opts.length ? opts : [a.horaIni||'08:00'];
  }
  function ensurePublicRoot(){
    let root = $('sjmPublicBookingRoot');
    if(!root){
      root=document.createElement('div');
      root.id='sjmPublicBookingRoot';
      root.className='sjmPublicBooking';
      document.body.appendChild(root);
    }
    return root;
  }
  function renderPublicBooking(){
    if(!isPublicRoute()){
      document.body.classList.remove('sjm-public-booking');
      const r=$('sjmPublicBookingRoot'); if(r) r.style.display='none';
      return;
    }
    document.body.classList.add('sjm-public-booking');
    const root=ensurePublicRoot();
    root.style.display='block';
    const a=getAutoConfig();
    const studio=getStudioName();
    if(a.ativo === false){
      root.innerHTML=`<div class="sjmPublicBookingCard"><h1>Autoagendamento indisponível</h1><p>O ${esc(studio)} desativou o link de agendamento no momento.</p></div>`;
      return;
    }
    const today = (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0,10);
    const procs=procList();
    const selectedDate = clean($('pubAgData')?.value) || today;
    const horarios=timeOptions(selectedDate);
    root.innerHTML=`
      <div class="sjmPublicBookingCard">
        <h1>Agendar horário</h1>
        <p>${esc(studio)} • Escolha o procedimento, data e horário.</p>
        <form id="pubAgForm">
          <div class="sjmPublicGrid">
            <label class="sjmPublicField"><span>Nome completo</span><input id="pubAgNome" autocomplete="name" required placeholder="Seu nome"></label>
            <label class="sjmPublicField"><span>WhatsApp</span><input id="pubAgWpp" inputmode="tel" autocomplete="tel" required placeholder="(17) 99999-9999"></label>
            <label class="sjmPublicField"><span>Procedimento</span><select id="pubAgProc">${procs.map(p=>`<option value="${esc(p.nome)}">${esc(p.nome)}${Number(p.preco||0)>0?' • '+esc(moneyBR(p.preco)):''}</option>`).join('')}</select></label>
            <label class="sjmPublicField"><span>Data</span><input id="pubAgData" type="date" min="${esc(today)}" value="${esc(selectedDate)}" required></label>
            <label class="sjmPublicField"><span>Horário livre</span><select id="pubAgHora">${horarios.map(h=>`<option value="${h}">${h}</option>`).join('')}</select></label>
            <label class="sjmPublicField"><span>Observação</span><input id="pubAgObs" placeholder="Opcional"></label>
          </div>
          <div class="sjmPublicHint">${a.pixPct ? `Sinal Pix: ${esc(String(a.pixPct))}%${a.pixChave ? ' • Chave: '+esc(a.pixChave) : ''}` : 'Após enviar, o studio confirma o horário.'}</div>
          <div class="sjmPublicActions"><button class="sjmPublicBtn" type="submit">Solicitar agendamento</button><button class="sjmPublicBtn secondary" type="button" id="pubAgBack">Voltar</button></div>
        </form>
      </div>`;
    const dateInp=$('pubAgData');
    dateInp?.addEventListener('change',()=>renderPublicBooking());
    $('pubAgBack')?.addEventListener('click',()=>{ location.hash='dashboard'; });
    $('pubAgForm')?.addEventListener('submit', submitPublicBooking);
  }
  function submitPublicBooking(e){
    e.preventDefault();
    const nome=clean($('pubAgNome')?.value);
    const wpp=onlyDigits($('pubAgWpp')?.value);
    const procedimento=clean($('pubAgProc')?.value);
    const data=clean($('pubAgData')?.value);
    const hora=clean($('pubAgHora')?.value);
    const obs=clean($('pubAgObs')?.value);
    if(!nome || !wpp || !procedimento || !data || !hora){ alert('Preencha nome, WhatsApp, procedimento, data e horário.'); return; }
    const proc = procList().find(p=>String(p.nome)===procedimento) || {};
    const ag = { id:nowId(), cliente:nome, wpp, procedimento, data, hora, status:'Agendado', valor:Number(proc.preco||0)||0, recebido:0, obs, origem:'autoagendamento', criadoEm:new Date().toISOString() };
    let savedDirect=false;
    try{
      if(typeof state === 'object' && state){
        state.clientes = Array.isArray(state.clientes) ? state.clientes : [];
        if(!state.clientes.some(c=>String(c.nome||'').trim().toLowerCase()===nome.toLowerCase())){
          state.clientes.push({id:nowId(),nome,wpp,tel:wpp,obs:'Criada pelo autoagendamento',fotos:[]});
        }
        state.agenda = Array.isArray(state.agenda) ? state.agenda : [];
        if(!busyAt(data,hora)) state.agenda.push(ag);
        if(typeof saveSoft === 'function') saveSoft();
        if(typeof scheduleSync === 'function') scheduleSync();
        if(typeof scheduleCloudPush === 'function') scheduleCloudPush();
        savedDirect = !!window.__SJM_CURRENT_USER;
      }
    }catch(err){ console.warn('autoagendamento direto:', err); }
    try{
      const pending = JSON.parse(localStorage.getItem('sjm_autoagendamento_pedidos')||'[]');
      pending.unshift(ag); localStorage.setItem('sjm_autoagendamento_pedidos', JSON.stringify(pending.slice(0,100)));
    }catch(e){}
    const studioPhone=getStudioPhone();
    const msg=`Olá! Quero solicitar um agendamento.%0A%0ANome: ${encodeURIComponent(nome)}%0AWhatsApp: ${encodeURIComponent(wpp)}%0AProcedimento: ${encodeURIComponent(procedimento)}%0AData: ${encodeURIComponent(data)}%0AHorário: ${encodeURIComponent(hora)}${obs?`%0AObs: ${encodeURIComponent(obs)}`:''}`;
    if(savedDirect){
      alert('Agendamento criado e salvo ✅');
      location.hash='agenda';
      try{ if(typeof renderAgendaHard==='function') renderAgendaHard(); if(typeof renderCalendar==='function') renderCalendar(); }catch(e){}
    }else if(studioPhone){
      alert('Pedido criado ✅\nAgora vamos abrir o WhatsApp para enviar a solicitação ao studio.');
      window.open(`https://wa.me/55${studioPhone}?text=${msg}`,'_blank','noopener,noreferrer');
    }else{
      alert('Pedido criado neste aparelho ✅\nAtenção: para visitante sem login salvar direto no Firebase, será necessário liberar gravação pública segura ou usar Cloud Function.');
    }
  }
  function fillAutoAdmin(){
    try{
      const a=getAutoConfig();
      const link=publicLink();
      if($('agSlug')) $('agSlug').value = slugLocal($('agSlug').value || a.slug || getStudioName());
      if($('agLink')) $('agLink').value = a.ativo === false ? 'Autoagenda desativada' : link;
      const prev=$('agPreview');
      if(prev && !isPublicRoute()){
        const old=prev.innerHTML||'';
        if(!old.includes('#agendar/')){
          prev.innerHTML = `<div class="simpleItem"><b>Link público:</b> ${esc(link)}</div>` + old;
        }
      }
    }catch(e){}
  }
  function bindAutoAdmin(){
    const save=$('btnSalvarAutoAg');
    if(save && !save.__autoPublicV82){
      save.__autoPublicV82=true;
      save.addEventListener('click',()=>setTimeout(()=>{
        try{
          const a=getAutoConfig();
          a.slug=slugLocal($('agSlug')?.value || a.slug || getStudioName());
          a.ativo=($('agAtivo')?.value !== 'false');
          a.horaIni=$('agHoraIni')?.value || a.horaIni || '08:00';
          a.horaFim=$('agHoraFim')?.value || a.horaFim || '18:00';
          a.intervalo=Number($('agIntervalo')?.value || a.intervalo || 30)||30;
          a.pixPct=Number($('agPixPct')?.value || a.pixPct || 0)||0;
          a.pixChave=$('agPixChave')?.value || a.pixChave || '';
          if(typeof saveSoft==='function') saveSoft();
          if(typeof scheduleCloudPush==='function') scheduleCloudPush();
          fillAutoAdmin();
        }catch(e){ console.warn(BUILD_AUTO_PUBLIC, e); }
      },80), true);
    }
    const copy=$('btnCopiarLinkAg');
    if(copy && !copy.__autoPublicV82){
      copy.__autoPublicV82=true;
      copy.addEventListener('click',async(ev)=>{
        try{
          const link=publicLink();
          if($('agLink')) $('agLink').value=link;
          ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
          if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
          else if(typeof copyToClipboardSafe==='function') await copyToClipboardSafe(link);
          alert('Link do autoagendamento copiado ✅');
        }catch(e){}
      }, true);
    }
    fillAutoAdmin();
  }
  function boot(){
    try{ bindAutoAdmin(); renderPublicBooking(); }catch(e){ console.warn(BUILD_AUTO_PUBLIC, e); }
  }
  window.addEventListener('hashchange', boot);
  document.addEventListener('DOMContentLoaded',()=>[50,300,900,1800].forEach(t=>setTimeout(boot,t)));
  setTimeout(boot,100);
  setTimeout(boot,1200);
})();

/* =========================================================
   v83 base v80 — Autoagendamento completo e seguro
   - publica dados públicos do studio para o link do cliente
   - cliente envia pedido direto ao Firestore quando o link tem sid
   - app do studio recebe pedido, salva na agenda e cria cliente
   - evita duplicidade por requestId e por horário ocupado
   - gera notificação local no navegador e mensagens de WhatsApp
   Observação: para visitante salvar sem login de dono, ative Anonymous Auth no Firebase.
   ========================================================= */
(function autoAgendamentoCompletoV83(){
  const BUILD='v83-autoagendamento-completo';
  const $=(id)=>document.getElementById(id);
  const clean=(v)=>String(v??'').trim();
  const digits=(v)=>String(v??'').replace(/\D/g,'');
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const slug=(v)=>String(v??'studio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'studio';
  const today=()=> new Date().toISOString().slice(0,10);
  const id=()=> 'req_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  const pubHash=()=>String(location.hash||'').replace(/^#/,'');
  const isPublic=()=>/^agendar(\/|$)/i.test(pubHash());
  const params=()=>{ const h=pubHash(); const q=h.includes('?')?h.slice(h.indexOf('?')+1):''; return new URLSearchParams(q); };
  const ownerUid=()=> clean(params().get('sid')||params().get('studioId')||publicSlug()||'');
  const baseUrl=()=>location.origin+location.pathname;
  let publicDataCache=null;
  let loadingPublic=false;

  function getAuto(){
    try{
      state.autoagendamento = state.autoagendamento && typeof state.autoagendamento==='object' ? state.autoagendamento : {};
      const a=state.autoagendamento;
      a.slug=slug(a.slug || state.settings?.studioNome || 'studio');
      if(typeof a.ativo!=='boolean') a.ativo=true;
      a.horaIni=a.horaIni||'08:00'; a.horaFim=a.horaFim||'18:00'; a.intervalo=Number(a.intervalo||30)||30;
      a.pixPct=Number(a.pixPct||0)||0; a.pixChave=a.pixChave||'';
      return a;
    }catch(e){ return {ativo:true,slug:'studio',horaIni:'08:00',horaFim:'18:00',intervalo:30,pixPct:0,pixChave:''}; }
  }
  function studioName(){ try{return clean(state?.settings?.studioNome)||'Studio';}catch(e){return 'Studio';} }
  function studioPhone(){ try{return digits(state?.settings?.studioWpp||state?.settings?.whatsapp||state?.wpp?.studioWpp||'');}catch(e){return '';} }
  function procListFromState(){
    try{
      const sys=/^(m[eé]dico|folga|reuni[aã]o|compromisso)$/i;
      const arr=Array.isArray(state?.procedimentos)?state.procedimentos:[];
      return arr.filter(p=>p&&clean(p.nome)&&!sys.test(clean(p.nome))).map(p=>({
        nome:clean(p.nome), preco:Number(p.preco||0)||0, duracaoMin:Number(p.duracaoMin||p.duracao||60)||60
      }));
    }catch(e){return []}
  }
  function busySlotsFromState(){
    try{
      return (Array.isArray(state?.agenda)?state.agenda:[])
        .filter(a=>a&&a.data&&a.hora&&String(a.status||'').toLowerCase()!=='cancelado')
        .map(a=>({data:String(a.data),hora:String(a.hora).slice(0,5),status:a.status||'Agendado',cliente:a.cliente||''}));
    }catch(e){return []}
  }
  function publicPayload(){
    const a=getAuto();
    return {
      studioNome: studioName(),
      studioWpp: studioPhone(),
      autoagendamento: {ativo:a.ativo!==false,slug:slug(a.slug||studioName()),horaIni:a.horaIni||'08:00',horaFim:a.horaFim||'18:00',intervalo:Number(a.intervalo||30)||30,pixPct:Number(a.pixPct||0)||0,pixChave:a.pixChave||''},
      procedimentos: procListFromState(),
      busySlots: busySlotsFromState().slice(0,1500)
    };
  }
  function publicLinkV83(){
    const a=getAuto(); const uid=clean(window.__SJM_CURRENT_USER?.uid||''); const tel=studioPhone();
    const q=[]; if(uid) q.push('sid='+encodeURIComponent(uid)); if(tel) q.push('tel='+encodeURIComponent(tel));
    return baseUrl()+'#agendar/'+encodeURIComponent(slug(a.slug||studioName()))+(q.length?'?'+q.join('&'):'');
  }
  async function publishPublic(){
    try{
      if(!window.__SJM_CURRENT_USER?.uid || window.__SJM_CURRENT_USER?.role==='public') return;
      if(typeof window.__SJM_PUBLISH_PUBLIC_AUTOAGENDAMENTO==='function') await window.__SJM_PUBLISH_PUBLIC_AUTOAGENDAMENTO(publicPayload());
    }catch(e){ console.warn(BUILD,'publish público:',e); }
  }
  function min(h){ const m=String(h||'').match(/^(\d{1,2}):(\d{2})$/); return m?Number(m[1])*60+Number(m[2]):0; }
  function hh(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
  function getPublicData(){
    if(publicDataCache) return publicDataCache;
    try{ return publicPayload(); }catch(e){ return {studioNome:'Studio',studioWpp:digits(params().get('tel')||''),autoagendamento:{ativo:true,horaIni:'08:00',horaFim:'18:00',intervalo:30},procedimentos:[],busySlots:[]}; }
  }
  function isBusy(data,hora){
    const pd=getPublicData();
    return (pd.busySlots||[]).some(x=>String(x.data)===String(data)&&String(x.hora).slice(0,5)===String(hora).slice(0,5));
  }
  function availableTimes(data){
    const pd=getPublicData(); const a=pd.autoagendamento||{};
    const ini=min(a.horaIni||'08:00'), fim=min(a.horaFim||'18:00'), step=Math.max(5,Number(a.intervalo||30)||30);
    const out=[]; for(let m=ini;m<=fim;m+=step){ const h=hh(m); if(!data||!isBusy(data,h)) out.push(h); }
    return out;
  }
  async function loadPublicData(){
    const uid=ownerUid();
    if(!isPublic()||!uid||loadingPublic) return;
    loadingPublic=true;
    try{
      if(typeof window.__SJM_LOAD_PUBLIC_AUTOAGENDAMENTO==='function'){
        const data=await window.__SJM_LOAD_PUBLIC_AUTOAGENDAMENTO(uid);
        if(data) publicDataCache=data;
      }
    }catch(e){ console.warn(BUILD,'load público:',e); }
    finally{ loadingPublic=false; }
  }
  function publicRoot(){ let r=$('sjmPublicBookingRoot'); if(!r){ r=document.createElement('div'); r.id='sjmPublicBookingRoot'; r.className='sjmPublicBooking'; document.body.appendChild(r); } return r; }
  function renderPublicV83(){
    if(!isPublic()){ const r=$('sjmPublicBookingRoot'); if(r) r.style.display='none'; document.body.classList.remove('sjm-public-booking'); return; }
    document.body.classList.add('sjm-public-booking');
    const r=publicRoot(); r.style.display='block';
    const pd=getPublicData(); const a=pd.autoagendamento||{}; const studio=pd.studioNome||'Studio';
    if(a.ativo===false){ r.innerHTML=`<div class="sjmPublicBookingCard"><h1>Autoagendamento indisponível</h1><p>${esc(studio)} desativou o link no momento.</p></div>`; return; }
    const procs=(pd.procedimentos||[]).filter(p=>p&&clean(p.nome));
    const d=clean($('pubAgDataV83')?.value)||today(); const times=availableTimes(d);
    r.innerHTML=`<div class="sjmPublicBookingCard"><h1>Agendar horário</h1><p>${esc(studio)} • Escolha uma data e um horário disponível.</p>
      <form id="pubAgFormV83"><div class="sjmPublicGrid">
        <label class="sjmPublicField"><span>Nome completo</span><input id="pubAgNomeV83" autocomplete="name" required placeholder="Seu nome"></label>
        <label class="sjmPublicField"><span>WhatsApp</span><input id="pubAgWppV83" inputmode="tel" autocomplete="tel" required placeholder="(17) 99999-9999"></label>
        <label class="sjmPublicField"><span>Procedimento</span><select id="pubAgProcV83" required>${(procs.length?procs:[{nome:'Procedimento',preco:0}]).map(p=>`<option value="${esc(p.nome)}">${esc(p.nome)}${Number(p.preco||0)>0?' • '+esc(money(p.preco)):''}</option>`).join('')}</select></label>
        <label class="sjmPublicField"><span>Data</span><input id="pubAgDataV83" type="date" min="${today()}" value="${esc(d)}" required></label>
        <label class="sjmPublicField"><span>Horário livre</span><select id="pubAgHoraV83" required>${times.length?times.map(h=>`<option value="${h}">${h}</option>`).join(''):'<option value="">Sem horário livre</option>'}</select></label>
        <label class="sjmPublicField"><span>Observação</span><input id="pubAgObsV83" placeholder="Opcional"></label>
      </div><div class="sjmPublicHint">${a.pixPct?`Sinal Pix: ${esc(a.pixPct)}%${a.pixChave?' • Chave: '+esc(a.pixChave):''}`:'Ao confirmar, o horário será enviado para a agenda do studio.'}</div>
      <div class="sjmPublicActions"><button class="sjmPublicBtn" type="submit">Confirmar agendamento</button><button class="sjmPublicBtn secondary" type="button" id="pubAgBackV83">Voltar</button></div></form></div>`;
    $('pubAgDataV83')?.addEventListener('change',()=>renderPublicV83());
    $('pubAgBackV83')?.addEventListener('click',()=>{ location.hash='dashboard'; });
  }
  async function submitPublicV83(ev){
    const form=ev.target; if(!form || form.id!=='pubAgFormV83') return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    const nome=clean($('pubAgNomeV83')?.value), wpp=digits($('pubAgWppV83')?.value), procedimento=clean($('pubAgProcV83')?.value), data=clean($('pubAgDataV83')?.value), hora=clean($('pubAgHoraV83')?.value), obs=clean($('pubAgObsV83')?.value);
    if(!nome||!wpp||!procedimento||!data||!hora){ alert('Preencha nome, WhatsApp, procedimento, data e horário.'); return; }
    if(isBusy(data,hora)){ alert('Esse horário acabou de ser ocupado. Escolha outro horário.'); renderPublicV83(); return; }
    const pd=getPublicData(); const proc=(pd.procedimentos||[]).find(p=>clean(p.nome)===procedimento)||{};
    const req={id:id(),cliente:nome,wpp,procedimento,data,hora,valor:Number(proc.preco||0)||0,obs,status:'Confirmado',criadoEm:new Date().toISOString(),studioNome:pd.studioNome||'Studio'};
    let sent=false;
    try{
      const uid=ownerUid();
      if(uid && typeof window.__SJM_CREATE_PUBLIC_BOOKING_REQUEST==='function'){
        await window.__SJM_CREATE_PUBLIC_BOOKING_REQUEST(uid, req);
        sent=true;
      }
    }catch(e){ console.warn(BUILD,'pedido firebase:',e); }
    try{ localStorage.setItem('sjm_ultimo_autoagendamento_cliente', JSON.stringify(req)); }catch(e){}
    const studioTel=digits(pd.studioWpp||params().get('tel')||'');
    const msgCliente=`Olá, ${nome}! Seu pedido de agendamento foi enviado para ${pd.studioNome||'o studio'}.%0A%0AProcedimento: ${encodeURIComponent(procedimento)}%0AData: ${encodeURIComponent(data)}%0AHorário: ${encodeURIComponent(hora)}`;
    const msgStudio=`Novo agendamento pelo link.%0A%0ACliente: ${encodeURIComponent(nome)}%0AWhatsApp: ${encodeURIComponent(wpp)}%0AProcedimento: ${encodeURIComponent(procedimento)}%0AData: ${encodeURIComponent(data)}%0AHorário: ${encodeURIComponent(hora)}${obs?'%0AObs: '+encodeURIComponent(obs):''}`;
    try{ notifyLocal('Agendamento enviado', `${procedimento} em ${data} às ${hora}`); }catch(e){}
    if(sent){
      alert('Agendamento enviado e registrado ✅\nVocê receberá a confirmação pelo studio.');
      if(studioTel) window.open(`https://wa.me/55${studioTel}?text=${msgStudio}`,'_blank','noopener,noreferrer');
      renderPublicV83();
    }else if(studioTel){
      alert('Não consegui gravar direto no banco. Vou abrir o WhatsApp para enviar o pedido ao studio.');
      window.open(`https://wa.me/55${studioTel}?text=${msgStudio}`,'_blank','noopener,noreferrer');
    }else alert('Pedido preparado, mas este link ainda não tem identificação do studio para gravar direto. Gere novamente o link estando logado.');
  }
  function findClient(nome,wpp){
    const nd=clean(nome).toLowerCase(), wd=digits(wpp);
    return (state.clientes||[]).find(c=>digits(c.wpp||c.tel)===wd || clean(c.nome).toLowerCase()===nd);
  }
  function slotBusyLocal(data,hora,ignoreRequestId){
    return (state.agenda||[]).some(a=>a&&String(a.data)===String(data)&&String(a.hora).slice(0,5)===String(hora).slice(0,5)&&String(a.status||'').toLowerCase()!=='cancelado'&&String(a.publicRequestId||'')!==String(ignoreRequestId||''));
  }
  async function saveAll(reason){
    // Gravação forte: local + Firebase antes de considerar o autoagendamento processado.
    try{
      state.meta = state.meta && typeof state.meta==='object' ? state.meta : {};
      state.meta.rev = Number(state.meta.rev||0) + 1;
      state.meta.updatedAt = Date.now();
      state.meta.reason = reason || BUILD;
      window.__SJM_LAST_PUBLIC_BOOKING_AT = Date.now();
    }catch(e){}
    try{ if(typeof saveSoft==='function') saveSoft(reason||BUILD); else if(typeof save==='function') save(); }catch(e){}
    try{
      const raw = JSON.stringify(state);
      const keys = [
        'sjm_sync_pro_v1','studio_sync_pro_db','studio_sync_pro_unico_v1',
        'studioSyncState','studio_sync_pro_db__last_good'
      ];
      try{ if(typeof ACTIVE_STORAGE_KEY !== 'undefined' && ACTIVE_STORAGE_KEY) keys.push(ACTIVE_STORAGE_KEY); }catch(e){}
      try{ if(typeof KEY !== 'undefined' && KEY) keys.push(KEY); }catch(e){}
      [...new Set(keys)].forEach(k=>{ try{ localStorage.setItem(k, raw); }catch(e){} });
    }catch(e){}
    try{ if(typeof scheduleCloudPush==='function') scheduleCloudPush(); }catch(e){}
    try{ if(typeof window.__SJM_PUSH_TO_CLOUD==='function') await window.__SJM_PUSH_TO_CLOUD(state); }catch(e){ console.warn(BUILD,'push imediato falhou:',e); }
    setTimeout(()=>{ try{ window.__SJM_PUSH_TO_CLOUD?.(state); }catch(e){} }, 700);
    setTimeout(()=>{ try{ window.__SJM_PUSH_TO_CLOUD?.(state); }catch(e){} }, 2200);
    setTimeout(publishPublic,250);
  }
  function notifyLocal(title,body){
    try{
      if(!('Notification' in window)) return;
      if(Notification.permission==='granted') new Notification(title,{body});
      else if(Notification.permission==='default') Notification.requestPermission().then(p=>{ if(p==='granted') new Notification(title,{body}); });
    }catch(e){}
  }
  window.__SJM_HANDLE_PUBLIC_BOOKING_REQUEST = async function(req){
    try{
      state.agenda=Array.isArray(state.agenda)?state.agenda:[];
      state.clientes=Array.isArray(state.clientes)?state.clientes:[];
      state.autoagendamentoPedidosProcessados=Array.isArray(state.autoagendamentoPedidosProcessados)?state.autoagendamentoPedidosProcessados:[];
      if(state.autoagendamentoPedidosProcessados.includes(req.id)) return;
      if(state.agenda.some(a=>String(a.publicRequestId||'')===String(req.id))){ state.autoagendamentoPedidosProcessados.push(req.id); return; }
      if(slotBusyLocal(req.data, req.hora, req.id)){
        notifyLocal('Conflito de autoagendamento', `${req.cliente||'Cliente'} tentou ${req.data} às ${req.hora}, mas o horário já está ocupado.`);
        try{ await window.__SJM_MARK_PUBLIC_BOOKING_REQUEST?.(req.id,{statusPedido:'conflito',motivo:'Horário ocupado',sourceStudioKey:req.__sourceStudioKey||''}); }catch(e){}
        return;
      }
      const c=findClient(req.cliente, req.wpp);
      if(!c) state.clientes.push({id:'cli_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),nome:req.cliente||'Cliente',wpp:req.wpp||'',tel:req.wpp||'',obs:'Criada pelo autoagendamento',fotos:[]});
      state.agenda.push({id:'ag_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),cliente:req.cliente||'Cliente',wpp:req.wpp||'',procedimento:req.procedimento||'Procedimento',data:req.data,hora:req.hora,status:'Confirmado',valor:Number(req.valor||0)||0,recebido:0,obs:req.obs||'',origem:'autoagendamento',publicRequestId:req.id,criadoEm:req.criadoEm||new Date().toISOString()});
      state.autoagendamentoPedidosProcessados.push(req.id);
      await saveAll('autoagendamento-recebido');
      try{ if(typeof renderAgendaHard==='function') renderAgendaHard(); if(typeof renderCalendar==='function') renderCalendar(); if(typeof renderClientes==='function') renderClientes(); if(typeof renderDashboard==='function') renderDashboard(); }catch(e){}
      notifyLocal('Novo agendamento confirmado', `${req.cliente} • ${req.procedimento} • ${req.data} às ${req.hora}`);
      try{ await window.__SJM_MARK_PUBLIC_BOOKING_REQUEST?.(req.id,{statusPedido:'processado',sourceStudioKey:req.__sourceStudioKey||'',ownerKey:req.ownerKey||''}); }catch(e){}
    }catch(e){ console.warn(BUILD,'handle request:',e); }
  };
  function enhanceAdminLink(){
    try{
      const link=publicLinkV83();
      if($('agLink')) $('agLink').value=link;
      const copy=$('btnCopiarLinkAg');
      if(copy && !copy.__v83){ copy.__v83=true; copy.addEventListener('click',async(e)=>{ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if($('agLink')) $('agLink').value=link; await navigator.clipboard?.writeText(link); alert('Link do autoagendamento copiado ✅'); publishPublic(); }catch(err){} }, true); }
      const save=$('btnSalvarAutoAg');
      if(save && !save.__v83){ save.__v83=true; save.addEventListener('click',()=>setTimeout(()=>{ publishPublic(); enhanceAdminLink(); },200), true); }
    }catch(e){}
  }
  function boot(){
    try{ enhanceAdminLink(); publishPublic(); }catch(e){}
    if(isPublic()) loadPublicData().then(()=>renderPublicV83()); else renderPublicV83();
  }
  document.addEventListener('submit',submitPublicV83,true);
  window.addEventListener('hashchange',()=>setTimeout(boot,100));
  document.addEventListener('DOMContentLoaded',()=>[100,600,1500,3000].forEach(t=>setTimeout(boot,t)));
  setInterval(()=>{ try{ if(!isPublic()) publishPublic(); }catch(e){} }, 60000);
  setInterval(()=>{ try{ enhanceAdminLink(); }catch(e){} }, 2500);
  setTimeout(boot,200); setTimeout(boot,1600); setTimeout(boot,3500);
})();


/* =========================================================
   v86 base v80 — Correção real da rota pública de autoagendamento
   - #agendar/slug não cai mais na trava de Plano Premium
   - link sem sid usa o slug público do studio
   - mantém app principal intacto
   ========================================================= */
(function publicBookingRouteGuardV85(){
  function isPublic(){ return /^#agendar(\/|$)/i.test(String(location.hash||'')); }
  function apply(){
    if(isPublic()){
      try{ document.body.classList.add('sjm-public-booking'); document.body.classList.remove('auth-locked'); }catch(e){}
      try{ document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active')); }catch(e){}
      try{ document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); }catch(e){}
    }
  }
  const oldAlert=window.alert;
  window.alert=function(msg){
    if(isPublic() && /Plano|Premium|plano superior/i.test(String(msg||''))){ apply(); return; }
    return oldAlert.apply(this, arguments);
  };
  window.addEventListener('hashchange',()=>setTimeout(apply,20));
  document.addEventListener('DOMContentLoaded',()=>[20,120,500,1200,2500].forEach(t=>setTimeout(apply,t)));
  setTimeout(apply,20); setTimeout(apply,600); setTimeout(apply,1800);
})();
