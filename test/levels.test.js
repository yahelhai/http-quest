'use strict';

const test = require('node:test');
const assert = require('node:assert');

const app = require('../server');
const store = require('../src/data/store');
const schemas = require('../src/schemas');

let server;
let base;

test.before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test.beforeEach(() => store.reset());

// Sends a request, optionally tagged with X-Quest-Level, and extracts the
// quest verdict headers alongside the plain response.
async function q(level, method, path, opts = {}) {
  const { query, body, headers = {}, raw } = opts;

  let url = base + path;
  if (query) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    url += (path.includes('?') ? '&' : '?') + qs;
  }

  const fetchHeaders = { ...headers };
  if (level !== undefined) fetchHeaders['X-Quest-Level'] = String(level);

  let fetchBody;
  if (raw !== undefined) {
    fetchBody = raw;
  } else if (body !== undefined) {
    fetchHeaders['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers: fetchHeaders, body: fetchBody });
  let json;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }

  return {
    status: res.status,
    result: res.headers.get('x-quest-result'),
    hint: res.headers.get('x-quest-hint'),
    json,
  };
}

// A full, valid movie body built from the schema's own examples.
function validMovieBody(overrides = {}) {
  const body = {};
  for (const field of schemas.movies.fields) {
    if (field.readonly) continue;
    body[field.name] = field.example;
  }
  body.directorId = 2; // guaranteed to exist per seed contract
  return { ...body, ...overrides };
}

// --- cross-cutting behaviour -------------------------------------------

test('no header: no X-Quest-* headers at all', async () => {
  const r = await q(undefined, 'GET', '/api/movies');
  assert.strictEqual(r.result, null);
  assert.strictEqual(r.hint, null);
});

test('unknown level id: fail + unknown-level', async () => {
  const r = await q(99, 'GET', '/api/movies');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'unknown-level');
});

// --- level 1: GET /api/movies --------------------------------------------

test('level 1 pass', async () => {
  const r = await q(1, 'GET', '/api/movies');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'pass');
});

test('level 1 fail: wrong method', async () => {
  const r = await q(1, 'POST', '/api/movies');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'wrong-method');
});

test('level 1 fail: wrong path', async () => {
  const r = await q(1, 'GET', '/api/directors');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'wrong-path');
});

test('level 1 fail: wrong-status fallback on invalid extra query', async () => {
  const r = await q(1, 'GET', '/api/movies', { query: { sort: 'color' } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'wrong-status:200');
  assert.strictEqual(r.status, 400);
});

// --- level 2: GET /api/movies/:id ----------------------------------------

test('level 2 pass', async () => {
  const r = await q(2, 'GET', '/api/movies/3');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'pass');
});

test('level 2 fail: wrong method', async () => {
  const r = await q(2, 'POST', '/api/movies/3');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'wrong-method');
});

test('level 2 fail: wrong path', async () => {
  const r = await q(2, 'GET', '/api/movies');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'wrong-path');
});

// --- level 3: GET /api/movies?genre=... -----------------------------------

test('level 3 pass', async () => {
  const r = await q(3, 'GET', '/api/movies', { query: { genre: 'sci-fi' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'pass');
});

test('level 3 fail: missing genre', async () => {
  const r = await q(3, 'GET', '/api/movies');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'missing-query:genre');
});

test('level 3 fail: bad genre', async () => {
  const r = await q(3, 'GET', '/api/movies', { query: { genre: 'not-a-genre' } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'bad-query:genre');
});

// --- level 4: GET /api/movies?minYear&sort&limit --------------------------

test('level 4 pass', async () => {
  const r = await q(4, 'GET', '/api/movies', { query: { minYear: 2000, sort: 'year', limit: 5 } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'pass');
});

test('level 4 fail: missing minYear', async () => {
  const r = await q(4, 'GET', '/api/movies', { query: { sort: 'year', limit: 5 } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'missing-query:minYear');
});

test('level 4 fail: bad minYear', async () => {
  const r = await q(4, 'GET', '/api/movies', { query: { minYear: 'abc', sort: 'year', limit: 5 } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'bad-query:minYear');
});

// --- level 5: POST /api/movies (valid body) -------------------------------

test('level 5 pass', async () => {
  const r = await q(5, 'POST', '/api/movies', { body: validMovieBody() });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.result, 'pass');
});

test('level 5 fail: invalid body (missing required field)', async () => {
  const r = await q(5, 'POST', '/api/movies', { body: { title: 'x' } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-invalid:year');
});

test('level 5 fail: body not an object', async () => {
  const r = await q(5, 'POST', '/api/movies', { body: [] });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-missing');
});

// --- level 6: POST /api/movies (server must reject) -----------------------

test('level 6 pass: rejected body', async () => {
  const r = await q(6, 'POST', '/api/movies', { body: {} });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.result, 'pass');
});

test('level 6 fail: body not an object', async () => {
  // A bare string fails express.json()'s strict top-level parse (only
  // objects/arrays are accepted), which would surface as body-not-json
  // instead. Use an array: it parses fine but still isn't a plain object.
  const r = await q(6, 'POST', '/api/movies', { body: [1, 2, 3] });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-missing');
});

test('level 6 fail: body was valid (server accepted it)', async () => {
  const r = await q(6, 'POST', '/api/movies', { body: validMovieBody() });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-was-valid');
});

// --- level 7: PATCH /api/movies/:id (partial valid body) ------------------

test('level 7 pass', async () => {
  const r = await q(7, 'PATCH', '/api/movies/3', { body: { rating: 9.1 } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'pass');
});

test('level 7 fail: empty object body', async () => {
  const r = await q(7, 'PATCH', '/api/movies/3', { body: {} });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-missing');
});

test('level 7 fail: invalid field', async () => {
  const r = await q(7, 'PATCH', '/api/movies/3', { body: { year: 'not-a-number' } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-invalid:year');
});

// --- level 8: PUT /api/movies/:id (full valid body) -----------------------

test('level 8 pass', async () => {
  const r = await q(8, 'PUT', '/api/movies/3', { body: validMovieBody() });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'pass');
});

test('level 8 fail: missing required field', async () => {
  const r = await q(8, 'PUT', '/api/movies/3', { body: { title: 'x' } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-invalid:year');
});

test('level 8 fail: body not an object', async () => {
  const r = await q(8, 'PUT', '/api/movies/3', { body: [] });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'body-missing');
});

// --- level 9: GET /api/directors/:id/movies?sort=... ----------------------

test('level 9 pass', async () => {
  const r = await q(9, 'GET', '/api/directors/2/movies', { query: { sort: 'year' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'pass');
});

test('level 9 fail: missing sort', async () => {
  const r = await q(9, 'GET', '/api/directors/2/movies');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'missing-query:sort');
});

test('level 9 fail: bad sort', async () => {
  const r = await q(9, 'GET', '/api/directors/2/movies', { query: { sort: 'invalid' } });
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'bad-query:sort');
});

// --- level 10: DELETE /api/movies/:id --------------------------------------

test('level 10 pass', async () => {
  const r = await q(10, 'DELETE', '/api/movies/4');
  assert.strictEqual(r.status, 204);
  assert.strictEqual(r.result, 'pass');
});

test('level 10 fail: wrong method', async () => {
  const r = await q(10, 'GET', '/api/movies/3');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'wrong-method');
});

test('level 10 fail: id not found', async () => {
  const r = await q(10, 'DELETE', '/api/movies/999');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'id-not-found');
});

// --- level 11: GET /api/movies/:id, expecting 404 --------------------------

test('level 11 pass', async () => {
  const del = await fetch(`${base}/api/movies/3`, { method: 'DELETE' });
  assert.strictEqual(del.status, 204);
  const r = await q(11, 'GET', '/api/movies/3');
  assert.strictEqual(r.status, 404);
  assert.strictEqual(r.result, 'pass');
});

test('level 11 fail: still exists', async () => {
  const r = await q(11, 'GET', '/api/movies/3');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'still-exists');
});

test('level 11 fail: wrong method', async () => {
  const r = await q(11, 'DELETE', '/api/movies/3');
  assert.strictEqual(r.result, 'fail');
  assert.strictEqual(r.hint, 'wrong-method');
});
