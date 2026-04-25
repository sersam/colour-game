import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { searchSongs, SpotifyTrack } from '../services/spotifySearch';
import {
  isSpotifyAppInstalled,
  playTrackInSpotify,
} from '../services/spotifyRemote';

interface SearchResult extends SpotifyTrack {
  hasPreview: boolean;
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Empty Search', 'Please enter a song name or artist');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRetryAfter(null);

    try {
      const tracks = await searchSongs(searchQuery);
      const resultsWithPreview = tracks.map((track) => ({
        ...track,
        hasPreview: track.preview_url !== null,
      }));
      setResults(resultsWithPreview);

      if (resultsWithPreview.length === 0) {
        Alert.alert('No Results', 'No tracks found matching your search');
      }
    } catch (err: unknown) {
      let errorMessage = 'An unknown error occurred';

      if (err instanceof Error) {
        if ('status' in err) {
          const error = err as {
            status: number;
            message: string;
            retryAfter?: number;
          };
          if (error.status === 401) {
            errorMessage =
              'Your session has expired. Please log out and log in again.';
            setError(errorMessage);
          } else if (error.status === 429) {
            errorMessage = `Rate limited. Please wait ${error.retryAfter || 60} seconds before trying again.`;
            setRetryAfter(error.retryAfter || 60);
            setError(errorMessage);
          } else {
            errorMessage = error.message || 'Failed to search songs';
            setError(errorMessage);
          }
        } else {
          errorMessage = err.message;
          setError(errorMessage);
        }
      } else {
        setError(errorMessage);
      }

      Alert.alert('Search Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTrackItem = ({ item }: { item: SearchResult }) => {
    const albumArt =
      item.album.images.length > 0
        ? item.album.images[item.album.images.length - 1].url
        : undefined;

    return (
      <View style={styles.trackItem}>
        {albumArt && (
          <Image source={{ uri: albumArt }} style={styles.albumArt} />
        )}
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {item.artists.map((a) => a.name).join(', ')}
          </Text>
          <Text style={styles.albumName} numberOfLines={1}>
            {item.album.name}
          </Text>
          <View style={styles.previewBadge}>
            <Text
              style={[
                styles.previewText,
                item.hasPreview
                  ? styles.previewAvailable
                  : styles.previewUnavailable,
              ]}
            >
              {item.hasPreview ? '🎵 Preview Available' : '❌ No Preview'}
            </Text>
          </View>
          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              style={styles.spotifyPlayButton}
              onPress={async () => {
                try {
                  const installed = await isSpotifyAppInstalled();

                  if (!installed) {
                    Alert.alert(
                      'Spotify Required',
                      'Install the Spotify app on your iPhone to play the full track.'
                    );
                    return;
                  }

                  await playTrackInSpotify(item.uri);
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : 'Unable to start playback in Spotify.';
                  Alert.alert('Spotify Playback Error', message);
                }
              }}
            >
              <Text style={styles.spotifyPlayButtonText}>Play on Spotify</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs or artists..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={!isLoading && !retryAfter}
        />
        <TouchableOpacity
          style={[
            styles.searchButton,
            isLoading || retryAfter ? styles.searchButtonDisabled : null,
          ]}
          onPress={handleSearch}
          disabled={isLoading || !!retryAfter}
        >
          <Text style={styles.searchButtonText}>
            {isLoading ? 'Searching...' : 'Search'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {retryAfter && (
            <Text style={styles.retryAfterText}>
              Rate limit cooldown: {retryAfter} seconds
            </Text>
          )}
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Searching Spotify...</Text>
        </View>
      )}

      {results.length > 0 && !isLoading && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Found {results.length} tracks</Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderTrackItem}
            scrollEnabled={false}
          />
        </View>
      )}

      {results.length === 0 && !isLoading && !error && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Search for songs to get started</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  searchContainer: {
    marginBottom: 20,
    marginTop: 10,
  },
  searchInput: {
    backgroundColor: '#282828',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#404040',
  },
  searchButton: {
    backgroundColor: '#1DB954',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#535353',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#3e1a1a',
    borderLeftWidth: 4,
    borderLeftColor: '#ff4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#ff7777',
    fontSize: 14,
  },
  retryAfterText: {
    color: '#ffaaaa',
    fontSize: 12,
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultsTitle: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  trackItem: {
    flexDirection: 'row',
    backgroundColor: '#282828',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#404040',
  },
  albumArt: {
    width: 80,
    height: 80,
  },
  trackInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  trackName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  artistName: {
    color: '#b3b3b3',
    fontSize: 12,
    marginTop: 4,
  },
  albumName: {
    color: '#909090',
    fontSize: 11,
    marginTop: 2,
  },
  previewBadge: {
    marginTop: 8,
  },
  previewText: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  previewAvailable: {
    color: '#1DB954',
    backgroundColor: '#1a4d2e',
  },
  previewUnavailable: {
    color: '#ff6b6b',
    backgroundColor: '#4d1a1a',
  },
  spotifyPlayButton: {
    marginTop: 10,
    backgroundColor: '#1DB954',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  spotifyPlayButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#b3b3b3',
    fontSize: 16,
  },
});
