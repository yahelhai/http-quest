'use strict';

/**
 * HTML pages: the game (/) and the reference (/schemas/).
 * Server-side rendering only; the API lives under /api.
 */

const express = require('express');
const schemas = require('../schemas');

const he = require('../i18n/he.json');
const en = require('../i18n/en.json');

const DICTIONARIES = { he: he, en: en };
const SUPPORTED = ['he', 'en'];
const TOTAL = 11;
const COOKIE_MAX_AGE = 31536000; // one year, per the i18n contract

const router = express.Router();

/** Read one cookie out of the raw Cookie header (no cookie-parser needed). */
function readCookie(header, name) {
  const match = String(header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/** ?lang wins, then the cookie, then Hebrew. */
function pickLang(req) {
  const query = typeof req.query.lang === 'string' ? req.query.lang : '';
  if (SUPPORTED.indexOf(query) !== -1) return query;
  const cookie = readCookie(req.headers.cookie, 'lang');
  if (SUPPORTED.indexOf(cookie) !== -1) return cookie;
  return 'he';
}

/**
 * Flatten the dictionary for the views: `ui` is spread to the top level
 * (t.builder, t.level, ...) while `meta`, `hints` and `levels` keep their names.
 * `t.ui` stays as an alias so both t.footer and t.ui.footer resolve.
 */
function buildT(dict) {
  return Object.assign({}, dict.ui, {
    ui: dict.ui,
    meta: dict.meta,
    hints: dict.hints,
    levels: dict.levels,
  });
}

function render(req, res, view, page, selfPath) {
  const lang = pickLang(req);
  const dict = DICTIONARIES[lang];
  const t = buildT(dict);
  const dir = (dict.meta && dict.meta.dir) || (lang === 'he' ? 'rtl' : 'ltr');
  const other = (dict.meta && dict.meta.otherLang) || (lang === 'he' ? 'en' : 'he');

  res.setHeader('Set-Cookie', 'lang=' + lang + '; Path=/; Max-Age=' + COOKIE_MAX_AGE + '; SameSite=Lax');
  res.render(view, {
    lang: lang,
    dir: dir,
    t: t,
    levelsPublic: t.levels,
    total: TOTAL,
    schemas: schemas,
    page: page,
    langSwitchHref: selfPath + '?lang=' + other,
  });
}

router.get('/', function (req, res) {
  render(req, res, 'game', 'game', '/');
});

// Express 5 matches '/schemas/' as well.
router.get('/schemas', function (req, res) {
  render(req, res, 'schemas', 'schemas', '/schemas/');
});

module.exports = router;
