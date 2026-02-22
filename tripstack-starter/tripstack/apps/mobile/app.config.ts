export default ({ config }) => ({
  ...config,
  name: "TripStack",
  slug: "tripstack",

  android: {
    // MUST be unique and reverse-DNS style
    package: "com.travel.tripstack",
  },

  extra: {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || "https://your-worker.workers.dev",
    eas: {
      projectId: "8f38cff2-c06a-4e85-be79-2af5d0f79190",
    },
  },
});
