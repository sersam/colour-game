import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  authenticateWithSpotify,
  isAuthenticated,
  logoutFromSpotify,
  getValidAccessToken,
} from '../services/spotifyAuth';

interface AuthContextType {
  isLoggedIn: boolean;
  accessToken: string | null;
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
    setIsLoading(false);
  };

  const login = async (): Promise<boolean> => {
    const success = await authenticateWithSpotify();
    if (success) {
      setIsLoggedIn(true);
      const token = await getValidAccessToken();
      setAccessToken(token);
    }
    return success;
  };

  const logout = async () => {
    await logoutFromSpotify();
    setIsLoggedIn(false);
    setAccessToken(null);
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
    login,
    logout,
    refreshToken,
  };

  if (isLoading) {
    return null; // Or a loading component
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
