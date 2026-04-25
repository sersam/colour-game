Pod::Spec.new do |s|
  s.name = 'SpotifyiOS'
  s.version = '1.0.0'
  s.summary = 'Vendored Spotify iOS SDK for App Remote integration.'
  s.homepage = 'https://developer.spotify.com/documentation/ios'
  s.license = { :type => 'Custom', :text => 'See Spotify developer terms and upstream SDK license.' }
  s.authors = { 'Spotify' => 'support@spotify.com' }
  s.platform = :ios, '12.0'
  s.source = { :path => '.' }
  s.vendored_frameworks = 'SpotifyiOS.xcframework'
  s.preserve_paths = 'SpotifyiOS.xcframework'
end
