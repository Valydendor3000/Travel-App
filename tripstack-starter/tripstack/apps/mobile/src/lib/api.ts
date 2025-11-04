export const API_URL = process.env.EXPO_PUBLIC_API_URL as string || 'https://your-worker.workers.dev';
export async function getTrips() {
  const res = await fetch(`${API_URL}/api/trips`);
  return res.json();
}
