Pod::Spec.new do |s|
  s.name           = 'CruiseWidgets'
  s.version        = '1.0.0'
  s.summary        = 'Hands the widget snapshot to the App Group'
  s.description    = 'Writes what the Home Screen and Lock Screen widgets read, and asks WidgetKit to redraw.'
  s.author         = 'Cruise FM'
  s.homepage       = 'https://cruisefm.netlify.app'
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
