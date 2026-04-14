import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type MessageParticipant = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  picture_url?: string | null;
};

type MessageItem = {
  id: number;
  content: string;
  created_at?: string | null;
  user?: MessageParticipant | null;
};

type ConversationResponse = {
  participant: MessageParticipant;
  can_message: boolean;
  messages: MessageItem[];
};

function getDisplayName(participant?: MessageParticipant | null) {
  const fullName = [participant?.first_name, participant?.last_name].filter(Boolean).join(" ").trim();
  return fullName || participant?.username || "Unknown user";
}

export default function MessageThreadScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { authFetch, token, user } = useAuth();
  const { t, colors, isRTL } = useAppSettings();
  const [participant, setParticipant] = useState<MessageParticipant | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [content, setContent] = useState("");
  const [canMessage, setCanMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadConversation = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!username) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/messages/with/${username}`);
      const data = await parseJsonResponse<ConversationResponse>(response);
      setParticipant(data.participant);
      setCanMessage(data.can_message);
      setMessages(data.messages);
    } catch (conversationError) {
      setError(
        conversationError instanceof Error
          ? conversationError.message
          : t("could_not_load_conversation", "Could not load conversation.")
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, router, t, token, username]);

  useFocusEffect(
    useCallback(() => {
      void loadConversation();
    }, [loadConversation])
  );

  async function sendMessage() {
    if (!content.trim() || !username) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/messages/with/${username}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await parseJsonResponse<{ message: MessageItem }>(response);
      setMessages((currentMessages) => [...currentMessages, data.message]);
      setContent("");
    } catch (messageError) {
      setError(
        messageError instanceof Error
          ? messageError.message
          : t("could_not_send_message", "Could not send message.")
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={24}
      >
        <View className="border-b px-4 pb-4 pt-2" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
          <Pressable
            onPress={() => router.back()}
            className="self-start rounded-xl border px-3 py-2"
            style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
          >
            <Text className="text-xs font-semibold" style={{ color: colors.text }}>
              {t("back", "Back")}
            </Text>
          </Pressable>

          <View className="mt-4 flex-row items-center gap-3">
            <View className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
              <Image
                source={getProfileImageSource(participant?.picture_url)}
                className="h-12 w-12"
                resizeMode="cover"
              />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                {getDisplayName(participant)}
              </Text>
              <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                @{participant?.username ?? username ?? "unknown"}
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              renderItem={({ item }) => {
                const isMine = item.user?.id === user?.id;

                return (
                  <View className={`mb-3 ${isMine ? "items-end" : "items-start"}`}>
                    <View
                      className="max-w-[82%] rounded-3xl px-4 py-3"
                      style={{
                        backgroundColor: isMine ? colors.primary : colors.surface,
                        borderWidth: isMine ? 0 : 1,
                        borderColor: isMine ? "transparent" : colors.border,
                      }}
                    >
                      <Text style={{ color: isMine ? colors.primaryText : colors.textSecondary }}>
                        {item.content}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="rounded-2xl border border-dashed px-4 py-8" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                  <Text className="text-sm" style={{ color: colors.textMuted }}>
                    {t("start_direct_message", "Start the conversation with your first message.")}
                  </Text>
                </View>
              }
            />

            {error ? (
              <View
                className="mx-4 mb-3 rounded-2xl border px-4 py-3"
                style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
              >
                <Text className="text-sm" style={{ color: colors.dangerText }}>
                  {error}
                </Text>
              </View>
            ) : null}

            {canMessage ? (
              <View className="border-t px-4 py-3" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                <View className="flex-row items-center gap-3 rounded-3xl border px-4 py-2" style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
                  <TextInput
                    value={content}
                    onChangeText={setContent}
                    placeholder={t("write_message", "Write a message")}
                    placeholderTextColor={colors.textMuted}
                    className="flex-1 py-2 text-sm"
                    style={{ color: colors.text }}
                    textAlign={isRTL ? "right" : "left"}
                    multiline
                  />
                  <Pressable
                    onPress={sendMessage}
                    disabled={sending || !content.trim()}
                    className="rounded-full px-4 py-2 disabled:opacity-60"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {sending ? (
                      <ActivityIndicator color={colors.primaryText} />
                    ) : (
                      <Text className="text-xs font-semibold" style={{ color: colors.primaryText }}>
                        {t("send", "Send")}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="border-t px-4 py-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                <Text className="text-sm" style={{ color: colors.textMuted }}>
                  {t("dm_requires_follow", "You can only send direct messages when one of you follows the other.")}
                </Text>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
