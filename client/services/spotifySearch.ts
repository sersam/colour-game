import { getValidAccessToken } from './spotifyAuth';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: {
    name: string;
  }[];
  album: {
    name: string;
    images: {
      url: string;
      height: number;
      width: number;
    }[];
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SearchError {
  status: number;
  message: string;
  retryAfter?: number;
}

class SpotifySearchError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'SpotifySearchError';
  }
}

/**
 * Search for songs on Spotify
 * @param query - Search query (e.g., "track:song_name artist:artist_name")
 * @param limit - Number of results to return (default: 20, max: 50)
 * @returns Array of tracks with preview URLs
 * @throws SpotifySearchError for API errors including 401 (unauthorized) and 429 (rate limit)
 */
export async function searchSongs(
  query: string,
  limit: number = 20
): Promise<SpotifyTrack[]> {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new SpotifySearchError(401, 'No valid access token available');
  }

  try {
    const url = new URL(`${SPOTIFY_API_BASE}/search`);
    url.searchParams.append('q', query);
    url.searchParams.append('type', 'track');
    url.searchParams.append('limit', Math.min(limit, 50).toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      throw new SpotifySearchError(
        401,
        'Unauthorized: Your session has expired. Please log in again.'
      );
    }

    // Handle 429 Rate Limit
    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get('Retry-After') || '60',
        10
      );
      throw new SpotifySearchError(
        429,
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    // Handle other errors
    if (!response.ok) {
      throw new SpotifySearchError(
        response.status,
        `Spotify API error: ${response.statusText}`
      );
    }

    const data = (await response.json()) as SpotifySearchResponse;
    return data.tracks.items;
  } catch (error) {
    if (error instanceof SpotifySearchError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new SpotifySearchError(0, `Search failed: ${error.message}`);
    }

    throw new SpotifySearchError(0, 'Unknown error during search');
  }
}

/**
 * Get a single track details including preview URL
 * @param trackId - Spotify track ID
 * @returns Track object with preview URL
 * @throws SpotifySearchError for API errors
 */
export async function getTrackDetails(trackId: string): Promise<SpotifyTrack> {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new SpotifySearchError(401, 'No valid access token available');
  }

  try {
    const url = `${SPOTIFY_API_BASE}/tracks/${trackId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new SpotifySearchError(
        401,
        'Unauthorized: Your session has expired. Please log in again.'
      );
    }

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get('Retry-After') || '60',
        10
      );
      throw new SpotifySearchError(
        429,
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    if (!response.ok) {
      throw new SpotifySearchError(
        response.status,
        `Failed to fetch track: ${response.statusText}`
      );
    }

    const track = (await response.json()) as SpotifyTrack;
    return track;
  } catch (error) {
    if (error instanceof SpotifySearchError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new SpotifySearchError(0, `Track fetch failed: ${error.message}`);
    }

    throw new SpotifySearchError(0, 'Unknown error fetching track');
  }
}

/**
 * Get recommendations based on seed tracks/artists/genres
 * @param seedTracks - Array of track IDs (max 5)
 * @param limit - Number of results to return (default: 20, max: 100)
 * @returns Array of recommended tracks
 * @throws SpotifySearchError for API errors
 */
export async function getRecommendations(
  seedTracks: string[],
  limit: number = 20
): Promise<SpotifyTrack[]> {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new SpotifySearchError(401, 'No valid access token available');
  }

  if (seedTracks.length === 0 || seedTracks.length > 5) {
    throw new SpotifySearchError(400, 'Seed tracks must be between 1 and 5');
  }

  try {
    const url = new URL(`${SPOTIFY_API_BASE}/recommendations`);
    url.searchParams.append('seed_tracks', seedTracks.join(','));
    url.searchParams.append('limit', Math.min(limit, 100).toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new SpotifySearchError(
        401,
        'Unauthorized: Your session has expired. Please log in again.'
      );
    }

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get('Retry-After') || '60',
        10
      );
      throw new SpotifySearchError(
        429,
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    if (!response.ok) {
      throw new SpotifySearchError(
        response.status,
        `Failed to get recommendations: ${response.statusText}`
      );
    }

    const data = (await response.json()) as { tracks: SpotifyTrack[] };
    return data.tracks;
  } catch (error) {
    if (error instanceof SpotifySearchError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new SpotifySearchError(
        0,
        `Recommendation fetch failed: ${error.message}`
      );
    }

    throw new SpotifySearchError(0, 'Unknown error fetching recommendations');
  }
}
