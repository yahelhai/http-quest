'use strict';

module.exports = {
  directors: [
    { id: 1, name: 'Christopher Nolan', country: 'United Kingdom', born: 1970 },
    { id: 2, name: 'Hayao Miyazaki', country: 'Japan', born: 1941 },
    { id: 3, name: 'Denis Villeneuve', country: 'Canada', born: 1967 },
    { id: 4, name: 'Bong Joon-ho', country: 'South Korea', born: 1969 },
    { id: 5, name: 'Greta Gerwig', country: 'United States', born: 1983 },
    { id: 6, name: 'Steven Spielberg', country: 'United States', born: 1946 },
    { id: 7, name: 'Werner Herzog', country: 'Germany', born: 1942 },
  ],
  movies: [
    { id: 1, title: 'Inception', year: 2010, genre: 'sci-fi', rating: 8.8, directorId: 1 },
    { id: 2, title: 'The Prestige', year: 2006, genre: 'drama', rating: 8.5, directorId: 1 },
    { id: 3, title: 'Spirited Away', year: 2001, genre: 'animation', rating: 8.6, directorId: 2 },
    { id: 4, title: 'Princess Mononoke', year: 1997, genre: 'animation', rating: 8.4, directorId: 2 },
    { id: 5, title: 'Dune', year: 2021, genre: 'sci-fi', rating: 8.3, directorId: 3 },
    { id: 6, title: 'Arrival', year: 2016, genre: 'sci-fi', rating: 8.1, directorId: 3 },
    { id: 7, title: 'Parasite', year: 2019, genre: 'thriller', rating: 8.2, directorId: 4 },
    { id: 8, title: 'Memories of Murder', year: 2003, genre: 'thriller', rating: 7.9, directorId: 4 },
    { id: 9, title: 'Lady Bird', year: 2017, genre: 'drama', rating: 7.8, directorId: 5 },
    { id: 10, title: 'Barbie', year: 2023, genre: 'comedy', rating: 6.8, directorId: 5 },
    { id: 11, title: 'Jurassic Park', year: 1993, genre: 'action', rating: 7.6, directorId: 6 },
    { id: 12, title: 'Munich', year: 2005, genre: 'thriller', rating: 7.5, directorId: 6 },
    { id: 13, title: 'Jaws', year: 1975, genre: 'horror', rating: 8.0, directorId: 6 },
    { id: 14, title: 'Encounters at the End of the World', year: 2007, genre: 'documentary', rating: 7.3, directorId: 7 },
  ],
};
