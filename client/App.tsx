import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
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
import {
  getRandomRecommendedTrack,
  type SpotifyTrack,
} from './services/spotifySearch';
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
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isTrackCardFlipped, setIsTrackCardFlipped] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flipAnimation, {
      toValue: isTrackCardFlipped ? 1 : 0,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [flipAnimation, isTrackCardFlipped]);

  const frontRotation = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotation = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const trackYear = currentTrack?.album.release_date
    ? currentTrack.album.release_date.slice(0, 4)
    : 'Unknown year';

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
      setCurrentTrack(track);
      setIsTrackCardFlipped(false);
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
          {currentTrack ? (
            <TouchableOpacity
              activeOpacity={0.95}
              style={styles.trackCardTouchable}
              onPress={() => setIsTrackCardFlipped((prev) => !prev)}
            >
              <View style={styles.trackCardContainer}>
                <Animated.View
                  style={[
                    styles.trackCardFace,
                    styles.trackCardFront,
                    { transform: [{ rotateY: frontRotation }] },
                  ]}
                >
                  <Text style={styles.noteIcon}>♪</Text>
                  <Text style={styles.trackCardHint}>
                    Tap to reveal song info
                  </Text>
                </Animated.View>
                <Animated.View
                  style={[
                    styles.trackCardFace,
                    styles.trackCardBack,
                    { transform: [{ rotateY: backRotation }] },
                  ]}
                >
                  <Text style={styles.trackCardTopText}>
                    {currentTrack.artists[0]?.name ?? 'Unknown artist'}
                  </Text>
                  <Text style={styles.trackCardYear}>{trackYear}</Text>
                  <Text style={styles.trackCardBottomText}>
                    {currentTrack.name}
                  </Text>
                </Animated.View>
              </View>
            </TouchableOpacity>
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
  trackCardTouchable: {
    marginTop: 20,
  },
  trackCardContainer: {
    width: 275,
    height: 170,
  },
  trackCardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  trackCardFront: {
    backgroundColor: '#181818',
  },
  trackCardBack: {
    backgroundColor: '#1f1f1f',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 14,
  },
  noteIcon: {
    fontSize: 58,
    color: '#1DB954',
    textShadowColor: 'rgba(29, 185, 84, 0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  trackCardHint: {
    color: '#d6d6d6',
    marginTop: 10,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  trackCardTopText: {
    color: '#d8d8d8',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  trackCardYear: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    lineHeight: 62,
    letterSpacing: 1,
  },
  trackCardBottomText: {
    color: '#d8d8d8',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
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
