import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  API_BASE_URL,
  API_BASE_URL_CANDIDATES,
  API_BASE_URL_SOURCE,
  ApiProbeResult,
  probeApiBaseUrl,
} from "@/lib/api";
import { useAppSettings } from "@/providers/app-settings-provider";

export default function ApiHealthScreen() {
  const router = useRouter();
  const { t, colors } = useAppSettings();
  const [results, setResults] = useState<Record<string, ApiProbeResult>>({});
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void runChecks();
  }, []);

  async function runChecks() {
    setRunning(true);

    try {
      const nextResults = await Promise.all(API_BASE_URL_CANDIDATES.map((candidate) => probeApiBaseUrl(candidate)));

      setResults(Object.fromEntries(nextResults.map((result) => [result.candidate.baseUrl, result])));
    } finally {
      setRunning(false);
    }
  }

  const reachableAlternative = API_BASE_URL_CANDIDATES
    .map((candidate) => results[candidate.baseUrl])
    .find((result) => result?.reachable && result.candidate.baseUrl !== API_BASE_URL);

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
            {t("api_connection", "API connection")}
          </Text>
          <Text className="mt-2 text-3xl font-semibold" style={{ color: colors.text }}>
            {t("api_health_title", "API health check")}
          </Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            {t("api_health_description", "The app will try the configured backend first, then fall back to local dev addresses when a network request cannot reach the server.")}
          </Text>
        </View>

        <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-xs uppercase tracking-[2px]" style={{ color: colors.textMuted }}>
            {t("current_api_base_url", "Current API base URL")}
          </Text>
          <Text className="mt-3 text-base font-semibold" style={{ color: colors.text }}>
            {API_BASE_URL}
          </Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            {API_BASE_URL_SOURCE}
          </Text>
        </View>

        {reachableAlternative ? (
          <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.successBorder, backgroundColor: colors.successBg }}>
            <Text className="text-sm font-semibold" style={{ color: colors.successText }}>
              {t("reachable_alternative_found", "A reachable fallback URL is available")}
            </Text>
            <Text className="mt-2 text-sm" style={{ color: colors.successText }}>
              {reachableAlternative.candidate.baseUrl}
            </Text>
          </View>
        ) : null}

        <View className="mt-5 flex-row items-center justify-between rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <View className="flex-1 pr-4">
            <Text className="text-lg font-semibold" style={{ color: colors.text }}>
              {t("api_candidates", "Connection candidates")}
            </Text>
            <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
              {t("api_candidates_description", "Each check requests /posts?page=1 so we can tell whether the backend is reachable from this device.")}
            </Text>
          </View>
          <Pressable
            onPress={runChecks}
            disabled={running}
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: colors.primary, opacity: running ? 0.7 : 1 }}
          >
            {running ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text className="font-semibold" style={{ color: colors.primaryText }}>
                {t("run_again", "Run again")}
              </Text>
            )}
          </Pressable>
        </View>

        <View className="mt-5 gap-3">
          {API_BASE_URL_CANDIDATES.map((candidate) => {
            const result = results[candidate.baseUrl];
            const isCurrent = candidate.baseUrl === API_BASE_URL;
            const reachable = result?.reachable;

            return (
              <View
                key={candidate.baseUrl}
                className="rounded-[28px] border p-5"
                style={{
                  borderColor: reachable ? colors.successBorder : colors.borderSoft,
                  backgroundColor: reachable ? colors.successBg : colors.surface,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-base font-semibold" style={{ color: reachable ? colors.successText : colors.text }}>
                    {candidate.label}
                  </Text>
                  <Text
                    className="ml-3 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      color: reachable ? colors.successText : colors.textMuted,
                      backgroundColor: reachable ? colors.surface : colors.surfaceAlt,
                    }}
                  >
                    {isCurrent ? t("current", "Current") : reachable ? t("reachable", "Reachable") : t("unreachable", "Unreachable")}
                  </Text>
                </View>

                <Text className="mt-3 text-sm" style={{ color: reachable ? colors.successText : colors.textSecondary }}>
                  {candidate.baseUrl}
                </Text>

                <Text className="mt-3 text-sm" style={{ color: reachable ? colors.successText : colors.textMuted }}>
                  {result ? result.message : t("waiting_for_check", "Waiting for check...")}
                </Text>
              </View>
            );
          })}
        </View>

        <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-lg font-semibold" style={{ color: colors.text }}>
            {t("next_steps", "Next steps")}
          </Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            {t("next_steps_api_health", "If the reachable URL is not the one you want, update frontend/.env for local Expo and frontend/eas.json for device builds, then restart the app.")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
