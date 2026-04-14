import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { RichContentText } from "@/components/rich-content-text";
import { useAppSettings } from "@/providers/app-settings-provider";

type CommentPreview = {
  id: number;
  content: string;
  likes_count: number;
  liked_by_user: boolean;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
  };
};

type CommentPreviewListProps = {
  comments: CommentPreview[];
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onChanged: () => Promise<void> | void;
  onRequireLogin?: () => void;
};

function displayName(comment: CommentPreview) {
  const fullName = [comment.user?.first_name, comment.user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || comment.user?.username || "Unknown user";
}

export function CommentPreviewList({
  comments,
  authFetch,
  onChanged,
  onRequireLogin,
}: CommentPreviewListProps) {
  const { colors } = useAppSettings();

  if (!comments.length) {
    return null;
  }

  async function toggleLike(comment: CommentPreview) {
    try {
      const response = await authFetch(`${API_BASE_URL}/comments/${comment.id}/like`, {
        method: comment.liked_by_user ? "DELETE" : "POST",
      });

      await parseJsonResponse(response);
      await onChanged();
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("unauth")) {
        onRequireLogin?.();
        return;
      }

      onRequireLogin?.();
    }
  }

  return (
    <View className="mt-4 gap-3">
      {comments.map((comment) => (
        <View
          key={comment.id}
          className="rounded-2xl border px-3 py-3"
          style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
        >
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/profile/[username]",
                params: { username: comment.user?.username ?? "unknown" },
              })
            }
          >
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>
              {displayName(comment)}
            </Text>
            <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
              @{comment.user?.username ?? "unknown"}
            </Text>
          </Pressable>

          <RichContentText
            content={comment.content}
            style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14, lineHeight: 24 }}
          />

          <Pressable
            onPress={() => toggleLike(comment)}
            className="mt-3 flex-row items-center self-start rounded-full px-3 py-2"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons
              name={comment.liked_by_user ? "heart" : "heart-outline"}
              size={16}
              color={comment.liked_by_user ? "#F43F5E" : colors.textMuted}
            />
            <Text
              className="ml-2 text-xs font-semibold"
              style={{ color: comment.liked_by_user ? "#F43F5E" : colors.text }}
            >
              {comment.likes_count}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
