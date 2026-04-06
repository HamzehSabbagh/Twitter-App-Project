import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Link, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
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

function getPostText(post: Post) {
  return post.content?.trim() || post.title?.trim() || "Untitled post";
}

export default function HomeScreen() {
  const { authFetch, loading: authLoading, signOut, user } = useAuth();
  const { t, colors } = useAppSettings();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const loadPosts = useCallback(() => {
    setLoading(true);

    authFetch(`${API_BASE_URL}/posts`)
      .then((response) => parseJsonResponse<Post[]>(response))
      .then((data) => {
        setPosts(data);
        setError("");
      })
      .catch((loadError) => {
        console.log(loadError);
        setError(t("loading_posts", "Loading posts..."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [authFetch, t]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  useEffect(() => {
    if (!user) {
      setAccountMenuOpen(false);
    }
  }, [user]);

  async function togglePostLike(post: Post) {
    if (!user) {
      setError(t("sign_in_required", "You need to log in first."));
      router.push("/login");
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${post.id}/like`, {
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

  async function togglePostRepost(post: Post) {
    if (!user) {
      setError(t("sign_in_required", "You need to log in first."));
      router.push("/login");
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${post.id}/repost`, {
        method: post.reposted_by_user ? "DELETE" : "POST",
      });

      await parseJsonResponse(response);

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
              ...currentPost,
              reposted_by_user: !currentPost.reposted_by_user,
              reposts_count: Math.max(
                0,
                (currentPost.reposts_count ?? 0) + (currentPost.reposted_by_user ? -1 : 1)
              ),
            }
            : currentPost
        )
      );
    } catch (repostError) {
      console.log(repostError);
      setError(t("update_failed", "Update failed"));
    }
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
                  <Link href="/register" asChild>
                    <Pressable className="rounded-xl px-5 py-3" style={{ backgroundColor: colors.primary }}>
                      <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>{t("create_account", "Create account")}</Text>
                    </Pressable>
                  </Link>
                  <Link href="/login" asChild>
                    <Pressable className="rounded-xl border px-5 py-3" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                      <Text className="text-sm font-semibold" style={{ color: colors.text }}>{t("login", "Log in")}</Text>
                    </Pressable>
                  </Link>
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
          <Text className="text-2xl font-black" style={{ color: colors.text }}>{t("app_name", "Twitter")}</Text>
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
                      className="flex-row items-center rounded-xl px-3 py-3"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Ionicons name="notifications-outline" size={18} color={colors.text} />
                      <Text className="ml-3 text-sm font-medium" style={{ color: colors.text }}>
                        {t("notifications", "Notifications")}
                      </Text>
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
                    onPress={() => {
                      setAccountMenuOpen(false);
                      signOut();
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
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 120 }}
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
                        <Link href="/register" asChild>
                          <Pressable className="rounded-2xl px-4 py-3" style={{ backgroundColor: colors.primary }}>
                            <Text className="font-semibold" style={{ color: colors.primaryText }}>{t("create_account", "Create account")}</Text>
                          </Pressable>
                        </Link>
                        <Link href="/login" asChild>
                          <Pressable className="rounded-2xl border px-4 py-3" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                            <Text className="font-semibold" style={{ color: colors.text }}>{t("login", "Log in")}</Text>
                          </Pressable>
                        </Link>
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
                router.push({
                  pathname: "/post/[id]",
                  params: { id: item.id.toString() },
                })
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
                    content={item.content || item.title || "Untitled post"}
                    style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}
                  />

                  <PostMediaPreview media={item.media ?? []} />
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
                      onPress={() => togglePostRepost(item)}
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
                    <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
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
      />

      <Link href="/create-post" asChild>
        <Pressable className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: colors.primary }}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
