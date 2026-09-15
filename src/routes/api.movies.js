'use strict';

const express = require('express');
const store = require('../data/store');
const { validate, validateQuery } = require('../validate');
const schemas = require('../schemas');

const router = express.Router();

function sendValidationError(res, status, message, errors) {
  res.status(status).json({ error: message, details: errors });
}

// Apply movies query filters/sort/limit to a list of movies.
// Returns { ok, errors, result }. Reused by the directors router for
// GET /api/directors/:id/movies.
function applyMovieQuery(movies, reqQuery) {
  const { ok, errors, query } = validateQuery(schemas.movies.queries, reqQuery);
  if (!ok) return { ok, errors, result: null };

  let result = movies.slice();

  if (query.genre !== undefined) {
    result = result.filter((m) => m.genre === query.genre);
  }
  if (query.directorId !== undefined) {
    result = result.filter((m) => m.directorId === query.directorId);
  }
  if (query.minYear !== undefined) {
    result = result.filter((m) => m.year >= query.minYear);
  }
  if (query.maxYear !== undefined) {
    result = result.filter((m) => m.year <= query.maxYear);
  }
  if (query.minRating !== undefined) {
    result = result.filter((m) => m.rating >= query.minRating);
  }
  if (query.q !== undefined) {
    const needle = query.q.toLowerCase();
    result = result.filter((m) => m.title.toLowerCase().includes(needle));
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
  const { ok, errors, result } = applyMovieQuery(store.movies.list(), req.query);
  if (!ok) return sendValidationError(res, 400, 'Invalid query parameters', errors);
  res.json(result);
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Movie not found' });
  const movie = store.movies.get(id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });
  res.json(movie);
});

router.post('/', (req, res) => {
  const { ok, errors } = validate(schemas.movies, req.body);
  if (!ok) return sendValidationError(res, 400, 'Invalid movie', errors);
  const created = store.movies.create(req.body);
  res.status(201).set('Location', `/api/movies/${created.id}`).json(created);
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!/^\d+$/.test(req.params.id) || !store.movies.get(id)) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  const { ok, errors } = validate(schemas.movies, req.body);
  if (!ok) return sendValidationError(res, 400, 'Invalid movie', errors);
  const replaced = store.movies.replace(id, req.body);
  res.json(replaced);
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!/^\d+$/.test(req.params.id) || !store.movies.get(id)) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body) || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty object' });
  }
  const { ok, errors } = validate(schemas.movies, body, { partial: true });
  if (!ok) return sendValidationError(res, 400, 'Invalid movie', errors);
  const updated = store.movies.update(id, body);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!/^\d+$/.test(req.params.id) || !store.movies.remove(id)) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  res.status(204).end();
});

module.exports = router;
module.exports.applyMovieQuery = applyMovieQuery;
