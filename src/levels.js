// The levels. Each one carries the text the player reads plus what the server
// needs to judge an attempt: the method, the path, the status a correct
// request produces, and for some levels an extra check.
//
// src/quest.js compares method, path and status. `check` is only for what is
// left after that, and returns the sentence the player should read, or null.
// `mistakes` explains a likely wrong status better than the general message.
//
// Only the text ever reaches the browser. See publicLevels at the bottom.

const { validateBody, validateQuery, isObject } = require('./validate');
const schemas = require('./schemas');

const MOVIES = /^\/api\/movies\/?$/;
const MOVIE = /^\/api\/movies\/\d+\/?$/;
const DIRECTOR = /^\/api\/directors\/\d+\/?$/;
const DIRECTOR_MOVIES = /^\/api\/directors\/\d+\/movies\/?$/;

// Every level that asks for query parameters is listing movies.
function missingQuery(request, names) {
  for (const name of names) {
    if (request.query[name] === undefined) {
      return `There is no ${name} parameter in the request. Add it under Query.`;
    }
  }

  const { problems } = validateQuery(schemas.movies.queries, request.query);
  return problems.length ? `The server won't take that: ${problems[0]}.` : null;
}

function notJsonObject(request) {
  if (!request.contentType.includes('application/json')) {
    return "This level needs a JSON body and the request didn't carry one.";
  }
  return isObject(request.body) ? null : 'The body has to be a JSON object.';
}

function badBody(request, { partial = false } = {}) {
  const shape = notJsonObject(request);
  if (shape) return shape;

  if (partial && Object.keys(request.body).length === 0) {
    return "An empty body doesn't change anything.";
  }

  const problems = validateBody(schemas.movies, request.body, { partial });
  return problems.length ? `The body doesn't fit the schema: ${problems[0]}.` : null;
}

const levels = [
  {
    id: 1,
    title: 'A first GET request',
    concept: "GET asks the server for something and changes nothing. What comes back is a status code and, in this API, a JSON body. 200 means it worked.",
    task: 'Ask the server for the whole list of movies.',
    success: 'Status 200, and every movie in the store as a JSON array.',
    method: 'GET',
    path: MOVIES,
    status: 200,
  },
  {
    id: 2,
    title: 'An id in the path',
    concept: '/api/movies is the whole collection. /api/movies/3 is the one movie with id 3, and that 3 is a route parameter: part of the path, not something after a question mark.',
    task: 'Ask for a single movie by putting an id that exists at the end of the path.',
    success: 'One object this time instead of an array, because the path pointed at one movie.',
    method: 'GET',
    path: MOVIE,
    status: 200,
    mistakes: { 404: 'Nothing has that id. Level 1 listed the ids that do exist.' },
  },
  {
    id: 3,
    title: 'Filtering with a query parameter',
    concept: "Query parameters come after the question mark. They don't change which resource you are asking for, only what you get back: genre drops every movie from another genre.",
    task: 'Ask for the movies of one genre. It has to be a genre the schema allows.',
    success: 'Everything that came back is from the genre you asked for.',
    method: 'GET',
    path: MOVIES,
    status: 200,
    check: (request) => missingQuery(request, ['genre']),
  },
  {
    id: 4,
    title: 'Three parameters in one request',
    concept: 'Parameters stack. This API filters first, sorts next and cuts the list to the limit last, which is why a limit of three gives you the top three and not three at random.',
    task: 'Ask for movies from 2000 onwards, best rated first, and no more than three of them.',
    success: 'Filtered, sorted and trimmed, all from one request line.',
    method: 'GET',
    path: MOVIES,
    status: 200,
    check(request) {
      const missing = missingQuery(request, ['minYear', 'sort', 'limit']);
      if (missing) return missing;

      if (request.query.minYear !== '2000') return "The task names one year, and that isn't it.";
      if (request.query.sort !== '-rating') return 'Wrong order. Check the direction, not only the field.';
      if (Number(request.query.limit) > 3) return 'That is more movies than the task asks for.';
      return null;
    },
  },
  {
    id: 5,
    title: 'The movies of one director',
    concept: "Movies carry a directorId, so the two resources are linked. /api/directors/:id/movies is a nested path for one director's movies, and query parameters still work on it.",
    task: 'Ask for the movies of a director that exists, ordered by year.',
    success: "Only that director's movies, in year order.",
    method: 'GET',
    path: DIRECTOR_MOVIES,
    status: 200,
    mistakes: { 404: 'No director has that id. /api/directors lists them.' },
    check(request) {
      const missing = missingQuery(request, ['sort']);
      if (missing) return missing;

      return ['year', '-year'].includes(request.query.sort)
        ? null
        : 'The task asks for year order, and this sort is on another field.';
    },
  },
  {
    id: 6,
    title: 'Creating with POST',
    concept: 'POST hands data to a collection and asks for a new item in it. The movie travels in the body as JSON. When it works you get 201 Created and a Location header with the address of what you just made.',
    task: 'Add a movie. The body needs every required field, and directorId has to point at a director that exists.',
    success: 'Status 201, the movie with the id the server gave it, and a Location header you could GET right away.',
    method: 'POST',
    path: MOVIES,
    status: 201,
    check: (request) => badBody(request),
  },
  {
    id: 7,
    title: "A request the server won't take",
    concept: "A 4xx status isn't a crash, it's the server saying the request was wrong. Break the schema and this API answers 400 with a details list of what it didn't like.",
    task: 'Send a movie the server has to refuse. Drop a required field, or give one the wrong type.',
    success: 'Status 400, and details points at the field that failed.',
    method: 'POST',
    path: MOVIES,
    status: 400,
    mistakes: { 201: 'That body was fine, so the movie was created. This level wants one the server turns down.' },
    check: (request) => notJsonObject(request),
  },
  {
    id: 8,
    title: 'Changing one field',
    concept: "PATCH touches only what's in the body and leaves the rest alone. The path picks the movie, the body carries the change.",
    task: 'Change the rating of a movie that exists, and nothing else about it.',
    success: 'The rating changed and every other field came back untouched.',
    method: 'PATCH',
    path: MOVIE,
    status: 200,
    mistakes: { 404: 'No movie has that id, so there is nothing to update.' },
    check(request) {
      const bad = badBody(request, { partial: true });
      if (bad) return bad;

      const fields = Object.keys(request.body);
      return fields.length === 1 && fields[0] === 'rating'
        ? null
        : 'A PATCH body should carry only the field that changes.';
    },
  },
  {
    id: 9,
    title: 'Replacing the whole thing',
    concept: "PUT replaces instead of merging, so the body has to describe the movie in full. Leave a required field out and it's an invalid request, not a field you kept. That is the difference from PATCH.",
    task: 'Replace a movie that exists. Every required field, including the ones you are not changing.',
    success: 'The movie is now exactly what you sent, and it kept the id from the path.',
    method: 'PUT',
    path: MOVIE,
    status: 200,
    mistakes: { 404: 'No movie has that id, so there is nothing to replace.' },
    check: (request) => badBody(request),
  },
  {
    id: 10,
    title: 'Deleting',
    concept: "DELETE removes whatever the path points at. This API answers 204 No Content: it worked, and there's nothing left worth sending back.",
    task: 'Delete one of the movies. Keep the id in mind, the next level needs it.',
    success: 'Status 204 and an empty body.',
    method: 'DELETE',
    path: MOVIE,
    status: 204,
    mistakes: { 404: 'No movie has that id, so there was nothing to delete.' },
  },
  {
    id: 11,
    title: 'Asking for what you deleted',
    concept: "404 isn't a broken server, it's a precise answer: nothing lives at that address. The movie you just deleted is the easiest way to see one.",
    task: 'Ask for the movie you deleted a moment ago.',
    success: "Status 404 and an error message, which is the right answer for a movie that isn't there.",
    method: 'GET',
    path: MOVIE,
    status: 404,
    mistakes: { 200: 'That one is still here, so it is the wrong id. Use the one you deleted.' },
  },
  {
    id: 12,
    title: 'A delete that gets refused',
    concept: 'Links between resources can make a reasonable request impossible. Removing a director while movies still point at that id would leave those movies hanging, so this API keeps the director and answers 409 Conflict.',
    task: 'Try to delete a director who still has movies.',
    success: 'Status 409, the director is still there, and the message says why.',
    method: 'DELETE',
    path: DIRECTOR,
    status: 409,
    mistakes: {
      204: 'That director had no movies left, so the delete went through. Pick one who still has some.',
      404: 'No director has that id.',
    },
  },
];

// What the game page sends to the browser: the text and nothing else.
const publicLevels = levels.map(({ id, title, concept, task, success }) => ({
  id, title, concept, task, success,
}));

module.exports = {
  levels,
  publicLevels,
  byId: (id) => levels.find((level) => level.id === id),
};
