// eslint-disable-next-line import/no-unresolved
import { SPOTIFY_CLIENT_ID } from '@env';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
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
  native: 'colourgame://redirect',
  useProxy: Platform.OS !== 'web',
});

console.log('Spotify Redirect URI:', SPOTIFY_REDIRECT_URI);

const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  // Add other scopes as needed
];

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Generate PKCE challenge
async function generatePKCE() {
  const verifier = await Crypto.getRandomBytesAsync(32);
  const verifierString = base64URLEncode(verifier);

  const challenge = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifierString
  );
  const challengeBytes = new Uint8Array(
    challenge.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const challengeString = base64URLEncode(challengeBytes);

  return { verifier: verifierString, challenge: challengeString };
}

// Base64 URL encode
function base64URLEncode(arrayBuffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

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
    const { verifier, challenge } = await generatePKCE();

    const request = new AuthSession.AuthRequest({
      clientId: CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      responseType: AuthSession.ResponseType.Code,
      redirectUri: SPOTIFY_REDIRECT_URI,
      codeChallenge: challenge,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      prompt: AuthSession.Prompt.SelectAccount,
    });

    const result = await request.promptAsync(
      { authorizationEndpoint: SPOTIFY_AUTH_URL },
      { useProxy: Platform.OS !== 'web' }
    );

    if (result.type === 'success' && result.params.code) {
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
          code_verifier: verifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens');
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
