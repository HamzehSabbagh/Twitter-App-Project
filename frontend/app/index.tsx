import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Link, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { sharePost } from "@/lib/post-sharing";
import { CommentPreviewList } from "@/components/comment-preview-list";
import { PostMediaPreview } from "@/components/post-media-preview";
import { RichContentText } from "@/components/rich-content-text";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type Post = {
  id: number;
  title?: string;
  content?: string | null;
  created_at?: string | null;
  is_repost?: boolean;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    picture_url?: string | null;
  };
  likes_count?: number;
  liked_by_user?: boolean;
  comments_count?: number;
  reposts_count?: number;
  reposted_by_user?: boolean;
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
  original_post?: {
    id: number;
    content?: string | null;
    created_at?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
      picture_url?: string | null;
    };
    media?: {
      id: number;
      type: string;
      url: string;
      mime_type?: string | null;
    }[];
  } | null;
};

type PaginatedPostsResponse = {
  data: Post[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  has_more_pages: boolean;
};

type NotificationsResponse = {
  notifications: {
    id: string;
    read_at?: string | null;
  }[];
  unread_count: number;
};

function getDisplayName(post: Post) {
  const firstName = post.user?.first_name?.trim() ?? "";
  const lastName = post.user?.last_name?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  return post.user?.username ?? "Unknown user";
}

function getUserDisplayName(user?: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}) {
  const firstName = user?.first_name?.trim() ?? "";
  const lastName = user?.last_name?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  return user?.username ?? "Unknown user";
}

  function formatUnreadCount(unreadCount: number) {
  return unreadCount > 99 ? "99+" : unreadCount.toString();
}

export default function HomeScreen() {
  const { authFetch, loading: authLoading, signOut, user } = useAuth();
  const { t, colors } = useAppSettings();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadingRef = useRef(loading);
  const refreshingRef = useRef(refreshing);
  const loadingMoreRef = useRef(loadingMore);
  const currentPageRef = useRef(currentPage);
  const lastPageRef = useRef(lastPage);
  const postsRef = useRef(posts);

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
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    lastPageRef.current = lastPage;
  }, [lastPage]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const loadPosts = useCallback(async (mode: "initial" | "refresh" | "loadMore" = "initial") => {
    if (mode === "loadMore") {
      if (
        loadingRef.current ||
        refreshingRef.current ||
        loadingMoreRef.current ||
        currentPageRef.current >= lastPageRef.current
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

    try {
      const targetPage = mode === "loadMore" ? currentPageRef.current + 1 : 1;
      const response = await authFetch(`${API_BASE_URL}/posts?page=${targetPage}`);
      const data = await parseJsonResponse<PaginatedPostsResponse>(response);

      setPosts((currentPosts) =>
        mode === "loadMore"
          ? [
            ...currentPosts,
            ...data.data.filter(
              (incomingPost) => !currentPosts.some((currentPost) => currentPost.id === incomingPost.id)
            ),
          ]
          : data.data
      );
      setCurrentPage(data.current_page);
      setLastPage(data.last_page);
      currentPageRef.current = data.current_page;
      lastPageRef.current = data.last_page;
      setError("");
    } catch (loadError) {
      console.log(loadError);
      setError(t("loading_posts", "Loading posts..."));
    } finally {
      if (mode === "refresh") {
        setRefreshing(false);
        refreshingRef.current = false;
      } else if (mode === "initial" && postsRef.current.length === 0) {
        setLoading(false);
        loadingRef.current = false;
      }

      if (mode === "loadMore") {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, [authFetch, t]);

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
      void loadPosts("initial");
      void loadUnreadCount();
    }, [loadPosts, loadUnreadCount])
  );

  useEffect(() => {
    if (!user) {
      setAccountMenuOpen(false);
      setUnreadCount(0);
    }
  }, [user]);

  async function togglePostLike(post: Post) {
    if (!user) {
      setError(t("sign_in_required", "You need to log in first."));
      router.push("/login");
      return;
    }

    try {
      const targetPostId = post.is_repost ? post.original_post?.id : post.id;

      if (!targetPostId) {
        return;
      }

      const response = await authFetch(`${API_BASE_URL}/posts/${targetPostId}/like`, {
        method: post.liked_by_user ? "DELETE" : "POST",
      });

      await parseJsonResponse(response);

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
              ...currentPost,
              liked_by_user: !currentPost.liked_by_user,
              likes_count: Math.max(
                0,
                (currentPost.likes_count ?? 0) + (currentPost.liked_by_user ? -1 : 1)
              ),
            }
            : currentPost
        )
      );
    } catch (likeError) {
      console.log(likeError);
      setError(t("update_failed", "Update failed"));
    }
  }

  async function openShareSheet(post: Post) {
    try {
      await sharePost(
        {
          id: post.id,
          type: post.is_repost ? "repost" : "post",
          title: post.title,
          content: post.content ?? post.original_post?.content ?? null,
          authorName: getDisplayName(post),
          username: post.user?.username ?? null,
        },
        {
          appName: t("app_name", "HearUs"),
          shareTitle: t("share_post", "Share post"),
          checkOutPost: t("check_out_this_post", "Check out this post on HearUs."),
          checkOutRepost: t("check_out_this_repost", "Check out this repost on HearUs."),
          mediaOnlyPost: t("media_only_post", "Media-only post"),
          sharedPostWithoutComment: t("shared_post_without_comment", "Shared a post"),
          openInApp: t("open_in_hearus", "Open in HearUs"),
        }
      );
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : t("share_failed", "Could not share this post.")
      );
    }
  }

  function openRepostComposer(post: Post) {
    if (!user) {
      setError(t("sign_in_required", "You need to log in first."));
      router.push("/login");
      return;
    }

    const targetPostId = post.is_repost ? post.original_post?.id : post.id;

    if (!targetPostId) {
      return;
    }

    router.push({
      pathname: "/repost/[id]",
      params: { id: targetPostId.toString() },
    });
  }

  if (!authLoading && !user) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <FlatList
          data={[
            {
              id: "fast",
              title: "Fast timeline",
              description: "Posts, reposts, and comments in one place.",
            },
            {
              id: "media",
              title: "Media support",
              description: "Attach photos, video, and audio to posts.",
            },
            {
              id: "hashtags",
              title: "Discover hashtags",
              description: "Track topics and join conversations quickly.",
            },
          ]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              <View className="overflow-hidden rounded-[32px] border px-5 pb-6 pt-8" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
                <View
                  className="pointer-events-none absolute -top-10 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: colors.primarySoft }}
                />
                <View
                  className="pointer-events-none absolute -bottom-10 -left-10 h-64 w-64 rounded-full"
                  style={{ backgroundColor: colors.dangerBg }}
                />

                <Text className="text-xs font-semibold uppercase tracking-[4px]" style={{ color: colors.accentText }}>
                  {t("social_platform", "Social Platform")}
                </Text>
                <Text className="mt-4 text-4xl font-black leading-[44px]" style={{ color: colors.text }}>
                  {t("guest_hero_title", "Share updates, follow people, and build your timeline")}
                </Text>

                <View className="mt-8 flex-row flex-wrap gap-3">
                  <Pressable
                    onPress={() => router.push("/signup")}
                    className="rounded-xl px-5 py-3"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>{t("create_account", "Create account")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/login")}
                    className="rounded-xl border px-5 py-3"
                    style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: colors.text }}>{t("login", "Log in")}</Text>
                  </Pressable>
                </View>
              </View>

              <View className="mt-5 gap-3">
                {[
                  [t("posts", "Posts"), t("compose_fast", "Compose fast")],
                  ["Threads", t("reply_in_context", "Reply in context")],
                  ["Reposts", t("boost_ideas", "Boost ideas")],
                  ["Hashtags", t("discover_trends", "Discover trends")],
                ].map(([label, value]) => (
                  <View
                    key={label}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
                  >
                    <Text className="text-xs uppercase tracking-[2px]" style={{ color: colors.accentText }}>{label}</Text>
                    <Text className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>{value}</Text>
                  </View>
                ))}
              </View>

              <Text className="mb-3 mt-6 text-sm font-semibold uppercase tracking-[2px]" style={{ color: colors.textMuted }}>
                {t("features", "Features")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-3 rounded-2xl border p-4" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
              <Text className="text-sm font-semibold" style={{ color: colors.text }}>{item.title}</Text>
              <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>{item.description}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {accountMenuOpen ? (
        <Pressable
          onPress={() => setAccountMenuOpen(false)}
          className="absolute inset-0"
          style={{ zIndex: 10 }}
        />
      ) : null}

      <View
        className="border-b px-4 pb-3"
        style={{ borderColor: colors.border, backgroundColor: colors.surface, zIndex: 20 }}
      >
        <View className="flex-row items-center justify-between">
          {user ? (
            <Link
              href={{
                pathname: "/profile/[username]",
                params: { username: user.username },
              }}
              asChild
            >
              <Pressable className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                <Image
                  source={getProfileImageSource(user.picture_url)}
                  className="h-10 w-10"
                  resizeMode="cover"
                />
              </Pressable>
            </Link>
          ) : (
            <View className="overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
              <Image source={getProfileImageSource()} className="h-10 w-10" resizeMode="cover" />
            </View>
          )}
          <Text className="text-2xl font-black" style={{ color: colors.text }}>{t("app_name", "HearUs")}</Text>
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
                  className="absolute right-0 top-14 w-44 rounded-2xl border p-2"
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
            <Ionicons name="sparkles-outline" size={22} color={colors.accentText} />
          )}
        </View>

        <View className="mt-5 flex-row rounded-2xl border p-1" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
          <View className="flex-1 items-center rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
            <Text className="text-base font-semibold" style={{ color: colors.primaryText }}>{t("timeline", "Timeline")}</Text>
          </View>
          <Link href="/explore" asChild>
            <Pressable className="flex-1 items-center justify-center rounded-xl py-3">
              <Text className="text-base" style={{ color: colors.textMuted }}>{t("discover", "Discover")}</Text>
            </Pressable>
          </Link>
          <Pressable
            onPress={() => router.push("/messages" as never)}
            className="flex-1 items-center justify-center rounded-xl py-3"
          >
            <Text className="text-base" style={{ color: colors.textMuted }}>{t("messages", "Messages")}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshing={refreshing}
        onRefresh={() => loadPosts("refresh")}
        onEndReached={() => loadPosts("loadMore")}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={
          <View className="px-4 pb-4 pt-4">
            <View className="overflow-hidden rounded-[28px] border" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <View className="absolute inset-0" style={{ backgroundColor: colors.surface }} />
              <View
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full"
                style={{ backgroundColor: colors.primarySoft }}
              />
              <View
                className="absolute -left-10 bottom-0 h-40 w-40 rounded-full"
                style={{ backgroundColor: colors.dangerBg }}
              />

              <View className="px-5 pb-5 pt-6">
                <Text className="text-xs font-semibold uppercase tracking-[3px]" style={{ color: colors.accentText }}>
                  {t("social_platform", "Social Platform")}
                </Text>
                <Text className="mt-3 text-3xl font-black leading-9" style={{ color: colors.text }}>
                  {t("share_updates_build_timeline", "Share updates and build your timeline")}
                </Text>
                <Text className="mt-3 text-base leading-6" style={{ color: colors.textSecondary }}>
                  {t("clean_mobile_experience", "A clean Twitter-like mobile experience inspired by your Laravel project.")}
                </Text>

                {!authLoading ? (
                  <View className="mt-5 flex-row gap-3">
                    {user ? (
                      <Link
                        href={{
                          pathname: "/profile/[username]",
                          params: { username: user.username },
                        }}
                        asChild
                      >
                        <Pressable className="rounded-2xl px-4 py-3" style={{ backgroundColor: colors.primary }}>
                          <Text className="font-semibold" style={{ color: colors.primaryText }}>@{user.username}</Text>
                        </Pressable>
                      </Link>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => router.push("/signup")}
                          className="rounded-2xl px-4 py-3"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Text className="font-semibold" style={{ color: colors.primaryText }}>{t("create_account", "Create account")}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => router.push("/login")}
                          className="rounded-2xl border px-4 py-3"
                          style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
                        >
                          <Text className="font-semibold" style={{ color: colors.text }}>{t("login", "Log in")}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            </View>

            <View className="mt-4 rounded-[28px] border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Text className="text-sm font-semibold uppercase tracking-[2px]" style={{ color: colors.textMuted }}>
                {t("composer", "Composer")}
              </Text>
              <View className="mt-4 rounded-[24px] border p-4" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                <Text className="text-lg font-semibold" style={{ color: colors.text }}>{t("create_post", "Create a post")}</Text>
                <Text className="mt-2 text-sm leading-5" style={{ color: colors.textMuted }}>
                  {t("create_post_description", "Open the composer to add text, pictures, videos, and audio.")}
                </Text>
                <Link href="/create-post" asChild>
                  <Pressable className="mt-4 self-start rounded-full px-5 py-3" style={{ backgroundColor: colors.primary }}>
                    <Text className="font-semibold" style={{ color: colors.primaryText }}>{t("new_post", "New post")}</Text>
                  </Pressable>
                </Link>
              </View>
            </View>

            {loading ? (
              <Text className="mt-4 text-base" style={{ color: colors.textMuted }}>{t("loading_posts", "Loading posts...")}</Text>
            ) : null}

            {error ? (
              <Text className="mt-4 text-base" style={{ color: colors.dangerText }}>{error}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View className="mx-4 mb-4 rounded-[28px] border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
            <Pressable
              onPress={() =>
                router.push(
                  item.is_repost
                    ? {
                        pathname: "/repost-show/[id]",
                        params: { id: item.id.toString() },
                      }
                    : {
                        pathname: "/post/[id]",
                        params: { id: item.id.toString() },
                      }
                )
              }
            >
              <View className="flex-row">
                <View className="mr-3 h-11 w-11 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                  <Image
                    source={getProfileImageSource(item.user?.picture_url)}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </View>

                <View className="flex-1">
                  {item.is_repost ? (
                    <View className="mb-3">
                      <Text className="text-xs font-semibold uppercase tracking-[2px]" style={{ color: colors.accentText }}>
                        {t("repost", "Repost")}
                      </Text>
                    </View>
                  ) : null}

                  <View className="flex-row flex-wrap items-center">
                    <Link
                      href={{
                        pathname: "/profile/[username]",
                        params: { username: item.user?.username ?? "guest" },
                      }}
                      asChild
                    >
                      <Pressable className="max-w-[55%]">
                        <Text className="text-base font-bold" style={{ color: colors.text }} numberOfLines={1}>
                          {getDisplayName(item)}
                        </Text>
                      </Pressable>
                    </Link>
                    <Link
                      href={{
                        pathname: "/profile/[username]",
                        params: { username: item.user?.username ?? "guest" },
                      }}
                      asChild
                    >
                      <Pressable className="ml-2 max-w-[35%]">
                        <Text className="text-sm" style={{ color: colors.textMuted }} numberOfLines={1}>
                          @{item.user?.username ?? "guest"}
                        </Text>
                      </Pressable>
                    </Link>
                    <Text className="ml-2 text-sm" style={{ color: colors.textMuted }}>.</Text>
                    <Text className="ml-2 text-sm" style={{ color: colors.textMuted }} numberOfLines={1}>
                      {item.created_at ?? "now"}
                    </Text>
                  </View>

                  <RichContentText
                    content={item.content || item.title || null}
                    fallback={
                      item.is_repost
                        ? t("shared_post_without_comment", "Shared a post")
                        : "Untitled post"
                    }
                    style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
                  />

                  <PostMediaPreview
                    media={item.media ?? []}
                    interactive={false}
                    onOpenPost={() =>
                      router.push(
                        item.is_repost
                          ? {
                              pathname: "/repost-show/[id]",
                              params: { id: item.id.toString() },
                            }
                          : {
                              pathname: "/post/[id]",
                              params: { id: item.id.toString() },
                            }
                      )
                    }
                  />

                  {item.is_repost && item.original_post ? (
                    <View
                      className="mt-4 rounded-2xl border p-4"
                      style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
                    >
                      <View className="flex-row">
                        <View className="mr-3 h-10 w-10 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
                          <Image
                            source={getProfileImageSource(item.original_post.user?.picture_url)}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                            {getUserDisplayName(item.original_post.user)}
                          </Text>
                          <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                            @{item.original_post.user?.username ?? "unknown"}
                          </Text>
                          <RichContentText
                            content={item.original_post.content}
                            fallback={t("media_only_post", "Media-only post")}
                            style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}
                          />
                          <PostMediaPreview
                            media={item.original_post.media ?? []}
                            interactive={false}
                            onOpenPost={() =>
                              router.push({
                                pathname: "/repost-show/[id]",
                                params: { id: item.id.toString() },
                              })
                            }
                          />
                        </View>
                      </View>
                    </View>
                  ) : null}

                  <CommentPreviewList
                    comments={item.comments_preview ?? []}
                    authFetch={authFetch}
                    onChanged={loadPosts}
                    onRequireLogin={() => {
                      setError(t("sign_in_required", "You need to log in first."));
                      router.push("/login");
                    }}
                  />

                  <View className="mt-4 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="chatbubble-outline" size={18} color="#71717A" />
                      <Text className="text-xs" style={{ color: colors.textMuted }}>
                        {item.comments_count ?? 0}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => openRepostComposer(item)}
                      className="flex-row items-center gap-2 rounded-full px-2 py-1"
                    >
                      <Ionicons
                        name="repeat-outline"
                        size={20}
                        color={item.reposted_by_user ? "#22C55E" : colors.textMuted}
                      />
                      <Text
                        className={`text-xs ${item.reposted_by_user ? "text-green-400" : ""
                          }`}
                        style={!item.reposted_by_user ? { color: colors.textMuted } : undefined}
                      >
                        {item.reposts_count ?? 0}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => togglePostLike(item)}
                      className="flex-row items-center gap-2 rounded-full px-2 py-1"
                    >
                      <Ionicons
                        name={item.liked_by_user ? "heart" : "heart-outline"}
                        size={18}
                        color={item.liked_by_user ? "#F43F5E" : colors.textMuted}
                      />
                      <Text
                        className={`text-xs ${item.liked_by_user ? "text-rose-400" : ""
                          }`}
                        style={!item.liked_by_user ? { color: colors.textMuted } : undefined}
                      >
                        {item.likes_count ?? 0}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        void openShareSheet(item);
                      }}
                      className="rounded-full px-2 py-1"
                    >
                      <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <View className="mx-4 rounded-[28px] border border-dashed px-4 py-8" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <Text className="text-base" style={{ color: colors.textMuted }}>{t("no_posts_yet", "No posts yet. Create the first one.")}</Text>
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

      <Link href="/create-post" asChild>
        <Pressable className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: colors.primary }}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
