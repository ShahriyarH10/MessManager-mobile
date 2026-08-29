// Dynamic layer over app.json.
//
// Only wires Android FCM (`googleServicesFile`) when the credentials file is
// actually present, so `eas build` works before Firebase is set up and picks
// push up automatically once google-services.json is dropped at the repo root.
// See PUSH_SETUP.md.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(googleServices)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
