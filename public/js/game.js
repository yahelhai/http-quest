'use strict';

/**
 * HTTP Quest client.
 *
 * The client never judges an answer: it builds a request, sends it with the
 * X-Quest-Level header and renders whatever the server says in
 * X-Quest-Result / X-Quest-Hint. All texts come from the bootstrap JSON that
 * views/game.ejs writes into #quest-data.
 */
(function () {
  var bootstrap = document.getElementById('quest-data');
  if (!bootstrap) return;

  var QUEST = JSON.parse(bootstrap.textContent);
  window.QUEST = QUEST; // handy in the console, and the documented contract

  var T = QUEST.t;
  var LEVELS = QUEST.levels;
  var TOTAL = QUEST.total;
  var STORAGE_KEY = 'http-quest-progress';
  var HEADERS_OF_INTEREST = ['content-type', 'location', 'x-quest-result', 'x-quest-hint'];

  // ---------------------------------------------------------------- elements

  var el = {
    map: document.getElementById('level-map'),
    reset: document.getElementById('reset-progress'),
    of: document.getElementById('level-of'),
    title: document.getElementById('level-title'),
    concept: document.getElementById('level-concept'),
    task: document.getElementById('level-task'),
    attempts: document.getElementById('level-attempts'),

    form: document.getElementById('builder'),
    method: document.getElementById('method'),
    path: document.getElementById('path'),
    queryRows: document.getElementById('query-rows'),
    addParam: document.getElementById('add-param'),
    body: document.getElementById('body'),
    bodyNote: document.getElementById('body-note'),
    requestLine: document.getElementById('request-line'),
    send: document.getElementById('send'),

    verdict: document.getElementById('verdict'),
    verdictHead: document.getElementById('verdict-head'),
    verdictText: document.getElementById('verdict-text'),
    verdictNext: document.getElementById('verdict-next'),

    responseEmpty: document.getElementById('response-empty'),
    response: document.getElementById('response'),
    status: document.getElementById('response-status'),
    time: document.getElementById('response-time'),
    headers: document.getElementById('response-headers'),
    body_: document.getElementById('response-body'),

    finish: document.getElementById('finish'),
    finishBody: document.getElementById('finish-body'),
    finishReplay: document.getElementById('finish-replay')
  };

  // ------------------------------------------------------------------- state

  // `current` is the furthest unlocked level, `viewing` is the one on screen.
  var state = { current: 1, done: [], attempts: {} };
  var viewing = 1;
  var busy = false;

  function loadProgress() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      raw = null;
    }
    if (!raw) return;
    try {
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        state.current = clampLevel(saved.current);
        state.done = Array.isArray(saved.done) ? saved.done.filter(isLevelId) : [];
        state.attempts = saved.attempts && typeof saved.attempts === 'object' ? saved.attempts : {};
      }
    } catch (err) {
      /* corrupt storage: start over silently */
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* ignore: progress simply is not remembered */
    }
  }

  function isLevelId(id) {
    return typeof id === 'number' && id >= 1 && id <= TOTAL;
  }

  function clampLevel(id) {
    var n = parseInt(id, 10);
    if (!n || n < 1) return 1;
    return n > TOTAL ? TOTAL : n;
  }

  function levelById(id) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].id === id) return LEVELS[i];
    }
    return LEVELS[0];
  }

  function isDone(id) {
    return state.done.indexOf(id) !== -1;
  }

  function totalAttempts() {
    var sum = 0;
    Object.keys(state.attempts).forEach(function (key) {
      sum += Number(state.attempts[key]) || 0;
    });
    return sum;
  }

  /** Fill {placeholders} from a plain object. */
  function fill(template, values) {
    return String(template === undefined || template === null ? '' : template)
      .replace(/\{(\w+)\}/g, function (match, key) {
        return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
      });
  }

  // ------------------------------------------------------------------ render

  function renderMap() {
    var chips = el.map.querySelectorAll('.chip');
    Array.prototype.forEach.call(chips, function (chip) {
      var id = parseInt(chip.getAttribute('data-level'), 10);
      var done = isDone(id);
      var unlocked = done || id <= state.current;
      chip.classList.toggle('chip--done', done && id !== viewing);
      chip.classList.toggle('chip--current', id === viewing);
      chip.classList.toggle('chip--locked', !unlocked);
      chip.disabled = !unlocked;
      chip.setAttribute('aria-current', id === viewing ? 'step' : 'false');
      chip.title = levelById(id).title + (done ? ' · ' + T.progress.done : (unlocked ? '' : ' · ' + T.progress.locked));
    });
  }

  function renderLevel() {
    var level = levelById(viewing);
    el.of.textContent = fill(T.level.of, { n: viewing, total: TOTAL });
    el.title.textContent = level.title;
    el.concept.textContent = level.concept;
    el.task.textContent = level.task;
    el.attempts.textContent = fill(T.level.attempts, { n: state.attempts[viewing] || 0 });
    renderMap();
  }

  function clearResponse() {
    el.verdict.hidden = true;
    el.verdictNext.hidden = true;
    el.response.hidden = true;
    el.responseEmpty.hidden = false;
    el.verdict.className = 'verdict';
  }

  function setLevel(id) {
    viewing = clampLevel(id);
    clearResponse();
    renderLevel();
  }

  // ----------------------------------------------------------------- builder

  function bodyAllowed() {
    var method = el.method.value;
    return method === 'POST' || method === 'PUT' || method === 'PATCH';
  }

  function syncBodyState() {
    var allowed = bodyAllowed();
    el.body.disabled = !allowed;
    if (!allowed) {
      el.bodyNote.textContent = T.builder.bodyDisabled;
      el.bodyNote.classList.remove('field__note--error');
    } else {
      el.bodyNote.textContent = '';
      el.bodyNote.classList.remove('field__note--error');
    }
  }

  /** Strip a leading "/", a leading "api/" and any trailing slash noise. */
  function normalizePath(raw) {
    var value = String(raw || '').trim();
    value = value.replace(/^\/+/, '');
    value = value.replace(/^api\/+/i, '');
    value = value.replace(/^\/+/, '');
    return value;
  }

  function addQueryRow(key, value) {
    var row = document.createElement('div');
    row.className = 'query-row';

    var keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'input input--mono query-row__key';
    keyInput.dir = 'ltr';
    keyInput.spellcheck = false;
    keyInput.autocomplete = 'off';
    keyInput.placeholder = T.builder.key;
    keyInput.setAttribute('aria-label', T.builder.key);
    if (key) keyInput.value = key;

    var valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'input input--mono query-row__value';
    valueInput.dir = 'ltr';
    valueInput.spellcheck = false;
    valueInput.autocomplete = 'off';
    valueInput.placeholder = T.builder.value;
    valueInput.setAttribute('aria-label', T.builder.value);
    if (value) valueInput.value = value;

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn--ghost btn--icon query-row__remove';
    remove.textContent = '×'; // multiplication sign, not an icon font
    remove.setAttribute('aria-label', T.builder.removeParam);
    remove.title = T.builder.removeParam;
    remove.addEventListener('click', function () {
      row.remove();
      renderRequestLine();
    });

    row.appendChild(keyInput);
    row.appendChild(valueInput);
    row.appendChild(remove);
    el.queryRows.appendChild(row);
    return row;
  }

  /** Query rows → [[key, value], ...]; rows with an empty key are ignored. */
  function collectQuery() {
    var pairs = [];
    var rows = el.queryRows.querySelectorAll('.query-row');
    Array.prototype.forEach.call(rows, function (row) {
      var key = row.querySelector('.query-row__key').value.trim();
      var value = row.querySelector('.query-row__value').value.trim();
      if (key) pairs.push([key, value]);
    });
    return pairs;
  }

  function queryString() {
    return collectQuery().map(function (pair) {
      return encodeURIComponent(pair[0]) + '=' + encodeURIComponent(pair[1]);
    }).join('&');
  }

  function buildUrl() {
    var path = '/api/' + normalizePath(el.path.value);
    var query = queryString();
    return query ? path + '?' + query : path;
  }

  function renderRequestLine() {
    // t.builder.requestLine is the pattern, e.g. "{method} /api/{path}".
    var query = queryString();
    var path = normalizePath(el.path.value) + (query ? '?' + query : '');
    el.requestLine.textContent = fill(T.builder.requestLine, {
      method: el.method.value,
      path: path
    }) + ' HTTP/1.1';
  }

  /** A "?a=b&c=d" typed into the path field becomes query rows. */
  function absorbQueryFromPath() {
    var value = el.path.value;
    var mark = value.indexOf('?');
    if (mark === -1) return;

    var pathPart = value.slice(0, mark);
    var queryPart = value.slice(mark + 1);
    el.path.value = pathPart;

    queryPart.split('&').forEach(function (chunk) {
      if (!chunk) return;
      var eq = chunk.indexOf('=');
      var key = eq === -1 ? chunk : chunk.slice(0, eq);
      var val = eq === -1 ? '' : chunk.slice(eq + 1);
      try {
        key = decodeURIComponent(key);
        val = decodeURIComponent(val);
      } catch (err) {
        /* keep the raw text if it is not valid percent-encoding */
      }
      if (key.trim()) addQueryRow(key.trim(), val);
    });
  }

  // ------------------------------------------------------------------ sending

  function statusClass(code) {
    return 'status status--' + Math.floor(code / 100) + 'xx';
  }

  function renderResponse(res, text, ms) {
    el.responseEmpty.hidden = true;
    el.response.hidden = false;

    el.status.className = statusClass(res.status);
    el.status.textContent = res.status + (res.statusText ? ' ' + res.statusText : '');
    el.time.textContent = fill(T.response.time, { ms: ms });

    el.headers.textContent = '';
    HEADERS_OF_INTEREST.forEach(function (name) {
      var value = res.headers.get(name);
      if (value === null) return;
      var dt = document.createElement('dt');
      dt.className = 'headers__name';
      dt.textContent = name;
      var dd = document.createElement('dd');
      dd.className = 'headers__value';
      dd.textContent = value;
      el.headers.appendChild(dt);
      el.headers.appendChild(dd);
    });

    var code = el.body_.querySelector('code');
    if (res.status === 204 || !text) {
      code.textContent = T.response.noBody;
      el.body_.classList.add('code-block--empty');
    } else {
      el.body_.classList.remove('code-block--empty');
      try {
        code.textContent = JSON.stringify(JSON.parse(text), null, 2);
      } catch (err) {
        code.textContent = text; // not JSON: show exactly what came back
      }
    }
  }

  function hintText(rawHint, status) {
    var raw = String(rawHint || '');
    var mark = raw.indexOf(':');
    var code = mark === -1 ? raw : raw.slice(0, mark);
    var arg = mark === -1 ? '' : raw.slice(mark + 1);
    var template = T.hints[code] || code;
    return fill(template, { param: arg, field: arg, expected: arg, actual: status });
  }

  function renderVerdict(res) {
    var result = res.headers.get('x-quest-result');
    if (!result) {
      el.verdict.hidden = true;
      return;
    }

    var level = levelById(viewing);
    el.verdict.hidden = false;

    if (result === 'pass') {
      el.verdict.className = 'verdict verdict--pass';
      el.verdictHead.textContent = T.verdict.pass;
      el.verdictText.textContent = level.success;
      markPassed(level.id);
      el.verdictNext.hidden = false;
      el.verdictNext.textContent = level.id === TOTAL ? T.verdict.finish : T.verdict.next;
    } else {
      el.verdict.className = 'verdict verdict--fail';
      el.verdictHead.textContent = T.verdict.fail;
      el.verdictText.textContent = hintText(res.headers.get('x-quest-hint'), res.status);
      el.verdictNext.hidden = true;
    }
  }

  function markPassed(id) {
    if (!isDone(id)) state.done.push(id);
    if (id >= state.current && state.current < TOTAL) state.current = id + 1;
    saveProgress();
    renderMap();
  }

  function showFinish() {
    el.finish.hidden = false;
    el.finishBody.textContent = fill(T.finish.body, { attempts: totalAttempts() });
    el.finish.scrollIntoView({ block: 'start' });
  }

  function send() {
    if (busy) return;

    var method = el.method.value;
    var url = buildUrl();
    var options = {
      method: method,
      cache: 'no-store',
      headers: { 'X-Quest-Level': String(viewing) }
    };

    if (bodyAllowed()) {
      var raw = el.body.value;
      if (raw.trim() !== '') {
        // Client-side parse for the hint only. The server is the judge, so the
        // raw text is sent exactly as typed even when it is invalid JSON.
        try {
          JSON.parse(raw);
          el.bodyNote.textContent = '';
          el.bodyNote.classList.remove('field__note--error');
        } catch (err) {
          el.bodyNote.textContent = T.builder.bodyInvalidJson;
          el.bodyNote.classList.add('field__note--error');
        }
        options.headers['Content-Type'] = 'application/json';
        options.body = raw;
      }
    }

    busy = true;
    el.send.disabled = true;
    el.send.textContent = T.builder.sending;

    state.attempts[viewing] = (state.attempts[viewing] || 0) + 1;
    saveProgress();
    el.attempts.textContent = fill(T.level.attempts, { n: state.attempts[viewing] });

    var started = (window.performance && performance.now) ? performance.now() : Date.now();

    fetch(url, options).then(function (res) {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var ms = Math.round(now - started);
      return res.text().then(function (text) {
        renderResponse(res, text, ms);
        renderVerdict(res);
      });
    }).catch(function (err) {
      // Network failure: no verdict to show, only what went wrong.
      el.responseEmpty.hidden = true;
      el.response.hidden = false;
      el.status.className = 'status status--5xx';
      el.status.textContent = String(err && err.message ? err.message : err);
      el.time.textContent = '';
      el.headers.textContent = '';
      el.body_.querySelector('code').textContent = '';
      el.verdict.hidden = true;
    }).then(function () {
      busy = false;
      el.send.disabled = false;
      el.send.textContent = T.builder.send;
    });
  }

  // ------------------------------------------------------------------ events

  function goNext() {
    if (viewing === TOTAL) {
      showFinish();
      return;
    }
    setLevel(viewing + 1);
  }

  function resetProgress() {
    if (!window.confirm(T.progress.resetConfirm)) return;
    state = { current: 1, done: [], attempts: {} };
    saveProgress();
    el.finish.hidden = true;
    setLevel(1);
  }

  function bind() {
    el.form.addEventListener('submit', function (event) {
      event.preventDefault();
      send();
    });

    el.method.addEventListener('change', function () {
      syncBodyState();
      renderRequestLine();
    });

    el.path.addEventListener('input', function () {
      absorbQueryFromPath();
      renderRequestLine();
    });
    el.path.addEventListener('blur', function () {
      el.path.value = normalizePath(el.path.value);
      renderRequestLine();
    });

    el.queryRows.addEventListener('input', renderRequestLine);
    el.addParam.addEventListener('click', function () {
      var row = addQueryRow('', '');
      row.querySelector('.query-row__key').focus();
      renderRequestLine();
    });

    el.map.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('.chip') : null;
      if (!chip || chip.disabled) return;
      el.finish.hidden = true;
      setLevel(parseInt(chip.getAttribute('data-level'), 10));
    });

    el.reset.addEventListener('click', resetProgress);
    el.verdictNext.addEventListener('click', goNext);

    el.finishReplay.addEventListener('click', function () {
      // Replay keeps `done` and `attempts` so every level stays open; only the
      // cursor goes back to level 1.
      el.finish.hidden = true;
      setLevel(1);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        send();
      }
    });
  }

  // -------------------------------------------------------------------- init

  loadProgress();
  viewing = clampLevel(state.current);
  bind();
  addQueryRow('', '');
  syncBodyState();
  setLevel(viewing);
  renderRequestLine();
}());
