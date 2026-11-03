require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['transform-inline-environment-variables', { include: ['CERCAGO_API_URL'] }],
  ],
};
