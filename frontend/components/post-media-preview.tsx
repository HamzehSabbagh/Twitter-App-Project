import { Ionicons } from "@expo/vector-icons";
import { Alert, Image, Linking, Pressable, Text, View } from "react-native";
import { useAppSettings } from "@/providers/app-settings-provider";

type PostMedia = {
  id: number;
  type: string;
  url: string;
  mime_type?: string | null;
};

export function PostMediaPreview({ media }: { media: PostMedia[] }) {
  const { colors } = useAppSettings();

  if (!media.length) {
    return null;
  }

  return (
    <View className="mt-4 gap-3">
      {media.slice(0, 2).map((item) => {
        if (item.type === "image") {
          return (
            <View
              key={item.id}
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
            >
              <Image
                source={{ uri: item.url }}
                className="h-72 w-full"
                resizeMode="contain"
              />
            </View>
          );
        }

        async function openMedia() {
          try {
            const supported = await Linking.canOpenURL(item.url);

            if (!supported) {
              Alert.alert("Media unavailable", "This file could not be opened on this device.");
              return;
            }

            await Linking.openURL(item.url);
          } catch {
            Alert.alert("Media unavailable", "This file could not be opened on this device.");
          }
        }

        return (
          <Pressable
            key={item.id}
            onPress={openMedia}
            className="flex-row items-center gap-3 rounded-2xl border px-4 py-4"
            style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
          >
            <Ionicons
              name={item.type === "video" ? "videocam-outline" : "musical-notes-outline"}
              size={20}
              color={colors.accentText}
            />
            <View className="flex-1">
              <Text className="text-sm font-semibold capitalize" style={{ color: colors.text }}>
                {item.type}
              </Text>
              <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                {item.mime_type || "Attachment available"}
              </Text>
              <Text className="mt-2 text-xs font-semibold" style={{ color: colors.accentText }}>
                {item.type === "video" ? "Open video" : "Open audio"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
