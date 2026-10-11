const root = document.querySelector("#app"),
  connection = document.querySelector("#connection");
const cats = {
  profession: "Профессия",
  biology: "Биология",
  health: "Здоровье",
  fact: "Факт",
  hobby: "Хобби",
  baggage: "Багаж",
};
const resources = {
  food: "Пища",
  water: "Вода",
  air: "Воздух",
  power: "Энергия",
  medicine: "Медицина",
};
const capabilities = {
  workshop: "Мастерская",
  filtration: "Фильтрация",
  greenhouse: "Теплица",
  backup_power: "Резервный генератор",
};
const timings = {
  before_reveal: "До раскрытия",
  after_owner_reveal: "После своего раскрытия",
  pre_vote: "Перед голосованием",
  post_vote: "После закрытия бюллетеней",
  after_elimination: "После выбывания",
  finale: "В финале",
};
const phases = {
  INTRO: "Знакомство со сценарием",
  SPECIAL_BEFORE_REVEAL: "Окно спецкарт",
  CHARACTER_REVEAL: "Раскрытие характеристик",
  DISCUSSION: "Обсуждение",
  SPECIAL_PRE_VOTE: "Спецкарты перед голосованием",
  VOTING: "Тайное голосование",
  SPECIAL_POST_VOTE: "Оспаривание бюллетеней",
  SPECIAL_AFTER_ELIMINATION: "После выбывания",
  INTERVOTE_DISCUSSION: "Обсуждение между голосованиями",
  SPECIAL_FINALE: "Последний шанс помочь",
  FINISHED: "Партия завершена",
};
let code = new URL(location.href).searchParams.get("room")?.toUpperCase() || "",
  token = localStorage.getItem("bunker42:" + code) || "",
  state = null,
  mode = code ? "join" : "create",
  catalog = { catastrophes: [], profiles: [] },
  busy = false,
  offset = 0,
  lastRev = -1,
  toastTimer,
  pollBusy = false,
  connected = false,
  catalogLoaded = false,
  catalogBusy = false,
  sessionEpoch = 0,
  actionEpoch = 0,
  entryError = "",
  entryName = localStorage.getItem("bunker42-name") || "",
  entryCode = code,
  pendingFocus = null,
  invalidVoteTarget = null;
const choices = new Map();
const detailStates = new Map();
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const me = () => state.players.find((p) => p.id === state.you);
const person = (id) => state.players.find((p) => p.id === id)?.name || "Игрок";
function toast(text) {
  const el = document.querySelector("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 6000);
  el.scrollIntoView({ block: "nearest", behavior: "instant" });
}
async function api(url, body, auth = token) {
  let resp;
  try {
    resp = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw Error(
      "Нет ответа сервера. Проверь связь; таймеры партии продолжаются. Действие могло сохраниться — дождись обновления экрана.",
    );
  }
  let data;
  try {
    data = await resp.json();
  } catch {
    throw Error(
      "Сервер вернул неожиданный ответ. Дождись повторного подключения.",
    );
  }
  if (!resp.ok)
    throw Object.assign(Error(data.error || "Ошибка сервера"), {
      status: resp.status,
    });
  return data;
}
function openSession(nextCode, nextToken) {
  sessionEpoch++;
  code = nextCode;
  token = nextToken;
  state = null;
  invalidVoteTarget = null;
  lastRev = -1;
  connected = false;
  entryCode = code;
  mode = "join";
  choices.clear();
  detailStates.clear();
  history.replaceState(null, "", `?room=${code}`);
  showConnection();
}
function setSession(result) {
  localStorage.setItem("bunker42:" + result.code, result.token);
  openSession(result.code, result.token);
}
function home() {
  sessionEpoch++;
  state = null;
  code = "";
  token = "";
  lastRev = -1;
  connected = false;
  entryCode = "";
  entryError = "";
  choices.clear();
  detailStates.clear();
  history.replaceState(null, "", location.pathname);
  mode = "create";
  invalidVoteTarget = null;
  showConnection();
  render();
}
function showConnection() {
  connection.textContent = token
    ? connected
      ? "● СЕРВЕР ПОДКЛЮЧЁН"
      : "○ НЕТ СВЯЗИ · ПОВТОР"
    : "СОЦИАЛЬНАЯ ИГРА";
  const note = document.querySelector("#connection-note");
  note.hidden = !token || connected;
  note.textContent = state
    ? "Связь потеряна. На экране последние данные; действия временно недоступны. Серверные таймеры продолжаются. Подключаемся автоматически…"
    : "Подключаемся к комнате. Если сервер недоступен, повторим автоматически. Не создавай нового персонажа: твой доступ сохранён в этом браузере.";
}
function focusKey(el) {
  if (!el || !root.contains(el)) return null;
  if (el.id) return { id: el.id };
  const attrs = [
    "data-mode",
    "data-action",
    "data-reveal",
    "data-vote",
    "data-copy",
    "data-rules",
    "data-home",
    "data-leave",
    "data-resume",
    "data-detail",
  ];
  for (const attr of attrs)
    if (el.hasAttribute(attr)) return { attr, value: el.getAttribute(attr) };
  if (el.matches('[type="submit"]')) return { submit: true };
  if (el.tagName === "SUMMARY") return focusKey(el.parentElement);
  return null;
}
function restoreFocus(key) {
  if (!key) return;
  let el = key.id
    ? document.getElementById(key.id)
    : key.submit
      ? root.querySelector('[type="submit"]')
      : [...root.querySelectorAll(`[${key.attr}]`)].find(
          (x) => x.getAttribute(key.attr) === key.value,
        );
  if (el?.tagName === "DETAILS") el = el.querySelector("summary");
  if (el && !el.disabled) el.focus({ preventScroll: true });
  else if (!busy) {
    el = root.querySelector(".phase h2, .room-title, .entry h2");
    if (el) {
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    }
  }
}
function setBusy(value) {
  if (value) pendingFocus = focusKey(document.activeElement);
  busy = value;
  if (value) {
    root.setAttribute("aria-busy", "true");
    root
      .querySelectorAll("button, input, select")
      .forEach((el) => (el.disabled = true));
  } else {
    render();
    pendingFocus = null;
  }
}
function landing() {
  const saved = Object.keys(localStorage)
    .filter((k) => /^bunker42:[A-Z2-9]{6}$/.test(k))
    .slice(-3);
  root.innerHTML = `<div class="landing"><section class="hero"><div class="eyebrow accent">ПРОТОКОЛ 42 / СОЦИАЛЬНОЕ ВЫЖИВАНИЕ</div><h1>Снаружи —<br>конец света.<br><span class="accent">Внутри — спор.</span></h1><p class="lead">Мест хватит не всем. Раскрой своего персонажа, докажи его пользу и реши, кому доверить будущее.</p><div class="protocol"><div><strong>4–16</strong><span>участников</span></div><div><strong>5</strong><span>раундов</span></div><div><strong>½</strong><span>мест в убежище</span></div></div><div class="how"><span class="num">01—03</span><div><h3>Комната. Аргументы. Выбор.</h3><p>Соберите друзей в голосовом чате или за одним столом. У каждого — свой экран.</p></div></div></section><section class="panel entry"><div class="tabs"><button data-mode="create" aria-pressed="${mode === "create"}" class="${mode === "create" ? "" : "ghost"}">Создать</button><button data-mode="join" aria-pressed="${mode === "join"}" class="${mode === "join" ? "" : "ghost"}">Подключиться</button></div><h2>${mode === "create" ? "Открой убежище" : "Вход по коду"}</h2><p class="form-note">${mode === "create" ? "Создай комнату и пригласи друзей по ссылке." : "Попроси код или ссылку у создателя комнаты."}</p><form id="entry-form" aria-describedby="entry-error"><div class="form-row"><label for="name">Твоё имя</label><input id="name" name="name" required maxlength="24" autocomplete="nickname" value="${esc(entryName)}" placeholder="Например, Саша"></div>${mode === "join" ? `<div class="form-row"><label for="code">Код комнаты</label><input id="code" name="code" required maxlength="6" minlength="6" pattern="[A-Za-z2-9]{6}" autocapitalize="characters" value="${esc(entryCode)}" placeholder="Например, HK7R2A" spellcheck="false" autocomplete="off"></div>` : ""}<button class="full" type="submit">${mode === "create" ? "Создать комнату →" : "Войти в комнату →"}</button><p id="entry-error" class="form-error" role="alert" ${entryError ? "" : "hidden"}>${esc(entryError)}</p></form><p class="form-note">Без регистрации. Карты выдаются сервером и остаются приватными до раскрытия.</p><div class="hint">Обновлять страницу можно. Доступ к персонажу хранится в этом браузере — не очищай данные сайта во время партии.</div><button data-rules class="ghost full" id="rules-link">Как играть</button>${saved.length ? `<p class="form-note">Вернуться в свою комнату</p><div class="actions">${saved.map((k) => `<button class="ghost small" data-resume="${esc(k.split(":")[1])}">${esc(k.split(":")[1])}</button>`).join("")}</div>` : ""}</section></div>`;
}
function roomHeader() {
  return `<div class="room-head"><div><div class="eyebrow">${state.state === "LOBBY" ? "Подготовка к эвакуации" : `Партия / Раунд ${state.round || "—"} из 5`}</div><h1 class="room-title">Убежище <span class="room-code">${state.code}</span></h1></div><div class="actions"><button class="ghost small" data-copy>Пригласить</button><button class="ghost small" data-rules>Правила</button><button class="ghost small" ${["SPECIAL_FINALE", "FINISHED"].includes(state.state) || me().status !== "active" ? "data-home" : "data-leave"}>${["SPECIAL_FINALE", "FINISHED"].includes(state.state) || me().status !== "active" ? "На главную" : "Покинуть"}</button></div></div>`;
}
function lobby() {
  const host = state.hostId === state.you;
  root.innerHTML =
    roomHeader() +
    `<div class="grid"><section class="panel"><div class="panel-heading"><h2>Команда собирается</h2><span class="ready-count">${state.players.filter((p) => p.ready).length}/${state.players.length} ГОТОВЫ</span></div>${state.players.map((p) => `<div class="player-row"><div class="avatar">${esc(p.name.slice(0, 1).toUpperCase())}</div><div class="player-name">${esc(p.name)}${p.id === state.you ? " · ты" : ""}<div class="host-badge">${p.id === state.hostId ? "СОЗДАТЕЛЬ КОМНАТЫ" : "УЧАСТНИК"}</div></div><span class="status ${p.ready ? "good" : ""}">${p.ready ? "✓ Готов" : "Ожидает"}</span></div>`).join("")}<button data-action="ready" class="full ${me().ready ? "ghost" : ""}">${me().ready ? "Снять готовность" : "Я готов"}</button><p class="note">Для старта нужно минимум 4 участника. Все должны подтвердить готовность.</p></section><aside class="stack"><section class="panel"><div class="eyebrow">Параметры партии</div><h2 class="scenario-title">Классический режим</h2><p class="muted">5 раундов · места ${Math.floor(state.players.length / 2)} · тайные голоса</p>${host ? `<div class="form-row"><label for="scenario">Катастрофа</label>${catalogLoaded ? "" : '<p class="note">Список сценариев загружается. Пока доступен случайный выбор.</p>'}<select id="scenario"><option value="">Случайная</option>${catalog.catastrophes.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select></div><div class="form-row"><label for="profile">Бункер</label><select id="profile"><option value="">Случайный</option>${catalog.profiles.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("")}</select></div><button class="full" data-action="start" ${state.players.length < 4 || state.players.some((p) => !p.ready) ? "disabled" : ""}>Начать партию</button>` : `<p class="note">${esc(person(state.hostId))} запустит партию, когда все будут готовы.</p>`}</section><section class="panel"><h3>Свои карты — на своём экране</h3><p class="note">Отправь друзьям ссылку кнопкой «Пригласить». Для игры на телефонах все должны открыть один и тот же сервер.</p></section></aside></div>`;
}
function phaseHint() {
  const p = me();
  switch (state.state) {
    case "INTRO":
      return "Изучите угрозу и три условия выживания. Нажмите «Продолжить», когда будете готовы.";
    case "CHARACTER_REVEAL":
      return state.turnId === p.id
        ? state.turnRevealed
          ? "Карта открыта. Можно объяснить её пользу или завершить ход."
          : state.round === 1
            ? "Твой ход: открой профессию."
            : "Твой ход: выбери одну закрытую характеристику."
        : `Выступает ${person(state.turnId)}. Остальные слушают.`;
    case "DISCUSSION":
    case "INTERVOTE_DISCUSSION":
      return "Убедите остальных в своей полезности. Обсуждение закончится по серверному таймеру.";
    case "VOTING":
      return "Выбери другого активного участника. Выбор можно менять до конца таймера.";
    case "SPECIAL_FINALE":
      return "Состав финалистов зафиксирован. Применяйте спецкарты финала. «На главную» только закроет экран: партия и таймер продолжатся, доступ для возврата сохранится.";
    default:
      return "Применяйте подходящие спецкарты. Эффекты разрешаются при закрытии окна, а не по скорости нажатия.";
  }
}
function myCards() {
  const p = me(),
    ownTurn =
      state.state === "CHARACTER_REVEAL" &&
      state.turnId === p.id &&
      p.status === "active";
  return `<section class="panel"><div class="panel-heading"><h2>Твой персонаж</h2><span class="eyebrow">${p.status === "active" ? "В ИГРЕ" : p.status === "withdrawn" ? "ВЫШЕЛ" : "ВЫБЫЛ"}</span></div><div class="cards">${Object.entries(
    cats,
  )
    .map(([c, label]) => {
      const opened = p.revealed.includes(c) || state.state === "FINISHED",
        can =
          ownTurn &&
          !state.turnRevealed &&
          !opened &&
          (state.round !== 1 || c === "profession");
      return `<article class="card ${opened ? "" : "private closed"} ${can ? "can-reveal" : ""}"><span class="label">${label}</span><div class="value">${esc(p.cards[c].title)}</div><span class="meta">${opened ? "✓ Открыто всем" : "Только тебе"}</span>${can ? `<button class="ghost small" data-reveal="${c}" aria-label="Раскрыть: ${label}">Раскрыть</button>` : ""}</article>`;
    })
    .join(
      "",
    )}</div>${ownTurn && state.turnRevealed ? '<button class="full ghost" data-action="end_turn">Завершить выступление →</button>' : ""}${specialBox(p)}</section>`;
}
function specialBox(p) {
  if (!p.special) return "";
  const s = p.special,
    map = {
      SPECIAL_BEFORE_REVEAL: "before_reveal",
      CHARACTER_REVEAL: "after_owner_reveal",
      SPECIAL_PRE_VOTE: "pre_vote",
      SPECIAL_POST_VOTE: "post_vote",
      SPECIAL_AFTER_ELIMINATION: "after_elimination",
      SPECIAL_FINALE: "finale",
    },
    can =
      !p.specialUsed &&
      map[state.state] === s.timing &&
      (p.status === "active" || s.can_use_after_elimination) &&
      (state.state !== "CHARACTER_REVEAL" ||
        (state.turnId === p.id && state.turnRevealed));
  return `<div class="special"><div class="eyebrow accent">СПЕЦКАРТА / ${p.specialUsed ? "ИСПОЛЬЗОВАНА" : esc(timings[s.timing])}</div><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p>${
    can
      ? (s.effect.target
          ? `<label for="special-target">Цель эффекта</label><select id="special-target">${state.players
              .filter((p) => p.status === "active")
              .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
              .join("")}</select>`
          : s.effect.type === "reveal_extra_self"
            ? `<label for="special-category">Дополнительная характеристика</label><select id="special-category">${Object.entries(
                cats,
              )
                .filter(([c]) => !p.revealed.includes(c))
                .map(([c, l]) => `<option value="${c}">${l}</option>`)
                .join("")}</select>`
            : "") +
        '<button data-action="special" class="full">Применить спецкарту</button>'
      : `<p class="note">${p.specialUsed ? "Заявка принята; результат ищи в журнале." : `Окно применения: ${esc(timings[s.timing])}.`}</p>`
  }</div>`;
}
function scenarioBox() {
  return `<section class="panel scenario-panel"><div class="eyebrow accent">Катастрофа</div><h2 class="scenario-title">${esc(state.catastrophe.title)}</h2><p class="muted">${esc(state.catastrophe.description)}</p><ul class="checks">${state.catastrophe.checks.map((c, i) => `<li><span class="check-num">0${i + 1}</span>${esc(c.label)}</li>`).join("")}</ul></section>`;
}
function bunkerBox() {
  return `<section class="panel bunker-panel"><div class="eyebrow">МЕСТ ${state.capacity} / АКТИВНЫХ ${state.players.filter((p) => p.status === "active").length}</div><h3 class="scenario-title">${esc(state.profile.title)}</h3>${Object.entries(
    state.resources,
  )
    .map(
      ([k, v]) =>
        `<div class="resource"><span>${resources[k]} <strong>${v}/5</strong></span><div class="bar" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<i class="${i < v ? "on" : ""}"></i>`).join("")}</div></div>`,
    )
    .join(
      "",
    )}<p class="capability">${state.capabilities.length ? state.capabilities.map((c) => esc(capabilities[c] || c)).join(" · ") : "Дополнительных модулей нет"}</p>${state.bunkerRevealed.map((c, i) => `<div class="bunker-event"><span>РАУНД ${i + 1}</span>${esc(c.title)}<span>${esc(c.description)}</span></div>`).join("")}</section>`;
}
function roster() {
  return `<section class="panel"><div class="panel-heading"><h2>Игровой стол</h2><span class="eyebrow">ПУБЛИЧНЫЕ КАРТЫ</span></div><div class="roster">${state.players
    .map(
      (p) =>
        `<article class="person ${p.status !== "active" ? "out" : ""} ${state.turnId === p.id ? "current" : ""}"><div class="person-top"><strong class="player-name">${esc(p.name)}${p.id === state.you ? " · ты" : ""}</strong>${p.status !== "active" ? `<span class="out-label">${p.status === "withdrawn" ? "ВЫШЕЛ" : "ВЫБЫЛ"}</span>` : ""}</div>${Object.entries(
          cats,
        )
          .map(
            ([c, l]) =>
              `<div class="trait"><span>${l}</span>${p.revealed.includes(c) ? esc(p.cards[c].title) : "<span>Не раскрыто</span>"}</div>`,
          )
          .join("")}${
          state.state === "FINISHED"
            ? `<details data-detail="player-${p.id}"><summary>Послематчевые карты</summary>${Object.values(
                p.cards,
              )
                .map((c) => `<p class="note">${esc(c.title)}</p>`)
                .join(
                  "",
                )}<p class="note">Спецкарта: ${esc(p.special.title)}</p></details>`
            : ""
        }</article>`,
    )
    .join("")}</div></section>`;
}
function voteBox() {
  if (state.state !== "VOTING") return "";
  const p = me();
  const validVote = state.players.some(
    (x) =>
      x.id === state.yourVote &&
      x.status === "active" &&
      x.id !== p.id &&
      !state.protected.includes(x.id),
  )
    ? state.yourVote
    : null;
  return `<section class="panel"><div class="panel-heading"><h2>Кто останется снаружи?</h2><span class="eyebrow">ЦИКЛ ${state.cyclesDone + 1}/${state.quota}</span></div>${
    p.status === "active"
      ? `${invalidVoteTarget ? `<p class="vote-warning" role="status">Голос за ${esc(person(invalidVoteTarget))} больше недействителен: цель вышла из партии или недоступна. Выбери другую цель до конца таймера. Без действительного голоса будет автоголос против тебя.</p>` : ""}<div class="vote-list">${state.players
          .filter((x) => x.status === "active" && x.id !== p.id)
          .map(
            (x) =>
              `<button class="vote-button ${validVote === x.id ? "selected" : ""}" data-vote="${x.id}" aria-pressed="${validVote === x.id}" ${state.protected.includes(x.id) ? "disabled" : ""}><span>${esc(x.name)}</span><span>${state.protected.includes(x.id) ? "Защищён" : validVote === x.id ? "✓ Твой голос" : "Выбрать"}</span></button>`,
          )
          .join(
            "",
          )}</div><p class="note">${validVote ? `Голос за ${esc(person(validVote))} сохранён.` : "У тебя нет действительного голоса. Если не выбрать цель, автоголос будет против тебя."} Имена голосовавших не публикуются.</p>`
      : '<p class="muted">Ты наблюдаешь за голосованием. Выбывшие не голосуют.</p>'
  }</section>`;
}
function lastVote() {
  if (!state.lastVote) return "";
  const v = state.lastVote;
  return `<section class="panel"><div class="eyebrow">ПОСЛЕДНИЙ ПОДСЧЁТ / РАУНД ${v.round}</div><h3 class="scenario-title">${esc(person(v.eliminated))} — снаружи</h3>${Object.entries(
    v.counts,
  )
    .map(
      ([id, n]) =>
        `<div class="resource"><span>${esc(person(id))}</span><strong>${n}</strong></div>`,
    )
    .join("")}</section>`;
}
const eventNames = {
  phase_changed: "Новый этап",
  player_joined: "Присоединился к комнате",
  player_left: "Покинул комнату",
  player_ready_changed: "Изменил готовность",
  player_withdrew: "Покинул партию",
  game_started: "Партия началась",
  cards_dealt: "Карты выданы",
  catastrophe_revealed: "Сценарий катастрофы объявлен",
  bunker_profile_revealed: "Профиль бункера объявлен",
  special_window_opened: "Открыто окно спецкарт",
  round_ended: "Раунд завершён",
  survival_check_completed: "Условия выживания проверены",
  round_started: "Начался раунд",
  bunker_card_revealed: "Открыта карта бункера",
  resource_changed: "Ресурс изменён",
  capability_added: "Добавлен модуль",
  character_revealed: "Раскрыл характеристику",
  character_auto_revealed: "Характеристика раскрыта автоматически",
  turn_timed_out: "Время хода закончилось",
  discussion_started: "Началось обсуждение",
  discussion_ended: "Обсуждение завершено",
  special_played: "Заявлена спецкарта",
  special_resolved: "Спецкарта сработала",
  special_fizzled: "Спецкарта не сработала",
  voting_started: "Началось голосование",
  vote_submitted: "Голос сохранён",
  vote_changed: "Голос изменён",
  vote_auto_cast: "Засчитан автоголос",
  voting_closed: "Бюллетени закрыты",
  vote_tallied: "Голоса подсчитаны",
  tie_break_resolved: "Ничья разрешена жеребьёвкой",
  player_eliminated: "Выбыл из партии",
  final_reveal_started: "Началось финальное раскрытие",
  game_finished: "Партия завершена",
  protection_revoked: "Защита снята: нельзя закрыть все цели",
};
function logBox() {
  return `<section class="panel"><h3 class="panel-heading">Журнал партии</h3>${state.log.length ? "" : '<p class="note">Событий пока нет.</p>'}<ul class="log">${state.log
    .slice(-35)
    .reverse()
    .map((e) => {
      let extra = e.data.card?.title || e.data.title || e.data.reason || "";
      if (e.type === "phase_changed")
        extra = phases[e.data.state] || e.data.state;
      if (e.type === "resource_changed")
        extra = `${resources[e.data.resource]} ${e.data.before} → ${e.data.after}`;
      return `<li><time>${new Date(e.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>${e.actor_id ? `${esc(person(e.actor_id))} · ` : ""}${esc(eventNames[e.type] || e.type)}${extra ? `: ${esc(extra)}` : ""}</li>`;
    })
    .join("")}</ul></section>`;
}
function resultBox() {
  if (state.state !== "FINISHED") return "";
  const titles = [
    "Провал сценария",
    "Провал сценария",
    "Выживание под угрозой",
    "Устойчивое выживание",
  ];
  return `<section class="result-banner ${state.score === 3 ? "" : state.score === 2 ? "risk" : "fail"}"><div class="eyebrow">ДВЕРИ ЗАКРЫТЫ / ИТОГ КОМАНДЫ</div><h2>${titles[state.score]}</h2><div class="score">${state.score} / 3</div><ul class="checks">${state.result.map((c) => `<li><strong>${c.passed ? "✓" : "×"}</strong>${esc(c.label)}</li>`).join("")}</ul><p class="note">В бункере: ${state.players
    .filter((p) => p.status === "active")
    .map((p) => esc(p.name))
    .join(
      ", ",
    )}. Личная победа этих участников не зависит от командного результата.</p></section>`;
}
function game() {
  root.innerHTML =
    roomHeader() +
    resultBox() +
    `${state.state === "FINISHED" ? "" : `<section class="phase"><div><div class="eyebrow">РАУНД ${state.round || "—"} / ${state.quota != null ? `ИСКЛЮЧЕНИЙ ${state.cyclesDone}/${state.quota}` : "ПОДГОТОВКА"}</div><h2>${phases[state.state]}</h2><p>${esc(phaseHint())}</p></div><div class="timer" data-timer aria-label="Осталось времени">—:—</div></section>`}<details class="mobile-brief" data-detail="brief"><summary>Катастрофа и условия убежища ↓</summary>${scenarioBox()}${bunkerBox()}</details><div class="grid game-grid"><div class="stack">${state.state === "INTRO" ? `<section class="panel"><h2>Всё готово к началу</h2><p class="note">Посмотри свои карты и условия катастрофы. Первый раунд начнётся по таймеру или когда все подтвердят.</p><button data-action="continue" class="full" ${state.continued.includes(state.you) || me().status !== "active" ? "disabled" : ""}>${me().status !== "active" ? "Режим наблюдения" : state.continued.includes(state.you) ? "Ждём остальных" : "Я ознакомился — продолжить"}</button></section>` : ""}${voteBox()}${myCards()}${roster()}</div><aside class="stack">${scenarioBox()}${bunkerBox()}${lastVote()}${logBox()}</aside></div>`;
}
function render() {
  const focused = pendingFocus || focusKey(document.activeElement);
  const oldLogScroll = root.querySelector(".log")?.scrollTop;
  for (const id of [
    "scenario",
    "profile",
    "special-target",
    "special-category",
  ]) {
    const el = document.getElementById(id);
    if (el) choices.set(id, el.value);
  }
  root
    .querySelectorAll("details[data-detail]")
    .forEach((el) => detailStates.set(el.dataset.detail, el.open));
  if (!state) landing();
  else if (state.state === "LOBBY") lobby();
  else game();
  for (const [id, val] of choices) {
    const el = document.getElementById(id);
    if (el && [...el.options].some((x) => x.value === val)) el.value = val;
  }
  root
    .querySelectorAll("details[data-detail]")
    .forEach((el) => (el.open = detailStates.get(el.dataset.detail) || false));
  root.setAttribute("aria-busy", String(busy));
  if (busy)
    root
      .querySelectorAll("button, input, select")
      .forEach((el) => (el.disabled = true));
  else if (state && !connected)
    root
      .querySelectorAll(
        "[data-action], [data-reveal], [data-vote], [data-leave]",
      )
      .forEach((el) => (el.disabled = true));
  if (oldLogScroll != null && root.querySelector(".log"))
    root.querySelector(".log").scrollTop = oldLogScroll;
  restoreFocus(focused);
  updateTimer();
}
function updateTimer() {
  const el = root.querySelector("[data-timer]");
  if (!el || !state.deadline) return;
  const sec = Math.max(
    0,
    Math.ceil((state.deadline - Date.now() - offset) / 1000),
  );
  el.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}
function accept(data, force = false) {
  if (data.code !== code || (state && data.rev < state.rev)) return;
  const sameVotePhase =
    state?.state === "VOTING" && state.phaseId === data.phaseId;
  const previousTarget = sameVotePhase
    ? state.yourVote || invalidVoteTarget
    : null;
  const candidate = data.yourVote || previousTarget;
  if (data.state !== "VOTING") invalidVoteTarget = null;
  else if (
    candidate &&
    !data.players.some(
      (p) =>
        p.id === candidate &&
        p.status === "active" &&
        p.id !== data.you &&
        !data.protected.includes(p.id),
    )
  )
    invalidVoteTarget = candidate;
  else if (data.yourVote || !sameVotePhase) invalidVoteTarget = null;
  const reconnect = !connected;
  offset = data.serverNow - Date.now();
  state = data;
  connected = true;
  entryError = "";
  showConnection();
  if (force || reconnect || lastRev !== data.rev) {
    lastRev = data.rev;
    render();
  }
  updateTimer();
}
async function refresh(force = false) {
  if (!code || !token || (!force && (pollBusy || busy))) return;
  if (!force) pollBusy = true;
  const epoch = sessionEpoch,
    actionVersion = actionEpoch,
    auth = token,
    room = code;
  try {
    const data = await api(`/api/rooms/${room}`, null, auth);
    if (epoch === sessionEpoch && actionVersion === actionEpoch)
      accept(data, force);
  } catch (e) {
    if (epoch !== sessionEpoch || actionVersion !== actionEpoch) return;
    connected = false;
    if (e.status === 401 || e.status === 404) {
      localStorage.removeItem("bunker42:" + room);
      sessionEpoch++;
      token = "";
      state = null;
      lastRev = -1;
      mode = "join";
      entryCode = room;
      entryError = e.message;
    }
    showConnection();
    render();
  } finally {
    if (!force) pollBusy = false;
  }
}
async function send(type, extra = {}) {
  if (type === "leave" && state?.state === "SPECIAL_FINALE") {
    home();
    return;
  }
  if (busy || !connected || !state) return;
  actionEpoch++;
  const epoch = sessionEpoch,
    room = code,
    auth = token,
    phaseId = state.phaseId;
  setBusy(true);
  try {
    const data = await api(
      `/api/rooms/${room}/action`,
      { type, phaseId, ...extra },
      auth,
    );
    if (epoch !== sessionEpoch) return;
    if (data.left) {
      localStorage.removeItem("bunker42:" + room);
      home();
    } else accept(data, true);
  } catch (e) {
    if (epoch !== sessionEpoch) return;
    toast(e.message);
    await refresh(true);
  } finally {
    setBusy(false);
  }
}
root.addEventListener("input", (e) => {
  if (e.target.id === "name") entryName = e.target.value;
  if (e.target.id === "code") entryCode = e.target.value;
});
root.addEventListener("submit", async (e) => {
  if (e.target.id !== "entry-form") return;
  e.preventDefault();
  if (busy) return;
  const form = new FormData(e.target),
    name = String(form.get("name")).trim(),
    c = String(form.get("code") || "")
      .trim()
      .toUpperCase();
  entryName = name;
  entryCode = c;
  entryError = "";
  if (!name) {
    entryError = "Укажи имя: от 1 до 24 символов.";
    render();
    document.querySelector("#name").focus();
    return;
  }
  localStorage.setItem("bunker42-name", name);
  setBusy(true);
  try {
    if (mode === "join" && localStorage.getItem("bunker42:" + c)) {
      openSession(c, localStorage.getItem("bunker42:" + c));
      await refresh(true);
    } else {
      const result = await api(
        mode === "create" ? "/api/create" : `/api/rooms/${c}/join`,
        { name },
        "",
      );
      setSession(result);
      await refresh(true);
    }
  } catch (err) {
    entryError = err.message;
  } finally {
    setBusy(false);
  }
});
root.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled || busy) return;
  if (b.dataset.mode) {
    mode = b.dataset.mode;
    entryError = "";
    render();
    return;
  }
  if (b.hasAttribute("data-home")) {
    home();
    return;
  }
  if (b.dataset.resume) {
    setBusy(true);
    openSession(
      b.dataset.resume,
      localStorage.getItem("bunker42:" + b.dataset.resume),
    );
    try {
      await refresh(true);
    } finally {
      setBusy(false);
    }
    return;
  }
  if (b.hasAttribute("data-copy")) {
    const link = `${location.origin}/?room=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast("Ссылка скопирована. Отправь её друзьям.");
    } catch {
      prompt("Скопируй ссылку для друзей:", link);
    }
    return;
  }
  if (b.hasAttribute("data-rules")) {
    document.querySelector("#rules").showModal();
    return;
  }
  if (b.hasAttribute("data-leave")) {
    if (
      confirm(
        state.state === "LOBBY"
          ? "Покинуть комнату?"
          : "Покинуть партию? Вернуться в активный состав будет нельзя.",
      )
    )
      await send("leave");
    return;
  }
  if (b.dataset.reveal) {
    await send("reveal", { category: b.dataset.reveal });
    return;
  }
  if (b.dataset.vote) {
    await send("vote", { target: b.dataset.vote });
    return;
  }
  const a = b.dataset.action;
  if (a) {
    let extra = {};
    if (a === "ready") extra.ready = !me().ready;
    if (a === "start") {
      extra.catastrophe = document.querySelector("#scenario").value;
      extra.profile = document.querySelector("#profile").value;
    }
    if (a === "special") {
      extra.target = document.querySelector("#special-target")?.value;
      extra.category = document.querySelector("#special-category")?.value;
    }
    await send(a, extra);
  }
});
document.querySelector("#close-rules").onclick = () =>
  document.querySelector("#rules").close();
async function loadCatalog() {
  if (catalogLoaded || catalogBusy) return;
  catalogBusy = true;
  try {
    catalog = await api("/api/content", null, "");
    catalogLoaded = true;
    render();
  } catch {
    // Room recovery is independent of this public optional-choice list.
  } finally {
    catalogBusy = false;
  }
}
showConnection();
render();
loadCatalog();
setInterval(loadCatalog, 10000);
if (code && token) await refresh();
setInterval(refresh, 1000);
setInterval(updateTimer, 250);
