Pod::Spec.new do |s|
  s.name           = 'CruiseMusicKit'
  s.version        = '1.0.0'
  s.summary        = 'Apple Music playback control for Cruise FM'
  s.description    = 'Drives the system Music player so Cruise FM can be the visual layer over Apple Music.'
  s.author         = 'Cruise FM'
  s.homepage       = 'https://cruisefm.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
