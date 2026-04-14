import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { PostMediaPreview } from "@/components/post-media-preview";
import { RichContentText } from "@/components/rich-content-text";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAppSettings } from "@/providers/app-settings-provider";
import { useAuth } from "@/providers/auth-provider";

type UserSummary = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  picture_url?: string | null;
};

type RepostDetail = {
  id: number;
  content?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  user?: UserSummary;
  original_post?: {
    id: number;
    content?: string | null;
    created_at?: string | null;
    user?: UserSummary;
    media?: {
      id: number;
      type: string;
      url: string;
      mime_type?: string | null;
    }[];
  } | null;
};

function displayName(user?: UserSummary) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || user?.username || "Unknown user";
}

export default function RepostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch } = useAuth();
  const { t, colors } = useAppSettings();
  const [repost, setRepost] = useState<RepostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRepost = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/reposts/${id}`);
      const data = await parseJsonResponse<{ repost: RepostDetail }>(response);
      setRepost(data.repost);
    } catch (repostError) {
      setError(
        repostError instanceof Error
          ? repostError.message
          : t("could_not_load_post", "Could not load post.")
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, id, t]);

  useFocusEffect(
    useCallback(() => {
      void loadRepost();
    }, [loadRepost])
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => "repost"}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
        ListHeaderComponent={
          <View>
            <Pressable
              onPress={() => router.back()}
              className="mb-4 self-start rounded-xl border px-3 py-2"
              style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
            >
              <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                {t("back", "Back")}
              </Text>
            </Pressable>

            {loading ? (
              <View className="mt-8 items-center py-8">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}

            {!loading && repost ? (
              <View className="rounded-[28px] border p-5" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                <Text className="text-2xl font-semibold" style={{ color: colors.text }}>
                  {t("repost", "Repost")}
                </Text>
                <Text className="mt-2 text-sm" style={{ color: colors.textMuted }}>
                  {repost.created_at ?? ""}
                </Text>

                <View className="mt-5 rounded-2xl border p-4" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                  <Link
                    href={{
                      pathname: "/profile/[username]",
                      params: { username: repost.user?.username ?? "unknown" },
                    }}
                    asChild
                  >
                    <Pressable className="self-start">
                      <Text className="text-base font-semibold" style={{ color: colors.text }}>
                        {displayName(repost.user)}
                      </Text>
                    </Pressable>
                  </Link>
                  <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                    @{repost.user?.username ?? "unknown"}
                  </Text>

                  <RichContentText
                    content={repost.content}
                    fallback={t("shared_post_without_comment", "Shared a post")}
                    style={{ marginTop: 16, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
                  />

                  {repost.original_post ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/post/[id]",
                          params: { id: repost.original_post?.id.toString() ?? "0" },
                        })
                      }
                      className="mt-4 rounded-2xl border p-4"
                      style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
                    >
                      <View className="flex-row">
                        <View className="mr-3 h-10 w-10 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                          <Image
                            source={getProfileImageSource(repost.original_post.user?.picture_url)}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                            {displayName(repost.original_post.user)}
                          </Text>
                          <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                            @{repost.original_post.user?.username ?? "unknown"}
                          </Text>
                          <RichContentText
                            content={repost.original_post.content}
                            fallback={t("media_only_post", "Media-only post")}
                            style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}
                          />
                          <PostMediaPreview media={repost.original_post.media ?? []} />
                        </View>
                      </View>
                    </Pressable>
                  ) : null}

                  <View className="mt-4 flex-row flex-wrap gap-4">
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {repost.likes_count} {t("likes", "likes")}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {repost.comments_count} {t("comments", "comments")}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {repost.reposts_count} {t("reposts", "reposts")}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {!loading && error ? (
              <View
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
              >
                <Text className="text-sm" style={{ color: colors.dangerText }}>
                  {error}
                </Text>
              </View>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}
