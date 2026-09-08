'use strict';

// In-memory store for movies and directors, loaded from src/data/seed.js.
// Always returns copies so callers cannot mutate internal state directly.
// Ids are monotonic per collection: a deleted id is never handed out again,
// so a "GET what you deleted" request keeps answering 404.

const seed = require('./seed');

function clone(obj) {
  return { ...obj };
}

function makeCollection(seedItems) {
  let items = [];
  let nextId = 1;

  const collection = {
    load() {
      items = seedItems.map(clone);
      nextId = items.reduce((max, it) => Math.max(max, it.id), 0) + 1;
    },

    list() {
      return items.map(clone);
    },

    get(id) {
      const item = items.find((it) => it.id === id);
      return item ? clone(item) : undefined;
    },

    create(data) {
      const created = { ...data, id: nextId++ };
      items.push(created);
      return clone(created);
    },

    replace(id, data) {
      const index = items.findIndex((it) => it.id === id);
      if (index === -1) return undefined;
      items[index] = { ...data, id };
      return clone(items[index]);
    },

    update(id, patch) {
      const index = items.findIndex((it) => it.id === id);
      if (index === -1) return undefined;
      items[index] = { ...items[index], ...patch, id };
      return clone(items[index]);
    },

    remove(id) {
      const index = items.findIndex((it) => it.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      return true;
    },
  };

  collection.load();
  return collection;
}

const store = {
  movies: makeCollection(seed.movies),
  directors: makeCollection(seed.directors),
  reset() {
    store.movies.load();
    store.directors.load();
  },
};

module.exports = store;
