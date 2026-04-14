import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

export default function LoginScreen() {
  const { verified } = useLocalSearchParams<{ verified?: string }>();
  const { signIn } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const successMessage = useMemo(
    () =>
      verified === "1"
        ? t("email_verified_sign_in", "Your email has been verified. You can sign in now.")
        : "",
    [t, verified]
  );

  async function handleLogin() {
    setLoading(true);
    setError("");

    try {
      await signIn({ email, password });
      router.replace("/");
    } catch (authError) {
      if (
        authError instanceof ApiError &&
        authError.status === 403 &&
        authError.message.toLowerCase().includes("verify")
      ) {
        router.replace({
          pathname: "/verify-email",
          params: {
            email,
            status: "unverified",
          },
        });
        return;
      }

      setError(authError instanceof Error ? authError.message : t("login", "Log in"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }}
      >
        <View className="rounded-[28px] border p-7" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
            {t("welcome_back", "Welcome back")}
          </Text>
          <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>
            {t("sign_in_account", "Sign in to your account")}
          </Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>{t("continue_left_off", "Continue where you left off.")}</Text>

          {successMessage ? (
            <View className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: colors.successBorder, backgroundColor: colors.successBg }}>
              <Text className="text-sm" style={{ color: colors.successText }}>{successMessage}</Text>
            </View>
          ) : null}

          <View className="mt-6">
            <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("email", "Email")}</Text>
            <View className="mt-2 rounded-xl border px-4" style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                className="py-3 text-sm"
                style={{ color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>
          </View>

          <View className="mt-5">
            <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("password", "Password")}</Text>
            <View className="mt-2 flex-row items-center rounded-xl border px-4" style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder={t("enter_password", "Enter your password")}
                placeholderTextColor={colors.textMuted}
                className="flex-1 py-3 text-sm"
                style={{ color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
              <Pressable onPress={() => setShowPassword((current) => !current)}>
                <Text className="text-xs font-semibold" style={{ color: colors.accentText }}>
                  {showPassword ? t("hide", "Hide") : t("show", "Show")}
                </Text>
              </Pressable>
            </View>
          </View>

          {error ? (
            <View className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}>
              <Text className="text-sm" style={{ color: colors.dangerText }}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="mt-6 items-center rounded-xl px-4 py-3 disabled:opacity-60"
            style={{ backgroundColor: colors.primary }}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>{t("login", "Log in")}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push("/signup")} className="mt-5">
            <Text className="text-center text-sm" style={{ color: colors.textSecondary }}>
              {t("new_here", "New here?")} <Text className="font-semibold" style={{ color: colors.accentText }}>{t("create_account", "Create account")}</Text>
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push("/api-health")} className="mt-4 self-center rounded-full px-4 py-2">
            <Text className="text-sm font-semibold" style={{ color: colors.accentText }}>
              {t("check_api_connection", "Check API connection")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
