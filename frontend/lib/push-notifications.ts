import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { API_BASE_URL } from "@/lib/api";

export const PUSH_TOKEN_KEY = "expo_push_token";

export function getPushProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    console.warn("Remote push notification registration is unavailable in Expo Go. Use a development build.");
    return null;
  }

  if (Device.osName === "Android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#06B6D4",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = getPushProjectId();

  if (!projectId) {
    console.warn(
      "Push notifications require an EAS project ID. Set EXPO_PUBLIC_EAS_PROJECT_ID or use a dev build that provides one."
    );
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function unregisterStoredPushToken(authToken?: string | null) {
  const storedPushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

  if (!storedPushToken) {
    return;
  }

  try {
    await fetch(`${API_BASE_URL}/push-tokens`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        token: storedPushToken,
      }),
    });
  } catch (error) {
    console.warn("Could not unregister push token", error);
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}
