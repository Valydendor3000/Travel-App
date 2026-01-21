import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { apiFetch } from "../../src/lib/api";

export default function Home() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      try {
        const data = await apiFetch("/api/my/groups", { method: "GET", token: token! });
        setGroups(Array.isArray(data) ? data : data?.results ?? []);
      } catch (e: any) {
        setErr(e.message || "Failed to load groups");
      }
    })();
  }, [token]);

  async function onLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Welcome</Text>
      <Text style={{ marginTop: 6 }}>{user?.email}</Text>

      <Pressable
        onPress={onLogout}
        style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: "#111", alignSelf: "flex-start" }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Logout</Text>
      </Pressable>

      <Text style={{ marginTop: 24, fontSize: 18, fontWeight: "700" }}>My Groups</Text>
      {!!err && <Text style={{ color: "crimson", marginTop: 8 }}>{err}</Text>}

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        style={{ marginTop: 10 }}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 12, marginBottom: 10 }}>
            <Text style={{ fontWeight: "700" }}>{item.name}</Text>
            <Text>capacity: {item.capacity ?? 0}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ marginTop: 12 }}>No groups yet (admin needs to add you).</Text>}
      />
    </View>
  );
}
