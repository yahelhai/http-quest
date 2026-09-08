'use strict';

/**
 * Single source of truth for the two resources of the game.
 *
 * Used by:
 *   - src/validate.js        → validates request bodies (POST / PUT / PATCH)
 *   - src/routes/api.*.js    → validates query parameters
 *   - src/data/seed.js       → initial data must satisfy these definitions
 *   - views/schemas.ejs      → the /schemas/ page is rendered from this file
 *
 * Field shape:
 *   name        string   the JSON key
 *   type        'integer' | 'number' | 'string' | 'enum'
 *   required    boolean  required on POST and PUT (PATCH is always partial)
 *   readonly    boolean  set by the server, rejected in request bodies
 *   values      string[] allowed values (type 'enum' only)
 *   min / max   number   inclusive bounds (integer / number only)
 *   minLength   number   strings only
 *   ref         string   name of the resource this id points to
 *   example     any      shown on the /schemas/ page
 *   description { he, en }
 *
 * Query shape (same keys where relevant, plus):
 *   description { he, en }
 */

const GENRES = ['drama', 'comedy', 'sci-fi', 'thriller', 'animation', 'action', 'horror', 'documentary'];

const movieSort = ['year', '-year', 'rating', '-rating', 'title', '-title'];
const directorSort = ['name', '-name', 'born', '-born'];

const movies = {
  name: 'movies',
  singular: 'movie',
  basePath: '/api/movies',
  fields: [
    {
      name: 'id', type: 'integer', required: false, readonly: true, example: 1,
      description: { he: 'מזהה ייחודי. השרת קובע אותו ביצירה, ואסור לשלוח אותו בגוף הבקשה.', en: 'Unique identifier. Assigned by the server on creation; must not be sent in a request body.' },
    },
    {
      name: 'title', type: 'string', required: true, minLength: 1, example: 'Inception',
      description: { he: 'שם הסרט.', en: 'The movie title.' },
    },
    {
      name: 'year', type: 'integer', required: true, min: 1888, max: 2100, example: 2010,
      description: { he: 'שנת היציאה. מספר שלם.', en: 'Release year. An integer.' },
    },
    {
      name: 'genre', type: 'enum', required: true, values: GENRES, example: 'sci-fi',
      description: { he: 'ז׳אנר, אחד מהערכים המותרים בלבד.', en: 'Genre. One of the allowed values only.' },
    },
    {
      name: 'rating', type: 'number', required: true, min: 0, max: 10, example: 8.8,
      description: { he: 'דירוג בין 0 ל-10. מותר מספר עשרוני.', en: 'Rating from 0 to 10. Decimals allowed.' },
    },
    {
      name: 'directorId', type: 'integer', required: true, ref: 'directors', example: 1,
      description: { he: 'מזהה הבמאי. חייב להצביע על במאי שקיים ב-/api/directors.', en: 'Director id. Must point to an existing director in /api/directors.' },
    },
  ],
  queries: [
    { name: 'genre', type: 'enum', values: GENRES, example: 'sci-fi',
      description: { he: 'מחזיר רק סרטים מהז׳אנר הזה.', en: 'Only movies of this genre.' } },
    { name: 'directorId', type: 'integer', example: 2,
      description: { he: 'מחזיר רק סרטים של הבמאי הזה.', en: 'Only movies by this director.' } },
    { name: 'minYear', type: 'integer', example: 2000,
      description: { he: 'סרטים משנה זו והלאה.', en: 'Movies from this year onward.' } },
    { name: 'maxYear', type: 'integer', example: 2010,
      description: { he: 'סרטים עד שנה זו, כולל.', en: 'Movies up to and including this year.' } },
    { name: 'minRating', type: 'number', example: 8,
      description: { he: 'סרטים עם דירוג זה ומעלה.', en: 'Movies rated at or above this value.' } },
    { name: 'q', type: 'string', example: 'dark',
      description: { he: 'חיפוש טקסט חופשי בשם הסרט, לא תלוי רישיות.', en: 'Case-insensitive search in the title.' } },
    { name: 'sort', type: 'enum', values: movieSort, example: '-rating',
      description: { he: 'שדה המיון. קידומת מינוס למיון יורד.', en: 'Sort field. Prefix with a minus for descending order.' } },
    { name: 'limit', type: 'integer', min: 1, example: 3,
      description: { he: 'מספר התוצאות המרבי. מופעל אחרי הסינון והמיון.', en: 'Maximum number of results. Applied after filtering and sorting.' } },
  ],
};

const directors = {
  name: 'directors',
  singular: 'director',
  basePath: '/api/directors',
  fields: [
    {
      name: 'id', type: 'integer', required: false, readonly: true, example: 1,
      description: { he: 'מזהה ייחודי. השרת קובע אותו ביצירה.', en: 'Unique identifier. Assigned by the server on creation.' },
    },
    {
      name: 'name', type: 'string', required: true, minLength: 1, example: 'Christopher Nolan',
      description: { he: 'שם הבמאי.', en: 'The director\'s name.' },
    },
    {
      name: 'country', type: 'string', required: true, minLength: 1, example: 'United Kingdom',
      description: { he: 'מדינת המוצא.', en: 'Country of origin.' },
    },
    {
      name: 'born', type: 'integer', required: true, min: 1850, max: 2020, example: 1970,
      description: { he: 'שנת הלידה. מספר שלם.', en: 'Year of birth. An integer.' },
    },
  ],
  queries: [
    { name: 'country', type: 'string', example: 'Japan',
      description: { he: 'מחזיר רק במאים מהמדינה הזו.', en: 'Only directors from this country.' } },
    { name: 'q', type: 'string', example: 'nolan',
      description: { he: 'חיפוש טקסט חופשי בשם, לא תלוי רישיות.', en: 'Case-insensitive search in the name.' } },
    { name: 'sort', type: 'enum', values: directorSort, example: 'born',
      description: { he: 'שדה המיון. קידומת מינוס למיון יורד.', en: 'Sort field. Prefix with a minus for descending order.' } },
    { name: 'limit', type: 'integer', min: 1, example: 3,
      description: { he: 'מספר התוצאות המרבי.', en: 'Maximum number of results.' } },
  ],
};

/**
 * Endpoint catalogue, rendered on /schemas/ and used by README.
 * `status` lists the codes the endpoint can return.
 */
const endpoints = [
  { method: 'GET',    path: '/api/movies',                  status: [200, 400], description: { he: 'רשימת סרטים. תומך בכל פרמטרי ה-Query של movies.', en: 'List movies. Supports every movies query parameter.' } },
  { method: 'GET',    path: '/api/movies/:id',              status: [200, 404], description: { he: 'סרט בודד לפי מזהה.', en: 'A single movie by id.' } },
  { method: 'POST',   path: '/api/movies',                  status: [201, 400], description: { he: 'יצירת סרט. מחזיר את הסרט החדש וכותרת Location.', en: 'Create a movie. Returns the new movie and a Location header.' } },
  { method: 'PUT',    path: '/api/movies/:id',              status: [200, 400, 404], description: { he: 'החלפה מלאה. כל השדות הנדרשים חייבים להופיע.', en: 'Full replacement. Every required field must be present.' } },
  { method: 'PATCH',  path: '/api/movies/:id',              status: [200, 400, 404], description: { he: 'עדכון חלקי. רק השדות שנשלחו משתנים.', en: 'Partial update. Only the fields sent are changed.' } },
  { method: 'DELETE', path: '/api/movies/:id',              status: [204, 404], description: { he: 'מחיקה. מחזיר 204 ללא גוף.', en: 'Delete. Returns 204 with no body.' } },
  { method: 'GET',    path: '/api/directors',               status: [200, 400], description: { he: 'רשימת במאים. תומך בפרמטרי ה-Query של directors.', en: 'List directors. Supports the directors query parameters.' } },
  { method: 'GET',    path: '/api/directors/:id',           status: [200, 404], description: { he: 'במאי בודד לפי מזהה.', en: 'A single director by id.' } },
  { method: 'GET',    path: '/api/directors/:id/movies',    status: [200, 400, 404], description: { he: 'כל הסרטים של במאי. תומך בפרמטרי ה-Query של movies.', en: 'All movies by a director. Supports the movies query parameters.' } },
  { method: 'POST',   path: '/api/directors',               status: [201, 400], description: { he: 'יצירת במאי.', en: 'Create a director.' } },
  { method: 'PUT',    path: '/api/directors/:id',           status: [200, 400, 404], description: { he: 'החלפה מלאה של במאי.', en: 'Full replacement of a director.' } },
  { method: 'PATCH',  path: '/api/directors/:id',           status: [200, 400, 404], description: { he: 'עדכון חלקי של במאי.', en: 'Partial update of a director.' } },
  { method: 'DELETE', path: '/api/directors/:id',           status: [204, 404, 409], description: { he: 'מחיקה. במאי שיש לו סרטים לא נמחק ומחזיר 409.', en: 'Delete. A director that still has movies is not deleted and returns 409.' } },
];

module.exports = { movies, directors, endpoints, GENRES, movieSort, directorSort };
