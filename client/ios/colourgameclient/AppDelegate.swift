internal import Expo
import React
import ReactAppDependencyProvider
import SpotifyiOS

private enum SpotifyRemoteAction {
  case none
  case connect
  case play(String)
  case pause
  case resume
  case skipNext
}

@main
class AppDelegate: ExpoAppDelegate, SPTAppRemoteDelegate, SPTAppRemotePlayerStateDelegate {
  @objc static var shared: AppDelegate?

  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  private let spotifyClientID = "8d3b7f135cc44599ae5169043bc61b63"
  private let spotifyRedirectURL = URL(string: "colourgame://spotify-remote-callback")!
  private var spotifyAccessToken: String?
  private var pendingSpotifyAction: SpotifyRemoteAction = .none
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?

  private lazy var spotifyConfiguration: SPTConfiguration = {
    SPTConfiguration(clientID: spotifyClientID, redirectURL: spotifyRedirectURL)
  }()

  private lazy var spotifyAppRemote: SPTAppRemote = {
    let appRemote = SPTAppRemote(
      configuration: spotifyConfiguration,
      logLevel: .debug
    )
    appRemote.delegate = self
    return appRemote
  }()

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    AppDelegate.shared = self

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    let handledSpotify = handleSpotifyRedirect(url)
    let handledReact = RCTLinkingManager.application(app, open: url, options: options)

    return handledSpotify ||
      super.application(app, open: url, options: options) ||
      handledReact
  }

  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  public override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)

    guard let accessToken = spotifyAccessToken, !accessToken.isEmpty else {
      return
    }

    spotifyAppRemote.connectionParameters.accessToken = accessToken
    if !spotifyAppRemote.isConnected {
      spotifyAppRemote.connect()
    }
  }

  public override func applicationWillResignActive(_ application: UIApplication) {
    super.applicationWillResignActive(application)

    if spotifyAppRemote.isConnected {
      spotifyAppRemote.disconnect()
    }
  }

  @objc(isSpotifyAppInstalled:rejecter:)
  func isSpotifyAppInstalled(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(UIApplication.shared.canOpenURL(URL(string: "spotify://")!))
  }

  @objc(connectSpotify:rejecter:)
  func connectSpotify(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    enqueueSpotifyAction(.connect, resolve: resolve, reject: reject)
  }

  @objc(playSpotifyURI:resolver:rejecter:)
  func playSpotifyURI(
    _ spotifyURI: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    enqueueSpotifyAction(.play(spotifyURI), resolve: resolve, reject: reject)
  }

  @objc(pauseSpotify:rejecter:)
  func pauseSpotify(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    enqueueSpotifyAction(.pause, resolve: resolve, reject: reject)
  }

  @objc(resumeSpotify:rejecter:)
  func resumeSpotify(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    enqueueSpotifyAction(.resume, resolve: resolve, reject: reject)
  }

  @objc(skipToNextSpotify:rejecter:)
  func skipToNextSpotify(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    enqueueSpotifyAction(.skipNext, resolve: resolve, reject: reject)
  }

  @objc(disconnectSpotify:rejecter:)
  func disconnectSpotify(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.spotifyAppRemote.disconnect()
      self.pendingSpotifyAction = .none
      resolve([
        "connected": false,
        "action": "disconnect",
      ])
    }
  }

  func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
    print("Spotify App Remote connected")
    appRemote.playerAPI?.delegate = self
    appRemote.playerAPI?.subscribe(toPlayerState: { _, error in
      if let error {
        print("Spotify player state subscription error: \(error.localizedDescription)")
      }
    })

    performPendingSpotifyAction()
  }

  func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
    if let error {
      print("Spotify App Remote disconnected: \(error.localizedDescription)")
    }
  }

  func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
    let message = error?.localizedDescription ?? "Unknown App Remote connection error"
    rejectPendingSpotifyAction(code: "spotify_connection_failed", message: message)
  }

  func playerStateDidChange(_ playerState: SPTAppRemotePlayerState) {
    print("Spotify player state changed: \(playerState.track.name)")
  }

  private func handleSpotifyRedirect(_ url: URL) -> Bool {
    guard url.scheme == spotifyRedirectURL.scheme,
          url.absoluteString.contains("spotify-remote-callback")
    else {
      return false
    }

    let parameters = spotifyAppRemote.authorizationParameters(from: url)

    if let accessToken = parameters?[SPTAppRemoteAccessTokenKey] as? String {
      spotifyAccessToken = accessToken
      spotifyAppRemote.connectionParameters.accessToken = accessToken
      spotifyAppRemote.connect()
      return true
    }

    if let errorDescription = parameters?[SPTAppRemoteErrorDescriptionKey] as? String {
      rejectPendingSpotifyAction(
        code: "spotify_authorization_failed",
        message: errorDescription
      )
      return true
    }

    return false
  }

  private func enqueueSpotifyAction(
    _ action: SpotifyRemoteAction,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard UIApplication.shared.canOpenURL(URL(string: "spotify://")!) else {
        reject(
          "spotify_not_installed",
          "Spotify must be installed on the iPhone to use App Remote.",
          nil
        )
        return
      }

      self.pendingSpotifyAction = action
      self.pendingResolve = resolve
      self.pendingReject = reject

      if self.spotifyAppRemote.isConnected {
        self.performPendingSpotifyAction()
        return
      }

      if let accessToken = self.spotifyAccessToken, !accessToken.isEmpty {
        self.spotifyAppRemote.connectionParameters.accessToken = accessToken
        self.spotifyAppRemote.connect()
        return
      }

      switch action {
      case .connect:
        self.spotifyAppRemote.authorizeAndPlayURI("") { spotifyInstalled in
          if !spotifyInstalled {
            self.rejectPendingSpotifyAction(
              code: "spotify_not_installed",
              message: "Spotify must be installed on the iPhone to use App Remote."
            )
          }
        }
      case .play(let spotifyURI):
        self.spotifyAppRemote.authorizeAndPlayURI(spotifyURI) { spotifyInstalled in
          if !spotifyInstalled {
            self.rejectPendingSpotifyAction(
              code: "spotify_not_installed",
              message: "Spotify must be installed on the iPhone to use App Remote."
            )
          }
        }
      case .resume:
        self.spotifyAppRemote.authorizeAndPlayURI("") { spotifyInstalled in
          if !spotifyInstalled {
            self.rejectPendingSpotifyAction(
              code: "spotify_not_installed",
              message: "Spotify must be installed on the iPhone to use App Remote."
            )
          }
        }
      case .pause, .skipNext, .none:
        reject(
          "spotify_not_connected",
          "Connect to Spotify App Remote before sending playback commands.",
          nil
        )
        self.clearPendingSpotifyAction()
      }
    }
  }

  private func performPendingSpotifyAction() {
    switch pendingSpotifyAction {
    case .none:
      resolvePendingSpotifyAction([
        "connected": spotifyAppRemote.isConnected,
      ])
    case .connect:
      resolvePendingSpotifyAction([
        "connected": spotifyAppRemote.isConnected,
        "action": "connect",
      ])
    case .play(let spotifyURI):
      guard !spotifyURI.isEmpty else {
        resolvePendingSpotifyAction([
          "connected": spotifyAppRemote.isConnected,
          "action": "play",
        ])
        return
      }

      spotifyAppRemote.playerAPI?.play(spotifyURI, callback: { _, error in
        if let error {
          self.rejectPendingSpotifyAction(
            code: "spotify_play_failed",
            message: error.localizedDescription
          )
          return
        }

        self.resolvePendingSpotifyAction([
          "connected": true,
          "action": "play",
        ])
      })
    case .pause:
      spotifyAppRemote.playerAPI?.pause({ _, error in
        if let error {
          self.rejectPendingSpotifyAction(
            code: "spotify_pause_failed",
            message: error.localizedDescription
          )
          return
        }

        self.resolvePendingSpotifyAction([
          "connected": true,
          "action": "pause",
        ])
      })
    case .resume:
      spotifyAppRemote.playerAPI?.resume({ _, error in
        if let error {
          self.rejectPendingSpotifyAction(
            code: "spotify_resume_failed",
            message: error.localizedDescription
          )
          return
        }

        self.resolvePendingSpotifyAction([
          "connected": true,
          "action": "resume",
        ])
      })
    case .skipNext:
      spotifyAppRemote.playerAPI?.skip(toNext: { _, error in
        if let error {
          self.rejectPendingSpotifyAction(
            code: "spotify_skip_failed",
            message: error.localizedDescription
          )
          return
        }

        self.resolvePendingSpotifyAction([
          "connected": true,
          "action": "skipNext",
        ])
      })
    }
  }

  private func resolvePendingSpotifyAction(_ payload: [String: Any]) {
    pendingResolve?(payload)
    clearPendingSpotifyAction()
  }

  private func rejectPendingSpotifyAction(code: String, message: String) {
    pendingReject?(code, message, nil)
    clearPendingSpotifyAction()
  }

  private func clearPendingSpotifyAction() {
    pendingSpotifyAction = .none
    pendingResolve = nil
    pendingReject = nil
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
