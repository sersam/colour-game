# Spotify Search API

This module provides functions to search for songs on Spotify and handle API responses, including preview URLs and error management.

## Features

- ✅ Get /search - Search for songs/tracks by query
- ✅ Preview URL handling - Shows if a track has a preview available
- ✅ 401 Error Handling - Detects expired sessions and prompts re-login
- ✅ 429 Error Handling - Rate limit detection with Retry-After header support
- ✅ Error recovery - Automatic retry suggestions based on error type
- ✅ TypeScript Support - Full type definitions for all API responses

## Installation & Setup

The search functionality is built on top of the Spotify authentication system. Make sure your Spotify OAuth is configured first (see SPOTIFY_SETUP.md).

## API Functions

### searchSongs(query, limit?)

Search for songs on Spotify.

```typescript
import { searchSongs } from './services/spotifySearch';

try {
  const tracks = await searchSongs('track:Bohemian Rhapsody artist:Queen');
  tracks.forEach(track => {
    console.log(`${track.name} - ${track.artists[0].name}`);
    if (track.preview_url) {
      console.log('Preview available:', track.preview_url);
    }
  });
} catch (error) {
  if (error.status === 401) {
    // Session expired - redirect to login
  } else if (error.status === 429) {
    // Rate limited - wait error.retryAfter seconds
  }
}
```

**Parameters:**
- `query` (string): Search query. Use format: "track:song_name artist:artist_name" for better results
- `limit` (number, optional): Number of results (max 50, default 20)

**Returns:** Array of SpotifyTrack objects

**Throws:** SpotifySearchError

### getTrackDetails(trackId)

Get detailed information about a specific track, including preview URL.

```typescript
const track = await getTrackDetails('11dFghVXANMlKmJXsNCQvf');
```

**Parameters:**
- `trackId` (string): Spotify track ID

**Returns:** SpotifyTrack object

**Throws:** SpotifySearchError

### getRecommendations(seedTracks, limit?)

Get song recommendations based on seed tracks.

```typescript
const recommendations = await getRecommendations(['11dFghVXANMlKmJXsNCQvf'], 10);
```

**Parameters:**
- `seedTracks` (string[]): Array of 1-5 Spotify track IDs
- `limit` (number, optional): Number of recommendations (max 100, default 20)

**Returns:** Array of SpotifyTrack objects

**Throws:** SpotifySearchError

## Error Handling

### 401 Unauthorized

When a 401 error occurs, it means your access token has expired or is invalid.

```typescript
try {
  const tracks = await searchSongs('query');
} catch (error) {
  if (error.status === 401) {
    // Show login screen
    // The user needs to log in again
  }
}
```

### 429 Rate Limited

When a 429 error occurs, Spotify is rate limiting your requests.

```typescript
try {
  const tracks = await searchSongs('query');
} catch (error) {
  if (error.status === 429) {
    const waitSeconds = error.retryAfter || 60;
    console.log(`Wait ${waitSeconds} seconds before retrying`);
  }
}
```

## Preview URLs

Each track has a `preview_url` property:

```typescript
const tracks = await searchSongs('Bohemian Rhapsody');
tracks.forEach(track => {
  if (track.preview_url) {
    // Audio preview available
    console.log('Play audio from:', track.preview_url);
  } else {
    // No preview available (common for some regions or rights issues)
    console.log('No preview available for:', track.name);
  }
});
```

## UI Component

A ready-to-use search screen component is available at `components/SearchScreen.tsx`:

```typescript
import SearchScreen from './components/SearchScreen';

// Add to your navigation
<Tab.Screen name="Search" component={SearchScreen} />
```

The SearchScreen component includes:
- Search input field
- Loading state
- Error messages with retry suggestions
- Results list with album art
- Preview availability badges
- Automatic 401 and 429 error handling

## Best Practices

1. **Search Query Format**: Use "track:song artist:artist" format for better results
2. **Rate Limiting**: Implement exponential backoff when hitting 429 errors
3. **Preview URLs**: Always check if preview_url is null before trying to play
4. **Session Management**: Handle 401 errors by redirecting to login
5. **Error Recovery**: Show user-friendly messages for errors

## Example: Complete Search Flow

```typescript
import { searchSongs, SpotifySearchError } from './services/spotifySearch';

async function performSearch(query: string) {
  try {
    const tracks = await searchSongs(query);
    
    // Filter tracks with previews
    const tracksWithPreviews = tracks.filter(t => t.preview_url);
    
    console.log(`Found ${tracks.length} tracks, ${tracksWithPreviews.length} with previews`);
    
    return tracksWithPreviews;
  } catch (error) {
    if (error instanceof SpotifySearchError) {
      if (error.status === 401) {
        // Re-authenticate
        redirectToLogin();
      } else if (error.status === 429) {
        // Show user rate limit message
        showRateLimitMessage(error.retryAfter);
      } else {
        // Generic error
        showErrorMessage(error.message);
      }
    }
  }
}
```