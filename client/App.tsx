import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import SearchScreen from './components/SearchScreen';
import { getRandomRecommendedTrack } from './services/spotifySearch';
import {
  connectToSpotifyAppRemote,
  pauseSpotifyPlayback,
  playTrackInSpotify,
} from './services/spotifyRemote';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeScreen() {
  const { accessToken, isSpotifyRemoteReady } = useAuth();
  const [isPlayingRandom, setIsPlayingRandom] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [currentTrackName, setCurrentTrackName] = useState<string | null>(null);

  const handlePlayRandomSong = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iPhone Required',
        'Full Spotify playback is currently available only on iPhone.'
      );
      return;
    }

    setIsPlayingRandom(true);

    try {
      const track = await getRandomRecommendedTrack();

      if (!isSpotifyRemoteReady) {
        await connectToSpotifyAppRemote();
      }

      await playTrackInSpotify(track.uri);
      setCurrentTrackName(
        `${track.name} - ${track.artists[0]?.name ?? 'Unknown artist'}`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start a random song in Spotify.';
      Alert.alert('Random Song Error', message);
    } finally {
      setIsPlayingRandom(false);
    }
  };

  const handlePause = async () => {
    if (Platform.OS !== 'ios') {
      return;
    }

    setIsPausing(true);

    try {
      await pauseSpotifyPlayback();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to pause Spotify playback.';
      Alert.alert('Pause Error', message);
    } finally {
      setIsPausing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Colour Game!</Text>
      {accessToken ? (
        <>
          <Text style={styles.subtitle}>
            Spotify connected - Ready to search!
          </Text>
          <Text style={styles.subtitleSecondary}>
            {isSpotifyRemoteReady
              ? 'Full playback control is ready in Spotify.'
              : 'Search is ready. Full playback will work once Spotify App Remote connects.'}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                (isPlayingRandom || !accessToken) &&
                  styles.controlButtonDisabled,
              ]}
              onPress={handlePlayRandomSong}
              disabled={isPlayingRandom || !accessToken}
            >
              <Text style={styles.controlButtonText}>
                {isPlayingRandom ? 'Picking song...' : 'Random song'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                isPausing && styles.controlButtonDisabled,
              ]}
              onPress={handlePause}
              disabled={isPausing}
            >
              <Text style={styles.controlButtonText}>
                {isPausing ? 'Pausing...' : 'Pause'}
              </Text>
            </TouchableOpacity>
          </View>
          {isPlayingRandom ? (
            <ActivityIndicator
              size="small"
              color="#1DB954"
              style={styles.loader}
            />
          ) : null}
          {currentTrackName ? (
            <Text style={styles.nowPlayingText}>
              Now playing: {currentTrackName}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.subtitle}>Spotify not connected</Text>
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
  },
  subtitleSecondary: {
    fontSize: 13,
    color: '#8e8e8e',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  controlButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  secondaryButton: {
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loader: {
    marginTop: 16,
  },
  nowPlayingText: {
    color: '#d6d6d6',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
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
