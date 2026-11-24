const KEY = "hezu-sunlight-v2";
const MEMBERS = [
  { id: "mia", name: "Mia Lin", short: "Mia" },
  { id: "ryan", name: "Ryan Zhou", short: "Ryan" },
  { id: "cole", name: "Cole Chen", short: "Cole" },
];

const seed = () => ({
  me: "mia",
  house: { name: "Sunlight House", invite: "SUN-8391", rentDay: 1 },
  expenses: [
    { id: "e1", title: "October rent", amount: 4200, paidBy: "mia", splitWith: ["mia", "ryan", "cole"], category: "Rent", note: "Landlord transfer · already cleared", at: "2026-10-01", confirmed: ["mia", "ryan", "cole"], settled: true },
    { id: "e2", title: "September electric", amount: 267, paidBy: "mia", splitWith: ["mia", "ryan", "cole"], category: "Utilities", note: "Meter read 23 Sep", at: "2026-09-24", confirmed: ["mia"] },
    { id: "e3", title: "Tissues & bags", amount: 42, paidBy: "cole", splitWith: ["mia", "ryan", "cole"], category: "Daily", note: "", at: "2026-10-12", confirmed: ["cole"] },
    { id: "e4", title: "Groceries", amount: 96, paidBy: "ryan", splitWith: ["mia", "ryan", "cole"], category: "Daily", note: "Weekend shop", at: "2026-10-18", confirmed: ["ryan", "mia"] },
  ],
  settlements: [],
  choreWeek: [
    { day: "Mon", zone: "Kitchen", person: "mia" },
    { day: "Wed", zone: "Bathroom", person: "ryan" },
    { day: "Fri", zone: "Living", person: "cole" },
    { day: "Sun", zone: "Trash", person: "mia" },
  ],
  todayDuty: { zone: "Bathroom", person: "ryan", due: "22:00" },
  choreLogs: [{ zone: "Trash", person: "mia", note: "Taken out Monday", at: todayISO() }],
  swap: null,
  items: [
    { id: "i1", name: "Tissues", stock: 1, unit: "pack", threshold: 2, next: "ryan", last: "Cole · 12 Oct" },
    { id: "i2", name: "Laundry detergent", stock: 70, unit: "%", threshold: 20, next: "mia", last: "Mia · 2 Oct" },
    { id: "i3", name: "Trash bags", stock: 18, unit: "left", threshold: 8, next: "cole", last: "Cole · 12 Oct" },
    { id: "i4", name: "Oyster sauce", stock: 1, unit: "bottle", threshold: 1, next: "mia", last: "Expires in 11 days", expiring: true },
  ],
  charter: {
    version: "1.2",
    clauses: [
      "Dishes leave the sink before midnight.",
      "Quiet hours 23:00 weekdays, 24:00 weekends.",
      "Overnight guests: post in House, max two nights.",
      "Shared goods: log use; restock in 48h if low.",
      "Confirm splits in 3 days; settle net at month end.",
    ],
    signed: { mia: true, ryan: true, cole: true },
    proposal: null,
  },
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function uid(p) {
  return p + Math.random().toString(36).slice(2, 8);
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return seed();
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

let state = load();
let tab = "home";
let view = { name: "main" };
let toastTimer;

const $app = document.getElementById("app");

function member(id) {
  return MEMBERS.find((m) => m.id === id);
}
function avatar(id) {
  const m = member(id);
  return `<span class="avatar a-${id}">${m.short[0]}</span>`;
}
function money(n) {
  return "$" + Math.abs(Number(n) || 0).toFixed(2);
}

function nets() {
  const net = { mia: 0, ryan: 0, cole: 0 };
  for (const e of state.expenses) {
    if (e.settled) continue;
    const share = e.amount / e.splitWith.length;
    net[e.paidBy] += e.amount;
    for (const id of e.splitWith) net[id] -= share;
  }
  for (const s of state.settlements) {
    net[s.from] += s.amount;
    net[s.to] -= s.amount;
  }
  return net;
}
function paths() {
  const n = nets();
  const debtors = MEMBERS.map((m) => ({ id: m.id, v: n[m.id] })).filter((x) => x.v < -0.5);
  const creditors = MEMBERS.map((m) => ({ id: m.id, v: n[m.id] })).filter((x) => x.v > 0.5);
  const out = [];
  let i = 0, j = 0;
  const d = debtors.map((x) => ({ ...x, v: -x.v }));
  const c = creditors.map((x) => ({ ...x }));
  while (i < d.length && j < c.length) {
    const pay = Math.min(d[i].v, c[j].v);
    if (pay > 0.5) out.push({ from: d[i].id, to: c[j].id, amount: Math.round(pay * 100) / 100 });
    d[i].v -= pay; c[j].v -= pay;
    if (d[i].v < 0.5) i++;
    if (c[j].v < 0.5) j++;
  }
  return out;
}

function toast(msg) {
  clearTimeout(toastTimer);
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  toastTimer = setTimeout(() => el.classList.add("hidden"), 1800);
}

function setTab(name) {
  tab = name;
  view = { name: "main" };
  render();
}

function render() {
  save();
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  $app.innerHTML = `
    <div class="shell">
      <div class="phone">
        <div class="statusbar"><span>${hh}:${mm}</span><span>Hezu</span></div>
        <div class="scroll">${page()}</div>
        <nav class="tabs">
          ${tabBtn("home", "⌂", "Home")}
          ${tabBtn("bills", "$", "Bills")}
          ${tabBtn("chores", "✓", "Chores")}
          ${tabBtn("stuff", "▣", "Stuff")}
          ${tabBtn("house", "⌂", "House")}
        </nav>
        <div id="toast" class="toast hidden"></div>
        ${modal()}
      </div>
    </div>
  `;
  bind();
}

function tabBtn(id, ico, label) {
  return `<button data-tab="${id}" class="${tab === id ? "on" : ""}"><span class="ico">${ico}</span>${label}</button>`;
}

function page() {
  if (tab === "home") return homePage();
  if (tab === "bills") return billsPage();
  if (tab === "chores") return choresPage();
  if (tab === "stuff") return stuffPage();
  return housePage();
}

function homePage() {
  const n = nets();
  const owed = n[state.me];
  const low = state.items.filter((i) => i.stock <= i.threshold || i.expiring);
  const unsigned = MEMBERS.filter((m) => !state.charter.signed[m.id]);
  const duty = state.todayDuty;
  return `
    <div class="kicker">${state.house.name.toUpperCase()}</div>
    <h1>Good ${greeting()}, ${member(state.me).short}</h1>
    <div class="kpi">
      <div class="card"><div class="muted">Harmony</div><b style="font-size:22px">86</b><div class="bar"><i style="width:86%"></i></div></div>
      <div class="card"><div class="muted">Shared spend</div><b style="font-size:22px">$4,862</b><div class="muted">this month</div></div>
    </div>
    <div class="muted" style="font-weight:800;margin:4px 0 8px">TODAY</div>
    <button class="card tap" data-goto="chores">
      <div class="row"><span>Bathroom duty</span><span class="chip warn">${member(duty.person).short}</span></div>
      <div class="muted" style="margin-top:4px">Due ${duty.due} · you are off today</div>
    </button>
    <button class="card tap" data-goto="bills">
      <div class="row">
        <span><b>${owed >= 0 ? "You are owed" : "You owe"}</b><br><span class="muted">${paths().length} open path${paths().length === 1 ? "" : "s"}</span></span>
        <b class="${owed >= 0 ? "ok" : "warn"}">${money(owed)}</b>
      </div>
    </button>
    ${low.map((i) => `
      <button class="card tap" data-goto="stuff" data-item="${i.id}">
        <div class="row"><span><b>${i.name}</b><br><span class="muted">${i.stock} ${i.unit} · ${member(i.next).short} next</span></span>
        <span class="chip ${i.expiring ? "gold" : "warn"}">${i.expiring ? "Expiring" : "Low"}</span></div>
      </button>`).join("")}
    <button class="card tap" data-goto="house">
      <div class="row"><span><b>Charter v${state.charter.version}</b><br><span class="muted">${unsigned.length ? unsigned.map(u => u.short).join(", ") + " to sign" : "3 / 3 confirmed"}</span></span>
      <span class="chip ${unsigned.length ? "warn" : ""}">${unsigned.length ? "Action" : "OK"}</span></div>
    </button>
  `;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function billsPage() {
  if (view.name === "add") return addExpense();
  if (view.name === "detail") return expenseDetail(view.id);
  if (view.name === "settle") return settlePage();
  const n = nets();
  const list = [...state.expenses].reverse();
  return `
    <div class="toprow"><h1>Bills</h1><button class="btn small" data-view="add">+ Add</button></div>
    <div class="kpi">
      <button class="card tap" data-view="settle"><div class="muted">Open net</div><b>${money(paths().reduce((s, p) => s + p.amount, 0))}</b></button>
      <div class="card"><div class="muted">Entries</div><b>${state.expenses.length}</b></div>
    </div>
    ${paths().length ? `
      <button class="card tap" data-view="settle">
        <div class="muted">WHO OWES WHOM</div>
        ${paths().map((p) => `<div class="row" style="margin-top:6px"><span>${member(p.from).short} → ${member(p.to).short}</span><b class="warn">${money(p.amount)}</b></div>`).join("")}
        <div class="muted" style="margin-top:8px">Tap to settle net balances</div>
      </button>` : `<div class="card"><b class="ok">All settled</b><div class="muted">No open paths this month.</div></div>`}
    ${list.map((e) => `
      <button class="card tap" data-detail="${e.id}">
        <div class="row"><b>${e.title}</b><b>${money(e.amount)}</b></div>
        <div class="muted">${member(e.paidBy).short} paid · ${e.category} · ${e.splitWith.length} ways · ${e.confirmed.length}/3 confirmed</div>
      </button>`).join("")}
  `;
}

function addExpense() {
  return `
    <button class="back" data-view="main">← Bills</button>
    <h1>New expense</h1>
    <div class="field">TITLE</div>
    <input class="input" id="ex-title" placeholder="September electric" />
    <div class="field">AMOUNT</div>
    <input class="input" id="ex-amount" type="number" min="0" step="0.01" placeholder="267.00" />
    <div class="field">CATEGORY</div>
    <div class="people" id="ex-cat">
      ${["Rent", "Utilities", "Daily", "Food"].map((c, i) => `<button type="button" data-cat="${c}" class="${i === 1 ? "on" : ""}">${c}</button>`).join("")}
    </div>
    <div class="field">PAID BY</div>
    <div class="people" id="ex-paid">${MEMBERS.map((m) => `<button type="button" data-paid="${m.id}" class="${m.id === state.me ? "on" : ""}">${m.short}</button>`).join("")}</div>
    <div class="field">SPLIT WITH</div>
    <div class="people" id="ex-split">${MEMBERS.map((m) => `<button type="button" data-split="${m.id}" class="on">${m.short}</button>`).join("")}</div>
    <div class="field">NOTE</div>
    <input class="input" id="ex-note" placeholder="Optional" />
    <button class="btn" id="ex-save">Save to house ledger</button>
  `;
}

function expenseDetail(id) {
  const e = state.expenses.find((x) => x.id === id);
  if (!e) return `<p>Missing expense.</p>`;
  const share = e.amount / e.splitWith.length;
  return `
    <button class="back" data-view="main">← Bills</button>
    <span class="chip">${e.category}</span>
    <h1>${money(e.amount)}</h1>
    <p class="sub">${e.title} · ${e.at} · paid by ${member(e.paidBy).name}</p>
    ${e.splitWith.map((id) => `
      <div class="card row">
        <span class="person">${avatar(id)} ${member(id).short}</span>
        <span>${id === e.paidBy ? `<span class="ok">paid ${money(e.amount)}</span>` : `share ${money(share)}`}</span>
      </div>`).join("")}
    ${e.note ? `<div class="card"><div class="muted">NOTE</div>${e.note}</div>` : ""}
    <div class="card"><div class="muted">CONFIRMATIONS</div>
      ${MEMBERS.map((m) => `<div class="row" style="margin-top:6px"><span>${m.short}</span><span class="${e.confirmed.includes(m.id) ? "ok" : "muted"}">${e.confirmed.includes(m.id) ? "Confirmed" : "Pending"}</span></div>`).join("")}
    </div>
    ${e.confirmed.includes(state.me) ? "" : `<button class="btn" data-confirm="${e.id}">Confirm my share</button>`}
  `;
}

function settlePage() {
  const n = nets();
  const list = paths();
  return `
    <button class="back" data-view="main">← Bills</button>
    <h1>Who owes whom</h1>
    <div class="card" style="background:#fff7ee;border-color:#f0d3bc">
      <div class="muted">SUGGESTED PATH</div>
      ${list.length ? list.map((p) => `<div style="margin-top:6px"><b>${member(p.from).short} → ${member(p.to).short} ${money(p.amount)}</b></div>`).join("") : "<b class='ok'>Nothing to settle</b>"}
    </div>
    ${MEMBERS.map((m) => `<div class="card row"><span>${m.short} balance</span><b class="${n[m.id] >= 0 ? "ok" : "warn"}">${n[m.id] >= 0 ? "+" : "−"}${money(n[m.id])}</b></div>`).join("")}
    ${list.map((p, idx) => `<button class="btn ${idx ? "ghost" : ""}" data-pay="${idx}">Mark ${member(p.from).short} → ${member(p.to).short} paid</button>`).join("")}
    ${state.settlements.length ? `<div class="card"><div class="muted">TIMELINE</div>${state.settlements.map((s) => `<div class="muted" style="margin-top:4px">${s.at} · ${member(s.from).short} paid ${member(s.to).short} ${money(s.amount)}</div>`).join("")}</div>` : ""}
  `;
}

function choresPage() {
  if (view.name === "checkin") return checkinPage();
  if (view.name === "swap") return swapPage();
  const duty = state.todayDuty;
  const mine = duty.person === state.me;
  return `
    <h1>This week</h1>
    <div class="cal">
      ${state.choreWeek.map((c) => `
        <div>
          <b>${c.day}</b>
          <div class="slot ${c.person === state.me ? "me" : ""}">${member(c.person).short}<br>${c.zone}</div>
        </div>`).join("")}
    </div>
    <div class="field">TODAY</div>
    <div class="card">
      <div class="row"><b>${duty.zone} · ${member(duty.person).short}</b><span class="chip warn">Due ${duty.due}</span></div>
      <div class="muted" style="margin-top:4px">Sink, floor, bin</div>
    </div>
    ${state.choreLogs.slice(-3).reverse().map((l) => `<div class="card"><b class="ok">${l.zone} logged</b><div class="muted">${member(l.person).short} · ${l.note || "Done"} · ${l.at}</div></div>`).join("")}
    ${state.swap ? `<div class="card"><div class="muted">OPEN SWAP</div><b>${member(state.swap.from).short} ${state.swap.fromZone} ↔ ${member(state.swap.to).short} ${state.swap.toZone}</b></div>` : ""}
    ${mine ? `<button class="btn" data-view="checkin">Check in</button>` : `<button class="btn ghost" data-view="checkin">Log a completed zone</button>`}
    <button class="btn ghost" data-view="swap">${state.swap ? "Review swap" : "Ask to swap"}</button>
  `;
}

function checkinPage() {
  return `
    <button class="back" data-view="main">← Chores</button>
    <span class="chip">Your turn</span>
    <h1>${state.todayDuty.zone} check-in</h1>
    <div class="card">Stove · sink · food waste / floor · bin</div>
    <div class="field">NOTE (OPTIONAL)</div>
    <input class="input" id="chore-note" placeholder="Wiped stove, took compost out." />
    <button class="btn" id="chore-done">Mark done</button>
  `;
}

function swapPage() {
  if (state.swap) {
    return `
      <button class="back" data-view="main">← Chores</button>
      <h1>Swap request</h1>
      <div class="card"><div class="muted">FROM</div><b>${member(state.swap.from).short} · ${state.swap.fromZone}</b></div>
      <div class="card"><div class="muted">OFFER</div><b>${member(state.swap.to).short} · ${state.swap.toZone}</b></div>
      <p class="sub">${state.swap.reason}</p>
      <button class="btn" id="swap-yes">Accept swap</button>
      <button class="btn ghost" id="swap-no">Decline</button>
    `;
  }
  return `
    <button class="back" data-view="main">← Chores</button>
    <h1>Ask to swap</h1>
    <div class="field">YOUR SHIFT</div>
    <div class="card">${state.todayDuty.zone} · ${member(state.todayDuty.person).short}</div>
    <div class="field">SWAP WITH</div>
    <div class="people" id="swap-who">${MEMBERS.filter((m) => m.id !== state.todayDuty.person).map((m, i) => `<button data-who="${m.id}" class="${i === 0 ? "on" : ""}">${m.short}</button>`).join("")}</div>
    <div class="field">REASON</div>
    <input class="input" id="swap-reason" value="Client dinner until 21:30." />
    <button class="btn" id="swap-send">Send request</button>
  `;
}

function stuffPage() {
  if (view.name === "item") return itemPage(view.id);
  if (view.name === "additem") return addItemPage();
  if (view.name === "restock") return restockPage(view.id);
  return `
    <div class="toprow"><h1>Shared stuff</h1><button class="btn small" data-view="additem">+ Item</button></div>
    ${state.items.map((i) => {
      const pct = i.unit === "%" ? i.stock : Math.min(100, (i.stock / Math.max(i.threshold * 3, 1)) * 100);
      const low = i.stock <= i.threshold || i.expiring;
      return `
        <button class="card tap" data-item="${i.id}">
          <div class="row"><b>${i.name}</b><span class="chip ${i.expiring ? "gold" : low ? "warn" : ""}">${i.expiring ? "Expiring" : low ? "Low" : "OK"}</span></div>
          <div class="bar ${low && !i.expiring ? "orange" : ""}"><i style="width:${Math.max(8, pct)}%"></i></div>
          <div class="muted">${i.stock} ${i.unit} · ${member(i.next).short} next · ${i.last}</div>
        </button>`;
    }).join("")}
  `;
}

function itemPage(id) {
  const i = state.items.find((x) => x.id === id);
  if (!i) return "";
  return `
    <button class="back" data-view="main">← Stuff</button>
    ${i.stock <= i.threshold ? `<span class="chip warn">Below threshold</span>` : `<span class="chip">In stock</span>`}
    <h1>${i.name}</h1>
    <div class="card row"><span>Stock</span><b>${i.stock} ${i.unit}</b></div>
    <div class="card row"><span>Alert at</span><b>${i.threshold} ${i.unit}</b></div>
    <div class="card row"><span>Last buy</span><b>${i.last}</b></div>
    <div class="card row"><span>Next buyer</span><b>${member(i.next).short}</b></div>
    <button class="btn" data-consume="${i.id}">Consume 1</button>
    <button class="btn orange" data-restock="${i.id}">I restocked</button>
  `;
}

function addItemPage() {
  return `
    <button class="back" data-view="main">← Stuff</button>
    <h1>Register item</h1>
    <div class="field">NAME</div>
    <input class="input" id="it-name" placeholder="Dish soap" />
    <div class="field">STOCK</div>
    <input class="input" id="it-stock" type="number" value="2" />
    <div class="field">UNIT</div>
    <input class="input" id="it-unit" value="bottle" />
    <div class="field">ALERT AT</div>
    <input class="input" id="it-th" type="number" value="1" />
    <div class="field">NEXT BUYER</div>
    <div class="people" id="it-next">${MEMBERS.map((m, i) => `<button data-next="${m.id}" class="${i === 0 ? "on" : ""}">${m.short}</button>`).join("")}</div>
    <button class="btn" id="it-save">Save item</button>
  `;
}

function restockPage(id) {
  const i = state.items.find((x) => x.id === id);
  return `
    <button class="back" data-item="${id}">← ${i.name}</button>
    <h1>Restock → bill</h1>
    <input class="input" id="rs-title" value="${i.name}, restock" />
    <div class="field">AMOUNT</div>
    <input class="input" id="rs-amount" type="number" step="0.01" value="28.50" />
    <div class="field">PAID BY</div>
    <div class="people" id="rs-paid">${MEMBERS.map((m) => `<button data-paid="${m.id}" class="${m.id === i.next ? "on" : ""}">${m.short}</button>`).join("")}</div>
    <div class="card"><div class="muted">STOCK UPDATE</div>${i.stock} → ${i.stock + (i.unit === "%" ? 80 - i.stock : Math.max(3, i.threshold + 2))} ${i.unit} · alert cleared</div>
    <button class="btn" id="rs-save" data-id="${id}">Save item + ledger</button>
  `;
}

function housePage() {
  if (view.name === "charter") return charterPage();
  if (view.name === "propose") return proposePage();
  const unsigned = MEMBERS.filter((m) => !state.charter.signed[m.id]);
  return `
    <h1>House</h1>
    <p class="sub">${state.house.name} · invite ${state.house.invite} · rent on the ${state.house.rentDay}st</p>
    <div class="field">WHO IS VIEWING</div>
    <div class="people" id="me-switch">${MEMBERS.map((m) => `<button data-me="${m.id}" class="${state.me === m.id ? "on" : ""}">${m.short}</button>`).join("")}</div>
    ${MEMBERS.map((m) => `
      <div class="card row">
        <span class="person">${avatar(m.id)} ${m.name}</span>
        <span class="muted">${m.id === "mia" ? "Admin" : "Member"}</span>
      </div>`).join("")}
    <button class="card tap" data-view="charter">
      <div class="row"><span><b>Charter v${state.charter.version}</b><br><span class="muted">${unsigned.length ? "Signature needed" : "Locked · 3 / 3 signed"}</span></span><span class="chip ${unsigned.length ? "warn" : ""}">${unsigned.length ? "Sign" : "Open"}</span></div>
    </button>
    <button class="btn ghost" id="reset-demo">Reset demo data</button>
  `;
}

function charterPage() {
  const c = state.charter;
  return `
    <button class="back" data-view="main">← House</button>
    <span class="chip">Active</span>
    <h1>Charter v${c.version}</h1>
    <p class="sub">${MEMBERS.filter((m) => c.signed[m.id]).length} / 3 confirmed</p>
    ${c.clauses.map((t, i) => `<div class="card clause"><b>${i + 1}.</b> ${t}</div>`).join("")}
    ${MEMBERS.map((m) => `<div class="card row"><span class="person">${avatar(m.id)} ${m.short}</span><span class="${c.signed[m.id] ? "ok" : "warn"}">${c.signed[m.id] ? "Signed" : "Required"}</span></div>`).join("")}
    ${c.signed[state.me] ? "" : `<button class="btn" id="sign-now">I agree to v${c.version}</button>`}
    <button class="btn ghost" data-view="propose">Propose an edit</button>
    ${c.proposal ? `<div class="card"><div class="muted">OPEN VOTE · v1.3</div><b>${c.proposal.text}</b>${MEMBERS.map((m) => `<div class="row" style="margin-top:6px"><span>${m.short}</span><span>${c.proposal.votes[m.id] ? "Yes" : "Pending"}</span></div>`).join("")}
      ${c.proposal.votes[state.me] ? "" : `<button class="btn small" style="margin-top:8px" id="vote-yes">Vote yes</button>`}
    </div>` : ""}
  `;
}

function proposePage() {
  return `
    <button class="back" data-view="charter">← Charter</button>
    <span class="chip gold">Amendment</span>
    <h1>Propose v1.3</h1>
    <div class="field">CLAUSE</div>
    <textarea id="prop-text">Quiet hours start at 22:30 before workdays.</textarea>
    <button class="btn" id="prop-send">Start vote</button>
  `;
}

function modal() { return ""; }

function on(sel, ev, fn) {
  document.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
}

function bind() {
  on("[data-tab]", "click", (e) => setTab(e.currentTarget.dataset.tab));
  on("[data-goto]", "click", (e) => {
    tab = e.currentTarget.dataset.goto;
    view = e.currentTarget.dataset.item ? { name: "item", id: e.currentTarget.dataset.item } : { name: "main" };
    render();
  });
  on("[data-view]", "click", (e) => { view = { name: e.currentTarget.dataset.view }; render(); });
  on("[data-detail]", "click", (e) => { view = { name: "detail", id: e.currentTarget.dataset.detail }; render(); });
  on("[data-item]", "click", (e) => { view = { name: "item", id: e.currentTarget.dataset.item }; render(); });
  on("[data-restock]", "click", (e) => { view = { name: "restock", id: e.currentTarget.dataset.restock }; render(); });
  on("[data-me]", "click", (e) => { state.me = e.currentTarget.dataset.me; toast("Viewing as " + member(state.me).short); render(); });

  on("#ex-cat button", "click", (e) => { document.querySelectorAll("#ex-cat button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); });
  on("#ex-paid button, #rs-paid button, #it-next button, #swap-who button", "click", (e) => {
    e.currentTarget.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
    e.currentTarget.classList.add("on");
  });
  on("#ex-split button", "click", (e) => e.currentTarget.classList.toggle("on"));

  const saveEx = document.getElementById("ex-save");
  if (saveEx) saveEx.onclick = () => {
    const title = document.getElementById("ex-title").value.trim() || "Untitled expense";
    const amount = Number(document.getElementById("ex-amount").value);
    if (!amount) return toast("Enter an amount");
    const paidBy = document.querySelector("#ex-paid .on").dataset.paid;
    const splitWith = [...document.querySelectorAll("#ex-split .on")].map((b) => b.dataset.split);
    if (!splitWith.length) return toast("Pick at least one person");
    const category = document.querySelector("#ex-cat .on").dataset.cat;
    const note = document.getElementById("ex-note").value.trim();
    state.expenses.push({ id: uid("e"), title, amount, paidBy, splitWith, category, note, at: todayISO(), confirmed: [paidBy] });
    view = { name: "main" };
    toast("Saved to ledger");
    render();
  };

  on("[data-confirm]", "click", (e) => {
    const ex = state.expenses.find((x) => x.id === e.currentTarget.dataset.confirm);
    if (ex && !ex.confirmed.includes(state.me)) ex.confirmed.push(state.me);
    toast("Share confirmed");
    render();
  });

  on("[data-pay]", "click", (e) => {
    const p = paths()[Number(e.currentTarget.dataset.pay)];
    if (!p) return;
    state.settlements.push({ ...p, at: todayISO(), method: "Alipay" });
    toast("Marked paid");
    render();
  });

  const choreDone = document.getElementById("chore-done");
  if (choreDone) choreDone.onclick = () => {
    const note = document.getElementById("chore-note").value.trim();
    state.choreLogs.push({ zone: state.todayDuty.zone, person: state.me, note, at: todayISO() });
    view = { name: "main" };
    toast("Check-in saved");
    render();
  };

  const swapSend = document.getElementById("swap-send");
  if (swapSend) swapSend.onclick = () => {
    const to = document.querySelector("#swap-who .on").dataset.who;
    state.swap = {
      from: state.todayDuty.person,
      fromZone: state.todayDuty.zone,
      to,
      toZone: state.choreWeek.find((c) => c.person === to)?.zone || "Kitchen",
      reason: document.getElementById("swap-reason").value.trim(),
    };
    view = { name: "main" };
    toast("Swap requested");
    render();
  };
  const swapYes = document.getElementById("swap-yes");
  if (swapYes) swapYes.onclick = () => {
    const s = state.swap;
    const a = state.choreWeek.find((c) => c.person === s.from);
    const b = state.choreWeek.find((c) => c.person === s.to);
    if (a && b) { const t = a.person; a.person = b.person; b.person = t; const z = a.zone; a.zone = b.zone; b.zone = z; }
    if (state.todayDuty.person === s.from) state.todayDuty.person = s.to;
    state.swap = null;
    view = { name: "main" };
    toast("Swap accepted");
    render();
  };
  const swapNo = document.getElementById("swap-no");
  if (swapNo) swapNo.onclick = () => { state.swap = null; view = { name: "main" }; toast("Swap declined"); render(); };

  on("[data-consume]", "click", (e) => {
    const it = state.items.find((x) => x.id === e.currentTarget.dataset.consume);
    if (!it) return;
    it.stock = Math.max(0, it.stock - (it.unit === "%" ? 10 : 1));
    toast("Logged consume");
    render();
  });

  const itSave = document.getElementById("it-save");
  if (itSave) itSave.onclick = () => {
    const name = document.getElementById("it-name").value.trim();
    if (!name) return toast("Name the item");
    state.items.push({
      id: uid("i"),
      name,
      stock: Number(document.getElementById("it-stock").value) || 1,
      unit: document.getElementById("it-unit").value.trim() || "pcs",
      threshold: Number(document.getElementById("it-th").value) || 1,
      next: document.querySelector("#it-next .on").dataset.next,
      last: "Just added",
    });
    view = { name: "main" };
    toast("Item registered");
    render();
  };

  const rsSave = document.getElementById("rs-save");
  if (rsSave) rsSave.onclick = () => {
    const id = rsSave.dataset.id;
    const it = state.items.find((x) => x.id === id);
    const paidBy = document.querySelector("#rs-paid .on").dataset.paid;
    const amount = Number(document.getElementById("rs-amount").value) || 0;
    const title = document.getElementById("rs-title").value.trim();
    it.stock = it.unit === "%" ? 100 : it.stock + Math.max(3, it.threshold + 2);
    it.last = member(paidBy).short + " · restock";
    it.expiring = false;
    if (amount) {
      state.expenses.push({ id: uid("e"), title, amount, paidBy, splitWith: ["mia", "ryan", "cole"], category: "Daily", note: "From inventory restock", at: todayISO(), confirmed: [paidBy] });
    }
    view = { name: "item", id };
    toast("Stock + ledger updated");
    render();
  };

  const sign = document.getElementById("sign-now");
  if (sign) sign.onclick = () => { state.charter.signed[state.me] = true; toast("Charter signed"); render(); };
  const propSend = document.getElementById("prop-send");
  if (propSend) propSend.onclick = () => {
    const text = document.getElementById("prop-text").value.trim();
    state.charter.proposal = { text, votes: { [state.me]: true } };
    view = { name: "charter" };
    toast("Vote opened");
    render();
  };
  const voteYes = document.getElementById("vote-yes");
  if (voteYes) voteYes.onclick = () => {
    state.charter.proposal.votes[state.me] = true;
    const all = MEMBERS.every((m) => state.charter.proposal.votes[m.id]);
    if (all) {
      state.charter.clauses.push(state.charter.proposal.text);
      state.charter.version = "1.3";
      state.charter.signed = { mia: true, ryan: true, cole: false };
      state.charter.proposal = null;
      toast("v1.3 adopted · resignatures needed");
    } else toast("Vote recorded");
    render();
  };

  const reset = document.getElementById("reset-demo");
  if (reset) reset.onclick = () => {
    state = seed();
    toast("Demo reset");
    render();
  };
}

render();
