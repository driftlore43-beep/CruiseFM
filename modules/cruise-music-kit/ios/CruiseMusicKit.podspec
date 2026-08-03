Pod::Spec.new do |s|
  s.name           = 'CruiseMusicKit'
  s.version        = '1.0.0'
  s.summary        = 'Apple Music playback for Cruise FM'
  s.description    = 'Thin MusicKit bridge: authorization, transport, and the listener\'s own playlists.'
  s.author         = 'Cruise FM'
  s.homepage       = 'https://cruisefm.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
