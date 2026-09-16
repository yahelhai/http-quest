// Decides whether a request solved the level named in the X-Quest-Level
// header, and answers in X-Quest-Result (pass or fail) plus X-Quest-Hint when
// it failed. The response body is left alone, so the player sees the real API
// answer rather than something wrapped around it.

const onHeaders = require('on-headers');
const { byId } = require('./levels');

function judge(level, request) {
  if (request.method !== level.method) {
    return `This level needs a ${level.method}, and you sent ${request.method}.`;
  }
  if (!level.path.test(request.path)) {
    return `${request.path} isn't the path this level asks for.`;
  }

  const problem = level.check?.(request);
  if (problem) return problem;

  if (request.status === level.status) return null;

  return level.mistakes?.[request.status]
    ?? `The request looks right, but the server answered ${request.status} where this level expects ${level.status}.`;
}

module.exports = function quest(req, res, next) {
  const level = byId(Number(req.get('X-Quest-Level')));
  if (!level) return next();

  // Routers rewrite req.url as they match, so the path is taken now.
  const path = req.originalUrl.split('?')[0];

  // The verdict is written just before the response goes out, because the
  // route has to run first: the status code it chose is part of the decision.
  onHeaders(res, () => {
    const problem = judge(level, {
      method: req.method,
      path,
      query: req.query,
      contentType: req.get('content-type') ?? '',
      body: req.body,
      status: res.statusCode,
    });

    res.setHeader('X-Quest-Result', problem ? 'fail' : 'pass');
    if (problem) res.setHeader('X-Quest-Hint', problem);
  });

  next();
};
