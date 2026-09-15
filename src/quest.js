'use strict';

// Middleware that judges each /api request against the level named in the
// X-Quest-Level header. Registered before express.json() and the routers,
// so the actual verdict is computed on-headers, once the route has run.
// The verdict travels in X-Quest-Result / X-Quest-Hint response headers.

const onHeaders = require('on-headers');
const { byId } = require('./levels');

module.exports = function quest(req, res, next) {
  const raw = req.get('X-Quest-Level');
  if (raw === undefined) return next();

  onHeaders(res, () => {
    let level;
    let result = 'fail';
    let hint = 'unknown-level';

    try {
      const id = parseInt(raw, 10);
      level = Number.isNaN(id) ? undefined : byId(id);

      if (!level) {
        hint = 'unknown-level';
      } else {
        const failCode = level.check(req, res);
        if (failCode) {
          hint = failCode;
        } else if (res.statusCode === level.expect) {
          result = 'pass';
        } else if (res.statusCode === 404 && (level.expect === 200 || level.expect === 204)) {
          hint = 'id-not-found';
        } else if (level.id === 11 && res.statusCode === 200) {
          hint = 'still-exists';
        } else if (level.id === 6 && res.statusCode === 201) {
          hint = 'body-was-valid';
        } else {
          hint = `wrong-status:${level.expect}`;
        }
      }
    } catch (err) {
      result = 'fail';
      hint = level ? `wrong-status:${level.expect}` : 'unknown-level';
    }

    res.setHeader('X-Quest-Result', result);
    if (result === 'fail') res.setHeader('X-Quest-Hint', hint);
  });

  next();
};
