const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('webm', 'glb', 'gltf', 'bin');
module.exports = config;
