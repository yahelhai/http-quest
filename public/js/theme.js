'use strict';

/**
 * Theme. Loaded synchronously in <head> so data-theme is on <html> before the
 * first paint and a stored light theme never flashes dark.
 */
(function () {
  var KEY = 'theme';
  var root = document.documentElement;

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (err) {
      return null; // private mode / storage disabled
    }
  }

  function write(value) {
    try {
      localStorage.setItem(KEY, value);
    } catch (err) {
      /* ignore: the theme still applies for this page view */
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
  }

  apply(read() === 'light' ? 'light' : 'dark'); // dark is the default

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('theme-toggle');
    if (!button) return;

    function sync() {
      button.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'light' ? 'true' : 'false');
    }

    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next);
      write(next);
      sync();
    });

    sync();
  });
}());
