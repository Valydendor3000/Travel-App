export default ({ config }) => ({
    ...config,
    name: "TripStack",
    slug: "tripstack",

    android: {
        package: "com.destinationmingle.tripstack",
    },
    runtimeVersion: "1.0.0",
    splash: {
        backgroundColor: "#FFFFFF",
    },

    extra: {
        EXPO_PUBLIC_API_URL:
            process.env.APP_BASE_URL || "https://your-worker.workers.dev",
        eas: {
            projectId: "8f38cff2-c06a-4e85-be79-2af5d0f79190",
        },
    },
});
