import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isAtLeast18YearsOld, parseDateInput } from "@/lib/date";
import { useAuth } from "@/providers/auth-provider";

const EXAMPLE_PROFILE = {
  firstName: "Alex",
  lastName: "Rivera",
  username: "alexrivera",
  email: "alex@example.com",
  birthDate: "1999-05-14",
};

const palette = {
  background: "#020617",
  card: "#0F172A",
  cardBorder: "#1E293B",
  inputBg: "#111827",
  inputBorder: "#334155",
  text: "#FFFFFF",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  accent: "#22D3EE",
  accentText: "#082F49",
  errorBg: "rgba(244,63,94,0.10)",
  errorBorder: "rgba(244,63,94,0.30)",
  errorText: "#FDA4AF",
};

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: palette.errorBorder,
            backgroundColor: palette.card,
            padding: 24,
          }}
        >
          <Text style={{ color: palette.errorText, fontSize: 24, fontWeight: "700" }}>
            Signup Screen Error
          </Text>
          <Text style={{ color: palette.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 12 }}>
            {error.message}
          </Text>
          <Pressable
            onPress={retry}
            style={{
              marginTop: 20,
              borderRadius: 14,
              backgroundColor: palette.accent,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: palette.accentText, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
              Retry
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function SignupScreen() {
  const { signUp } = useAuth();
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  function setField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleRegister() {
    if (!parseDateInput(form.birth_date)) {
      setError("Please choose a valid birth date.");
      return;
    }

    if (!isAtLeast18YearsOld(form.birth_date)) {
      setError("You must be 18 or older to create an account.");
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
      setError(authError instanceof Error ? authError.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={{ marginBottom: 16, alignItems: "center" }}>
          <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800" }}>HearUs</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 6 }}>Create your mobile account</Text>
        </View>

        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.card,
            padding: 24,
            shadowColor: "#000000",
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 4,
          }}
        >
          <Text style={{ color: palette.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 }}>
            JOIN NOW
          </Text>
          <Text style={{ color: palette.text, fontSize: 30, fontWeight: "700", marginTop: 12 }}>
            Create your account
          </Text>
          <Text style={{ color: palette.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 22 }}>
            Set up your profile and start using the app.
          </Text>

          <View style={{ marginTop: 24, gap: 16 }}>
            <Field
              label="First name"
              value={form.first_name}
              onChangeText={(value) => setField("first_name", value)}
              placeholder={EXAMPLE_PROFILE.firstName}
            />
            <Field
              label="Last name"
              value={form.last_name}
              onChangeText={(value) => setField("last_name", value)}
              placeholder={EXAMPLE_PROFILE.lastName}
            />
            <Field
              label="Username"
              value={form.username}
              onChangeText={(value) => setField("username", value)}
              placeholder={EXAMPLE_PROFILE.username}
              autoCapitalize="none"
            />
            <Field
              label="Email"
              value={form.email}
              onChangeText={(value) => setField("email", value)}
              placeholder={EXAMPLE_PROFILE.email}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Birth date"
              value={form.birth_date}
              onChangeText={(value) => setField("birth_date", value)}
              placeholder={EXAMPLE_PROFILE.birthDate}
              autoCapitalize="none"
              helperText="Use YYYY-MM-DD format. You must be 18 or older to create an account."
            />
            <PasswordField
              label="Password"
              value={form.password}
              onChangeText={(value) => setField("password", value)}
              placeholder="Create a password"
              visible={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />
            <PasswordField
              label="Confirm password"
              value={form.password_confirmation}
              onChangeText={(value) => setField("password_confirmation", value)}
              placeholder="Repeat your password"
              visible={showPasswordConfirmation}
              onToggle={() => setShowPasswordConfirmation((current) => !current)}
            />
          </View>

          {error ? (
            <View
              style={{
                marginTop: 20,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: palette.errorBorder,
                backgroundColor: palette.errorBg,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: palette.errorText, fontSize: 14 }}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={{
              marginTop: 24,
              alignItems: "center",
              borderRadius: 14,
              backgroundColor: palette.accent,
              paddingHorizontal: 16,
              paddingVertical: 16,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={palette.accentText} />
            ) : (
              <Text style={{ color: palette.accentText, fontSize: 15, fontWeight: "700" }}>Create account</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push("/login")} style={{ marginTop: 20 }}>
            <Text style={{ color: palette.textSecondary, fontSize: 14, textAlign: "center" }}>
              Already have an account?{" "}
              <Text style={{ color: palette.accent, fontWeight: "700" }}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  helperText,
  ...props
}: {
  label: string;
  helperText?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
}) {
  return (
    <View>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: "600" }}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={palette.textMuted}
        style={{
          marginTop: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: palette.inputBorder,
          backgroundColor: palette.inputBg,
          color: palette.text,
          paddingHorizontal: 18,
          paddingVertical: 16,
          minHeight: 56,
          fontSize: 14,
          textAlignVertical: "center",
        }}
      />
      {helperText ? (
        <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: "600" }}>{label}</Text>
      <View
        style={{
          marginTop: 8,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: palette.inputBorder,
          backgroundColor: palette.inputBg,
          paddingHorizontal: 18,
          minHeight: 56,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          style={{
            flex: 1,
            color: palette.text,
            paddingVertical: 16,
            fontSize: 14,
            paddingRight: 12,
            textAlignVertical: "center",
          }}
        />
        <Pressable onPress={onToggle}>
          <Text style={{ color: palette.accent, fontSize: 12, fontWeight: "700" }}>
            {visible ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
