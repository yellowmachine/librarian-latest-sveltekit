import type { Movie } from '$lib/server/db/schema';
import { OMDB_API_KEY } from '$env/static/private';

export type ApiSource = 'omdb' | 'imdb';

interface OMDB_Movie {
  Title: string; // Título de la película (ej. "Blade Runner 2049")
  Year: string; // Año de estreno (ej. "2017")
  Rated?: string; // Clasificación (ej. "R", "PG-13")
  Released?: string; // Fecha de estreno (ej. "06 Oct 2017")
  Runtime?: string; // Duración (ej. "164 min")
  Genre?: string; // Géneros (ej. "Action, Drama, Sci-Fi")
  Director?: string; // Director (ej. "Denis Villeneuve")
  Writer?: string; // Guionistas (ej. "Hampton Fancher, Michael Green")
  Actors?: string; // Actores principales (ej. "Ryan Gosling, Harrison Ford")
  Plot?: string; // Sinopsis (ej. "A young blade runner's discovery...")
  Language?: string; // Idiomas (ej. "English")
  Country?: string; // Países de producción (ej. "USA, UK, Canada")
  Awards?: string; // Premios (ej. "Won 2 Oscars...")
  Poster?: string; // URL del póster (ej. "https://m.media-amazon.com/...")
  Ratings?: Array<{ Source: string; Value: string }>; // Calificaciones de fuentes (IMDb, Rotten Tomatoes, etc.)
  Metascore?: string; // Puntuación de Metacritic (ej. "81")
  imdbRating?: string; // Puntuación de IMDb (ej. "8.0")
  imdbVotes?: string; // Votos en IMDb (ej. "558,127")
  imdbID: string; // ID único de IMDb (ej. "tt1856101")
  Type: string; // Tipo (ej. "movie", "series", "episode")
  DVD?: string; // Fecha de lanzamiento en DVD/Blu-ray (ej. "05 Jan 2018")
  BoxOffice?: string; // Recaudación (ej. "$92,054,159")
  Production?: string; // Productora (ej. "Warner Bros.")
  Website?: string; // Sitio web oficial (puede ser "N/A")
  Response: string; // Estado de la respuesta (ej. "True" o "False")
}

function mapOMDB_MovieToMovie(data: OMDB_Movie): Omit<Movie, 'id' | 'userId'> {
  
  //console.log(data.details.covers);
  return {
    movieId: data.imdbID,
    provider: 'omdb',
    title: data.Title || '',
    director: data.Director?.split(", ") || [],
    actors: data.Actors?.split(", ") || [],
    publishDate: data.Year,
    coverUrl: data.Poster || null,
    genre: data.Genre || null,
    description: data.Plot || ""
  };
}


export async function queryByTitle(
  title: string,
  source: ApiSource = 'omdb',
  fetchFn: typeof fetch = fetch
): Promise<Omit<Movie, 'id' | 'userId'> | null> {
    try {
        const apiUrl = `http://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`;
        const res = await fetchFn(apiUrl);
        const data: { [key: string]: OMDB_Movie } = await res.json();

        const movieData = data as unknown as OMDB_Movie;
        if (movieData.Response !== 'True') {
            return null;
        }
        return mapOMDB_MovieToMovie(movieData);
    }catch (error) {
        console.error(`Error querying title ${title} with ${source}:`, error);
        return null;
    }
}

