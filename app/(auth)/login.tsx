import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("Password123!");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/(app)/home");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>Sign in</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

      {!!err && <Text style={{ color: "crimson" }}>{err}</Text>}

      <Pressable
        onPress={onLogin}
        disabled={busy}
        style={{
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: busy ? "#999" : "#111",
        }}
      >
        {busy ? <ActivityIndicator /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Login</Text>}
      </Pressable>

      <Text style={{ marginTop: 8 }}>
        New here? <Link href="/(auth)/register">Create an account</Link>
      </Text>
    </View>
  );
}
