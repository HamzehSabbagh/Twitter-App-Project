import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSettings } from "@/providers/app-settings-provider";

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, language, setTheme, setLanguage, t, colors } = useAppSettings();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable
          onPress={() => router.back()}
          className="mb-4 self-start rounded-xl px-3 py-2"
          style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
        >
          <Text className="text-xs font-semibold" style={{ color: colors.text }}>
            {t("back", "Back")}
          </Text>
        </Pressable>

        <View className="rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-sm uppercase tracking-[3px]" style={{ color: colors.accentText }}>
            {t("settings", "Settings")}
          </Text>
          <Text className="mt-2 text-3xl font-semibold" style={{ color: colors.text }}>
            {t("settings_title", "App settings")}
          </Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            {t(
              "settings_description",
              "Choose how the interface looks and which language to use for the app shell."
            )}
          </Text>
        </View>

        <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-lg font-semibold" style={{ color: colors.text }}>{t("theme", "Theme")}</Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => setTheme("light")}
              className="flex-1 rounded-2xl border p-4"
              style={{
                borderColor: theme === "light" ? colors.primary : colors.borderSoft,
                backgroundColor: theme === "light" ? colors.primarySoft : colors.surfaceAlt,
              }}
            >
              <Text className="font-semibold" style={{ color: colors.text }}>{t("light", "Light")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setTheme("dark")}
              className="flex-1 rounded-2xl border p-4"
              style={{
                borderColor: theme === "dark" ? colors.primary : colors.borderSoft,
                backgroundColor: theme === "dark" ? colors.primarySoft : colors.surfaceAlt,
              }}
            >
              <Text className="font-semibold" style={{ color: colors.text }}>{t("dark", "Dark")}</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-lg font-semibold" style={{ color: colors.text }}>{t("language", "Language")}</Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => setLanguage("en")}
              className="flex-1 rounded-2xl border p-4"
              style={{
                borderColor: language === "en" ? colors.primary : colors.borderSoft,
                backgroundColor: language === "en" ? colors.primarySoft : colors.surfaceAlt,
              }}
            >
              <Text className="font-semibold" style={{ color: colors.text }}>{t("english", "English")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setLanguage("ar")}
              className="flex-1 rounded-2xl border p-4"
              style={{
                borderColor: language === "ar" ? colors.primary : colors.borderSoft,
                backgroundColor: language === "ar" ? colors.primarySoft : colors.surfaceAlt,
              }}
            >
              <Text className="font-semibold" style={{ color: colors.text }}>{t("arabic", "Arabic")}</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-lg font-semibold" style={{ color: colors.text }}>
            {t("api_connection", "API connection")}
          </Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            {t("api_connection_description", "Run a quick health check to see which backend URL the app can reach right now.")}
          </Text>
          <Pressable
            onPress={() => router.push("/api-health")}
            className="mt-4 self-start rounded-2xl px-4 py-3"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="font-semibold" style={{ color: colors.primaryText }}>
              {t("open_api_health", "Open API health")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
