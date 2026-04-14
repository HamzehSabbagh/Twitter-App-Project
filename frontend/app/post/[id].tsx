import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { MentionInput } from "@/components/mention-input";
import { PostMediaPreview } from "@/components/post-media-preview";
import { RichContentText } from "@/components/rich-content-text";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type UserSummary = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  picture_url?: string | null;
};

type CommentItem = {
  id: number;
  content: string;
  created_at?: string | null;
  likes_count: number;
  liked_by_user: boolean;
  user: UserSummary;
  replies: CommentItem[];
};

type PostDetail = {
  id: number;
  content?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  reposted_by_user?: boolean;
  liked_by_user: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  user: UserSummary;
  media?: {
    id: number;
    type: string;
    url: string;
    mime_type?: string | null;
  }[];
  comments: CommentItem[];
};

function displayName(user: UserSummary) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || "Unknown user";
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch, token, user } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canEditPost =
    !!post && (post.can_edit || post.user.username === user?.username);
  const canDeletePost =
    !!post && (post.can_delete || post.user.username === user?.username);

  const loadPost = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${id}`);
      const data = await parseJsonResponse<{ post: PostDetail }>(response);
      setPost(data.post);
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : t("could_not_update_post", "Could not update post."));
    } finally {
      setLoading(false);
    }
  }, [authFetch, id, t]);

  useFocusEffect(
    useCallback(() => {
      loadPost();
    }, [loadPost])
  );

  async function toggleLike() {
    if (!post) {
      return;
    }

    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      router.push("/login");
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${post.id}/like`, {
        method: post.liked_by_user ? "DELETE" : "POST",
      });

      await parseJsonResponse(response);
      await loadPost();
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : t("update_failed", "Update failed"));
    }
  }

  function openRepostComposer() {
    if (!post) {
      return;
    }

    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      router.push("/login");
      return;
    }

    router.push({
      pathname: "/repost/[id]",
      params: { id: post.id.toString() },
    });
  }

  async function submitComment() {
    if (!post || !comment.trim()) {
      return;
    }

    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      router.push("/login");
      return;
    }

    setSubmitting(true);

    try {
      const response = await authFetch(`${API_BASE_URL}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: post.id,
          content: comment,
        }),
      });

      await parseJsonResponse(response);
      setComment("");
      await loadPost();
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : t("update_failed", "Update failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleCommentLike(commentItem: CommentItem) {
    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      router.push("/login");
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/comments/${commentItem.id}/like`, {
        method: commentItem.liked_by_user ? "DELETE" : "POST",
      });

      await parseJsonResponse(response);
      await loadPost();
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : t("update_failed", "Update failed"));
    }
  }

  function confirmDeletePost() {
    if (!post) {
      return;
    }

    Alert.alert(
      t("delete_post", "Delete post"),
      t("delete_post_irreversible", "Are you sure you want to delete this post? This cannot be undone."),
      [
        {
          text: t("cancel", "Cancel"),
          style: "cancel",
        },
        {
          text: t("delete_post", "Delete post"),
          style: "destructive",
          onPress: deletePost,
        },
      ]
    );
  }

  async function deletePost() {
    if (!post) {
      return;
    }

    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      router.push("/login");
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${post.id}`, {
        method: "DELETE",
      });

      await parseJsonResponse(response);
      router.replace("/");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("could_not_delete_post", "Could not delete post."));
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="border-b px-4 pb-4 pt-2" style={{ borderColor: colors.border }}>
        <Pressable onPress={() => router.back()} className="self-start rounded-xl border px-3 py-2" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text className="text-xs font-semibold" style={{ color: colors.text }}>{t("back_home", "Back to Home")}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!loading && post ? (
        <FlatList
          data={post.comments}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              <View className="rounded-[28px] border p-5" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                <Text className="text-2xl font-semibold" style={{ color: colors.text }}>{t("post_details", "Post details")}</Text>
                <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                  {t("post_details_description", "Review the full post and its conversation in one place.")}
                </Text>

                <View className="mt-5 rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
                  <Link
                    href={{
                      pathname: "/profile/[username]",
                      params: { username: post.user.username ?? "unknown" },
                    }}
                    asChild
                  >
                    <Pressable>
                      <Text className="text-base font-semibold" style={{ color: colors.text }}>
                        {displayName(post.user)}
                      </Text>
                    </Pressable>
                  </Link>
                  <Link
                    href={{
                      pathname: "/profile/[username]",
                      params: { username: post.user.username ?? "unknown" },
                    }}
                    asChild
                  >
                    <Pressable className="mt-1 self-start">
                      <Text className="text-sm" style={{ color: colors.textMuted }}>
                        @{post.user.username ?? "unknown"}
                      </Text>
                    </Pressable>
                  </Link>
                  <RichContentText
                    content={post.content}
                    fallback={t("no_text_content", "This post has no text content.")}
                    style={{ marginTop: 16, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
                  />

                  <PostMediaPreview media={post.media ?? []} />

                  <View className="mt-4 flex-row flex-wrap items-center gap-4">
                    <Pressable onPress={toggleLike} className="flex-row items-center gap-2 rounded-full px-3 py-2" style={{ backgroundColor: colors.surface }}>
                      <Ionicons
                        name={post.liked_by_user ? "heart" : "heart-outline"}
                        size={18}
                        color={post.liked_by_user ? "#F43F5E" : colors.textMuted}
                      />
                      <Text className="text-sm font-semibold" style={{ color: colors.text }}>{post.likes_count}</Text>
                    </Pressable>
                    <Pressable
                      onPress={openRepostComposer}
                      className="flex-row items-center gap-2 rounded-full px-3 py-2"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Ionicons
                        name="repeat-outline"
                        size={18}
                        color={post.reposted_by_user ? "#22C55E" : colors.textMuted}
                      />
                      <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                        {post.reposts_count ?? 0}
                      </Text>
                    </Pressable>
                    <Text className="text-sm" style={{ color: colors.textMuted }}>{post.comments_count} {t("comments", "comments")}</Text>
                    {canEditPost ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/edit-post/[id]",
                            params: { id: post.id.toString() },
                          })
                        }
                        className="rounded-full border px-4 py-2"
                        style={{ borderColor: colors.primary, backgroundColor: colors.primarySoft }}
                      >
                        <Text className="text-sm font-semibold" style={{ color: colors.accentText }}>{t("edit_post", "Edit post")}</Text>
                      </Pressable>
                    ) : null}
                    {canDeletePost ? (
                      <Pressable
                        onPress={confirmDeletePost}
                        className="rounded-full border px-4 py-2"
                        style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
                      >
                        <Text className="text-sm font-semibold" style={{ color: colors.dangerText }}>
                          {t("delete_post", "Delete post")}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>

              <View className="mt-5 rounded-[28px] border p-4" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
                <Text className="text-lg font-semibold" style={{ color: colors.text }}>{t("add_comment", "Add a comment")}</Text>
                <MentionInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t("write_reply", "Write a reply")}
                  minHeight={112}
                  textAlign={isRTL ? "right" : "left"}
                />
                <Pressable
                  onPress={submitComment}
                  disabled={submitting}
                  className="mt-4 self-start rounded-full px-5 py-3 disabled:opacity-60"
                  style={{ backgroundColor: colors.primary }}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>{t("post_comment", "Post comment")}</Text>
                  )}
                </Pressable>
              </View>

              <Text className="mb-3 mt-5 text-lg font-semibold" style={{ color: colors.text }}>{t("comments", "Comments")}</Text>

              {error ? (
                <View className="mb-4 rounded-2xl border px-4 py-3" style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}>
                  <Text className="text-sm" style={{ color: colors.dangerText }}>{error}</Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-4 rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Link
                href={{
                  pathname: "/profile/[username]",
                  params: { username: item.user.username ?? "unknown" },
                }}
                asChild
              >
                <Pressable className="max-w-[70%]">
                  <Text className="text-sm font-semibold" style={{ color: colors.text }} numberOfLines={1}>
                    {displayName(item.user)}
                  </Text>
                </Pressable>
              </Link>
              <Link
                href={{
                  pathname: "/profile/[username]",
                  params: { username: item.user.username ?? "unknown" },
                }}
                asChild
              >
                <Pressable className="mt-1 self-start">
                  <Text className="text-xs" style={{ color: colors.textMuted }}>@{item.user.username ?? "unknown"}</Text>
                </Pressable>
              </Link>
              <RichContentText
                content={item.content}
                style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14, lineHeight: 24 }}
              />
              <Pressable
                onPress={() => toggleCommentLike(item)}
                className="mt-3 flex-row items-center self-start rounded-full px-3 py-2"
                style={{ backgroundColor: colors.surfaceAlt }}
              >
                <Ionicons
                  name={item.liked_by_user ? "heart" : "heart-outline"}
                  size={16}
                  color={item.liked_by_user ? "#F43F5E" : colors.textMuted}
                />
                <Text
                  className={`ml-2 text-xs font-medium ${
                    item.liked_by_user ? "text-rose-400" : "text-slate-400"
                  }`}
                  style={!item.liked_by_user ? { color: colors.textMuted } : undefined}
                >
                  {item.likes_count} {t("likes", "likes")}
                </Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text className="text-sm" style={{ color: colors.textMuted }}>{t("no_comments_yet", "No comments yet. Start the conversation.")}</Text>}
        />
      ) : null}
    </SafeAreaView>
  );
}
