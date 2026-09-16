// The data lives in memory. Writes from the game stay for as long as the
// server runs, and restarting brings the seed back.

const seed = require('./seed');

function collection(seedItems) {
  const items = seedItems.map((item) => ({ ...item }));
  let nextId = Math.max(...items.map((item) => item.id)) + 1;

  function indexOf(id) {
    return items.findIndex((item) => item.id === id);
  }

  return {
    all() {
      return items;
    },

    find(id) {
      return items[indexOf(id)];
    },

    // Ids only grow, so a deleted id is never handed out again and a request
    // for it keeps answering 404. Level 11 relies on that.
    add(data) {
      const created = { ...data, id: nextId };
      nextId += 1;
      items.push(created);
      return created;
    },

    // The routes look an item up before they change or remove it, so the
    // three below are only ever called with an id that is really there.
    replace(id, data) {
      const index = indexOf(id);
      items[index] = { ...data, id };
      return items[index];
    },

    update(id, changes) {
      const index = indexOf(id);
      items[index] = { ...items[index], ...changes, id };
      return items[index];
    },

    remove(id) {
      items.splice(indexOf(id), 1);
    },
  };
}

module.exports = {
  movies: collection(seed.movies),
  directors: collection(seed.directors),
};
