import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type ConversationListItem = {
  id: number;
  participant?: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    picture_url?: string | null;
  } | null;
  latest_message?: {
    id: number;
    content: string;
    created_at?: string | null;
    is_from_me: boolean;
  } | null;
  unread_count: number;
};

type ConversationsResponse = {
  conversations: ConversationListItem[];
};

type NotificationsResponse = {
  notifications: {
    id: string;
    read_at?: string | null;
  }[];
  unread_count: number;
};

function getDisplayName(participant?: ConversationListItem["participant"]) {
  const fullName = [participant?.first_name, participant?.last_name].filter(Boolean).join(" ").trim();
  return fullName || participant?.username || "Unknown user";
}

export default function MessagesScreen() {
  const { authFetch, token, signOut, user } = useAuth();
  const { t, colors } = useAppSettings();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadConversations = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/messages/conversations`);
      const data = await parseJsonResponse<ConversationsResponse>(response);
      setConversations(data.conversations);
    } catch (messageError) {
      setError(
        messageError instanceof Error
          ? messageError.message
          : t("could_not_load_messages", "Could not load conversations.")
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, t, token]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
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

  function formatUnreadCount(count: number) {
    return count > 99 ? "99+" : count.toString();
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {accountMenuOpen ? (
        <Pressable
          onPress={() => setAccountMenuOpen(false)}
          className="absolute inset-0"
          style={{ zIndex: 10 }}
        />
      ) : null}

      <View
        className="border-b px-4 pb-3 pt-2"
        style={{ borderColor: colors.border, backgroundColor: colors.surface, zIndex: 20 }}
      >
        <View className="flex-row items-center justify-between">
          {user ? (
            <Link
              href={{
                pathname: "/profile/[username]",
                params: { username: user.username },
              }}
              asChild
            >
              <Pressable className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                <Image
                  source={getProfileImageSource(user.picture_url)}
                  className="h-10 w-10"
                  resizeMode="cover"
                />
              </Pressable>
            </Link>
          ) : (
            <View className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
              <Image source={getProfileImageSource()} className="h-10 w-10" resizeMode="cover" />
            </View>
          )}
          <Text className="text-2xl font-black" style={{ color: colors.text }}>{t("app_name", "HearUs")}</Text>
          {user ? (
            <View style={{ position: "relative" }}>
              <Pressable
                onPress={() => setAccountMenuOpen((current) => !current)}
                className="rounded-full border p-2"
                style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
              >
                <Ionicons
                  name={accountMenuOpen ? "close-outline" : "ellipsis-horizontal"}
                  size={22}
                  color={colors.accentText}
                />
              </Pressable>

              {accountMenuOpen ? (
                <View
                  className="absolute right-0 top-14 w-44 rounded-2xl border p-2"
                  style={{
                    borderColor: colors.borderSoft,
                    backgroundColor: colors.surface,
                    zIndex: 30,
                    elevation: 8,
                  }}
                >
                  <Link href="/notifications" asChild>
                    <Pressable
                      onPress={() => setAccountMenuOpen(false)}
                      className="flex-row items-center justify-between rounded-xl px-3 py-3"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <View className="flex-row items-center">
                        <Ionicons name="notifications-outline" size={18} color={colors.text} />
                        <Text className="ml-3 text-sm font-medium" style={{ color: colors.text }}>
                          {t("notifications", "Notifications")}
                        </Text>
                      </View>
                      {unreadCount > 0 ? (
                        <View className="rounded-full px-2 py-1" style={{ backgroundColor: colors.primary }}>
                          <Text className="text-[10px] font-bold" style={{ color: colors.primaryText }}>
                            {formatUnreadCount(unreadCount)}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  </Link>

                  <Link href="/settings" asChild>
                    <Pressable
                      onPress={() => setAccountMenuOpen(false)}
                      className="mt-1 flex-row items-center rounded-xl px-3 py-3"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Ionicons name="settings-outline" size={18} color={colors.text} />
                      <Text className="ml-3 text-sm font-medium" style={{ color: colors.text }}>
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
                    className="mt-1 flex-row items-center rounded-xl px-3 py-3"
                    style={{ backgroundColor: colors.dangerBg }}
                  >
                    <Ionicons name="log-out-outline" size={18} color={colors.dangerText} />
                    <Text className="ml-3 text-sm font-medium" style={{ color: colors.dangerText }}>
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

        <View className="mt-5 flex-row rounded-2xl border p-1" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
          <Link href="/" asChild>
            <Pressable className="flex-1 items-center justify-center rounded-xl py-3">
              <Text className="text-base" style={{ color: colors.textMuted }}>{t("timeline", "Timeline")}</Text>
            </Pressable>
          </Link>
          <Link href="/explore" asChild>
            <Pressable className="flex-1 items-center justify-center rounded-xl py-3">
              <Text className="text-base" style={{ color: colors.textMuted }}>{t("discover", "Discover")}</Text>
            </Pressable>
          </Link>
          <View className="flex-1 items-center rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
            <Text className="text-base font-semibold" style={{ color: colors.primaryText }}>{t("messages", "Messages")}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="px-4 pb-4 pt-2">
            <View className="rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
              <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
                {t("messages", "Messages")}
              </Text>
              <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>
                {t("direct_messages_title", "Direct messages")}
              </Text>
              <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                {t("direct_messages_description", "See conversations with people you can message and jump back into the thread instantly.")}
              </Text>
            </View>

            {loading ? (
              <View className="mt-5 items-center py-6">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}

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
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/messages/[username]",
                params: { username: item.participant?.username ?? "unknown" },
              })
            }
            className="mx-4 mb-4 rounded-[28px] border p-4"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <View className="flex-row items-center gap-3">
              <View className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                <Image
                  source={getProfileImageSource(item.participant?.picture_url)}
                  className="h-12 w-12"
                  resizeMode="cover"
                />
              </View>

              <View className="flex-1">
                <Text className="text-base font-semibold" style={{ color: colors.text }}>
                  {getDisplayName(item.participant)}
                </Text>
                <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                  @{item.participant?.username ?? "unknown"}
                </Text>
                <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }} numberOfLines={2}>
                  {item.latest_message
                    ? `${item.latest_message.is_from_me ? `${t("you", "You")}: ` : ""}${item.latest_message.content}`
                    : t("no_messages_yet", "No messages yet.")}
                </Text>
              </View>

              {item.unread_count > 0 ? (
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: colors.primary }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.primaryText }}>
                    {item.unread_count > 99 ? "99+" : item.unread_count}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <View className="mx-4 rounded-2xl border border-dashed px-4 py-8" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {t("no_conversations_yet", "No conversations yet. Follow someone or wait until a thread starts.")}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
