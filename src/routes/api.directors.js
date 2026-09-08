'use strict';

const express = require('express');
const store = require('../data/store');
const { validate, validateQuery } = require('../validate');
const schemas = require('../schemas');
const { applyMovieQuery } = require('./api.movies');

const router = express.Router();

function sendValidationError(res, status, message, errors) {
  res.status(status).json({ error: message, details: errors });
}

function applyDirectorQuery(directors, reqQuery) {
  const { ok, errors, query } = validateQuery(schemas.directors.queries, reqQuery);
  if (!ok) return { ok, errors, result: null };

  let result = directors.slice();

  if (query.country !== undefined) {
    const needle = query.country.toLowerCase();
    result = result.filter((d) => d.country.toLowerCase() === needle);
  }
  if (query.q !== undefined) {
    const needle = query.q.toLowerCase();
    result = result.filter((d) => d.name.toLowerCase().includes(needle));
  }

  if (query.sort !== undefined) {
    const desc = query.sort.startsWith('-');
    const field = desc ? query.sort.slice(1) : query.sort;
    result.sort((a, b) => {
      if (a[field] < b[field]) return desc ? 1 : -1;
      if (a[field] > b[field]) return desc ? -1 : 1;
      return 0;
    });
  }

  if (query.limit !== undefined) {
    result = result.slice(0, query.limit);
  }

  return { ok: true, errors: [], result };
}

router.get('/', (req, res) => {
  const { ok, errors, result } = applyDirectorQuery(store.directors.list(), req.query);
  if (!ok) return sendValidationError(res, 400, 'Invalid query parameters', errors);
  res.json(result);
});

router.get('/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Director not found' });
  const id = parseInt(req.params.id, 10);
  const director = store.directors.get(id);
  if (!director) return res.status(404).json({ error: 'Director not found' });
  res.json(director);
});

router.get('/:id/movies', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Director not found' });
  const id = parseInt(req.params.id, 10);
  const director = store.directors.get(id);
  if (!director) return res.status(404).json({ error: 'Director not found' });

  const movies = store.movies.list().filter((m) => m.directorId === id);
  const { ok, errors, result } = applyMovieQuery(movies, req.query);
  if (!ok) return sendValidationError(res, 400, 'Invalid query parameters', errors);
  res.json(result);
});

router.post('/', (req, res) => {
  const { ok, errors } = validate(schemas.directors, req.body);
  if (!ok) return sendValidationError(res, 400, 'Invalid director', errors);
  const created = store.directors.create(req.body);
  res.status(201).set('Location', `/api/directors/${created.id}`).json(created);
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!/^\d+$/.test(req.params.id) || !store.directors.get(id)) {
    return res.status(404).json({ error: 'Director not found' });
  }
  const { ok, errors } = validate(schemas.directors, req.body);
  if (!ok) return sendValidationError(res, 400, 'Invalid director', errors);
  const replaced = store.directors.replace(id, req.body);
  res.json(replaced);
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!/^\d+$/.test(req.params.id) || !store.directors.get(id)) {
    return res.status(404).json({ error: 'Director not found' });
  }
  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body) || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty object' });
  }
  const { ok, errors } = validate(schemas.directors, body, { partial: true });
  if (!ok) return sendValidationError(res, 400, 'Invalid director', errors);
  const updated = store.directors.update(id, body);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Director not found' });
  const id = parseInt(req.params.id, 10);
  if (!store.directors.get(id)) return res.status(404).json({ error: 'Director not found' });

  const hasMovies = store.movies.list().some((m) => m.directorId === id);
  if (hasMovies) return res.status(409).json({ error: 'Director still has movies' });

  store.directors.remove(id);
  res.status(204).end();
});

module.exports = router;
