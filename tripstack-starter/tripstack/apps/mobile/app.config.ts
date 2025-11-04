export default () => ({
  expo: {
    name: 'TripStack',
    slug: 'tripstack',
    scheme: 'tripstack',
    extra: {
      EXPO_PUBLIC_API_URL: process.env.APP_BASE_URL || 'https://your-worker.workers.dev'
    }
  }
});
