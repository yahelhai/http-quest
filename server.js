const path = require('path');
const express = require('express');

const quest = require('./src/quest');
const schemas = require('./src/schemas');
const { publicLevels } = require('./src/levels');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Levels are replayed with the same GET, and a 304 would come back without a
// body for the player to read.
app.set('etag', false);

app.use(express.static(path.join(__dirname, 'public')));

// quest runs before the JSON parser, so a body the parser rejects still gets
// a verdict instead of slipping through unjudged.
app.use('/api', quest, express.json());
app.use('/api/movies', require('./src/routes/api.movies'));
app.use('/api/directors', require('./src/routes/api.directors'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.get('/', (req, res) => {
  res.render('game', { page: 'game', levels: publicLevels });
});

app.get('/schemas', (req, res) => {
  res.render('schemas', {
    page: 'schemas',
    resources: [schemas.movies, schemas.directors],
    endpoints: schemas.endpoints,
  });
});

app.use((req, res) => res.status(404).type('text').send('Page not found'));

// Express needs four arguments here to treat this as the error handler.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`HTTP Quest is running on http://localhost:${port}`));
}
