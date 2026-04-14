import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

export default function VerifyEmailScreen() {
  const { email, status } = useLocalSearchParams<{ email?: string; status?: string }>();
  const router = useRouter();
  const { resendVerification, signOut } = useAuth();
  const { t, colors } = useAppSettings();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    status === "unverified"
      ? t("account_exists_unverified", "Your account exists, but your email address is not verified yet.")
      : ""
  );
  const [error, setError] = useState("");

  async function handleResend() {
    if (!email) {
      setError(t("missing_email_address", "Missing email address."));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await resendVerification(email);
      setStatusMessage(data.message);
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : t("could_not_resend_verification_email", "Could not resend verification email.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }}>
        <View className="rounded-[28px] border p-7" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
            {t("one_more_step", "One more step")}
          </Text>
          <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>{t("check_inbox", "Check your inbox")}</Text>
          <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
            {t("check_inbox_description", "Check your inbox and click the verification link we sent. If it did not arrive, request a new one below.")}
          </Text>

          {email ? (
            <View className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{email}</Text>
            </View>
          ) : null}

          {statusMessage ? (
            <View className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: colors.successBorder, backgroundColor: colors.successBg }}>
              <Text className="text-sm font-medium" style={{ color: colors.successText }}>{statusMessage}</Text>
            </View>
          ) : null}

          {error ? (
            <View className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}>
              <Text className="text-sm font-medium" style={{ color: colors.dangerText }}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleResend}
            disabled={loading}
            className="mt-6 items-center rounded-xl px-4 py-3 disabled:opacity-60"
            style={{ backgroundColor: colors.primary }}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>{t("resend_verification_email", "Resend verification email")}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="mt-4 items-center"
          >
            <Text className="text-sm font-semibold" style={{ color: colors.accentText }}>{t("logout", "Log out")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
