import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MentionInput } from "@/components/mention-input";
import { PostMediaPreview } from "@/components/post-media-preview";
import { RichContentText } from "@/components/rich-content-text";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type UserSummary = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

type RepostPostDetail = {
  id: number;
  content?: string | null;
  created_at?: string | null;
  reposted_by_user?: boolean;
  user: UserSummary;
  media?: {
    id: number;
    type: string;
    url: string;
    mime_type?: string | null;
  }[];
};

function displayName(user: UserSummary) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || "Unknown user";
}

export default function RepostComposerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch, token } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [post, setPost] = useState<RepostPostDetail | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPost() {
      if (!id) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await authFetch(`${API_BASE_URL}/posts/${id}`);
        const data = await parseJsonResponse<{ post: RepostPostDetail }>(response);
        setPost(data.post);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("could_not_load_post", "Could not load post.")
        );
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [authFetch, id, t]);

  async function submitRepost() {
    if (!post) {
      return;
    }

    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      router.push("/login");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${post.id}/repost`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: comment.trim() || null,
        }),
      });

      await parseJsonResponse(response);
      Alert.alert(
        t("repost_created", "Repost created"),
        t("repost_created_success", "Your repost was shared successfully.")
      );
      router.back();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : t("could_not_repost", "Could not repost this post.");
      setError(message);
    } finally {
      setProcessing(false);
    }
  }

  async function removeRepost() {
    if (!post) {
      return;
    }

    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      router.push("/login");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${post.id}/repost`, {
        method: "DELETE",
      });

      await parseJsonResponse(response);
      Alert.alert(
        t("repost_removed", "Repost removed"),
        t("repost_removed_success", "Your repost was removed.")
      );
      router.back();
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : t("could_not_remove_repost", "Could not remove repost.");
      setError(message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="mb-4 self-start rounded-xl border px-3 py-2"
            style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
          >
            <Text className="text-xs font-semibold" style={{ color: colors.text }}>
              {t("back_home", "Back to Home")}
            </Text>
          </Pressable>

          <View
            className="rounded-[28px] border p-5"
            style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
          >
            <Text className="text-2xl font-semibold" style={{ color: colors.text }}>
              {t("quote_repost", "Quote repost")}
            </Text>
            <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
              {t(
                "quote_repost_description",
                "Add your own comment, then share the original post underneath like a Twitter quote repost."
              )}
            </Text>
          </View>

          {loading ? (
            <View className="mt-6 items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          {!loading && post ? (
            <>
              <View
                className="mt-5 rounded-[28px] border p-4"
                style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
              >
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("your_comment", "Your comment")}
                </Text>

                <MentionInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t("add_comment_before_repost", "Add a comment before reposting")}
                  minHeight={150}
                  textAlign={isRTL ? "right" : "left"}
                />

                {error ? (
                  <View
                    className="mt-4 rounded-2xl border px-4 py-3"
                    style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
                  >
                    <Text className="text-sm" style={{ color: colors.dangerText }}>
                      {error}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-5 flex-row flex-wrap gap-3">
                  <Pressable
                    onPress={submitRepost}
                    disabled={processing}
                    className="rounded-full px-5 py-3 disabled:opacity-60"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {processing ? (
                      <ActivityIndicator color={colors.primaryText} />
                    ) : (
                      <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>
                        {t("repost", "Repost")}
                      </Text>
                    )}
                  </Pressable>

                  {post.reposted_by_user ? (
                    <Pressable
                      onPress={removeRepost}
                      disabled={processing}
                      className="rounded-full border px-5 py-3 disabled:opacity-60"
                      style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
                    >
                      <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                        {t("remove_repost", "Remove repost")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View
                className="mt-5 rounded-[28px] border p-4"
                style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
              >
                <View className="flex-row items-center">
                  <Ionicons name="repeat-outline" size={18} color={colors.accentText} />
                  <Text className="ml-2 text-sm font-medium" style={{ color: colors.accentText }}>
                    {t("original_post", "Original post")}
                  </Text>
                </View>

                <View
                  className="mt-4 rounded-2xl border p-4"
                  style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
                >
                  <Text className="text-base font-semibold" style={{ color: colors.text }}>
                    {displayName(post.user)}
                  </Text>
                  <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                    @{post.user.username ?? "unknown"}
                  </Text>

                  <RichContentText
                    content={post.content}
                    fallback={t("media_only_post", "Media-only post")}
                    style={{ marginTop: 14, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
                  />

                  <PostMediaPreview media={post.media ?? []} />

                  <Text className="mt-3 text-xs" style={{ color: colors.textMuted }}>
                    {post.created_at ?? t("unknown_date", "Unknown date")}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
