import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { getTrips } from '../lib/api';

export default function TripsScreen() {
  const [trips, setTrips] = useState<any[] | null>(null);
  useEffect(() => { getTrips().then(setTrips).catch(() => setTrips([])); }, []);
  if (!trips) return <ActivityIndicator/>;
  return (
    <View style={{ padding: 24 }}>
      {trips.map(t => <Text key={t.id}>{t.title}</Text>)}
    </View>
  );
}
