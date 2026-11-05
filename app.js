'use strict';

/* =========================================================
   Spines — your books as colorful spines on a shelf (PWA)
   All data lives in this device's localStorage.
   ========================================================= */

const STORE_KEY = 'spines-v1';
const LANG_KEY = 'spines-lang';
const SHELVES = ['reading', 'want', 'finished'];
const MAX_CATS = 10;
const BACKUP_AFTER_DAYS = 30;

/* Spine thickness in px: a page count only decides where a book falls between the limits */
const MIN_W = 26, MAX_W = 52, BLANK_W = 39, MIN_PAGES = 100, MAX_PAGES = 500;

/* Text color (on) is chosen for readable titles on each spine color */
const PALETTE = [
  { c: '#E97F5B', on: '#3A1407' },
  { c: '#38B88E', on: '#04342C' },
  { c: '#AFA9EC', on: '#26215C' },
  { c: '#EF9F27', on: '#412402' },
  { c: '#85B7EB', on: '#042C53' },
  { c: '#ED93B1', on: '#4B1528' },
  { c: '#97C459', on: '#173404' },
  { c: '#534AB7', on: '#FFFFFF' },
  { c: '#185FA5', on: '#FFFFFF' },
  { c: '#993556', on: '#FFFFFF' },
];
const NEUTRALS = [
  { c: '#E4DFD3', on: '#2C2C2A' },
  { c: '#D3D1C7', on: '#2C2C2A' },
  { c: '#C9C2B2', on: '#2C2C2A' },
];

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const hashOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------- Language: the saved choice, otherwise the phone's language ---------- */
const phoneLang = navigator.language || '';
let lang = /^it\b/i.test(phoneLang) ? 'it' : 'en';
try { const saved = localStorage.getItem(LANG_KEY); if (saved === 'en' || saved === 'it') lang = saved; } catch (e) { /* storage blocked */ }
const tr = (key, ...args) => args.reduce((s, a) => s.replace('{}', () => a), TEXT[lang][key]);
/* Date format: the phone's own if it is in this language, otherwise a default for it */
const locale = () => phoneLang.toLowerCase().startsWith(lang) ? phoneLang : lang === 'it' ? 'it-IT' : 'en-GB';
const num = n => n.toLocaleString(locale());

function setLang(next) {
  lang = next;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* storage blocked */ }
  render();
}

/* ---------- Dates (local calendar days as YYYY-MM-DD) ---------- */
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => keyOf(new Date());
const thisYear = () => new Date().getFullYear();
const fmt = (k, opts) => dateOf(k).toLocaleDateString(locale(), opts);
const daysSince = k => Math.round((dateOf(todayKey()) - dateOf(k)) / 864e5);
const isDate = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

/* ---------- State ---------- */
let state = load();
save();

function seedState() {
  return {
    books: [],
    cats: ['catNovels', 'catScience', 'catArt'].map((key, slot) => ({ id: uid(), name: tr(key), slot })),
    goals: {},
    nextColor: 0,
    firstUsed: null,
    lastBackup: null,
    lastChange: null,
    snoozeUntil: null,
  };
}
function valid(s) { return s && Array.isArray(s.books) && Array.isArray(s.cats); }
/* Everything read from storage or a backup file is reduced to known fields and types */
function clean(s) {
  const cats = s.cats.filter(c => c && typeof c.name === 'string' && c.name.trim()).slice(0, MAX_CATS).map(c => ({
    id: String(c.id || uid()),
    name: c.name.trim().slice(0, 30),
    slot: clamp(Math.floor(c.slot) || 0, 0, PALETTE.length - 1),
  }));
  const catIds = new Set(cats.map(c => c.id));
  const books = s.books.filter(b => b && typeof b.title === 'string' && b.title.trim()).map(b => {
    const shelf = SHELVES.includes(b.shelf) ? b.shelf : 'want';
    return {
      id: String(b.id || uid()),
      title: b.title.trim(),
      author: typeof b.author === 'string' ? b.author : '',
      pages: Number.isInteger(b.pages) && b.pages > 0 ? b.pages : null,
      shelf,
      cat: catIds.has(b.cat) ? b.cat : null,
      finished: shelf === 'finished' && isDate(b.finished) ? b.finished : null,
      rating: Number.isInteger(b.rating) ? clamp(b.rating, 0, 5) : 0,
      notes: typeof b.notes === 'string' ? b.notes : '',
      quotes: Array.isArray(b.quotes) ? b.quotes.filter(q => q && typeof q.text === 'string').map(q => ({
        id: String(q.id || uid()),
        text: q.text,
        page: Number.isInteger(q.page) && q.page > 0 ? q.page : null,
      })) : [],
      color: Number.isInteger(b.color) && b.color >= 0 ? b.color : hashOf(b.id),
      moved: Number(b.moved) || 0,
    };
  });
  const goals = {};
  if (s.goals && typeof s.goals === 'object') {
    for (const y in s.goals) if (/^\d{4}$/.test(y) && Number.isInteger(s.goals[y]) && s.goals[y] > 0) goals[y] = s.goals[y];
  }
  return {
    books, cats, goals,
    nextColor: Number.isInteger(s.nextColor) && s.nextColor >= 0 ? s.nextColor : books.length,
    firstUsed: isDate(s.firstUsed) ? s.firstUsed : null,
    lastBackup: isDate(s.lastBackup) ? s.lastBackup : null,
    lastChange: isDate(s.lastChange) ? s.lastChange : null,
    snoozeUntil: isDate(s.snoozeUntil) ? s.snoozeUntil : null,
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (valid(s)) return clean(s);
  } catch (e) { /* fall through to a fresh start */ }
  return seedState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast(tr('saveFailed')); }
}
function changed() {
  const t = todayKey();
  state.lastChange = t;
  if (!state.firstUsed) state.firstUsed = t;
  save();
}

const bookById = id => state.books.find(b => b.id === id);
const catById = id => state.cats.find(c => c.id === id);
const usesCats = () => state.books.some(b => b.cat);

/* Moving to Finished fills in today's date; moving away removes it */
function moveTo(b, shelf) {
  if (shelf === b.shelf) return;
  b.finished = shelf === 'finished' ? todayKey() : null;
  b.shelf = shelf;
  b.moved = Date.now();
}

function byNewest(a, b) {
  if (a.shelf === 'finished' && a.finished !== b.finished) return (b.finished || '').localeCompare(a.finished || '');
  return b.moved - a.moved;
}
function booksOn(shelf) {
  return state.books.filter(b => b.shelf === shelf && matchesFilter(b)).sort(byNewest);
}
function finishedIn(year) {
  return state.books.filter(b => b.shelf === 'finished' && b.finished && b.finished.startsWith(year + '-'));
}

/* ---------- Spine looks ---------- */
function spineWidth(b) {
  if (!b.pages) return BLANK_W;
  const p = clamp(b.pages, MIN_PAGES, MAX_PAGES);
  return Math.round(MIN_W + (p - MIN_PAGES) / (MAX_PAGES - MIN_PAGES) * (MAX_W - MIN_W));
}
/* A small, fixed height difference per book, just for looks */
const spineHeight = b => 124 + hashOf(b.id) % 23;
function colorOf(b) {
  const cat = catById(b.cat);
  if (cat) return PALETTE[cat.slot];
  return usesCats() ? NEUTRALS[b.color % NEUTRALS.length] : PALETTE[b.color % PALETTE.length];
}
const colorVars = p => `--c:${p.c};--on:${p.on}`;
const pagesLabel = n => n === 1 ? tr('pagesOne') : tr('pagesCount', num(n));
const starLabel = n => n === 1 ? tr('starOne') : tr('starMany', n);

function spineHtml(b) {
  const label = b.author ? `${b.title}, ${b.author}` : b.title;
  return `<button class="spine${ui.justAdded === b.id ? ' pop' : ''}" data-act="open" data-id="${esc(b.id)}" aria-label="${esc(label)}"
    style="--w:${spineWidth(b)}px;--h:${spineHeight(b)}px;${colorVars(colorOf(b))}"><span>${esc(b.title)}</span></button>`;
}
function starsHtml(value, act) {
  let html = '<div class="stars" role="group" aria-label="' + tr('rating') + '">';
  for (let n = 1; n <= 5; n++) {
    html += `<button type="button" class="star${n <= value ? ' on' : ''}" data-act="${act}" data-n="${n}" aria-label="${starLabel(n)}" aria-pressed="${n === value}">★</button>`;
  }
  return html + '</div>';
}

/* ---------- Navigation: each page is a history entry, so the phone's back button works ---------- */
const ui = { route: null, cat: null, year: null, query: '', y: 0, scroll: {}, filtersX: 0, justAdded: null };
history.scrollRestoration = 'manual';
const depth = () => (history.state && history.state.d) || 0;
function go(hash) {
  history.pushState({ d: depth() + 1 }, '', '#' + hash);
  render();
}
function back() {
  if (depth() > 0) { history.back(); return; }
  history.replaceState({ d: 0 }, '', location.pathname + location.search);
  render();
}
addEventListener('popstate', render);

function currentRoute() {
  const [name, arg] = location.hash.slice(1).split('/');
  return { name: name || 'home', arg: arg ? decodeURIComponent(arg) : null };
}

/* ---------- Rendering ---------- */
const app = $('#app');
function render() {
  const key = location.hash;
  const sameRoute = key === ui.route;
  const y = scrollY;
  if (ui.route === '') {
    ui.y = y;
    document.querySelectorAll('[data-shelf]').forEach(el => { ui.scroll[el.dataset.shelf] = el.scrollLeft; });
    const filters = $('.filters');
    if (filters) ui.filtersX = filters.scrollLeft;
  }
  if (!sameRoute && sheet.open) sheet.close();

  const { name, arg } = currentRoute();
  document.documentElement.lang = lang;
  const book = arg && bookById(arg);
  if (name === 'add') app.innerHTML = formHtml(null);
  else if (name === 'edit' && book) app.innerHTML = formHtml(book);
  else if (name === 'book' && book) app.innerHTML = bookHtml(book);
  else if (name === 'shelf' && SHELVES.includes(arg)) app.innerHTML = shelfHtml(arg);
  else if (name === 'search') app.innerHTML = searchHtml();
  else if (name === 'year') app.innerHTML = yearHtml();
  else if (name === 'settings') app.innerHTML = settingsHtml();
  else if (name === 'home') app.innerHTML = homeHtml();
  else { back(); return; }
  ui.route = key;

  if (name === 'home') {
    document.querySelectorAll('[data-shelf]').forEach(el => { el.scrollLeft = ui.justAdded ? 0 : ui.scroll[el.dataset.shelf] || 0; });
    const filters = $('.filters');
    if (filters) filters.scrollLeft = ui.filtersX;
    scrollTo(0, sameRoute ? y : ui.y);
    ui.justAdded = null;
  } else {
    scrollTo(0, sameRoute ? y : 0);
  }
  document.querySelectorAll('.ruled').forEach(fitNotes);
  if (name === 'add' && !sameRoute) { const t = $('#book-title'); if (t) t.focus(); }
  if (name === 'search') {
    filterRows(ui.query);
    if (!sameRoute && !ui.query) $('#book-search').focus();
  }
}

/* ---------- Home ---------- */
const matchesFilter = b => !ui.cat || (ui.cat === 'none' ? !b.cat : b.cat === ui.cat);

function homeHtml() {
  if (ui.cat && ui.cat !== 'none' && !catById(ui.cat)) ui.cat = null;
  if (!usesCats()) ui.cat = null;
  return `<div class="view">
    <header class="topbar">
      <h1>Spines</h1>
      <div class="topbar-actions">
        <button class="icon-btn" data-act="search" aria-label="${tr('searchBooks')}">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>
        </button>
        <button class="icon-btn" data-act="settings" aria-label="${tr('menu')}">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></svg>
        </button>
      </div>
    </header>
    ${noticeHtml()}${goalHtml()}${filtersHtml()}
    ${SHELVES.map(shelfBlockHtml).join('')}
    ${creditHtml()}
  </div>
  <button class="fab" data-act="add">+ ${tr('addBook')}</button>`;
}

function goalHtml() {
  const y = thisYear(), goal = state.goals[y];
  if (!goal) return '';
  const n = finishedIn(y).length;
  const text = n >= goal ? tr('goalReached', n, goal) : goal === 1 ? tr('goalOne', n) : tr('goalMany', n, goal);
  return `<button class="goal" data-act="year" aria-label="${tr('openYear')}: ${esc(text)}">
    <span class="goal-text"><span>${tr('goalLabel', y)}</span><span>${text}</span></span>
    <span class="goal-track"><span class="goal-fill" style="width:${clamp(n / goal * 100, 0, 100)}%"></span></span>
  </button>`;
}

function filtersHtml() {
  if (!usesCats()) return '';
  const used = state.cats.filter(c => state.books.some(b => b.cat === c.id));
  const pill = (id, label, vars) => `<button class="pill" data-act="filter" data-id="${esc(id)}" aria-pressed="${ui.cat === id}" style="${vars}"><i></i>${esc(label)}</button>`;
  const none = state.books.some(b => !b.cat) ? pill('none', tr('noCategory'), colorVars(NEUTRALS[2])) : '';
  return `<div class="pills filters" role="group" aria-label="${tr('filters')}">
    ${used.map(c => pill(c.id, c.name, colorVars(PALETTE[c.slot]))).join('')}${none}
  </div>`;
}

function shelfBlockHtml(shelf) {
  const list = booksOn(shelf);
  const empty = ui.cat ? tr('emptyFiltered') : tr('empty_' + shelf);
  const name = tr('shelf_' + shelf);
  return `<section class="shelf-block">
    <button class="shelf-title" data-act="shelf" data-id="${shelf}" aria-label="${tr('openShelf', esc(name))}">${esc(name)} <span>· ${list.length}</span></button>
    <div class="shelf"><div class="shelf-scroll" data-shelf="${shelf}">
      ${list.length ? list.map(spineHtml).join('') : `<p class="shelf-empty">${empty}</p>`}
    </div></div>
  </section>`;
}

function backupDue() {
  if (!state.books.length || !state.lastChange) return false;
  const t = todayKey();
  if (state.snoozeUntil && t < state.snoozeUntil) return false;
  if (state.lastBackup && state.lastChange <= state.lastBackup) return false;
  return daysSince(state.lastBackup || state.firstUsed || t) >= BACKUP_AFTER_DAYS;
}
function noticeHtml() {
  if (!backupDue()) return '';
  const text = state.lastBackup ? tr('backupOld', daysSince(state.lastBackup)) : tr('backupNever');
  return `<div class="notice"><p>${text}</p><div>
    <button class="btn small" data-act="snooze">${tr('later')}</button>
    <button class="btn small primary" data-act="export">${tr('backupNow')}</button>
  </div></div>`;
}

const creditHtml = () => `<footer class="credit">${tr('madeBy')} · <a href="https://buymeacoffee.com/gionzana" target="_blank" rel="noopener">${tr('coffee')}</a></footer>`;

/* ---------- Book lists: all the books on one shelf, or a search of every shelf ---------- */
/* Accents are ignored, so "levi" also finds "Lévi" */
const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ð/g, 'd').replace(/þ/g, 'th');

function rowHtml(b, withShelf) {
  const sub = [b.author, withShelf ? tr('shelf_' + b.shelf) : ''].filter(Boolean).map(esc).join(' · ');
  return `<button class="row" data-act="open" data-id="${esc(b.id)}" data-search="${esc(plain(b.title + ' ' + b.author))}">
    <span class="row-mark" style="${colorVars(colorOf(b))}"></span>
    <span class="row-main"><span class="row-title">${esc(b.title)}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>
    ${b.rating ? `<span class="row-stars" aria-label="${starLabel(b.rating)}">${'★'.repeat(b.rating)}</span>` : ''}
  </button>`;
}
function listHtml(title, rows, value, emptyText) {
  return `<div class="view">
    <header class="topbar">
      <button class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
      <h2>${esc(title)}</h2>
    </header>
    <input class="field-search" type="search" id="book-search" value="${esc(value)}" placeholder="${tr('search')}" aria-label="${tr('search')}">
    <div id="book-rows">${rows}</div>
    <p class="none" id="book-none" ${rows ? 'hidden' : ''}>${rows ? tr('searchNone') : emptyText}</p>
  </div>`;
}
function shelfHtml(shelf) {
  const cat = catById(ui.cat);
  const label = tr('shelf_' + shelf) + (ui.cat === 'none' ? ' · ' + tr('noCategory') : cat ? ' · ' + cat.name : '');
  return listHtml(label, booksOn(shelf).map(b => rowHtml(b, false)).join(''), '', tr('empty_' + shelf));
}
function searchHtml() {
  const list = state.books.slice().sort((a, b) => a.title.localeCompare(b.title, locale()));
  return listHtml(tr('searchBooks'), list.map(b => rowHtml(b, true)).join(''), ui.query, tr('searchNone'));
}
function filterRows(value) {
  const term = plain(value.trim());
  let shown = 0;
  document.querySelectorAll('#book-rows .row').forEach(r => {
    r.hidden = !r.dataset.search.includes(term);
    if (!r.hidden) shown++;
  });
  if (document.querySelector('#book-rows .row')) $('#book-none').hidden = shown > 0;
}

/* ---------- Book page ---------- */
function bookHtml(b) {
  const sub = [b.author, b.pages ? pagesLabel(b.pages) : ''].filter(Boolean).map(esc).join(' · ');
  const shelfPills = SHELVES.map(s => `<button class="pill" data-act="move" data-shelf-to="${s}" aria-pressed="${b.shelf === s}">${tr('shelf_' + s)}</button>`).join('');
  const cat = catById(b.cat);
  const quotes = b.quotes.map(q => `<button class="quote" data-act="edit-quote" data-id="${esc(q.id)}">
    <span class="quote-text">${esc(q.text)}</span>
    ${q.page ? `<span class="quote-page">${tr('pageShort', q.page)}</span>` : ''}
  </button>`).join('');
  return `<div class="paper-view"><article class="paper">
    <header class="topbar">
      <button class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
      <button class="link-btn" data-act="edit">${tr('edit')}</button>
    </header>
    <div class="book-head">
      <div class="book-spine" style="--w:${spineWidth(b)}px;${colorVars(colorOf(b))}"></div>
      <div>
        <h1 class="book-title">${esc(b.title)}</h1>
        ${sub ? `<p class="book-sub">${sub}</p>` : ''}
        ${cat ? `<p class="book-sub">${esc(cat.name)}</p>` : ''}
      </div>
    </div>
    <span class="section-label">${tr('shelf')}</span>
    <div class="pills">${shelfPills}</div>
    ${b.shelf === 'finished' ? `
      <span class="section-label">${tr('rating')}</span>
      ${starsHtml(b.rating, 'rate')}
      <label class="section-label" for="finish-date">${tr('finishedOn')}</label>
      <input class="date-input" type="date" id="finish-date" value="${b.finished || ''}" max="${todayKey()}">` : ''}
    <label class="section-label" for="book-notes">${tr('notes')}</label>
    <textarea class="ruled" id="book-notes" placeholder="${tr('notesPlaceholder')}">${esc(b.notes)}</textarea>
    <span class="section-label">${tr('quotes')}</span>
    ${quotes}
    <button class="btn small" data-act="add-quote">${tr('addQuote')}</button>
  </article></div>`;
}
function fitNotes(el) {
  el.style.height = 'auto';
  el.style.height = Math.max(84, Math.ceil(el.scrollHeight / 28) * 28) + 'px';
}

/* ---------- Add or edit a book ---------- */
function formHtml(b) {
  const isNew = !b;
  const shelf = isNew ? 'reading' : b.shelf;
  const rating = isNew ? 0 : b.rating;
  const shelfChoices = SHELVES.map(s => `<label class="choice"><input type="radio" name="shelf" value="${s}" ${s === shelf ? 'checked' : ''}><span class="pill">${tr('shelf_' + s)}</span></label>`).join('');
  const catChoice = (id, name, vars, checked) => `<label class="choice"><input type="radio" name="cat" value="${esc(id)}" ${checked ? 'checked' : ''}>
    <span class="pill" style="${vars}"><i></i>${esc(name)}</span></label>`;
  const catChoices = state.cats.map(c => catChoice(c.id, c.name, colorVars(PALETTE[c.slot]), !isNew && b.cat === c.id)).join('');
  const date = isNew ? todayKey() : b.finished || '';
  return `<div class="paper-view"><form class="paper" id="book-form" data-id="${isNew ? '' : esc(b.id)}">
    <header class="topbar">
      <button type="button" class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
      <h2 class="book-title">${tr(isNew ? 'addBook' : 'editBook')}</h2>
    </header>
    <label class="field"><span>${tr('titleRequired')}</span>
      <input type="text" id="book-title" name="title" value="${isNew ? '' : esc(b.title)}" maxlength="200" required pattern=".*\\S.*" title="${tr('titleError')}" autocomplete="off"></label>
    <label class="field"><span>${tr('author')}</span>
      <input type="text" name="author" value="${isNew ? '' : esc(b.author)}" maxlength="200" autocomplete="off"></label>
    <label class="field short"><span>${tr('pages')}</span>
      <input type="number" name="pages" value="${!isNew && b.pages ? b.pages : ''}" min="1" max="99999" step="1" inputmode="numeric"></label>
    <div class="group"><span class="field-label">${tr('shelf')}</span><div class="pills">${shelfChoices}</div></div>
    <div class="group"><span class="field-label">${tr('category')}</span><div class="pills">
      ${catChoice('', tr('noCategory'), colorVars(NEUTRALS[2]), isNew || !b.cat)}${catChoices}</div></div>
    <div id="finished-fields" ${shelf === 'finished' ? '' : 'hidden'}>
      <div class="group"><span class="field-label">${tr('rating')}</span>
        <input type="hidden" name="rating" value="${rating}">${starsHtml(rating, 'form-star')}</div>
      <label class="field short" style="max-width:190px"><span>${tr('finishedOn')}</span>
        <input type="date" name="finished" value="${date}" max="${todayKey()}"></label>
    </div>
    <div class="btns">
      <button class="btn primary grow">${tr('save')}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="delete">${tr('delete')}</button>`}
    </div>
  </form></div>`;
}

function submitBook(form) {
  const d = new FormData(form);
  const id = form.dataset.id;
  const shelf = d.get('shelf');
  const pages = parseInt(d.get('pages'), 10) || null;
  if (id) {
    const b = bookById(id);
    if (!b) return;
    if (shelf !== b.shelf) b.moved = Date.now();
    Object.assign(b, { title: d.get('title').trim(), author: d.get('author').trim(), pages, shelf, cat: d.get('cat') || null });
    b.finished = shelf === 'finished' ? d.get('finished') || null : null;
    if (shelf === 'finished') b.rating = Number(d.get('rating')) || 0;
    changed();
    back();
    return;
  }
  const b = {
    id: uid(), title: d.get('title').trim(), author: d.get('author').trim(), pages, shelf,
    cat: d.get('cat') || null,
    finished: shelf === 'finished' ? d.get('finished') || null : null,
    rating: shelf === 'finished' ? Number(d.get('rating')) || 0 : 0,
    notes: '', quotes: [], color: state.nextColor++, moved: Date.now(),
  };
  state.books.push(b);
  changed();
  ui.justAdded = b.id;
  ui.cat = null;
  toast(tr('added', tr('shelf_' + shelf)));
  back();
}

/* ---------- Year in books ---------- */
function yearHtml() {
  const now = thisYear();
  const years = state.books.filter(b => b.finished).map(b => Number(b.finished.slice(0, 4)));
  const first = Math.min(now, ...years);
  const y = clamp(ui.year || now, first, now);
  ui.year = y;
  const list = finishedIn(y).sort((a, b) => a.finished.localeCompare(b.finished) || a.moved - b.moved);
  const withPages = list.filter(b => b.pages);
  const rated = list.filter(b => b.rating);
  const nav = `<header class="topbar">
    <button class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
  </header>
  <h1 class="year-title">${tr('yearTitle', y)}</h1>
  <div class="year-nav">
    <button class="btn small" data-act="year-step" data-n="-1" aria-label="${tr('prevYear')}" ${y <= first ? 'hidden' : ''}>‹ ${y - 1}</button>
    <button class="btn small" data-act="year-step" data-n="1" aria-label="${tr('nextYear')}" ${y >= now ? 'hidden' : ''}>${y + 1} ›</button>
  </div>`;
  const goalBtn = y === now ? `<div class="btns"><button class="btn small" data-act="goal">${tr(state.goals[y] ? 'changeGoal' : 'setGoal')}</button></div>` : '';
  if (!list.length) {
    return `<div class="paper-view"><article class="paper">${nav}<p class="none">${tr('yearEmpty', y)}</p>${goalBtn}</article></div>`;
  }

  const months = {};
  list.forEach(b => { const m = b.finished.slice(0, 7); months[m] = (months[m] || 0) + 1; });
  const busiest = Object.keys(months).sort((a, b) => months[b] - months[a] || a.localeCompare(b))[0];
  const stat = (value, label) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
  const longest = withPages.slice().sort((a, b) => b.pages - a.pages)[0];
  const topCat = (() => {
    const counts = {};
    list.forEach(b => { if (b.cat) counts[b.cat] = (counts[b.cat] || 0) + 1; });
    const id = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return id && catById(id);
  })();
  const average = rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : 0;
  return `<div class="paper-view"><article class="paper">${nav}
    <div class="shelf"><div class="shelf-scroll" data-year-shelf>${list.map(spineHtml).join('')}</div></div>
    <div class="stats">
      ${stat(list.length, tr(list.length === 1 ? 'statBooksOne' : 'statBooksMany'))}
      ${withPages.length ? stat(num(withPages.reduce((s, b) => s + b.pages, 0)), tr('statPages')) : ''}
      ${rated.length ? stat(average.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ★', tr('statRating')) : ''}
      ${stat(fmt(busiest + '-01', { month: 'short' }), tr('statMonth'))}
    </div>
    ${longest ? `<p class="year-line">${tr('statLongest', esc(longest.title), num(longest.pages))}</p>` : ''}
    ${topCat ? `<p class="year-line">${tr('statTopCat', esc(topCat.name))}</p>` : ''}
    ${goalBtn}
  </article></div>`;
}

/* ---------- Settings ---------- */
function settingsHtml() {
  const y = thisYear(), goal = state.goals[y];
  const catRows = state.cats.map(c => `<button class="row" data-act="edit-cat" data-id="${esc(c.id)}" style="${colorVars(PALETTE[c.slot])}">
    <i></i><span class="row-main"><span class="row-title">${esc(c.name)}</span></span></button>`).join('');
  return `<div class="view settings">
    <header class="topbar">
      <button class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
      <h2>${tr('settings')}</h2>
    </header>
    <h3>${tr('yearlyGoal')}</h3>
    <p class="note">${goal ? (goal === 1 ? tr('goalOne', finishedIn(y).length) : tr('goalMany', finishedIn(y).length, goal)) : tr('noGoal', y)}</p>
    <div class="btns">
      <button class="btn" data-act="goal">${tr(goal ? 'changeGoal' : 'setGoal')}</button>
      <button class="btn" data-act="year">${tr('yearInBooks')}</button>
    </div>
    <h3>${tr('categories')}</h3>
    <p class="note">${tr('categoriesNote')}</p>
    ${catRows}
    <div class="btns">${state.cats.length < MAX_CATS
      ? `<button class="btn" data-act="add-cat">${tr('addCategory')}</button>`
      : `<p class="note">${tr('categoryLimit', MAX_CATS)}</p>`}</div>
    <h3>${tr('language')}</h3>
    <div class="pills" role="group" aria-label="${tr('language')}">
      <button class="pill" data-act="lang" data-lang="en" lang="en" aria-pressed="${lang === 'en'}">English</button>
      <button class="pill" data-act="lang" data-lang="it" lang="it" aria-pressed="${lang === 'it'}">Italiano</button>
    </div>
    <h3>${tr('backup')}</h3>
    <p class="note">${tr('backupNote')}${state.lastBackup ? ' ' + tr('backupLast', fmt(state.lastBackup, { dateStyle: 'medium' })) : ''}</p>
    <div class="btns">
      <button class="btn" data-act="export">${tr('exportBackup')}</button>
      <label class="btn">${tr('importBackup')}<input type="file" accept="application/json,.json" id="import-file" hidden></label>
    </div>
    ${/[?&]demo\b/.test(location.search) ? `<h3>${tr('demo')}</h3><div class="btns">
      <button class="btn" data-act="demo">${tr('loadSample')}</button>
      <button class="btn danger" data-act="reset">${tr('resetAll')}</button></div>` : ''}
    ${creditHtml()}
  </div>`;
}

/* ---------- Sheets (dialogs) ---------- */
const sheet = $('#sheet');
function openSheet(html) {
  sheet.innerHTML = html;
  if (!sheet.open) sheet.showModal();
}
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

function finishedSheet(b) {
  openSheet(`<h2>${tr('finishedPrompt')}</h2>
    <p class="book-sub">${esc(b.title)}</p>
    ${starsHtml(0, 'finish-star')}
    <div class="btns"><button class="btn grow" data-act="sheet-close">${tr('skip')}</button></div>`);
}

function quoteSheet(q) {
  const isNew = !q;
  openSheet(`<form id="quote-form" data-id="${isNew ? '' : esc(q.id)}">
    <h2>${tr(isNew ? 'quote' : 'editQuote')}</h2>
    <label class="field"><span>${tr('quote')}</span>
      <textarea name="text" rows="4" required title="${tr('quoteRequired')}">${isNew ? '' : esc(q.text)}</textarea></label>
    <label class="field short"><span>${tr('page')}</span>
      <input type="number" name="page" value="${!isNew && q.page ? q.page : ''}" min="1" max="99999" step="1" inputmode="numeric"></label>
    <div class="btns">
      <button type="button" class="btn" data-act="sheet-close">${tr('cancel')}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="delete-quote">${tr('delete')}</button>`}
      <button class="btn primary grow">${tr('save')}</button>
    </div>
  </form>`);
}

function goalSheet() {
  const y = thisYear();
  openSheet(`<form id="goal-form">
    <h2>${tr('yearlyGoal')}</h2>
    <label class="field short"><span>${tr('goalFor', y)}</span>
      <input type="number" name="goal" value="${state.goals[y] || ''}" min="1" max="9999" step="1" inputmode="numeric"></label>
    <p class="book-sub">${tr('goalNote')}</p>
    <div class="btns">
      <button type="button" class="btn" data-act="sheet-close">${tr('cancel')}</button>
      <button class="btn primary grow">${tr('save')}</button>
    </div>
  </form>`);
}

function catSheet(c) {
  const isNew = !c;
  const taken = new Set(state.cats.filter(o => o !== c).map(o => o.slot));
  const slot = isNew ? PALETTE.findIndex((p, i) => !taken.has(i)) : c.slot;
  const swatches = PALETTE.map((p, i) => `<label class="swatch" style="--c:${p.c}"><input type="radio" name="slot" value="${i}"
    aria-label="${tr('colors')[i]}" ${i === slot ? 'checked' : ''} ${taken.has(i) ? 'disabled' : ''}></label>`).join('');
  openSheet(`<form id="cat-form" data-id="${isNew ? '' : esc(c.id)}">
    <h2>${tr(isNew ? 'newCategory' : 'editCategory')}</h2>
    <label class="field"><span>${tr('categoryName')}</span>
      <input type="text" name="name" value="${isNew ? '' : esc(c.name)}" maxlength="30" required pattern=".*\\S.*" title="${tr('categoryRequired')}" autocomplete="off"></label>
    <div class="group"><span class="field-label">${tr('color')}</span><div class="swatches">${swatches}</div></div>
    <div class="btns">
      <button type="button" class="btn" data-act="sheet-close">${tr('cancel')}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="delete-cat">${tr('delete')}</button>`}
      <button class="btn primary grow">${tr('save')}</button>
    </div>
  </form>`);
}

/* ---------- Backup ---------- */
function exportData() {
  state.lastBackup = todayKey();
  state.snoozeUntil = null;
  save();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `spines-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(tr('backupSaved'));
  render();
}
function importFile(input) {
  const f = input.files[0];
  if (!f) return;
  f.text().then(txt => {
    const s = JSON.parse(txt);
    if (!valid(s)) throw new Error('bad file');
    if (!confirm(tr('confirmImport'))) return;
    state = clean(s);
    ui.cat = null;
    save();
    render();
    toast(tr('backupRestored'));
  }).catch(() => toast(tr('notBackup')));
  input.value = '';
}

/* Sample data for trying the app (only reachable with ?demo in the URL) */
function loadDemo() {
  if (!confirm(tr('confirmDemo'))) return;
  const s = seedState(), y = thisYear(), [novels, science, art] = s.cats.map(c => c.id);
  const sample = [
    ['Dune', 'Frank Herbert', 500, 'finished', novels, `${y}-10-12`, 4],
    ['Cosmos', 'Carl Sagan', 365, 'finished', science, `${y}-09-03`, 5],
    ['Emma', 'Jane Austen', 340, 'finished', novels, `${y}-07-21`, 4],
    ['The Story of Art', 'E. H. Gombrich', 688, 'finished', art, `${y}-05-30`, 5],
    ['Il nome della rosa', 'Umberto Eco', 500, 'finished', novels, `${y}-03-14`, 5],
    ['A Short History of Nearly Everything', 'Bill Bryson', 400, 'finished', science, `${y}-03-02`, 4],
    ['Siddhartha', 'Hermann Hesse', 150, 'finished', null, `${y - 1}-11-08`, 3],
    ['Ways of Seeing', 'John Berger', 176, 'reading', art, null, 0],
    ['Middlemarch', 'George Eliot', 800, 'want', novels, null, 0],
    ['The Elegant Universe', 'Brian Greene', 450, 'want', science, null, 0],
    ['Se questo è un uomo', 'Primo Levi', 200, 'want', null, null, 0],
    ['A book with no page count', '', null, 'want', null, null, 0],
  ];
  s.books = sample.map(([title, author, pages, shelf, cat, finished, rating], i) => ({
    id: uid(), title, author, pages, shelf, cat, finished, rating, notes: '', quotes: [], color: i, moved: Date.now() - i * 1000,
  }));
  s.nextColor = s.books.length;
  s.goals[y] = 20;
  s.firstUsed = s.lastChange = todayKey();
  state = s;
  save();
  back();
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  const route = currentRoute();
  const book = route.arg && bookById(route.arg);
  switch (b.dataset.act) {
    case 'back': back(); break;
    case 'add': go('add'); break;
    case 'settings': go('settings'); break;
    case 'search': ui.query = ''; go('search'); break;
    case 'open': go('book/' + encodeURIComponent(id)); break;
    case 'shelf': go('shelf/' + id); break;
    case 'year': ui.year = null; go('year'); break;
    case 'filter': ui.cat = ui.cat === id ? null : id; ui.scroll = {}; render(); break;
    case 'snooze': {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      state.snoozeUntil = keyOf(d);
      save();
      render();
      break;
    }
    case 'export': exportData(); break;
    case 'lang': setLang(b.dataset.lang); break;
    case 'demo': loadDemo(); break;
    case 'reset':
      if (confirm(tr('confirmReset'))) { state = seedState(); save(); back(); }
      break;
    case 'sheet-close': sheet.close(); break;

    case 'edit': go('edit/' + encodeURIComponent(book.id)); break;
    case 'delete':
      if (book && confirm(tr('confirmDelete', book.title))) {
        state.books = state.books.filter(x => x !== book);
        changed();
        toast(tr('deleted'));
        history.replaceState({ d: Math.max(0, depth() - 1) }, '', location.pathname + location.search);
        if (depth() > 0) history.go(-1); else render();
      }
      break;
    case 'move': {
      const was = book.shelf;
      moveTo(book, b.dataset.shelfTo);
      changed();
      render();
      if (was !== 'finished' && book.shelf === 'finished' && !book.rating) finishedSheet(book);
      break;
    }
    case 'rate': {
      const n = Number(b.dataset.n);
      book.rating = book.rating === n ? 0 : n;
      changed();
      render();
      break;
    }
    case 'finish-star':
      book.rating = Number(b.dataset.n);
      changed();
      sheet.close();
      render();
      break;
    case 'form-star': {
      const field = $('#book-form [name="rating"]');
      const n = Number(b.dataset.n);
      const value = Number(field.value) === n ? 0 : n;
      field.value = value;
      b.parentElement.querySelectorAll('.star').forEach((s, i) => {
        s.classList.toggle('on', i < value);
        s.setAttribute('aria-pressed', i + 1 === value);
      });
      break;
    }
    case 'add-quote': quoteSheet(null); break;
    case 'edit-quote': quoteSheet(book.quotes.find(q => q.id === id)); break;
    case 'delete-quote': {
      const qid = $('#quote-form').dataset.id;
      book.quotes = book.quotes.filter(q => q.id !== qid);
      changed();
      sheet.close();
      render();
      break;
    }
    case 'year-step': ui.year += Number(b.dataset.n); render(); break;
    case 'goal': goalSheet(); break;
    case 'add-cat': catSheet(null); break;
    case 'edit-cat': catSheet(catById(id)); break;
    case 'delete-cat': {
      const cat = catById($('#cat-form').dataset.id);
      if (cat && confirm(tr('confirmDeleteCat', cat.name))) {
        state.books.forEach(x => { if (x.cat === cat.id) x.cat = null; });
        state.cats = state.cats.filter(c => c !== cat);
        changed();
        sheet.close();
        render();
      }
      break;
    }
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const d = new FormData(form);
  const route = currentRoute();
  const book = route.arg && bookById(route.arg);
  if (form.id === 'book-form') { submitBook(form); return; }
  if (form.id === 'quote-form') {
    const text = d.get('text').trim();
    if (!text) { form.querySelector('textarea').focus(); toast(tr('quoteRequired')); return; }
    const page = parseInt(d.get('page'), 10) || null;
    const q = book.quotes.find(x => x.id === form.dataset.id);
    if (q) Object.assign(q, { text, page }); else book.quotes.push({ id: uid(), text, page });
  } else if (form.id === 'goal-form') {
    const goal = parseInt(d.get('goal'), 10);
    if (goal > 0) state.goals[thisYear()] = goal; else delete state.goals[thisYear()];
  } else if (form.id === 'cat-form') {
    const name = d.get('name').trim(), slot = Number(d.get('slot'));
    const c = catById(form.dataset.id);
    if (c) Object.assign(c, { name, slot }); else state.cats.push({ id: uid(), name, slot });
  } else return;
  changed();
  sheet.close();
  render();
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'book-notes') {
    bookById(currentRoute().arg).notes = el.value;
    fitNotes(el);
    changed();
  } else if (el.id === 'book-search') {
    if (currentRoute().name === 'search') ui.query = el.value;
    filterRows(el.value);
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'finish-date') {
    const b = bookById(currentRoute().arg);
    b.finished = el.value && el.value <= todayKey() ? el.value : null;
    changed();
  } else if (el.id === 'import-file') {
    importFile(el);
  } else if (el.name === 'shelf' && el.form && el.form.id === 'book-form') {
    $('#finished-fields').hidden = el.value !== 'finished';
  }
});

/* Pick up a new day or year if the app was left open */
let lastDay = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayKey() !== lastDay) { lastDay = todayKey(); render(); }
});

render();

/* ---------- Offline support ---------- */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) location.reload(); });
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
