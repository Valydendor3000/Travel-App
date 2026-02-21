export default ({ config }) => ({
  ...config,
  name: "TripStack",
  slug: "tripstack",

  // ✅ Required for EAS Update on a dev build
  updates: {
    url: "https://u.expo.dev/8f38cff2-c06a-4e85-be79-2af5d0f79190",
  },

  // (Recommended) keep runtime stable for dev updates
  runtimeVersion: "1.0.0",

  extra: {
    EXPO_PUBLIC_API_URL:
      process.env.EXPO_PUBLIC_API_URL ||
      process.env.APP_BASE_URL ||
      "https://your-worker.workers.dev",

    eas: {
      projectId: "8f38cff2-c06a-4e85-be79-2af5d0f79190",
    },
  },
});
