import { Stack } from "expo-router";
import { AuthProvider } from "@/providers/auth-provider";
import { AppSettingsProvider, useAppSettings } from "@/providers/app-settings-provider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppSettingsProvider>
        <StackShell />
      </AppSettingsProvider>
    </AuthProvider>
  );
}

function StackShell() {
  const { colors } = useAppSettings();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
