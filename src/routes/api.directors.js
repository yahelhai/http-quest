const express = require('express');

const store = require('../data/store');
const schemas = require('../schemas');
const { filterMovies, filterDirectors } = require('../query');
const { validateBody, validateQuery } = require('../validate');

const router = express.Router();

function badRequest(res, error, details) {
  res.status(400).json({ error, details });
}

function moviesOf(directorId) {
  return store.movies.all().filter((movie) => movie.directorId === directorId);
}

router.param('id', (req, res, next, id) => {
  const director = /^\d+$/.test(id) && store.directors.find(Number(id));
  if (!director) return res.status(404).json({ error: 'Director not found' });

  req.director = director;
  next();
});

router.get('/', (req, res) => {
  const { problems, query } = validateQuery(schemas.directors.queries, req.query);
  if (problems.length) return badRequest(res, 'Invalid query parameters', problems);

  res.json(filterDirectors(store.directors.all(), query));
});

router.get('/:id', (req, res) => {
  res.json(req.director);
});

// The movies of one director take the same parameters as /api/movies.
router.get('/:id/movies', (req, res) => {
  const { problems, query } = validateQuery(schemas.movies.queries, req.query);
  if (problems.length) return badRequest(res, 'Invalid query parameters', problems);

  res.json(filterMovies(moviesOf(req.director.id), query));
});

router.post('/', (req, res) => {
  const problems = validateBody(schemas.directors, req.body);
  if (problems.length) return badRequest(res, 'Invalid director', problems);

  const director = store.directors.add(req.body);
  res.status(201).location(`/api/directors/${director.id}`).json(director);
});

router.put('/:id', (req, res) => {
  const problems = validateBody(schemas.directors, req.body);
  if (problems.length) return badRequest(res, 'Invalid director', problems);

  res.json(store.directors.replace(req.director.id, req.body));
});

router.patch('/:id', (req, res) => {
  const problems = validateBody(schemas.directors, req.body, { partial: true });
  if (problems.length) return badRequest(res, 'Invalid director', problems);

  res.json(store.directors.update(req.director.id, req.body));
});

// Movies point at their director by id, so removing a director who still has
// movies would leave them pointing at nothing.
router.delete('/:id', (req, res) => {
  if (moviesOf(req.director.id).length > 0) {
    return res.status(409).json({ error: 'Director still has movies' });
  }

  store.directors.remove(req.director.id);
  res.status(204).end();
});

module.exports = router;
