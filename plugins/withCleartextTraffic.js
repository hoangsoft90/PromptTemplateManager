// plugins/withCleartextTraffic.js
//
// Expo config plugin: allow cleartext HTTP for EVERY domain in the Android
// build (Android 9+ blocks http:// by default; targetSdk 28+ ignores the
// `usesCleartextTraffic` manifest flag whenever a network security config is
// present, so the explicit config below is the reliable way).
//
// This writes res/xml/network_security_config.xml with a base-config that
// permits cleartext traffic for all domains, and references it from the
// <application> element in AndroidManifest.xml. Prebuild regenerates android/
// on every build, so both files must be applied via this config plugin
// (registered in app.json) to persist.
//
// SECURITY NOTE: allowing cleartext for every domain is intentionally broad —
// this app is 100% on-device with no backend, and the only network traffic is
// user-initiated (importing a backup from an http URL on web, or future
// user-provided URLs). Tighten to a domain list before shipping a build that
// talks to a real server.

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<!-- Allow cleartext http:// traffic for all domains (added by withCleartextTraffic). -->
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

module.exports = function withCleartextTraffic(config) {
  // 1. Write res/xml/network_security_config.xml
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const resDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(resDir, { recursive: true });
      fs.writeFileSync(path.join(resDir, 'network_security_config.xml'), NETWORK_SECURITY_CONFIG);
      return config;
    },
  ]);

  // 2. Reference it from <application> in AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    // Belt-and-suspenders: keep the flag too (harmless, and covers any path
    // that does not read the network security config).
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });

  return config;
};
