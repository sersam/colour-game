// eslint-disable-next-line import/no-unresolved
import { SPOTIFY_CLIENT_ID } from '@env';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

// Spotify OAuth configuration
if (!SPOTIFY_CLIENT_ID) {
  throw new Error(
    'SPOTIFY_CLIENT_ID is not configured. Please set it in your .env file.'
  );
}

// TypeScript knows SPOTIFY_CLIENT_ID is defined after the check above
const CLIENT_ID: string = SPOTIFY_CLIENT_ID;

const SPOTIFY_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'colourgame',
  path: 'redirect',
});

console.log('Spotify Redirect URI:', SPOTIFY_REDIRECT_URI);

const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  // Add other scopes as needed
];

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Token storage keys
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'spotify_access_token',
  REFRESH_TOKEN: 'spotify_refresh_token',
  EXPIRES_AT: 'spotify_expires_at',
};

// Store tokens securely
async function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const expiresAt = Date.now() + expiresIn * 1000;

  await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
  await SecureStore.setItemAsync(TOKEN_KEYS.EXPIRES_AT, expiresAt.toString());
}

// Get stored tokens
async function getStoredTokens() {
  try {
    const accessToken = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN);
    const refreshToken = await SecureStore.getItemAsync(
      TOKEN_KEYS.REFRESH_TOKEN
    );
    const expiresAt = await SecureStore.getItemAsync(TOKEN_KEYS.EXPIRES_AT);

    if (!accessToken || !refreshToken || !expiresAt) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: parseInt(expiresAt),
    };
  } catch (error) {
    console.error('Error getting stored tokens:', error);
    return null;
  }
}

// Clear stored tokens
async function clearStoredTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(TOKEN_KEYS.EXPIRES_AT);
}

// Refresh access token
async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    const { access_token, expires_in } = data;

    // Store new access token
    await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, access_token);
    const expiresAt = Date.now() + expires_in * 1000;
    await SecureStore.setItemAsync(TOKEN_KEYS.EXPIRES_AT, expiresAt.toString());

    return access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Check if token is expired or about to expire (within 5 minutes)
function isTokenExpired(expiresAt: number): boolean {
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  return Date.now() + bufferTime >= expiresAt;
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();

  if (!tokens) {
    return null;
  }

  if (isTokenExpired(tokens.expiresAt)) {
    const newAccessToken = await refreshAccessToken(tokens.refreshToken);
    return newAccessToken;
  }

  return tokens.accessToken;
}

// Spotify OAuth with PKCE
export async function authenticateWithSpotify(): Promise<boolean> {
  try {
    const request = new AuthSession.AuthRequest({
      clientId: CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      responseType: AuthSession.ResponseType.Code,
      redirectUri: SPOTIFY_REDIRECT_URI,
      prompt: AuthSession.Prompt.SelectAccount,
      usePKCE: true,
    });

    const authUrl = await request.makeAuthUrlAsync({
      authorizationEndpoint: SPOTIFY_AUTH_URL,
    });
    console.log('Spotify auth URL:', authUrl);
    console.log(
      'Spotify code verifier present:',
      Boolean(request.codeVerifier)
    );
    console.log(
      'Spotify redirect URI used for token exchange:',
      SPOTIFY_REDIRECT_URI
    );

    const result = await request.promptAsync(
      { authorizationEndpoint: SPOTIFY_AUTH_URL },
      {}
    );

    console.log('Spotify auth result type:', result.type);
    console.log('Spotify auth result params:', result.params);

    if (result.type === 'success' && result.params.code) {
      if (!request.codeVerifier) {
        throw new Error('Spotify PKCE code verifier was not generated');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: result.params.code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: request.codeVerifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Spotify token exchange failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          body: errorText,
          redirectUri: SPOTIFY_REDIRECT_URI,
        });
        throw new Error(`Failed to exchange code for tokens: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, expires_in } = tokenData;

      await storeTokens(access_token, refresh_token, expires_in);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
}

// Logout
export async function logoutFromSpotify() {
  await clearStoredTokens();
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return tokens !== null && !isTokenExpired(tokens.expiresAt);
}
