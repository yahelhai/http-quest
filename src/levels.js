'use strict';

// Level definitions for HTTP Quest: what each level expects from the request.

const { validate, validateQuery } = require('./validate');
const schemas = require('./schemas');

const movieQueries = schemas.movies.queries;

// --- small reusable check helpers -----------------------------------------

function methodIs(method) {
  return (req) => (req.method.toUpperCase() === method ? null : 'wrong-method');
}

function pathMatches(pattern) {
  return (req) => (pattern.test(req.baseUrl + req.path) ? null : 'wrong-path');
}

// Required query params must be present, and (together with any other
// present query params) valid according to the movies query schema.
function requireQuery(names) {
  return (req) => {
    for (const name of names) {
      if (req.query[name] === undefined) return `missing-query:${name}`;
    }
    const { ok, errors } = validateQuery(movieQueries, req.query);
    if (!ok) {
      const err = errors.find((e) => names.includes(e.field)) || errors[0];
      return `bad-query:${err.field}`;
    }
    return null;
  };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function badBodyShape(req) {
  const contentType = req.get('content-type') || '';
  if (!contentType.includes('application/json') || req.body === undefined) return 'body-not-json';
  if (!isPlainObject(req.body)) return 'body-missing';
  return null;
}

// Any JSON object body is accepted at the shape level (level 6: the route
// itself decides whether the content is valid).
function bodyIsObject() {
  return (req) => badBodyShape(req);
}

// Body must be a JSON object that also passes schema validation.
function bodyValid(schema, { partial = false, requireNonEmpty = false } = {}) {
  return (req) => {
    const shapeFail = badBodyShape(req);
    if (shapeFail) return shapeFail;
    if (requireNonEmpty && Object.keys(req.body).length === 0) return 'body-missing';
    const { ok, errors } = validate(schema, req.body, { partial });
    if (!ok) return `body-invalid:${errors[0].field}`;
    return null;
  };
}

function compose(...checks) {
  return (req, res) => {
    for (const check of checks) {
      const hint = check(req, res);
      if (hint) return hint;
    }
    return null;
  };
}

// --- levels -----------------------------------------------------------------

const MOVIES_LIST = /^\/api\/movies\/?$/;
const MOVIE_ITEM = /^\/api\/movies\/\d+\/?$/;
const DIRECTOR_MOVIES = /^\/api\/directors\/\d+\/movies\/?$/;

const levels = [
  { id: 1, method: 'GET', pathPattern: MOVIES_LIST, expect: 200,
    check: compose(methodIs('GET'), pathMatches(MOVIES_LIST)) },

  { id: 2, method: 'GET', pathPattern: MOVIE_ITEM, expect: 200,
    check: compose(methodIs('GET'), pathMatches(MOVIE_ITEM)) },

  { id: 3, method: 'GET', pathPattern: MOVIES_LIST, expect: 200,
    check: compose(methodIs('GET'), pathMatches(MOVIES_LIST), requireQuery(['genre'])) },

  { id: 4, method: 'GET', pathPattern: MOVIES_LIST, expect: 200,
    check: compose(methodIs('GET'), pathMatches(MOVIES_LIST), requireQuery(['minYear', 'sort', 'limit'])) },

  { id: 5, method: 'POST', pathPattern: MOVIES_LIST, expect: 201,
    check: compose(methodIs('POST'), pathMatches(MOVIES_LIST), bodyValid(schemas.movies)) },

  { id: 6, method: 'POST', pathPattern: MOVIES_LIST, expect: 400,
    check: compose(methodIs('POST'), pathMatches(MOVIES_LIST), bodyIsObject()) },

  { id: 7, method: 'PATCH', pathPattern: MOVIE_ITEM, expect: 200,
    check: compose(methodIs('PATCH'), pathMatches(MOVIE_ITEM), bodyValid(schemas.movies, { partial: true, requireNonEmpty: true })) },

  { id: 8, method: 'PUT', pathPattern: MOVIE_ITEM, expect: 200,
    check: compose(methodIs('PUT'), pathMatches(MOVIE_ITEM), bodyValid(schemas.movies)) },

  { id: 9, method: 'GET', pathPattern: DIRECTOR_MOVIES, expect: 200,
    check: compose(methodIs('GET'), pathMatches(DIRECTOR_MOVIES), requireQuery(['sort'])) },

  { id: 10, method: 'DELETE', pathPattern: MOVIE_ITEM, expect: 204,
    check: compose(methodIs('DELETE'), pathMatches(MOVIE_ITEM)) },

  { id: 11, method: 'GET', pathPattern: MOVIE_ITEM, expect: 404,
    check: compose(methodIs('GET'), pathMatches(MOVIE_ITEM)) },
];

function byId(id) {
  return levels.find((level) => level.id === id);
}


module.exports = { levels, byId };
