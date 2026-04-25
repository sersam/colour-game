import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { io, type Socket } from 'socket.io-client';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import SearchScreen from './components/SearchScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const SESSION_CODE_REGEX = /^[A-Z0-9]{6}$/;
const MAX_PLAYERS_PER_SESSION = 6;

type LobbyPlayer = {
  playerId: string;
  playerName: string;
  avatar: string;
  joinedAt: string;
};

type JoinSessionResponse = {
  sessionId: string;
  code: string;
  player: LobbyPlayer;
  players: LobbyPlayer[];
  playerCount: number;
  maxPlayers: number;
  hostPlayerId: string;
  isHost: boolean;
};

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }

  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3001`;
  }

  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptUrl) {
    const hostMatch = scriptUrl.match(/^https?:\/\/([^/:]+)(?::\d+)?/i);
    const host = hostMatch?.[1];
    if (host) {
      return `http://${host}:3001`;
    }
  }

  return 'http://localhost:3001';
}

const API_BASE_URL = getApiBaseUrl();

function generateLocalPlayerProfile() {
  const avatars = ['🦊', '🐼', '🐸', '🦁', '🐯', '🐵', '🐙', '🐧', '🦄', '🐻'];
  const names = [
    'PlayerNova',
    'PlayerPixel',
    'PlayerLuna',
    'PlayerEcho',
    'PlayerBolt',
    'PlayerFlame',
    'PlayerWave',
    'PlayerSky',
  ];

  const randomPart = Math.random().toString(36).slice(2, 10);
  const playerId = `p_${Date.now()}_${randomPart}`;
  const avatar = avatars[Math.floor(Math.random() * avatars.length)];
  const playerName = `${names[Math.floor(Math.random() * names.length)]}${Math.floor(
    Math.random() * 90 + 10
  )}`;

  return { playerId, playerName, avatar };
}

function HomeScreen() {
  const [sessionCode, setSessionCode] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [currentSession, setCurrentSession] =
    useState<JoinSessionResponse | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localPlayer = useMemo(() => generateLocalPlayerProfile(), []);

  const normalizedSessionCode = sessionCode.trim().toUpperCase();
  const isSessionCodeValid = SESSION_CODE_REGEX.test(normalizedSessionCode);
  const isCurrentPlayerHost =
    !!currentSession && hostPlayerId === localPlayer.playerId;

  useEffect(() => {
    if (!currentSession) {
      return;
    }

    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_session_room', currentSession.sessionId);
    });

    socket.on(
      'session_players_updated',
      (payload: { players?: LobbyPlayer[]; hostPlayerId?: string }) => {
        if (payload.players) {
          setLobbyPlayers(payload.players);
        }

        if (payload.hostPlayerId) {
          setHostPlayerId(payload.hostPlayerId);
        }
      }
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentSession]);

  const joinSession = async (code: string) => {
    const response = await fetch(`${API_BASE_URL}/sessions/${code}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(localPlayer),
    });

    const payload = (await response.json()) as Partial<JoinSessionResponse> & {
      message?: string;
    };

    if (
      !response.ok ||
      !payload.sessionId ||
      !payload.code ||
      !payload.player ||
      !payload.players ||
      !payload.hostPlayerId
    ) {
      throw new Error(payload.message || 'Could not join room.');
    }

    const typedPayload = payload as JoinSessionResponse;
    setCurrentSession(typedPayload);
    setLobbyPlayers(typedPayload.players);
    setHostPlayerId(typedPayload.hostPlayerId);
    setSessionCode(typedPayload.code);
  };

  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);

    try {
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
      });

      const payload = (await response.json()) as {
        sessionId?: string;
        code?: string;
        message?: string;
      };

      if (!response.ok || !payload.sessionId || !payload.code) {
        throw new Error(payload.message || 'Could not create room.');
      }

      setSessionCode(payload.code);
      await joinSession(payload.code);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not create room.';
      Alert.alert('Error al crear sala', message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!isSessionCodeValid) {
      Alert.alert(
        'Codigo invalido',
        'Introduce un codigo de 6 caracteres (A-Z y 0-9).'
      );
      return;
    }

    setIsJoiningRoom(true);

    try {
      await joinSession(normalizedSessionCode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not join room.';
      Alert.alert('Error al unirse', message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleLeaveLobby = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setCurrentSession(null);
    setLobbyPlayers([]);
    setHostPlayerId(null);
  };

  const handleStartGame = () => {
    Alert.alert('Comenzar', 'Aqui lanzaremos la partida en el siguiente paso.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Colour Game</Text>
      {currentSession ? (
        <View style={styles.homeCard}>
          <Text style={styles.subtitle}>
            Lobby de sala {currentSession.code}
          </Text>
          <Text style={styles.playerCounter}>
            Jugadores: {lobbyPlayers.length}/{MAX_PLAYERS_PER_SESSION}
          </Text>

          <View style={styles.playersList}>
            {lobbyPlayers.map((player) => (
              <View key={player.playerId} style={styles.playerRow}>
                <Text style={styles.playerAvatar}>{player.avatar}</Text>
                <Text style={styles.playerName}>
                  {player.playerName}
                  {player.playerId === hostPlayerId ? ' (Anfitrion)' : ''}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton]}
              onPress={handleLeaveLobby}
            >
              <Text style={styles.controlButtonText}>Salir</Text>
            </TouchableOpacity>

            {isCurrentPlayerHost ? (
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleStartGame}
              >
                <Text style={styles.controlButtonText}>Comenzar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Crea una sala nueva o unete con un codigo.
          </Text>

          <View style={styles.homeCard}>
            <Text style={styles.inputLabel}>Codigo de sala</Text>
            <TextInput
              style={[
                styles.codeInput,
                !isSessionCodeValid && sessionCode
                  ? styles.codeInputInvalid
                  : null,
              ]}
              value={sessionCode}
              onChangeText={(value) => {
                const cleanedValue = value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '');
                setSessionCode(cleanedValue.slice(0, 6));
              }}
              placeholder="ABC123"
              placeholderTextColor="#7f7f7f"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />

            {!isSessionCodeValid && sessionCode ? (
              <Text style={styles.validationText}>
                El codigo debe tener 6 caracteres (A-Z y 0-9).
              </Text>
            ) : null}

            <Text style={styles.localPlayerText}>
              Tu perfil: {localPlayer.avatar} {localPlayer.playerName}
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  isJoiningRoom && styles.controlButtonDisabled,
                ]}
                onPress={handleJoinRoom}
                disabled={isJoiningRoom}
              >
                {isJoiningRoom ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.controlButtonText}>Unirse</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.controlButton,
                  isCreatingRoom && styles.controlButtonDisabled,
                ]}
                onPress={handleCreateRoom}
                disabled={isCreatingRoom}
              >
                {isCreatingRoom ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.controlButtonText}>Crear sala</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

function AppNavigator() {
  const { isLoggedIn } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isLoggedIn ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <Stack.Screen
            name="MainApp"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#1DB954',
        tabBarInactiveTintColor: '#b3b3b3',
        headerStyle: styles.header,
        headerTintColor: '#fff',
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          title: 'Colour Game',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          title: 'Search Spotify',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#b3b3b3',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
  homeCard: {
    width: '88%',
    maxWidth: 420,
    marginTop: 24,
    backgroundColor: '#1b1b1b',
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 16,
    padding: 16,
  },
  inputLabel: {
    color: '#d0d0d0',
    fontSize: 13,
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderRadius: 10,
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  codeInputInvalid: {
    borderColor: '#ef4444',
  },
  validationText: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 8,
  },
  localPlayerText: {
    color: '#9f9f9f',
    fontSize: 12,
    marginTop: 10,
  },
  playerCounter: {
    color: '#d2d2d2',
    marginTop: 8,
    marginBottom: 10,
    fontSize: 14,
  },
  playersList: {
    marginTop: 8,
    marginBottom: 6,
    gap: 8,
  },
  playerRow: {
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#343434',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    fontSize: 20,
    marginRight: 10,
  },
  playerName: {
    color: '#efefef',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  controlButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    flex: 1,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    flex: 1,
    alignItems: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  tabBar: {
    backgroundColor: '#282828',
    borderTopColor: '#404040',
    borderTopWidth: 1,
  },
  header: {
    backgroundColor: '#282828',
    borderBottomColor: '#404040',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
