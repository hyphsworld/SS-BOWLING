import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";

function WebDiagnosticHome() {
  const router = useRouter();
  return (
    <View style={styles.webRoot}>
      <Text style={styles.webEyebrow}>AMS WEST</Text>
      <Text style={styles.webTitle}>SUPER STRIKE</Text>
      <Text style={styles.webCopy}>Web boot is alive.</Text>
      <Pressable style={styles.webButton} onPress={() => router.push("/game?mode=solo")}>
        <Text style={styles.webButtonText}>OPEN GAME</Text>
      </Pressable>
    </View>
  );
}

function NativeHome() {
  const router = useRouter();
  return (
    <View style={styles.nativeRoot}>
      <Text style={styles.nativeTitle}>SUPER STRIKE</Text>
      <Pressable style={styles.nativeButton} onPress={() => router.push("/game?mode=solo")}>
        <Text style={styles.nativeButtonText}>Solo Play</Text>
      </Pressable>
      <Pressable style={styles.nativeButton} onPress={() => router.push("/game?mode=cpu")}>
        <Text style={styles.nativeButtonText}>Vs CPU</Text>
      </Pressable>
      <Pressable style={styles.nativeButton} onPress={() => router.push("/multiplayer")}>
        <Text style={styles.nativeButtonText}>Multiplayer</Text>
      </Pressable>
    </View>
  );
}

export default function Home() {
  return Platform.OS === "web" ? <WebDiagnosticHome /> : <NativeHome />;
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#08080d",
    paddingHorizontal: 24,
  },
  webEyebrow: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#ff3b30",
    marginBottom: 10,
  },
  webTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
  },
  webCopy: {
    fontSize: 18,
    color: "#c7c7cc",
    marginTop: 12,
    marginBottom: 28,
  },
  webButton: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
  },
  webButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#08080d",
    letterSpacing: 1,
  },
  nativeRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#08080d",
    padding: 24,
    gap: 14,
  },
  nativeTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 16,
  },
  nativeButton: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  nativeButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#08080d",
  },
});
