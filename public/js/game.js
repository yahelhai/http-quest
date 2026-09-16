// Builds the request, sends it, shows what came back. Whether the answer was
// right is decided by the server and arrives in the X-Quest-* headers.

const levels = JSON.parse(document.getElementById('level-data').textContent);
const total = levels.length;

const STORAGE_KEY = 'http-quest-progress';
const BODY_METHODS = ['POST', 'PUT', 'PATCH'];
const SHOWN_HEADERS = ['content-type', 'location', 'x-quest-result', 'x-quest-hint'];

const el = (id) => document.getElementById(id);

const form = el('builder');
const method = el('method');
const pathInput = el('path');
const queryRows = el('query-rows');
const body = el('body');
const bodyNote = el('body-note');
const requestLine = el('request-line');
const sendButton = el('send');
const levelMap = el('level-map');
const verdict = el('verdict');
const response = el('response');
const responseBody = document.querySelector('#response-body code');

let progress = readProgress();
let level = Math.min(progress.unlocked, total);
let sending = false;

// Progress

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.unlocked >= 1) return saved;
  } catch {
    // No storage, or something we cannot read. Start over.
  }
  return { unlocked: 1, solved: [], attempts: {} };
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The game still works, it just will not be remembered.
  }
}

function attemptsOn(id) {
  return progress.attempts[id] || 0;
}

// Showing a level

function showLevel(id) {
  level = id;
  el('finish').hidden = true;
  verdict.hidden = true;
  el('next-level').hidden = true;
  response.hidden = true;
  el('nothing-sent').hidden = false;

  const current = levels.find((item) => item.id === id);
  el('level-count').textContent = `Level ${id} of ${total}`;
  el('level-title').textContent = current.title;
  el('level-concept').textContent = current.concept;
  el('level-task').textContent = current.task;

  showAttempts();
  showFrames();
}

function showFrames() {
  for (const frame of levelMap.querySelectorAll('.frame')) {
    const id = Number(frame.dataset.level);
    const solved = progress.solved.includes(id);

    frame.disabled = id > progress.unlocked && !solved;
    frame.classList.toggle('is-current', id === level);
    frame.classList.toggle('is-solved', solved && id !== level);
  }
}

function showAttempts() {
  const count = attemptsOn(level);

  if (count === 0) el('attempts').textContent = 'No attempts yet';
  else el('attempts').textContent = count === 1 ? '1 attempt' : `${count} attempts`;
}

// The request

function addQueryRow(name = '', value = '') {
  const row = document.createElement('div');
  row.className = 'query-row';
  row.innerHTML = `
    <input type="text" class="query-name" placeholder="name" aria-label="Parameter name" autocomplete="off">
    <input type="text" class="query-value" placeholder="value" aria-label="Parameter value" autocomplete="off">
    <button type="button" class="ghost" aria-label="Remove this parameter">&times;</button>`;

  row.querySelector('.query-name').value = name;
  row.querySelector('.query-value').value = value;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    showRequestLine();
  });

  queryRows.append(row);
  return row;
}

function requestUrl() {
  const typed = pathInput.value.trim().replace(/^\/*(api\/)?/, '');
  const params = new URLSearchParams();

  for (const row of queryRows.querySelectorAll('.query-row')) {
    const name = row.querySelector('.query-name').value.trim();
    if (name) params.append(name, row.querySelector('.query-value').value.trim());
  }

  const query = params.toString();
  if (!query) return `/api/${typed}`;
  return `/api/${typed}${typed.includes('?') ? '&' : '?'}${query}`;
}

function showRequestLine() {
  requestLine.textContent = `${method.value} ${requestUrl()}`;
}

function bodyAllowed() {
  return BODY_METHODS.includes(method.value);
}

function syncBody() {
  body.disabled = !bodyAllowed();
  bodyNote.textContent = body.disabled ? 'GET and DELETE requests carry no body.' : '';
  bodyNote.classList.remove('is-error');
}

async function send() {
  if (sending) return;

  const options = {
    method: method.value,
    cache: 'no-store',
    headers: { 'X-Quest-Level': String(level) },
  };

  if (bodyAllowed() && body.value.trim()) {
    // Sent exactly as typed, even if it is not valid JSON: the server is the
    // one that decides. Parsing here only puts a warning under the field.
    try {
      JSON.parse(body.value);
      bodyNote.textContent = '';
      bodyNote.classList.remove('is-error');
    } catch {
      bodyNote.textContent = 'That is not valid JSON yet.';
      bodyNote.classList.add('is-error');
    }

    options.headers['Content-Type'] = 'application/json';
    options.body = body.value;
  }

  sending = true;
  sendButton.disabled = true;
  sendButton.textContent = 'Sending...';

  progress.attempts[level] = attemptsOn(level) + 1;
  saveProgress();
  showAttempts();

  const started = Date.now();

  try {
    const result = await fetch(requestUrl(), options);
    const text = await result.text();

    showResponse(result, text, Date.now() - started);
    showVerdict(result);
  } catch (error) {
    showFailedRequest(error);
  }

  sending = false;
  sendButton.disabled = false;
  sendButton.textContent = 'Send request';
}

// The answer

function showResponse(result, text, ms) {
  el('nothing-sent').hidden = true;
  response.hidden = false;

  el('status').textContent = `${result.status} ${result.statusText}`.trim();
  el('status').className = `status status--${Math.floor(result.status / 100)}xx`;
  el('duration').textContent = `${ms} ms`;

  const headers = el('headers');
  headers.replaceChildren();
  for (const name of SHOWN_HEADERS) {
    const value = result.headers.get(name);
    if (value === null) continue;

    const term = document.createElement('dt');
    term.textContent = name;
    const description = document.createElement('dd');
    description.textContent = value;
    headers.append(term, description);
  }

  responseBody.textContent = text ? pretty(text) : 'No body.';
}

function pretty(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function showVerdict(result) {
  const passed = result.headers.get('X-Quest-Result') === 'pass';
  const nextButton = el('next-level');

  verdict.hidden = false;
  verdict.className = passed ? 'verdict is-pass' : 'verdict is-fail';
  el('verdict-head').textContent = passed ? 'Solved' : 'Not yet';
  el('verdict-text').textContent = passed
    ? levels.find((item) => item.id === level).success
    : result.headers.get('X-Quest-Hint') ?? 'That request does not match this level.';

  nextButton.hidden = !passed;
  if (!passed) return;

  nextButton.textContent = level === total ? 'See the results' : 'Next level';
  if (!progress.solved.includes(level)) progress.solved.push(level);
  progress.unlocked = Math.max(progress.unlocked, Math.min(level + 1, total));
  saveProgress();
  showFrames();
}

function showFailedRequest(error) {
  el('nothing-sent').hidden = true;
  response.hidden = false;
  verdict.hidden = true;

  el('status').textContent = 'no answer';
  el('status').className = 'status status--5xx';
  el('duration').textContent = '';
  el('headers').replaceChildren();
  responseBody.textContent = `The request never reached the server: ${error.message}`;
}

function showFinish() {
  const attempts = Object.values(progress.attempts).reduce((sum, count) => sum + count, 0);

  el('finish').hidden = false;
  el('finish-text').textContent = `All ${total} levels, in ${attempts} requests. `
    + 'Every level stays open if you want to try another way of asking.';
}

// Events

form.addEventListener('submit', (event) => {
  event.preventDefault();
  send();
});

method.addEventListener('change', () => {
  syncBody();
  showRequestLine();
});

pathInput.addEventListener('input', showRequestLine);
queryRows.addEventListener('input', showRequestLine);

el('add-param').addEventListener('click', () => {
  addQueryRow().querySelector('.query-name').focus();
});

levelMap.addEventListener('click', (event) => {
  const frame = event.target.closest('.frame');
  if (frame && !frame.disabled) showLevel(Number(frame.dataset.level));
});

el('next-level').addEventListener('click', () => {
  if (level === total) showFinish();
  else showLevel(level + 1);
});

el('finish-replay').addEventListener('click', () => showLevel(1));

el('reset').addEventListener('click', () => {
  if (!confirm('Start over and forget the levels you solved?')) return;

  progress = { unlocked: 1, solved: [], attempts: {} };
  saveProgress();
  showLevel(1);
});

addQueryRow();
syncBody();
showLevel(level);
showRequestLine();
