import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type NotificationActor = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  picture_url?: string | null;
};

type NotificationTarget = {
  id?: number;
  username?: string | null;
};

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  actor?: NotificationActor | null;
  post?: NotificationTarget | null;
  comment?: NotificationTarget | null;
  profile?: NotificationTarget | null;
  read_at?: string | null;
  created_at?: string | null;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  unread_count: number;
};

function displayName(actor?: NotificationActor | null) {
  const fullName = [actor?.first_name, actor?.last_name].filter(Boolean).join(" ").trim();
  return fullName || actor?.username || "Someone";
}

function formatTime(timestamp?: string | null) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

export default function NotificationsScreen() {
  const { authFetch, token } = useAuth();
  const { t, colors } = useAppSettings();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const hasUnread = unreadCount > 0;

  const loadNotifications = useCallback(async () => {
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/notifications`);
      const data = await parseJsonResponse<NotificationsResponse>(response);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (notificationError) {
      setError(
        notificationError instanceof Error
          ? notificationError.message
          : t("notifications", "Notifications")
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, t, token]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  async function markAllRead() {
    if (!hasUnread) {
      return;
    }

    setProcessing(true);

    try {
      const response = await authFetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "POST",
      });

      await parseJsonResponse(response);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : t("mark_all_read", "Mark all read"));
    } finally {
      setProcessing(false);
    }
  }

  function openNotification(notification: NotificationItem) {
    if (notification.post?.id) {
      router.push({
        pathname: "/post/[id]",
        params: { id: notification.post.id.toString() },
      });
      return;
    }

    const username = notification.profile?.username || notification.actor?.username;

    if (username) {
      router.push({
        pathname: "/profile/[username]",
        params: { username },
      });
    }
  }

  const headerBadge = useMemo(() => {
    if (!hasUnread) {
      return null;
    }

    return (
      <View className="rounded-full px-3 py-1" style={{ backgroundColor: colors.primarySoft }}>
        <Text className="text-xs font-semibold" style={{ color: colors.accentText }}>
          {unreadCount} {t("unread", "unread")}
        </Text>
      </View>
    );
  }, [colors.accentText, colors.primarySoft, hasUnread, t, unreadCount]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="px-4 pb-4 pt-2">
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => router.back()}
                className="rounded-xl border px-3 py-2"
                style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
              >
                <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                  {t("back", "Back")}
                </Text>
              </Pressable>

              <Pressable
                onPress={markAllRead}
                disabled={!hasUnread || processing}
                className="rounded-xl border px-3 py-2 disabled:opacity-60"
                style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
              >
                <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                  {processing ? t("loading", "Loading...") : t("mark_all_read", "Mark all read")}
                </Text>
              </Pressable>
            </View>

            <View className="mt-4 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
                    {t("notifications", "Notifications")}
                  </Text>
                  <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>
                    {t("notifications_title", "Your activity inbox")}
                  </Text>
                  <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                    {t("notifications_description", "Follow events, likes, replies, reposts, and mentions all land here.")}
                  </Text>
                </View>
                {headerBadge}
              </View>
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
            onPress={() => openNotification(item)}
            className="mx-4 mb-4 rounded-[28px] border p-4"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <View className="flex-row items-start gap-3">
              <View className="relative">
                <View className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                  <Image
                    source={getProfileImageSource(item.actor?.picture_url)}
                    className="h-11 w-11"
                    resizeMode="cover"
                  />
                </View>
                {!item.read_at ? (
                  <View
                    className="absolute -right-1 -top-1 h-3 w-3 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                  />
                ) : null}
              </View>

              <View className="flex-1">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                  {displayName(item.actor)}
                </Text>
                {item.actor?.username ? (
                  <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                    @{item.actor.username}
                  </Text>
                ) : null}
                <Text className="mt-3 text-sm leading-6" style={{ color: colors.textSecondary }}>
                  {item.message}
                </Text>
                <Text className="mt-2 text-xs" style={{ color: colors.textMuted }}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <View className="mx-4 rounded-2xl border border-dashed px-4 py-8" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {t("no_notifications_yet", "No notifications yet.")}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
