# Spotify Authentication Setup

## Prerequisites

1. Create a Spotify App at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Get your Client ID from the app settings
3. Add your redirect URI: `colourgame://redirect` in the app settings

## Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace `your_spotify_client_id_here` with your actual Spotify Client ID:
   ```
   SPOTIFY_CLIENT_ID=your_actual_client_id_here
   ```

3. The app will automatically load the environment variables from the `.env` file.

## Features Implemented

- ✅ OAuth 2.0 Authorization Code Flow with PKCE
- ✅ Secure token storage using Expo SecureStore
- ✅ Automatic token refresh before expiration
- ✅ React Context for auth state management
- ✅ Environment variable configuration (no secrets in code)
- ✅ Cross-platform support (iOS, Android, Web) with `react-native-dotenv`

## Security Notes

- The `.env` file is automatically ignored by Git (see `.gitignore`)
- Never commit your actual `.env` file with real credentials
- Use `.env.example` as a template for other developers

## Usage

The app will automatically show the login screen if not authenticated. Once logged in, it will maintain the session and refresh tokens automatically.

To access the access token in any component:

```tsx
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { accessToken } = useAuth();

  // Use accessToken for API calls
};
```

## API Calls

Before making Spotify API calls, ensure to get a valid token:

```tsx
const { accessToken } = useAuth();

if (accessToken) {
  // Make API call with accessToken in Authorization header
  fetch('https://api.spotify.com/v1/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
}
```

The `getValidAccessToken()` function automatically refreshes the token if it's expired or about to expire.