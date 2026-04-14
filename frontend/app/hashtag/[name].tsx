import { useFocusEffect } from "@react-navigation/native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { PostMediaPreview } from "@/components/post-media-preview";
import { RichContentText } from "@/components/rich-content-text";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type HashtagPost = {
  id: number;
  content?: string | null;
  created_at?: string | null;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    picture_url?: string | null;
  };
  hashtags?: {
    id: number;
    name: string;
  }[];
  media?: {
    id: number;
    type: string;
    url: string;
    mime_type?: string | null;
  }[];
};

type HashtagResponse = {
  hashtag: {
    id: number;
    name: string;
    posts_count: number;
  };
  posts: HashtagPost[];
};

function getDisplayName(post: HashtagPost) {
  const fullName = [post.user?.first_name, post.user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || post.user?.username || "Unknown user";
}

export default function HashtagScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string | string[] }>();
  const { authFetch } = useAuth();
  const { t, colors } = useAppSettings();
  const [data, setData] = useState<HashtagResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const hashtagName = useMemo(() => {
    const rawName = Array.isArray(name) ? name[0] : name;
    return (rawName ?? "").replace(/^#/, "");
  }, [name]);

  const loadHashtag = useCallback(async () => {
    if (!hashtagName) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/hashtags/${encodeURIComponent(hashtagName)}`);
      const nextData = await parseJsonResponse<HashtagResponse>(response);
      setData(nextData);
    } catch (hashtagError) {
      setError(
        hashtagError instanceof Error
          ? hashtagError.message
          : t("could_not_load_hashtag", "Could not load this hashtag.")
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, hashtagName, t]);

  useFocusEffect(
    useCallback(() => {
      loadHashtag();
    }, [loadHashtag])
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <FlatList
        data={data?.posts ?? []}
        keyExtractor={(item) => item.id.toString()}
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

              <Link href="/explore" asChild>
                <Pressable className="rounded-xl border px-3 py-2" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                    {t("discover", "Discover")}
                  </Text>
                </Pressable>
              </Link>
            </View>

            <View className="mt-4 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
              <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
                {t("hashtag", "Hashtag")}
              </Text>
              <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>
                #{data?.hashtag.name ?? hashtagName}
              </Text>
              <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                {t("top_posts_for_hashtag", "Top posts for this hashtag, ranked by likes, comments, and reposts.")}
              </Text>

              <View className="mt-4 flex-row flex-wrap gap-3">
                <View className="rounded-full px-4 py-2" style={{ backgroundColor: colors.primarySoft }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.accentText }}>
                    {(data?.hashtag.posts_count ?? 0)} {t("posts", "Posts")}
                  </Text>
                </View>
                <View className="rounded-full px-4 py-2" style={{ backgroundColor: colors.surfaceAlt }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.textMuted }}>
                    {t("ranked_by_engagement", "Ranked by engagement")}
                  </Text>
                </View>
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
        renderItem={({ item, index }) => {
          const engagement = (item.likes_count ?? 0) + (item.comments_count ?? 0) + (item.reposts_count ?? 0);

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/post/[id]",
                  params: { id: item.id.toString() },
                })
              }
              className="mx-4 mb-4 rounded-[28px] border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-row flex-1">
                  <View className="mr-3 overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                    <Image
                      source={getProfileImageSource(item.user?.picture_url)}
                      className="h-11 w-11"
                      resizeMode="cover"
                    />
                  </View>

                  <View className="flex-1">
                    <Link
                      href={{
                        pathname: "/profile/[username]",
                        params: { username: item.user?.username ?? "unknown" },
                      }}
                      asChild
                    >
                      <Pressable className="self-start">
                        <Text className="text-base font-semibold" style={{ color: colors.text }} numberOfLines={1}>
                          {getDisplayName(item)}
                        </Text>
                      </Pressable>
                    </Link>
                    <Text className="mt-1 text-sm" style={{ color: colors.textMuted }} numberOfLines={1}>
                      @{item.user?.username ?? "unknown"}
                    </Text>
                  </View>
                </View>

                <View className="rounded-full px-3 py-2" style={{ backgroundColor: colors.primarySoft }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.accentText }}>
                    #{index + 1}
                  </Text>
                </View>
              </View>

              <RichContentText
                content={item.content}
                fallback={t("media_only_post", "Media-only post")}
                style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
              />

              <PostMediaPreview media={item.media ?? []} />

              {!!item.hashtags?.length ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {item.hashtags.map((hashtag) => (
                    <Pressable
                      key={hashtag.id}
                      onPress={() =>
                        router.replace({
                          pathname: "/hashtag/[name]",
                          params: { name: hashtag.name },
                        })
                      }
                      className="rounded-full px-3 py-1"
                      style={{ backgroundColor: colors.surfaceAlt }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: colors.accentText }}>
                        #{hashtag.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View className="mt-4 flex-row flex-wrap items-center gap-4">
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {item.likes_count ?? 0} {t("likes", "likes")}
                </Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {item.comments_count ?? 0} {t("comments", "comments")}
                </Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {item.reposts_count ?? 0} {t("reposts", "reposts")}
                </Text>
                <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                  {engagement} {t("engagement", "engagement")}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading && !error ? (
            <View className="mx-4 rounded-2xl border border-dashed px-4 py-8" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {t("no_posts_for_hashtag", "No posts for this hashtag yet.")}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
