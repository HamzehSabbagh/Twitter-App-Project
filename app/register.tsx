import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BirthDateField } from "@/components/birth-date-field";
import { isAtLeast18YearsOld, parseDateInput } from "@/lib/date";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    birth_date: "",
    password: "",
    password_confirmation: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleRegister() {
    if (!parseDateInput(form.birth_date)) {
      setError(t("choose_valid_birth_date", "Please choose a valid birth date."));
      return;
    }

    if (!isAtLeast18YearsOld(form.birth_date)) {
      setError(t("must_be_18_create", "You must be 18 or older to create an account."));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signUp(form);
      router.replace({
        pathname: "/verify-email",
        params: { email: result.email },
      });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t("create_account", "Create account"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="rounded-[28px] border p-7" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
          <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
            {t("join_now", "Join now")}
          </Text>
          <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>{t("create_your_account", "Create your account")}</Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            {t("setup_profile_start", "Set up your profile and start using the app.")}
          </Text>

          <View className="mt-6 gap-4">
            <View>
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("first_name", "First name")}</Text>
              <TextInput
                value={form.first_name}
                onChangeText={(value) => setField("first_name", value)}
                placeholder="Hamza"
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            <View>
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("last_name", "Last name")}</Text>
              <TextInput
                value={form.last_name}
                onChangeText={(value) => setField("last_name", value)}
                placeholder="Sabbagh"
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            <View>
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("username", "Username")}</Text>
              <TextInput
                value={form.username}
                onChangeText={(value) => setField("username", value)}
                autoCapitalize="none"
                placeholder="hamzasabbagh"
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            <View>
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("email", "Email")}</Text>
              <TextInput
                value={form.email}
                onChangeText={(value) => setField("email", value)}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            <BirthDateField
              value={form.birth_date}
              onChange={(value) => setField("birth_date", value)}
            />

            <View>
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("password", "Password")}</Text>
              <TextInput
                value={form.password}
                onChangeText={(value) => setField("password", value)}
                secureTextEntry
                placeholder={t("create_password", "Create a password")}
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            <View>
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("confirm_password", "Confirm password")}</Text>
              <TextInput
                value={form.password_confirmation}
                onChangeText={(value) => setField("password_confirmation", value)}
                secureTextEntry
                placeholder={t("repeat_password", "Repeat your password")}
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>
          </View>

          {error ? (
            <View className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}>
              <Text className="text-sm" style={{ color: colors.dangerText }}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className="mt-6 items-center rounded-xl px-4 py-3 disabled:opacity-60"
            style={{ backgroundColor: colors.primary }}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>{t("create_account", "Create account")}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push("/login")} className="mt-5">
            <Text className="text-center text-sm" style={{ color: colors.textSecondary }}>
              {t("already_have_account", "Already have an account?")} <Text className="font-semibold" style={{ color: colors.accentText }}>{t("login", "Log in")}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
