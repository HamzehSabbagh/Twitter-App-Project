import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { ReactNode, useEffect } from "react";
import { Platform } from "react-native";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import {
  isTemporaryExpoPushTokenError,
  PUSH_TOKEN_KEY,
  registerForPushNotificationsAsync,
} from "@/lib/push-notifications";
import { useAuth } from "@/providers/auth-provider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { authFetch, token, user } = useAuth();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        post_id?: number | string;
        username?: string;
      };

      if (data?.post_id) {
        router.push({
          pathname: "/post/[id]",
          params: { id: String(data.post_id) },
        });
        return;
      }

      if (data?.username) {
        router.push({
          pathname: "/profile/[username]",
          params: { username: data.username },
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    async function syncPushToken() {
      try {
        const expoPushToken = await registerForPushNotificationsAsync();

        if (!expoPushToken || cancelled) {
          return;
        }

        const response = await authFetch(`${API_BASE_URL}/push-tokens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: expoPushToken,
            platform: Platform.OS,
          }),
        });

        await parseJsonResponse(response);
        const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

        if (previousToken !== expoPushToken) {
          await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
        }
      } catch (error) {
        if (isTemporaryExpoPushTokenError(error)) {
          console.info("Push registration will retry because Expo's token service is temporarily unavailable.");

          if (!cancelled) {
            retryTimeout = setTimeout(() => {
              void syncPushToken();
            }, 30000);
          }

          return;
        }

        console.warn("Could not register push notifications", error);
      }
    }

    void syncPushToken();

    return () => {
      cancelled = true;

      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [authFetch, token, user]);

  return <>{children}</>;
}
