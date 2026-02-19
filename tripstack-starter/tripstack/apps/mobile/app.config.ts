export default ({ config }: any) => ({
    ...config,
    name: "TripStack",
    slug: "tripstack",

    // REQUIRED for EAS build (Android)
    android: {
        package: "com.destinationmingle.tripstack",
        ...(config.android ?? {}),
    },

    extra: {
        // your API URL (set APP_BASE_URL in your shell or EAS env vars)
        EXPO_PUBLIC_API_URL: process.env.APP_BASE_URL || "https://your-worker.workers.dev",
        eas: {
            projectId: "8f38cff2-c06a-4e85-be79-2af5d0f79190",
        },
    },
});
