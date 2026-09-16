// The two resources. Validation and the /schemas page both read this, so a
// field is described in one place only.

const GENRES = ['drama', 'comedy', 'sci-fi', 'thriller', 'animation', 'action', 'horror', 'documentary'];
const MOVIE_SORT = ['year', '-year', 'rating', '-rating', 'title', '-title'];
const DIRECTOR_SORT = ['name', '-name', 'born', '-born'];

// readonly: the server assigns it, so a request body may not send it.
// required applies to POST and PUT. PATCH only checks the fields it gets.
const movies = {
  name: 'movies',
  singular: 'movie',
  path: '/api/movies',
  fields: [
    { name: 'id', type: 'integer', readonly: true },
    { name: 'title', type: 'string', required: true },
    { name: 'year', type: 'integer', required: true, min: 1888, max: 2100 },
    { name: 'genre', type: 'enum', required: true, values: GENRES },
    { name: 'rating', type: 'number', required: true, min: 0, max: 10 },
    { name: 'directorId', type: 'integer', required: true, ref: 'directors' },
  ],
  queries: [
    { name: 'genre', type: 'enum', values: GENRES, about: 'only movies of this genre' },
    { name: 'directorId', type: 'integer', about: 'only movies by this director' },
    { name: 'minYear', type: 'integer', about: 'released in this year or later' },
    { name: 'maxYear', type: 'integer', about: 'released in this year or earlier' },
    { name: 'minRating', type: 'number', about: 'rated this or higher' },
    { name: 'q', type: 'string', about: 'search inside the title, ignoring case' },
    { name: 'sort', type: 'enum', values: MOVIE_SORT, about: 'order by a field, minus for descending' },
    { name: 'limit', type: 'integer', min: 1, about: 'how many results at most' },
  ],
};

const directors = {
  name: 'directors',
  singular: 'director',
  path: '/api/directors',
  fields: [
    { name: 'id', type: 'integer', readonly: true },
    { name: 'name', type: 'string', required: true },
    { name: 'country', type: 'string', required: true },
    { name: 'born', type: 'integer', required: true, min: 1850, max: 2020 },
  ],
  queries: [
    { name: 'country', type: 'string', about: 'only directors from this country' },
    { name: 'q', type: 'string', about: 'search inside the name, ignoring case' },
    { name: 'sort', type: 'enum', values: DIRECTOR_SORT, about: 'order by a field, minus for descending' },
    { name: 'limit', type: 'integer', min: 1, about: 'how many results at most' },
  ],
};

const endpoints = [
  { method: 'GET', path: '/api/movies', status: [200, 400] },
  { method: 'GET', path: '/api/movies/:id', status: [200, 404] },
  { method: 'POST', path: '/api/movies', status: [201, 400] },
  { method: 'PUT', path: '/api/movies/:id', status: [200, 400, 404] },
  { method: 'PATCH', path: '/api/movies/:id', status: [200, 400, 404] },
  { method: 'DELETE', path: '/api/movies/:id', status: [204, 404] },
  { method: 'GET', path: '/api/directors', status: [200, 400] },
  { method: 'GET', path: '/api/directors/:id', status: [200, 404] },
  { method: 'GET', path: '/api/directors/:id/movies', status: [200, 400, 404] },
  { method: 'POST', path: '/api/directors', status: [201, 400] },
  { method: 'PUT', path: '/api/directors/:id', status: [200, 400, 404] },
  { method: 'PATCH', path: '/api/directors/:id', status: [200, 400, 404] },
  { method: 'DELETE', path: '/api/directors/:id', status: [204, 404, 409] },
];

module.exports = { movies, directors, endpoints };
