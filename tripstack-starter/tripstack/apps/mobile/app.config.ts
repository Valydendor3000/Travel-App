import type { ExpoConfig } from "expo/config";

export default ({ config }: { config: ExpoConfig }) => ({
  ...config,
  name: "TripStack",
  slug: "tripstack",

  // REQUIRED for EAS Android builds
  android: {
    package: "com.destinationmingle.tripstack",
    ...(config.android ?? {}),
  },

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
