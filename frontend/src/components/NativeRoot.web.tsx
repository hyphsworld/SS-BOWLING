import { Stack } from "expo-router";

export default function NativeRootWeb() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
