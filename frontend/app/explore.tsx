import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { CommentPreviewList } from "@/components/comment-preview-list";
import { PostMediaPreview } from "@/components/post-media-preview";
import { RichContentText } from "@/components/rich-content-text";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type ExplorePost = {
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
  hashtags?: { id: number; name: string }[];
  media?: {
    id: number;
    type: string;
    url: string;
    mime_type?: string | null;
  }[];
  comments_preview?: {
    id: number;
    content: string;
    likes_count: number;
    liked_by_user: boolean;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
    };
  }[];
};

type TrendingHashtag = {
  id: number;
  name: string;
  posts_count: number;
};

type SuggestedUser = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username: string;
  followers_count: number;
  posts_count: number;
};

type ExploreResponse = {
  posts: ExplorePost[];
  current_page: number;
  last_page: number;
  has_more_pages: boolean;
  trendingHashtags: TrendingHashtag[];
  suggestedUsers: SuggestedUser[];
};

type NotificationsResponse = {
  unread_count: number;
};

function getDisplayName(user?: ExplorePost["user"] | SuggestedUser) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || user?.username || "Unknown user";
}

function formatUnreadCount(unreadCount: number) {
  return unreadCount > 99 ? "99+" : unreadCount.toString();
}

export default function ExploreScreen() {
  const router = useRouter();
  const { authFetch, signOut, user } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ExploreResponse>({
    posts: [],
    current_page: 1,
    last_page: 1,
    has_more_pages: false,
    trendingHashtags: [],
    suggestedUsers: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadingRef = useRef(loading);
  const refreshingRef = useRef(refreshing);
  const loadingMoreRef = useRef(loadingMore);
  const currentPageRef = useRef(data.current_page);
  const hasMorePagesRef = useRef(data.has_more_pages);
  const postsRef = useRef(data.posts);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    currentPageRef.current = data.current_page;
    hasMorePagesRef.current = data.has_more_pages;
  }, [data.current_page, data.has_more_pages]);

  useEffect(() => {
    postsRef.current = data.posts;
  }, [data.posts]);

  const loadExplore = useCallback(
    async (mode: "initial" | "refresh" | "loadMore" = "initial") => {
      if (mode === "loadMore") {
        if (
          loadingRef.current ||
          refreshingRef.current ||
          loadingMoreRef.current ||
          !hasMorePagesRef.current
        ) {
          return;
        }

        setLoadingMore(true);
        loadingMoreRef.current = true;
      }

      if (mode === "refresh") {
        setRefreshing(true);
        refreshingRef.current = true;
      } else if (mode === "initial" && postsRef.current.length === 0) {
        setLoading(true);
        loadingRef.current = true;
      }

      setError("");

      try {
        const targetPage = mode === "loadMore" ? currentPageRef.current + 1 : 1;
        const response = await authFetch(`${API_BASE_URL}/explore?page=${targetPage}`);
        const nextData = await parseJsonResponse<ExploreResponse>(response);

        setData((currentData) => ({
          ...nextData,
          posts:
            mode === "loadMore"
              ? [
                ...currentData.posts,
                ...nextData.posts.filter(
                  (incomingPost) => !currentData.posts.some((currentPost) => currentPost.id === incomingPost.id)
                ),
              ]
              : nextData.posts,
        }));
      } catch (exploreError) {
        setError(
          exploreError instanceof Error
            ? exploreError.message
            : t("explore", "Explore")
        );
      } finally {
        if (mode === "loadMore") {
          setLoadingMore(false);
          loadingMoreRef.current = false;
        } else if (mode === "refresh") {
          setRefreshing(false);
          refreshingRef.current = false;
        } else if (postsRef.current.length === 0) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [authFetch, t]
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
      void loadExplore();
      void loadUnreadCount();
    }, [loadExplore, loadUnreadCount])
  );

  useEffect(() => {
    if (!user) {
      setAccountMenuOpen(false);
      setUnreadCount(0);
    }
  }, [user]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPosts = useMemo(() => {
    if (!normalizedQuery) {
      return data.posts;
    }

    return data.posts.filter((post) => {
      const haystack = [
        post.content ?? "",
        post.user?.first_name ?? "",
        post.user?.last_name ?? "",
        post.user?.username ?? "",
        ...(post.hashtags ?? []).map((hashtag) => hashtag.name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [data.posts, normalizedQuery]);

  const filteredHashtags = useMemo(() => {
    if (!normalizedQuery) {
      return data.trendingHashtags;
    }

    return data.trendingHashtags.filter((hashtag) =>
      hashtag.name.toLowerCase().includes(normalizedQuery)
    );
  }, [data.trendingHashtags, normalizedQuery]);

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) {
      return data.suggestedUsers;
    }

    return data.suggestedUsers.filter((suggestedUser) =>
      [suggestedUser.first_name, suggestedUser.last_name, suggestedUser.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [data.suggestedUsers, normalizedQuery]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {accountMenuOpen ? (
        <Pressable
          onPress={() => setAccountMenuOpen(false)}
          className="absolute inset-0"
          style={{ zIndex: 10 }}
        />
      ) : null}

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshing={refreshing}
        onRefresh={() => loadExplore("refresh")}
        onEndReached={() => loadExplore("loadMore")}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={
          <View className="px-4 pb-4 pt-2">
            <View className="flex-row items-center justify-between">
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
                      className="absolute left-0 top-14 w-44 rounded-2xl border p-2"
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
                <View className="w-10" />
              )}

              <Text className="text-2xl font-black" style={{ color: colors.text }}>{t("app_name", "HearUs")}</Text>

              {user ? (
                <Link
                  href={{
                    pathname: "/profile/[username]",
                    params: { username: user.username },
                  }}
                  asChild
                >
                  <Pressable className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft }}>
                    <Image
                      source={getProfileImageSource(user.picture_url)}
                      className="h-10 w-10"
                      resizeMode="cover"
                    />
                  </Pressable>
                </Link>
              ) : (
                <View className="w-10" />
              )}
            </View>

            <View className="mt-4 flex-row rounded-2xl border p-1" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
              <Link href="/" asChild>
                <Pressable className="flex-1 items-center justify-center rounded-xl py-3">
                  <Text className="text-base" style={{ color: colors.textMuted }}>{t("timeline", "Timeline")}</Text>
                </Pressable>
              </Link>
              <View className="flex-1 items-center rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
                <Text className="text-base font-semibold" style={{ color: colors.primaryText }}>{t("discover", "Discover")}</Text>
              </View>
              <Pressable
                onPress={() => router.push("/messages" as never)}
                className="flex-1 items-center justify-center rounded-xl py-3"
              >
                <Text className="text-base" style={{ color: colors.textMuted }}>{t("messages", "Messages")}</Text>
              </Pressable>
            </View>

            <View className="mt-4 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
              <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
                {t("explore_label", "Explore")}
              </Text>
              <Text className="mt-3 text-3xl font-semibold" style={{ color: colors.text }}>
                {t("discover_moving", "Discover what is moving")}
              </Text>
              <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                {t("browse_trending_description", "Browse trending hashtags, suggested accounts, and the most active posts across the app.")}
              </Text>

              <View className="mt-5 flex-row items-center rounded-2xl border px-4" style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}>
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("search_users_posts_hashtags", "Search users, posts, hashtags")}
                  placeholderTextColor={colors.textMuted}
                  className="flex-1 px-3 py-3 text-sm"
                  style={{ color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>
            </View>

            {loading ? (
              <View className="mt-5 items-center py-6">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}

            {error ? (
              <View className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/15 px-4 py-3">
                <Text className="text-sm" style={{ color: colors.dangerText }}>{error}</Text>
              </View>
            ) : null}

            <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold" style={{ color: colors.text }}>{t("suggested_users", "Suggested users")}</Text>
                <Text className="text-sm" style={{ color: colors.textMuted }}>{filteredUsers.length}</Text>
              </View>

              <View className="mt-4 gap-3">
                {filteredUsers.length === 0 ? (
                  <Text className="text-sm" style={{ color: colors.textMuted }}>{t("no_suggested_users_match", "No suggested users match your search.")}</Text>
                ) : (
                  filteredUsers.map((suggestedUser) => (
                    <View
                      key={suggestedUser.id}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="mr-3 flex-1">
                          <Text className="text-base font-semibold" style={{ color: colors.text }}>
                            {getDisplayName(suggestedUser)}
                          </Text>
                          <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                            @{suggestedUser.username}
                          </Text>
                          <Text className="mt-2 text-xs" style={{ color: colors.textMuted }}>
                            {suggestedUser.followers_count} {t("followers", "followers")} . {suggestedUser.posts_count} {t("posts", "posts")}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/profile/[username]",
                              params: { username: suggestedUser.username },
                            })
                          }
                          className="rounded-full px-4 py-2"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Text className="text-xs font-semibold" style={{ color: colors.primaryText }}>{t("view", "View")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View className="mt-5 rounded-[28px] border p-5" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold" style={{ color: colors.text }}>{t("trending_hashtags", "Trending hashtags")}</Text>
                <Text className="text-sm" style={{ color: colors.textMuted }}>{filteredHashtags.length}</Text>
              </View>

              <View className="mt-4 gap-3">
                {filteredHashtags.length === 0 ? (
                  <Text className="text-sm" style={{ color: colors.textMuted }}>{t("no_hashtags_match", "No hashtags match your search.")}</Text>
                ) : (
                  filteredHashtags.map((hashtag) => (
                    <Pressable
                      key={hashtag.id}
                      onPress={() =>
                        router.push({
                          pathname: "/hashtag/[name]",
                          params: { name: hashtag.name },
                        })
                      }
                      className="rounded-2xl border p-4"
                      style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
                    >
                      <Text className="text-base font-semibold" style={{ color: colors.text }}>#{hashtag.name}</Text>
                      <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                        {hashtag.posts_count} post(s)
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>

            <View className="mt-5 flex-row items-center justify-between">
                <Text className="text-lg font-semibold" style={{ color: colors.text }}>{t("popular_posts", "Popular posts")}</Text>
              <Text className="text-sm" style={{ color: colors.textMuted }}>{filteredPosts.length} {t("results", "result(s)")}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
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
            <View className="flex-row items-center justify-between gap-3">
              <View className="mr-3 overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                <Image
                  source={getProfileImageSource(item.user?.picture_url)}
                  className="h-11 w-11"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold" style={{ color: colors.text }} numberOfLines={1}>
                  {getDisplayName(item.user)}
                </Text>
                <Text className="mt-1 text-sm" style={{ color: colors.textMuted }} numberOfLines={1}>
                  @{item.user?.username ?? "unknown"}
                </Text>
              </View>
              <Text className="text-xs" style={{ color: colors.textMuted }} numberOfLines={1}>
                {item.created_at ?? t("unknown_date", "Unknown date")}
              </Text>
            </View>

            <RichContentText
              content={item.content}
              fallback={t("media_only_post", "Media-only post")}
              style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
            />

            <PostMediaPreview media={item.media ?? []} />
            <CommentPreviewList
              comments={item.comments_preview ?? []}
              authFetch={authFetch}
              onChanged={loadExplore}
              onRequireLogin={() => {
                setError(t("sign_in_required", "You need to log in first."));
                router.push("/login");
              }}
            />

            {!!item.hashtags?.length ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {item.hashtags.map((hashtag) => (
                  <Pressable
                    key={hashtag.id}
                    onPress={() =>
                      router.push({
                        pathname: "/hashtag/[name]",
                        params: { name: hashtag.name },
                      })
                    }
                    className="rounded-full px-3 py-1"
                    style={{ backgroundColor: colors.primarySoft }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.accentText }}>#{hashtag.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View className="mt-4 flex-row flex-wrap items-center gap-4">
              <Text className="text-xs" style={{ color: colors.textMuted }}>{item.likes_count ?? 0} {t("likes", "likes")}</Text>
              <Text className="text-xs" style={{ color: colors.textMuted }}>{item.comments_count ?? 0} {t("comments", "comments")}</Text>
              <Text className="text-xs" style={{ color: colors.textMuted }}>{item.reposts_count ?? 0} {t("reposts", "reposts")}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <View className="mx-4 rounded-2xl border border-dashed px-4 py-8" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Text className="text-sm" style={{ color: colors.textMuted }}>{t("no_posts_match_search", "No posts match your search yet.")}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="pb-6 pt-2">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
