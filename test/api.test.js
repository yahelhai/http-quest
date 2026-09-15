'use strict';

const test = require('node:test');
const assert = require('node:assert');

const app = require('../server');
const store = require('../src/data/store');
const seed = require('../src/data/seed');
const { GENRES } = require('../src/schemas');

let server;
let base;

test.before(() => {
  server = app.listen(0);
  base = 'http://127.0.0.1:' + server.address().port;
});

test.after(() => server.close());

test.beforeEach(() => store.reset());

function url(p) {
  return base + p;
}

async function get(p) {
  const res = await fetch(url(p));
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body };
}

async function send(method, p, payload, rawBody) {
  const opts = { method };
  if (rawBody !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = rawBody;
  } else if (payload !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(payload);
  }
  const res = await fetch(url(p), opts);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body };
}

// --- seed-derived fixtures (do not depend on specific titles) ---

const existingDirectorId = seed.directors[0].id;
const anotherDirectorId = (seed.directors.find((d) => d.id !== existingDirectorId) || seed.directors[0]).id;
const sciFiMovie = seed.movies.find((m) => m.genre === 'sci-fi');
const directorWithMovies = seed.directors.find(
  (d) => seed.movies.filter((m) => m.directorId === d.id).length >= 2
);

function validMovieBody(overrides) {
  return Object.assign(
    {
      title: 'Test Movie Title',
      year: 2015,
      genre: GENRES[0],
      rating: 7.5,
      directorId: existingDirectorId,
    },
    overrides
  );
}

function validDirectorBody(overrides) {
  return Object.assign(
    { name: 'Test Director', country: 'Testland', born: 1975 },
    overrides
  );
}

// ---------------- movies: list / get ----------------

test('GET /api/movies returns the seeded list', async () => {
  const { status, body } = await get('/api/movies');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.length, seed.movies.length);
});

test('GET /api/movies/:id returns a single movie', async () => {
  const { status, body } = await get('/api/movies/3');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.id, 3);
});

test('GET /api/movies/:id 404s on missing id', async () => {
  const { status, body } = await get('/api/movies/999999');
  assert.strictEqual(status, 404);
  assert.ok(body.error);
});

test('GET /api/movies/:id 404s on non-numeric id', async () => {
  const { status } = await get('/api/movies/abc');
  assert.strictEqual(status, 404);
});

// ---------------- movies: filters ----------------

test('GET /api/movies filters by genre', async () => {
  assert.ok(sciFiMovie, 'seed must contain a sci-fi movie');
  const { status, body } = await get('/api/movies?genre=sci-fi');
  assert.strictEqual(status, 200);
  assert.ok(body.length >= 1);
  assert.ok(body.every((m) => m.genre === 'sci-fi'));
});

test('GET /api/movies filters by directorId', async () => {
  const { status, body } = await get(`/api/movies?directorId=${existingDirectorId}`);
  assert.strictEqual(status, 200);
  assert.ok(body.every((m) => m.directorId === existingDirectorId));
});

test('GET /api/movies filters by minYear and maxYear', async () => {
  const years = seed.movies.map((m) => m.year);
  const minYear = Math.min(...years);

  const onlyMin = await get(`/api/movies?minYear=${minYear}&maxYear=${minYear}`);
  assert.strictEqual(onlyMin.status, 200);
  assert.ok(onlyMin.body.every((m) => m.year === minYear));
  assert.ok(onlyMin.body.length >= 1);

  const all = await get(`/api/movies?minYear=${minYear}`);
  assert.strictEqual(all.status, 200);
  assert.strictEqual(all.body.length, seed.movies.length);
});

test('GET /api/movies filters by minRating', async () => {
  const ratings = seed.movies.map((m) => m.rating);
  const threshold = Math.max(...ratings);
  const { status, body } = await get(`/api/movies?minRating=${threshold}`);
  assert.strictEqual(status, 200);
  assert.ok(body.every((m) => m.rating >= threshold));
});

test('GET /api/movies filters by q (case-insensitive substring)', async () => {
  const sample = seed.movies[0].title;
  const needle = sample.slice(0, Math.max(1, Math.ceil(sample.length / 2))).toUpperCase();
  const { status, body } = await get(`/api/movies?q=${encodeURIComponent(needle)}`);
  assert.strictEqual(status, 200);
  assert.ok(body.some((m) => m.id === seed.movies[0].id));
});

// ---------------- movies: sort ----------------

test('GET /api/movies sorts by year ascending and descending', async () => {
  const asc = await get('/api/movies?sort=year');
  assert.strictEqual(asc.status, 200);
  for (let i = 1; i < asc.body.length; i++) {
    assert.ok(asc.body[i - 1].year <= asc.body[i].year);
  }

  const desc = await get('/api/movies?sort=-year');
  assert.strictEqual(desc.status, 200);
  for (let i = 1; i < desc.body.length; i++) {
    assert.ok(desc.body[i - 1].year >= desc.body[i].year);
  }
});

test('GET /api/movies sorts by rating and title', async () => {
  const byRating = await get('/api/movies?sort=rating');
  for (let i = 1; i < byRating.body.length; i++) {
    assert.ok(byRating.body[i - 1].rating <= byRating.body[i].rating);
  }

  const byTitle = await get('/api/movies?sort=-title');
  for (let i = 1; i < byTitle.body.length; i++) {
    assert.ok(byTitle.body[i - 1].title >= byTitle.body[i].title);
  }
});

test('GET /api/movies applies limit after filtering and sorting', async () => {
  const { status, body } = await get('/api/movies?sort=year&limit=1');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.length, 1);
  const allSorted = await get('/api/movies?sort=year');
  assert.strictEqual(body[0].id, allSorted.body[0].id);
});

test('GET /api/movies with bad sort returns 400 with details[0].field === "sort"', async () => {
  const { status, body } = await get('/api/movies?sort=color');
  assert.strictEqual(status, 400);
  assert.ok(Array.isArray(body.details));
  assert.strictEqual(body.details[0].field, 'sort');
});

test('GET /api/movies with bad limit returns 400', async () => {
  const { status, body } = await get('/api/movies?limit=abc');
  assert.strictEqual(status, 400);
  assert.ok(Array.isArray(body.details));
  assert.strictEqual(body.details[0].field, 'limit');
});

// ---------------- movies: POST ----------------

test('POST /api/movies with a valid body creates a movie (201, Location, id)', async () => {
  const { status, headers, body } = await send('POST', '/api/movies', validMovieBody());
  assert.strictEqual(status, 201);
  assert.strictEqual(headers.get('location'), `/api/movies/${body.id}`);
  assert.ok(Number.isInteger(body.id));
  const fetched = await get(`/api/movies/${body.id}`);
  assert.strictEqual(fetched.status, 200);
});

test('POST /api/movies missing a required field returns 400 with details', async () => {
  const bad = validMovieBody();
  delete bad.year;
  const { status, body } = await send('POST', '/api/movies', bad);
  assert.strictEqual(status, 400);
  assert.ok(body.details.some((d) => d.field === 'year' && d.code === 'required'));
});

test('POST /api/movies with an unknown field returns 400', async () => {
  const { status, body } = await send('POST', '/api/movies', validMovieBody({ nope: 1 }));
  assert.strictEqual(status, 400);
  assert.ok(body.details.some((d) => d.field === 'nope' && d.code === 'unknown'));
});

test('POST /api/movies with id in body returns 400 readonly', async () => {
  const { status, body } = await send('POST', '/api/movies', validMovieBody({ id: 999 }));
  assert.strictEqual(status, 400);
  assert.ok(body.details.some((d) => d.field === 'id' && d.code === 'readonly'));
});

test('POST /api/movies with a non-existent directorId returns 400 ref', async () => {
  const { status, body } = await send('POST', '/api/movies', validMovieBody({ directorId: 987654 }));
  assert.strictEqual(status, 400);
  assert.ok(body.details.some((d) => d.field === 'directorId' && d.code === 'ref'));
});

// ---------------- movies: PUT / PATCH / DELETE ----------------

test('PUT /api/movies/:id replaces the movie (200)', async () => {
  const replacement = validMovieBody({ title: 'Replaced Title' });
  const { status, body } = await send('PUT', '/api/movies/3', replacement);
  assert.strictEqual(status, 200);
  assert.strictEqual(body.id, 3);
  assert.strictEqual(body.title, 'Replaced Title');
});

test('PUT /api/movies/:id missing a field returns 400', async () => {
  const bad = validMovieBody();
  delete bad.title;
  const { status, body } = await send('PUT', '/api/movies/3', bad);
  assert.strictEqual(status, 400);
  assert.ok(body.details.some((d) => d.field === 'title'));
});

test('PATCH /api/movies/:id partially updates (200, merges)', async () => {
  const before = await get('/api/movies/3');
  const { status, body } = await send('PATCH', '/api/movies/3', { title: 'Patched Title' });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.title, 'Patched Title');
  assert.strictEqual(body.year, before.body.year);
  assert.strictEqual(body.genre, before.body.genre);
});

test('PATCH /api/movies/:id with empty object returns 400', async () => {
  const { status } = await send('PATCH', '/api/movies/3', {});
  assert.strictEqual(status, 400);
});

test('PATCH /api/movies/:id on missing id returns 404', async () => {
  const { status } = await send('PATCH', '/api/movies/999999', { title: 'x' });
  assert.strictEqual(status, 404);
});

test('DELETE /api/movies/:id removes the movie (204, empty body) then 404 on repeat', async () => {
  const created = await send('POST', '/api/movies', validMovieBody());
  const del = await send('DELETE', `/api/movies/${created.body.id}`);
  assert.strictEqual(del.status, 204);
  assert.strictEqual(del.body, null);

  const again = await send('DELETE', `/api/movies/${created.body.id}`);
  assert.strictEqual(again.status, 404);
});

// ---------------- directors: CRUD ----------------

test('GET /api/directors returns the seeded list', async () => {
  const { status, body } = await get('/api/directors');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.length, seed.directors.length);
});

test('GET /api/directors/:id returns a single director', async () => {
  const { status, body } = await get(`/api/directors/${existingDirectorId}`);
  assert.strictEqual(status, 200);
  assert.strictEqual(body.id, existingDirectorId);
});

test('GET /api/directors/:id 404s on missing id', async () => {
  const { status } = await get('/api/directors/999999');
  assert.strictEqual(status, 404);
});

test('POST /api/directors creates a director (201, Location, id)', async () => {
  const { status, headers, body } = await send('POST', '/api/directors', validDirectorBody());
  assert.strictEqual(status, 201);
  assert.strictEqual(headers.get('location'), `/api/directors/${body.id}`);
});

test('PUT /api/directors/:id replaces a director', async () => {
  const created = await send('POST', '/api/directors', validDirectorBody());
  const { status, body } = await send(
    'PUT',
    `/api/directors/${created.body.id}`,
    validDirectorBody({ name: 'Renamed' })
  );
  assert.strictEqual(status, 200);
  assert.strictEqual(body.name, 'Renamed');
});

test('PATCH /api/directors/:id merges fields', async () => {
  const created = await send('POST', '/api/directors', validDirectorBody());
  const { status, body } = await send('PATCH', `/api/directors/${created.body.id}`, { name: 'Merged' });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.name, 'Merged');
  assert.strictEqual(body.country, 'Testland');
});

test('DELETE /api/directors/:id with no movies succeeds (204)', async () => {
  const created = await send('POST', '/api/directors', validDirectorBody());
  const del = await send('DELETE', `/api/directors/${created.body.id}`);
  assert.strictEqual(del.status, 204);
});

test('DELETE /api/directors/:id with movies returns 409', async () => {
  assert.ok(directorWithMovies, 'seed must have a director with movies');
  const { status, body } = await send('DELETE', `/api/directors/${directorWithMovies.id}`);
  assert.strictEqual(status, 409);
  assert.strictEqual(body.error, 'Director still has movies');
});

// ---------------- directors: filters + nested movies ----------------

test('GET /api/directors filters by country (case-insensitive)', async () => {
  const target = seed.directors[0];
  const { status, body } = await get(`/api/directors?country=${target.country.toUpperCase()}`);
  assert.strictEqual(status, 200);
  assert.ok(body.some((d) => d.id === target.id));
});

test('GET /api/directors/:id/movies applies sort and only that director\'s movies', async () => {
  assert.ok(directorWithMovies);
  const { status, body } = await get(`/api/directors/${directorWithMovies.id}/movies?sort=year`);
  assert.strictEqual(status, 200);
  assert.ok(body.every((m) => m.directorId === directorWithMovies.id));
  for (let i = 1; i < body.length; i++) {
    assert.ok(body[i - 1].year <= body[i].year);
  }
});

test('GET /api/directors/:id/movies 404s when director is missing', async () => {
  const { status } = await get('/api/directors/999999/movies');
  assert.strictEqual(status, 404);
});

test('GET /api/directors/:id/movies with bad query returns 400', async () => {
  const { status, body } = await get(`/api/directors/${existingDirectorId}/movies?sort=nope`);
  assert.strictEqual(status, 400);
  assert.ok(Array.isArray(body.details));
});

// ---------------- cross-cutting ----------------

test('unknown /api route returns 404 JSON', async () => {
  const { status, body } = await get('/api/xyz');
  assert.strictEqual(status, 404);
  assert.strictEqual(body.error, 'Not found');
});

test('malformed JSON body returns 400 JSON', async () => {
  const { status, body } = await send('POST', '/api/movies', undefined, '{not valid json');
  assert.strictEqual(status, 400);
  assert.strictEqual(body.error, 'Malformed JSON body');
});

test('store.reset() restores seed data', async () => {
  await send('POST', '/api/movies', validMovieBody());
  const before = await get('/api/movies');
  assert.strictEqual(before.body.length, seed.movies.length + 1);

  store.reset();

  const after = await get('/api/movies');
  assert.strictEqual(after.body.length, seed.movies.length);
  test('API responses are never cached: no ETag, no 304 on If-None-Match', async () => {
    const first = await fetch(base + '/api/movies');
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.equal(first.headers.get('etag'), null);
    const again = await fetch(base + '/api/movies', { headers: { 'If-None-Match': 'W/"anything"' } });
    assert.equal(again.status, 200);
  });
});
