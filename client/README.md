# Colour Game - Client

React Native Expo app for Colour Game with Spotify integration.

## Features

- 🎵 **Spotify Authentication** - OAuth 2.0 with PKCE flow
- 🔍 **Song Search** - Search Spotify catalogue with preview URLs
- 🛡️ **Error Handling** - 401/429 status code management
- 🔐 **Secure Storage** - Token storage with OS Keychain/SecureStore
- 🔄 **Auto Token Refresh** - Automatic refresh before expiration
- 📱 **Cross-Platform** - iOS, Android, and Web support

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Spotify Developer Account ([Create here](https://developer.spotify.com/dashboard))

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Spotify Client ID:
   ```
   SPOTIFY_CLIENT_ID=your_spotify_client_id_here
   ```

### Running the App

```bash
npm start
```

Then select your platform:
- Press `i` for iOS
- Press `a` for Android
- Press `w` for Web

## Project Structure

```
client/
├── services/
│   ├── spotifyAuth.ts        # OAuth authentication
│   └── spotifySearch.ts      # Song search & API calls
├── components/
│   ├── LoginScreen.tsx       # Spotify login UI
│   └── SearchScreen.tsx      # Song search UI
├── contexts/
│   └── AuthContext.tsx       # Authentication state management
├── App.tsx                   # Main app entry point
└── babel.config.js           # Babel configuration
```

## Documentation

- [Spotify Setup Guide](./SPOTIFY_SETUP.md) - Initial Spotify configuration
- [Search API Guide](./SPOTIFY_SEARCH.md) - Song search functionality and error handling

## Key Technologies

- **React Native** - Cross-platform development
- **Expo** - Managed React Native framework
- **TypeScript** - Type-safe development
- **React Navigation** - Screen navigation
- **Expo Auth Session** - OAuth 2.0 implementation
- **Expo Secure Store** - Secure token storage
- **react-native-dotenv** - Environment variable management

## Available Scripts

```bash
# Start development server
npm start

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npx tsc --noEmit

# Build for iOS
npm run ios

# Build for Android
npm run android

# Build for Web
npm run web
```

## Error Handling

The app handles Spotify API errors gracefully:

- **401 Unauthorized** - Shows re-login prompt
- **429 Rate Limited** - Shows wait time and retry options
- **Network Errors** - Shows user-friendly error messages

## License

MIT
