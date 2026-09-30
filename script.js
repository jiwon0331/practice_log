"use strict";
(() => {
  const PROGRAM_KEY = "violinPracticeProgram";
  const LOGS_KEY = "violinPracticeLogs";
  const defaults = [
    { id: "warmup-group", name: "Warm-up", type: "group", children: [{ id: "warmup", name: "Warm-up" }] },
    { id: "scales", name: "Scales System", type: "group", children: [
      { id: "arpeggios", name: "Arpeggios" }, { id: "thirds", name: "3rds" },
      { id: "sixths", name: "6ths" }, { id: "octaves", name: "Octaves" },
      { id: "star", name: "*" }, { id: "chromatics", name: "Chromatics" }
    ] },
    { id: "etude", name: "Etude", type: "single" },
    { id: "mozart", name: "Mozart No. 5", heading: "Mozart", type: "single" },
    { id: "repertoire", name: "Repertoire", type: "single" }
  ];
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const leaves = program => program.flatMap(item => item.type === "group" ? item.children : [item]);
  let storageProblem = false;
  function warn(message) { storageProblem = true; $("storage-status").textContent = message; $("storage-status").classList.add("error"); }
  function validProgram(value) {
    const ids = new Set();
    const validItem = item => {
      if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(item.id) || ["__proto__", "constructor", "prototype"].includes(item.id) || ids.has(item.id) || typeof item.name !== "string" || !item.name.trim()) return false;
      ids.add(item.id); return true;
    };
    return Array.isArray(value) && value.every(item => validItem(item) &&
      (item.type === "single" || (item.type === "group" && Array.isArray(item.children) && item.children.every(validItem))));
  }
  function read(key, fallback, validate) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return copy(fallback);
      const value = JSON.parse(raw);
      if (!validate(value)) throw new Error("Invalid data");
      return value;
    } catch (_) { warn("Some saved data could not be read. Available records are still shown."); return copy(fallback); }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); if (!storageProblem) $("storage-status").textContent = "Saved on this device"; }
    catch (_) { warn("Changes cannot be saved on this device. Keep this page open to retain this session."); }
  }
  let program = read(PROGRAM_KEY, defaults, validProgram);
  const logs = read(LOGS_KEY, {}, value => value && typeof value === "object" && !Array.isArray(value));
  // Keep the original leaf ID so existing minutes, checks, and timers remain attached.
  program = program.map(section => section.id === "warmup" && section.type === "single"
    ? { id: makeId(), name: "Warm-up", type: "group", children: [{ id: section.id, name: section.name }] }
    : section);
  function dateKey(date) { return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  function parseDate(key) { const date = new Date(0); const [y,m,d] = key.split("-").map(Number); date.setFullYear(y,m-1,d); date.setHours(12,0,0,0); return date; }
  function validDate(key) { return /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= "0001-01-01" && key <= "9999-12-31" && dateKey(parseDate(key)) === key; }
  function minutes(value) { const number = Number(value); return Number.isFinite(number) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number))) : 0; }
  let selected = dateKey(new Date());
  let log;
  let timerRows = [];
  function activeTimer() { return logs._activeTimer || null; }
  function validTimer(timer) {
    return timer && validDate(timer.date) && typeof timer.itemId === "string" &&
      Number.isFinite(timer.startedAt) && timer.startedAt > 0 &&
      own(logs, timer.date) && validProgram(logs[timer.date]?.programSnapshot) &&
      leaves(logs[timer.date].programSnapshot).some(item => item.id === timer.itemId);
  }
  if (logs._activeTimer && !validTimer(logs._activeTimer)) {
    logs._activeTimer = null;
    warn("A saved timer could not be restored. Your practice records are still available.");
  }
  function meaningful(record, id, date) {
    const state = record.items?.[id];
    const timer = activeTimer();
    return state?.completed || minutes(state?.minutes) > 0 || state?.timerSeconds > 0 ||
      (timer?.date === date && timer.itemId === id);
  }
  // Reconcile only today/future snapshots. Keep removed leaves with meaningful work.
  function syncCurrentLogs() {
    const today = dateKey(new Date());
    for (const [date, record] of Object.entries(logs)) {
      if (!validDate(date) || date < today || !validProgram(record?.programSnapshot)) continue;
      const next = copy(program);
      const currentIds = new Set(leaves(next).map(item => item.id));
      for (const section of record.programSnapshot) {
        const retained = leaves([section]).filter(item => !currentIds.has(item.id) && meaningful(record, item.id, date));
        if (!retained.length) continue;
        const matchingGroup = next.find(item => item.id === section.id && item.type === "group");
        if (matchingGroup) matchingGroup.children.push(...copy(retained));
        else next.push(section.type === "group" ? { ...copy(section), children: copy(retained) } : copy(section));
      }
      record.programSnapshot = next;
      if (!record.items || typeof record.items !== "object" || Array.isArray(record.items)) record.items = {};
      for (const item of leaves(next)) {
        const state = record.items[item.id];
        record.items[item.id] = { ...state, completed: state?.completed === true, minutes: minutes(state?.minutes) };
      }
    }
  }
  function elapsedSeconds(timer, now = Date.now()) { return Math.max(0, Math.floor((now - timer.startedAt) / 1000)); }
  function stopTimer() {
    const timer = activeTimer();
    if (!timer) return;
    if (validTimer(timer)) {
      const record = logs[timer.date];
      if (!record.items || typeof record.items !== "object" || Array.isArray(record.items)) record.items = {};
      const state = record.items[timer.itemId] || { completed: false, minutes: 0 };
      const seconds = elapsedSeconds(timer);
      record.items[timer.itemId] = { ...state, minutes: minutes(minutes(state.minutes) + Math.round(seconds / 60)), timerSeconds: minutes(state.timerSeconds) + seconds };
    }
    // Timer clearing and credited minutes are one localStorage write, avoiding double credit on refresh.
    logs._activeTimer = null;
    saveLog();
  }
  function toggleTimer(itemId) {
    const stopping = activeTimer()?.date === selected && activeTimer()?.itemId === itemId;
    stopTimer();
    if (!stopping) logs._activeTimer = { itemId, date: selected, startedAt: Date.now() };
    saveLog(); renderChecklist(); updateSummary();
  }
  function tickTimers() {
    const timer = activeTimer();
    for (const entry of timerRows) {
      const running = timer?.date === selected && timer.itemId === entry.id;
      entry.row.classList.toggle("timing", running);
      entry.duration.hidden = running; entry.elapsed.hidden = !running;
      entry.button.textContent = running ? "Stop" : "Start";
      entry.button.setAttribute("aria-label", `${running ? "Stop" : "Start"} timer for ${entry.name}`);
      if (running) {
        const seconds = elapsedSeconds(timer);
        entry.elapsed.textContent = [Math.floor(seconds/3600), Math.floor(seconds/60)%60, seconds%60].map(n => String(n).padStart(2,"0")).join(":");
      }
    }
  }
  function renderPreviousNote() {
    const previous = parseDate(selected); previous.setDate(previous.getDate() - 1);
    const key = dateKey(previous);
    const note = own(logs, key) && typeof logs[key]?.note === "string" ? logs[key].note : "";
    $("previous-note").hidden = !note.trim();
    $("previous-note-title").textContent = `Previous Day · ${previous.toLocaleDateString("en-US", {month:"long", day:"numeric", year:"numeric"})}`;
    $("previous-note-text").textContent = note;
  }
  function saveLog() { write(LOGS_KEY, logs); }
  function openDate(key) {
    if (!validDate(key)) return;
    selected = key;
    const existing = own(logs, key) ? logs[key] : null;
    if (!existing || !validProgram(existing.programSnapshot)) {
      if (existing) warn("This date's saved record could not be read. A new practice page was created.");
      logs[key] = { programSnapshot: copy(program), items: {}, note: "" };
    }
    log = logs[key];
    if (!log.items || typeof log.items !== "object" || Array.isArray(log.items)) log.items = {};
    for (const item of leaves(log.programSnapshot)) {
      const state = own(log.items, item.id) ? log.items[item.id] : null;
      log.items[item.id] = { ...state, completed: state?.completed === true, minutes: minutes(state?.minutes) };
    }
    if (typeof log.note !== "string") log.note = "";
    saveLog();
    $("date-picker").value = key;
    $("date-title").textContent = parseDate(key).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
    $("date-context").textContent = key === dateKey(new Date()) ? "TODAY'S PRACTICE" : parseDate(key).toLocaleDateString("en-US", {weekday:"long"}).toUpperCase();
    $("previous").disabled = key === "0001-01-01";
    $("next").disabled = key === "9999-12-31";
    $("daily-note").value = log.note;
    renderChecklist(); updateSummary(); renderPreviousNote();
  }
  function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function renderChecklist() {
    const root = $("checklist"); root.replaceChildren();
    timerRows = [];
    if (!leaves(log.programSnapshot).length) root.append(element("p", "empty", "No practice items for this date. Add items in Settings for dates you open next."));
    log.programSnapshot.forEach((section, index) => {
      const card = element("section", "practice-card");
      const heading = element("div", "card-heading");
      heading.append(element("span", "card-number", String(index+1).padStart(2,"0")), element("h3", "", section.heading || section.name));
      card.append(heading);
      for (const item of section.type === "group" ? section.children : [section]) {
        const row = element("div", "practice-row");
        const label = element("label", "check-label");
        const check = element("input"); check.type = "checkbox"; check.checked = log.items[item.id].completed;
        check.addEventListener("change", () => { log.items[item.id].completed = check.checked; updateSummary(); saveLog(); });
        label.append(check, element("span", "", item.name));
        const duration = element("label", "duration");
        const input = element("input"); input.type = "number"; input.min = "0"; input.step = "1"; input.inputMode = "numeric"; input.value = log.items[item.id].minutes;
        input.setAttribute("aria-label", `${item.name} practice minutes`);
        input.addEventListener("keydown", event => { if (["-", "+", "e", "E", "."].includes(event.key)) event.preventDefault(); });
        input.addEventListener("input", () => { const value = minutes(input.value); log.items[item.id].minutes = value; if (input.value !== "" && Number(input.value) !== value) input.value = value; updateSummary(); saveLog(); });
        input.addEventListener("blur", () => { input.value = log.items[item.id].minutes; });
        duration.append(input, element("span", "", "min"));
        const controls = element("div", "practice-controls");
        const elapsed = element("span", "elapsed"); elapsed.setAttribute("role", "timer"); elapsed.setAttribute("aria-label", `${item.name} elapsed time`);
        const button = element("button", "timer-button", "Start");
        button.addEventListener("click", () => toggleTimer(item.id));
        controls.append(duration, elapsed, button); row.append(label, controls); card.append(row);
        timerRows.push({ id:item.id, name:item.name, row, duration, elapsed, button });
      }
      root.append(card);
    });
    tickTimers();
  }
  function updateSummary() {
    const items = leaves(log.programSnapshot);
    const complete = items.filter(item => log.items[item.id].completed).length;
    const total = items.reduce((sum,item) => sum + log.items[item.id].minutes, 0);
    const percent = items.length ? Math.round(complete/items.length*100) : 0;
    $("completed-total").textContent = `${complete} / ${items.length}`;
    $("practice-total").textContent = total < 60 ? `${total}m` : `${Math.floor(total/60)}h ${total%60}m`;
    $("percentage").textContent = `${percent}%`;
    $("progress").setAttribute("aria-valuenow", percent); $("progress-fill").style.width = `${percent}%`;
  }
  function saveProgram() { write(PROGRAM_KEY, program); syncCurrentLogs(); saveLog(); }
  function makeId() { return "item_" + (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }
  function editRow(item, remove) {
    const row = element("div", "edit-row"); const input = element("input"); input.type = "text"; input.value = item.name; input.setAttribute("aria-label", `Practice item name: ${item.name}`);
    input.addEventListener("input", () => {
      if (!input.value.trim()) return;
      item.name = input.value.trim(); saveProgram();
      button.setAttribute("aria-label", `Delete ${item.name}`);
      if (program.includes(item)) row.closest(".editor-card").querySelector("h3").textContent = item.heading || item.name;
    });
    input.addEventListener("blur", () => { input.value = item.name; });
    const button = element("button", "delete", "Delete"); button.setAttribute("aria-label", `Delete ${item.name}`);
    button.addEventListener("click", () => { remove(); saveProgram(); renderEditor(); $("add-single").focus(); });
    row.append(input, button); return row;
  }
  function addItemForm(button, add) {
    const form = element("form", "add-item-form");
    const label = element("label", "", "Practice item name");
    const input = element("input"); input.type = "text"; input.required = true; input.placeholder = "e.g. Bach";
    label.append(input);
    const actions = element("div", "add-actions");
    const submit = element("button", "", "Add"); submit.type = "submit";
    const cancel = element("button", "", "Cancel"); cancel.type = "button";
    const close = () => { form.remove(); button.hidden = false; button.focus(); };
    cancel.addEventListener("click", close);
    form.addEventListener("submit", event => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      const item = { id: makeId(), name }; add(item); close(); saveProgram(); renderEditor(item.id);
    });
    actions.append(submit, cancel); form.append(label, actions); button.after(form); button.hidden = true; input.focus();
  }
  function renderEditor(focusId) {
    const root = $("program-editor"); root.replaceChildren();
    program.forEach(section => {
      const card = element("section", "editor-card");
      const heading = element("div", "editor-heading"); heading.append(element("h3", "", section.heading || section.name)); card.append(heading);
      if (section.type === "group") {
        section.children.forEach(child => { const row = editRow(child, () => { section.children = section.children.filter(item => item.id !== child.id); }); row.dataset.itemId = child.id; card.append(row); });
        const add = element("button", "add-child", `+ Add item to ${section.name}`);
        add.addEventListener("click", () => addItemForm(add, item => section.children.push(item))); card.append(add);
      } else { const row = editRow(section, () => { program = program.filter(item => item.id !== section.id); }); row.dataset.itemId = section.id; card.append(row); }
      root.append(card);
    });
    if (focusId) { const input = [...root.querySelectorAll(".edit-row")].find(row => row.dataset.itemId === focusId)?.querySelector("input"); input?.focus(); input?.select(); }
  }
  function showView(view) { const daily = view === "daily"; $("daily-view").hidden = !daily; $("settings-view").hidden = daily; for (const name of ["daily", "settings"]) { $(name+"-tab").classList.toggle("active", name === view); $(name+"-tab").setAttribute("aria-pressed", name === view); } if (!daily) renderEditor(); else openDate(selected); }
  $("daily-tab").addEventListener("click", () => showView("daily"));
  $("settings-tab").addEventListener("click", () => showView("settings"));
  $("add-single").addEventListener("click", () => addItemForm($("add-single"), item => program.push({ ...item, type: "single" })));
  $("daily-note").addEventListener("input", event => { log.note = event.target.value; saveLog(); });
  $("today").addEventListener("click", () => openDate(dateKey(new Date())));
  for (const [id, step] of [["previous", -1], ["next", 1]]) $(id).addEventListener("click", () => { const date = parseDate(selected); date.setDate(date.getDate()+step); openDate(dateKey(date)); });
  $("date-picker").addEventListener("change", event => { if (validDate(event.target.value)) openDate(event.target.value); else event.target.value = selected; });
  saveProgram(); openDate(selected);
  setInterval(tickTimers, 1000);
  document.addEventListener("visibilitychange", tickTimers);
})();
