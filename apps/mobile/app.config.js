module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL ?? config.experiments?.baseUrl ?? "";

  return {
    ...config,
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
