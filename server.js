'use strict';

const path = require('path');
const express = require('express');

const moviesRouter = require('./src/routes/api.movies');
const directorsRouter = require('./src/routes/api.directors');

function notFoundJson(req, res) {
  res.status(404).json({ error: 'Not found' });
}

const app = express();
const PORT = process.env.PORT || 3000;

// The game re-sends identical GETs; a 304 would let the browser replay a cached
// body while the level verdict is computed against a bodiless 304. No caching.
app.set('etag', false);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', require('./src/quest'));
app.use('/api', express.json());
app.use('/api/movies', moviesRouter);
app.use('/api/directors', directorsRouter);
app.use('/api', notFoundJson);

app.use('/', require('./src/routes/pages'));
app.use((req, res) => res.status(404).type('text').send('Not found'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isApi = req.path.startsWith('/api');

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : (err.message || 'Error');

  if (isApi) {
    return res.status(status).json({ error: message });
  }
  res.status(status).type('text').send(message);
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`HTTP Quest server running at http://localhost:${PORT}`));
}
