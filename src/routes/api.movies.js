const express = require('express');

const store = require('../data/store');
const schemas = require('../schemas');
const { filterMovies } = require('../query');
const { validateBody, validateQuery } = require('../validate');

const router = express.Router();

function badRequest(res, error, details) {
  res.status(400).json({ error, details });
}

// Every /:id route needs the same lookup, so it happens once.
router.param('id', (req, res, next, id) => {
  const movie = /^\d+$/.test(id) && store.movies.find(Number(id));
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  req.movie = movie;
  next();
});

router.get('/', (req, res) => {
  const { problems, query } = validateQuery(schemas.movies.queries, req.query);
  if (problems.length) return badRequest(res, 'Invalid query parameters', problems);

  res.json(filterMovies(store.movies.all(), query));
});

router.get('/:id', (req, res) => {
  res.json(req.movie);
});

router.post('/', (req, res) => {
  const problems = validateBody(schemas.movies, req.body);
  if (problems.length) return badRequest(res, 'Invalid movie', problems);

  const movie = store.movies.add(req.body);
  res.status(201).location(`/api/movies/${movie.id}`).json(movie);
});

router.put('/:id', (req, res) => {
  const problems = validateBody(schemas.movies, req.body);
  if (problems.length) return badRequest(res, 'Invalid movie', problems);

  res.json(store.movies.replace(req.movie.id, req.body));
});

router.patch('/:id', (req, res) => {
  const problems = validateBody(schemas.movies, req.body, { partial: true });
  if (problems.length) return badRequest(res, 'Invalid movie', problems);

  if (Object.keys(req.body).length === 0) {
    return badRequest(res, 'Nothing to update', ['the body has no fields']);
  }

  res.json(store.movies.update(req.movie.id, req.body));
});

router.delete('/:id', (req, res) => {
  store.movies.remove(req.movie.id);
  res.status(204).end();
});

module.exports = router;
