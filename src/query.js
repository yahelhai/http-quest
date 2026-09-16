// Filter, then sort, then limit. The query here has already been checked and
// converted by src/validate.js.

function sorted(items, sort) {
  if (!sort) return items;

  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;

  return [...items].sort((a, b) => {
    if (a[field] === b[field]) return 0;
    const order = a[field] < b[field] ? -1 : 1;
    return descending ? -order : order;
  });
}

function has(text, needle) {
  return text.toLowerCase().includes(needle.toLowerCase());
}

function limited(items, limit) {
  return limit === undefined ? items : items.slice(0, limit);
}

function filterMovies(movies, query) {
  let result = movies;

  if (query.genre) result = result.filter((movie) => movie.genre === query.genre);
  if (query.directorId) result = result.filter((movie) => movie.directorId === query.directorId);
  if (query.minYear) result = result.filter((movie) => movie.year >= query.minYear);
  if (query.maxYear) result = result.filter((movie) => movie.year <= query.maxYear);
  if (query.minRating) result = result.filter((movie) => movie.rating >= query.minRating);
  if (query.q) result = result.filter((movie) => has(movie.title, query.q));

  return limited(sorted(result, query.sort), query.limit);
}

function filterDirectors(directors, query) {
  let result = directors;

  if (query.country) result = result.filter((director) => has(director.country, query.country));
  if (query.q) result = result.filter((director) => has(director.name, query.q));

  return limited(sorted(result, query.sort), query.limit);
}

module.exports = { filterMovies, filterDirectors };
