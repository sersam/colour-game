import { NativeModules, Platform } from 'react-native';

type SpotifyRemoteResult = {
  connected?: boolean;
  installed?: boolean;
  action?: string;
};

type SpotifyRemoteNativeModule = {
  isSpotifyAppInstalled(): Promise<boolean>;
  connect(): Promise<SpotifyRemoteResult>;
  playURI(spotifyURI: string): Promise<SpotifyRemoteResult>;
  pause(): Promise<SpotifyRemoteResult>;
  resume(): Promise<SpotifyRemoteResult>;
  skipNext(): Promise<SpotifyRemoteResult>;
  disconnect(): Promise<SpotifyRemoteResult>;
};

const spotifyRemoteModule = NativeModules.SpotifyRemoteModule as
  | SpotifyRemoteNativeModule
  | undefined;

function getSpotifyRemoteModule(): SpotifyRemoteNativeModule {
  if (Platform.OS !== 'ios') {
    throw new Error('Spotify App Remote is currently only supported on iOS.');
  }

  if (!spotifyRemoteModule) {
    throw new Error(
      'Spotify App Remote native module is not available in this build.'
    );
  }

  return spotifyRemoteModule;
}

export async function isSpotifyAppInstalled(): Promise<boolean> {
  return getSpotifyRemoteModule().isSpotifyAppInstalled();
}

export async function connectToSpotifyAppRemote() {
  return getSpotifyRemoteModule().connect();
}

export async function playTrackInSpotify(spotifyURI: string) {
  return getSpotifyRemoteModule().playURI(spotifyURI);
}

export async function pauseSpotifyPlayback() {
  return getSpotifyRemoteModule().pause();
}

export async function resumeSpotifyPlayback() {
  return getSpotifyRemoteModule().resume();
}

export async function skipSpotifyTrack() {
  return getSpotifyRemoteModule().skipNext();
}

export async function disconnectSpotifyAppRemote() {
  return getSpotifyRemoteModule().disconnect();
}
