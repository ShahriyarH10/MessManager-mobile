module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin must be listed last (it replaces the old
    // react-native-reanimated/plugin). Reanimated is pulled in by expo-router.
    plugins: ['react-native-worklets/plugin'],
  };
};
