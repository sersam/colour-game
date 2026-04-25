import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';
import {
  authenticateWithSpotify,
  isAuthenticated,
  logoutFromSpotify,
  getValidAccessToken,
} from '../services/spotifyAuth';
import {
  connectToSpotifyAppRemote,
  disconnectSpotifyAppRemote,
  isSpotifyAppInstalled,
} from '../services/spotifyRemote';

interface AuthContextType {
  isLoggedIn: boolean;
  accessToken: string | null;
  isSpotifyRemoteReady: boolean;
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSpotifyRemoteReady, setIsSpotifyRemoteReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const authenticated = await isAuthenticated();
    setIsLoggedIn(authenticated);
    if (authenticated) {
      const token = await getValidAccessToken();
      setAccessToken(token);
    }
    setIsSpotifyRemoteReady(false);
    setIsLoading(false);
  };

  const login = async (): Promise<boolean> => {
    const success = await authenticateWithSpotify();
    if (!success) {
      return false;
    }

    setIsLoggedIn(true);
    const token = await getValidAccessToken();
    setAccessToken(token);

    if (Platform.OS === 'ios') {
      try {
        const installed = await isSpotifyAppInstalled();

        if (installed) {
          await connectToSpotifyAppRemote();
          setIsSpotifyRemoteReady(true);
        } else {
          setIsSpotifyRemoteReady(false);
        }
      } catch (error) {
        console.error('Spotify App Remote setup failed:', error);
        setIsSpotifyRemoteReady(false);
      }
    }

    return true;
  };

  const logout = async () => {
    if (Platform.OS === 'ios') {
      try {
        await disconnectSpotifyAppRemote();
      } catch (error) {
        console.error('Spotify App Remote disconnect failed:', error);
      }
    }

    await logoutFromSpotify();
    setIsLoggedIn(false);
    setAccessToken(null);
    setIsSpotifyRemoteReady(false);
  };

  const refreshToken = async (): Promise<string | null> => {
    const token = await getValidAccessToken();
    setAccessToken(token);
    return token;
  };

  // Auto-refresh token every 50 minutes (tokens expire in 1 hour)
  useEffect(() => {
    if (isLoggedIn) {
      const interval = setInterval(
        async () => {
          const token = await getValidAccessToken();
          setAccessToken(token);
        },
        50 * 60 * 1000
      ); // 50 minutes

      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const value: AuthContextType = {
    isLoggedIn,
    accessToken,
    isSpotifyRemoteReady,
    login,
    logout,
    refreshToken,
  };

  if (isLoading) {
    return null; // Or a loading component
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
