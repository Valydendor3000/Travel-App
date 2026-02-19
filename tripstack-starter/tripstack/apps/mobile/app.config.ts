export default ({ config }) => ({
<<<<<<< HEAD
  ...config,
  name: "TripStack",
  slug: "tripstack",
  splash: {
    backgroundColor: "#FFFFFF",
  },
  android: {
    // Must be unique globally. Use reverse-domain style.
    package: "com.destinationmingle.tripstack",
  },

  // Optional but recommended if you will ever build iOS
  ios: {
    bundleIdentifier: "com.destinationmingle.tripstack",
  },

  extra: {
    ...(config.extra ?? {}),
    EXPO_PUBLIC_API_URL:
      process.env.EXPO_PUBLIC_API_URL ||
      process.env.APP_BASE_URL ||
      "https://your-worker.workers.dev",
    eas: {
      projectId: "8f38cff2-c06a-4e85-be79-2af5d0f79190",
    },
  },
=======
    ...config,
    name: "TripStack",
    slug: "tripstack",
    splash: {
        backgroundColor: "#FFFFFF",
    },
    android: {
        // Must be unique globally. Use reverse-domain style.
        package: "com.destinationmingle.tripstack",
    },

    // Optional but recommended if you will ever build iOS
    ios: {
        bundleIdentifier: "com.destinationmingle.tripstack",
    },

    extra: {
        ...(config.extra ?? {}),
        EXPO_PUBLIC_API_URL:
            process.env.EXPO_PUBLIC_API_URL ||
            process.env.APP_BASE_URL ||
            "https://your-worker.workers.dev",
        eas: {
            projectId: "8f38cff2-c06a-4e85-be79-2af5d0f79190",
        },
    },
>>>>>>> e85b877 (Configure EAS build and mobile config)
});
