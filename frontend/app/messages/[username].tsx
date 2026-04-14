import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

type NotificationsResponse = {
  notifications: {
    id: string;
    read_at?: string | null;
  }[];
  unread_count: number;
};

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#020617" }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(244,63,94,0.30)",
            backgroundColor: "#0F172A",
            padding: 24,
          }}
        >
          <Text style={{ color: "#FDA4AF", fontSize: 24, fontWeight: "700" }}>Conversation Screen Error</Text>
          <Text style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 22, marginTop: 12 }}>{error.message}</Text>
          <Pressable
            onPress={retry}
            style={{
              marginTop: 20,
              borderRadius: 14,
              backgroundColor: "#22D3EE",
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: "#082F49", fontSize: 15, fontWeight: "700", textAlign: "center" }}>Retry</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function getDisplayName(participant?: MessageParticipant | null) {
  const fullName = [participant?.first_name, participant?.last_name].filter(Boolean).join(" ").trim();
  return fullName || participant?.username || "Unknown user";
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : count.toString();
}

export default function MessageThreadScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { authFetch, token, user, signOut } = useAuth();
  const { t, colors, isRTL } = useAppSettings();
  const insets = useSafeAreaInsets();
  const messagesListRef = useRef<FlatList<MessageItem> | null>(null);
  const [participant, setParticipant] = useState<MessageParticipant | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [content, setContent] = useState("");
  const [canMessage, setCanMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/notifications`);
      const data = await parseJsonResponse<NotificationsResponse>(response);
      setUnreadCount(data.unread_count);
    } catch {
      setUnreadCount(0);
    }
  }, [authFetch, user]);

  useFocusEffect(
    useCallback(() => {
      void loadUnreadCount();
    }, [loadUnreadCount])
  );

  const scrollToLatestMessage = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (loading || messages.length === 0) {
      return;
    }

    scrollToLatestMessage(false);
  }, [loading, messages.length, scrollToLatestMessage]);

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
      scrollToLatestMessage();
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

  const messageListEmpty = !loading && messages.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {accountMenuOpen ? (
        <Pressable
          onPress={() => setAccountMenuOpen(false)}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 }}
        />
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            zIndex: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {user ? (
              <Link
                href={{
                  pathname: "/profile/[username]",
                  params: { username: user.username },
                }}
                asChild
              >
                <Pressable
                  style={{
                    overflow: "hidden",
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.borderSoft,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Image source={getProfileImageSource(user.picture_url)} style={{ width: 40, height: 40 }} resizeMode="cover" />
                </Pressable>
              </Link>
            ) : (
              <View
                style={{
                  overflow: "hidden",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Image source={getProfileImageSource()} style={{ width: 40, height: 40 }} resizeMode="cover" />
              </View>
            )}

            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{t("app_name", "HearUs")}</Text>

            {user ? (
              <View style={{ position: "relative" }}>
                <Pressable
                  onPress={() => setAccountMenuOpen((current) => !current)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.borderSoft,
                    backgroundColor: colors.surfaceAlt,
                    padding: 8,
                  }}
                >
                  <Ionicons
                    name={accountMenuOpen ? "close-outline" : "ellipsis-horizontal"}
                    size={22}
                    color={colors.accentText}
                  />
                </Pressable>

                {accountMenuOpen ? (
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 56,
                      width: 176,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.borderSoft,
                      backgroundColor: colors.surface,
                      padding: 8,
                      zIndex: 30,
                      elevation: 8,
                    }}
                  >
                    <Link href="/notifications" asChild>
                      <Pressable
                        onPress={() => setAccountMenuOpen(false)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Ionicons name="notifications-outline" size={18} color={colors.text} />
                          <Text style={{ marginLeft: 12, color: colors.text, fontSize: 14, fontWeight: "500" }}>
                            {t("notifications", "Notifications")}
                          </Text>
                        </View>
                        {unreadCount > 0 ? (
                          <View
                            style={{
                              borderRadius: 999,
                              backgroundColor: colors.primary,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Text style={{ color: colors.primaryText, fontSize: 10, fontWeight: "700" }}>
                              {formatUnreadCount(unreadCount)}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    </Link>

                    <Link href="/settings" asChild>
                      <Pressable
                        onPress={() => setAccountMenuOpen(false)}
                        style={{
                          marginTop: 4,
                          flexDirection: "row",
                          alignItems: "center",
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                        }}
                      >
                        <Ionicons name="settings-outline" size={18} color={colors.text} />
                        <Text style={{ marginLeft: 12, color: colors.text, fontSize: 14, fontWeight: "500" }}>
                          {t("settings", "Settings")}
                        </Text>
                      </Pressable>
                    </Link>

                    <Pressable
                      onPress={async () => {
                        setAccountMenuOpen(false);
                        await signOut();
                        router.replace("/login");
                      }}
                      style={{
                        marginTop: 4,
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 12,
                        backgroundColor: colors.dangerBg,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                      }}
                    >
                      <Ionicons name="log-out-outline" size={18} color={colors.dangerText} />
                      <Text style={{ marginLeft: 12, color: colors.dangerText, fontSize: 14, fontWeight: "500" }}>
                        {t("logout", "Log out")}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <Ionicons name="sparkles-outline" size={22} color={colors.accentText} />
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
          <View
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.borderSoft,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={() => router.back()}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                  backgroundColor: colors.surfaceAlt,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{t("back", "Back")}</Text>
              </Pressable>

              <View
                style={{
                  marginLeft: 12,
                  overflow: "hidden",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Image source={getProfileImageSource(participant?.picture_url)} style={{ width: 48, height: 48 }} resizeMode="cover" />
              </View>

              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{getDisplayName(participant)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
                  @{participant?.username ?? username ?? "unknown"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {error && !loading ? (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
              backgroundColor: colors.dangerBg,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: colors.dangerText, fontSize: 14 }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View
            style={{
              flex: 1,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.borderSoft,
              backgroundColor: colors.surface,
              overflow: "hidden",
            }}
          >
            {loading ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                ref={messagesListRef}
                data={messages}
                keyExtractor={(item) => item.id.toString()}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: messageListEmpty ? "center" : "flex-start",
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  paddingBottom: 20,
                }}
                onContentSizeChange={() => {
                  if (!messageListEmpty) {
                    scrollToLatestMessage(false);
                  }
                }}
                renderItem={({ item }) => {
                  const isMine = item.user?.id === user?.id;

                  return (
                    <View
                      style={{
                        marginBottom: 12,
                        alignItems: isMine ? "flex-end" : "flex-start",
                      }}
                    >
                      <View
                        style={{
                          maxWidth: "82%",
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: isMine ? colors.primary : colors.border,
                          backgroundColor: isMine ? colors.primary : colors.surfaceAlt,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                        }}
                      >
                        <Text style={{ color: isMine ? colors.primaryText : colors.text, fontSize: 14, lineHeight: 20 }}>
                          {item.content}
                        </Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      paddingHorizontal: 16,
                      paddingVertical: 28,
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
                      {t("start_direct_message", "Start the conversation with your first message.")}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>

        {canMessage ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <TextInput
                value={content}
                onChangeText={setContent}
                onFocus={() => scrollToLatestMessage()}
                placeholder={t("write_message", "Write a message")}
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 14,
                  maxHeight: 120,
                  paddingVertical: 8,
                  paddingRight: 12,
                  textAlignVertical: "top",
                }}
                textAlign={isRTL ? "right" : "left"}
                multiline
              />

              <Pressable
                onPress={sendMessage}
                disabled={sending || !content.trim()}
                style={{
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  opacity: sending || !content.trim() ? 0.6 : 1,
                }}
              >
                {sending ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>{t("send", "Send")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {t("dm_requires_follow", "You can only send direct messages when one of you follows the other.")}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
