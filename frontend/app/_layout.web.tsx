import { Stack, usePathname } from "expo-router";
import PopWall3D from "@/src/components/PopWall3D.web";

export default function WebRootLayout() {
  const pathname = usePathname();
  const isGameRoute = pathname === "/game" || pathname.endsWith("/game");

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {isGameRoute ? <PopWall3D /> : null}
    </>
  );
}
