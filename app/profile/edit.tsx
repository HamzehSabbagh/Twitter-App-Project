import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BirthDateField } from "@/components/birth-date-field";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { isAtLeast18YearsOld, parseDateInput } from "@/lib/date";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type ProfileResponse = {
  profile: {
    first_name: string;
    last_name: string;
    username: string;
    email?: string | null;
    birth_date?: string | null;
    bio?: string | null;
    location?: string | null;
    is_profile_public?: boolean;
  };
};

export default function EditProfileScreen() {
  const { authFetch, token, updateUser } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [initialProfile, setInitialProfile] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    birth_date: "",
    location: "",
    bio: "",
  });
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    birth_date: "",
    location: "",
    bio: "",
    is_profile_public: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await authFetch(`${API_BASE_URL}/profile/me`);
        const data = await parseJsonResponse<ProfileResponse>(response);
        const nextProfile = {
          first_name: data.profile.first_name ?? "",
          last_name: data.profile.last_name ?? "",
          username: data.profile.username ?? "",
          email: data.profile.email ?? "",
          birth_date: data.profile.birth_date ?? "",
          location: data.profile.location ?? "",
          bio: data.profile.bio ?? "",
        };

        setInitialProfile(nextProfile);
        setForm({
          ...nextProfile,
          is_profile_public: data.profile.is_profile_public ?? true,
        });
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? profileError.message
            : t("could_not_load_profile", "Could not load profile.")
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [authFetch, t, token]);

  function setField(name: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSave() {
    if (!parseDateInput(form.birth_date)) {
      setError(t("choose_valid_birth_date", "Please choose a valid birth date."));
      return;
    }

    if (!isAtLeast18YearsOld(form.birth_date)) {
      setError(t("must_be_18_use", "You must be 18 or older to use this app."));
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await parseJsonResponse<ProfileResponse & { message: string }>(response);
      await updateUser({
        first_name: data.profile.first_name,
        last_name: data.profile.last_name,
        username: data.profile.username,
        email: data.profile.email ?? form.email,
      });
      router.replace({
        pathname: "/profile/[username]",
        params: { username: data.profile.username },
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("could_not_update_profile", "Could not update your profile.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable
          onPress={() => router.back()}
          className="mb-4 self-start rounded-xl border px-3 py-2"
          style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
        >
          <Text className="text-xs font-semibold" style={{ color: colors.text }}>
            {t("back", "Back")}
          </Text>
        </Pressable>

        <View
          className="rounded-[28px] border p-7"
          style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
        >
          <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
            {t("profile", "Profile")}
          </Text>
          <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>
            {t("edit_your_profile", "Edit your profile")}
          </Text>
          <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            {t("update_profile_description", "Update the same profile details you use in the web app.")}
          </Text>

          {loading ? (
            <View className="mt-8 items-center py-8">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View className="mt-6 gap-4">
              <View>
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("first_name", "First name")}
                </Text>
                <TextInput
                  value={form.first_name}
                  onChangeText={(value) => setField("first_name", value)}
                  placeholder={initialProfile.first_name || "Hamza"}
                  placeholderTextColor="#94A3B8"
                  className="mt-2 rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              <View>
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("last_name", "Last name")}
                </Text>
                <TextInput
                  value={form.last_name}
                  onChangeText={(value) => setField("last_name", value)}
                  placeholder={initialProfile.last_name || "Sabbagh"}
                  placeholderTextColor="#94A3B8"
                  className="mt-2 rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              <View>
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("username", "Username")}
                </Text>
                <TextInput
                  value={form.username}
                  onChangeText={(value) => setField("username", value)}
                  autoCapitalize="none"
                  placeholder={initialProfile.username || "hamzasabbagh"}
                  placeholderTextColor="#94A3B8"
                  className="mt-2 rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              <View>
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("email", "Email")}
                </Text>
                <TextInput
                  value={form.email}
                  onChangeText={(value) => setField("email", value)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={initialProfile.email || "you@example.com"}
                  placeholderTextColor="#94A3B8"
                  className="mt-2 rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              <BirthDateField
                value={form.birth_date}
                onChange={(value) => setField("birth_date", value)}
                placeholder={initialProfile.birth_date}
              />

              <View>
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("location", "Location")}
                </Text>
                <TextInput
                  value={form.location}
                  onChangeText={(value) => setField("location", value)}
                  placeholder={initialProfile.location || "Amman, Jordan"}
                  placeholderTextColor="#94A3B8"
                  className="mt-2 rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              <View>
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("bio", "Bio")}
                </Text>
                <TextInput
                  value={form.bio}
                  onChangeText={(value) => setField("bio", value)}
                  multiline
                  textAlignVertical="top"
                  placeholder={initialProfile.bio || t("tell_about_yourself", "Tell people about yourself")}
                  placeholderTextColor="#94A3B8"
                  className="mt-2 min-h-24 rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              <View
                className="mt-2 flex-row items-center justify-between rounded-2xl border px-4 py-4"
                style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
              >
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-medium" style={{ color: colors.text }}>
                    {t("public_profile", "Public profile")}
                  </Text>
                  <Text className="mt-1 text-xs leading-5" style={{ color: colors.textMuted }}>
                    {t("public_profile_description", "Turn this off if you want only yourself and admins to see your posts.")}
                  </Text>
                </View>
                <Switch
                  value={form.is_profile_public}
                  onValueChange={(value) => setField("is_profile_public", value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={form.is_profile_public ? colors.primaryText : colors.textSecondary}
                />
              </View>
            </View>
          )}

          {error ? (
            <View
              className="mt-5 rounded-2xl border px-4 py-3"
              style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
            >
              <Text className="text-sm" style={{ color: colors.dangerText }}>
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={loading || saving}
            className="mt-6 items-center rounded-xl px-4 py-3 disabled:opacity-60"
            style={{ backgroundColor: colors.primary }}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>
                {t("save_changes", "Save changes")}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
