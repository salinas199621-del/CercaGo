module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL ?? config.experiments?.baseUrl ?? "";
  if (process.env.EAS_BUILD && !process.env.EXPO_PUBLIC_API_URL?.startsWith("https://")) {
    throw new Error("Configura EXPO_PUBLIC_API_URL con la URL HTTPS pública del API antes de generar el APK.");
  }
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ["react-native-maps", process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ? { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }
        : {}],
    ],
    experiments: {
      ...config.experiments,
      baseUrl,
    },
    web: {
      ...config.web,
      output: "single",
    },
  };
};
