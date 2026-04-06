import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { PostMediaPreview } from "@/components/post-media-preview";
import { RichContentText } from "@/components/rich-content-text";
import {
  getCoverImageSource,
  getCoverResizeMode,
  getProfileImageSource,
} from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type ProfilePost = {
  id: number;
  content?: string | null;
  created_at?: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  can_delete: boolean;
  media?: {
    id: number;
    type: string;
    url: string;
    mime_type?: string | null;
  }[];
};

type Profile = {
  first_name: string;
  last_name: string;
  username: string;
  email?: string | null;
  birth_date?: string | null;
  bio?: string | null;
  location?: string | null;
  role_name?: string | null;
  picture_url?: string | null;
  cover_url?: string | null;
  is_owner: boolean;
  is_following: boolean;
  is_profile_public?: boolean;
  is_private?: boolean;
  followers_count: number;
  following_count: number;
  posts?: ProfilePost[];
};

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { authFetch, token, user } = useAuth();
  const { t, colors } = useAppSettings();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    if (!username) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/profile/${username}`);
      const data = await parseJsonResponse<{ profile: Profile }>(response);
      setProfile(data.profile);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : t("could_not_load_profile", "Could not load profile."));
    } finally {
      setLoading(false);
    }
  }, [authFetch, t, username]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function toggleFollow() {
    const isOwnProfile = !!(profile && user?.username === profile.username);

    if (!profile || profile.is_owner || isOwnProfile) {
      return;
    }

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/profile/${profile.username}/follow`, {
        method: profile.is_following ? "DELETE" : "POST",
      });

      await parseJsonResponse(response);
      await loadProfile();
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : t("could_not_update_follow", "Could not update follow."));
    }
  }

  const headerName = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.username
    : username ?? t("profile", "Profile");
  const effectiveIsOwner = !!(profile && (profile.is_owner || user?.username === profile.username));

  async function deletePost(postId: number) {
    Alert.alert(t("delete_post", "Delete post"), t("delete_post_confirm", "Are you sure you want to delete this post?"), [
      { text: t("cancel", "Cancel"), style: "cancel" },
      {
        text: t("delete_post", "Delete post"),
        style: "destructive",
        onPress: async () => {
          try {
            const response = await authFetch(`${API_BASE_URL}/posts/${postId}`, {
              method: "DELETE",
            });

            await parseJsonResponse<{ message: string }>(response);
            await loadProfile();
          } catch (deleteError) {
            setError(
              deleteError instanceof Error ? deleteError.message : t("could_not_delete_post", "Could not delete post.")
            );
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="border-b px-4 pb-4 pt-2" style={{ borderColor: colors.border }}>
        <Pressable
          onPress={() => router.back()}
          className="self-start rounded-xl border px-3 py-2"
          style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
        >
          <Text className="text-xs font-semibold" style={{ color: colors.text }}>
            {t("back", "Back")}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!loading && profile ? (
        <FlatList
          data={profile.posts ?? []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              <View
                className="overflow-hidden rounded-[28px] border"
                style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
              >
                <View className="relative">
                  <Image
                    source={getCoverImageSource(profile.cover_url, profile.picture_url)}
                    className="h-40 w-full"
                    resizeMode={getCoverResizeMode(profile.cover_url)}
                  />
                  <View className="absolute inset-0 bg-black/20" />
                  <Image
                    source={getProfileImageSource(profile.picture_url)}
                    className="absolute -bottom-10 left-5 h-20 w-20 rounded-full border-4"
                    style={{ borderColor: colors.background }}
                    resizeMode="cover"
                  />
                </View>
                <View className="px-5 pb-5 pt-14">
                  <Text className="text-2xl font-semibold" style={{ color: colors.text }}>
                    {headerName}
                  </Text>
                  <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
                    @{profile.username}
                  </Text>

                  {profile.role_name ? (
                    <Text
                      className="mt-3 text-xs font-semibold uppercase tracking-[2px]"
                      style={{ color: colors.accentText }}
                    >
                      {profile.role_name}
                    </Text>
                  ) : null}

                  {profile.is_private ? (
                    <Text className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
                      {t("profile_private", "This profile is private.")}
                    </Text>
                  ) : (
                    <>
                      {profile.bio ? (
                        <Text className="mt-4 text-sm leading-6" style={{ color: colors.textSecondary }}>
                          {profile.bio}
                        </Text>
                      ) : null}
                      {profile.location ? (
                        <Text className="mt-2 text-sm" style={{ color: colors.textMuted }}>
                          {profile.location}
                        </Text>
                      ) : null}
                      <View className="mt-4 flex-row flex-wrap gap-5">
                        <Text className="text-sm" style={{ color: colors.textMuted }}>
                          <Text className="font-semibold" style={{ color: colors.text }}>
                            {profile.following_count}
                          </Text>{" "}
                          {t("following", "Following")}
                        </Text>
                        <Text className="text-sm" style={{ color: colors.textMuted }}>
                          <Text className="font-semibold" style={{ color: colors.text }}>
                            {profile.followers_count}
                          </Text>{" "}
                          {t("followers", "Followers")}
                        </Text>
                      </View>
                    </>
                  )}

                  <View className="mt-5 flex-row flex-wrap gap-3">
                    {effectiveIsOwner ? (
                      <Pressable
                        onPress={() => router.push("/profile/edit")}
                        className="rounded-full px-5 py-3"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text className="font-semibold" style={{ color: colors.primaryText }}>
                          {t("edit_profile", "Edit profile")}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={toggleFollow}
                        className="rounded-full border px-5 py-3"
                        style={{
                          borderColor: profile.is_following ? colors.borderSoft : colors.primary,
                          backgroundColor: profile.is_following ? colors.surfaceAlt : colors.primary,
                        }}
                      >
                        <Text className="font-semibold" style={{ color: profile.is_following ? colors.text : colors.primaryText }}>
                          {profile.is_following ? t("unfollow", "Unfollow") : t("follow", "Follow")}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

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

              {!profile.is_private ? (
                <Text className="mb-3 mt-5 text-lg font-semibold" style={{ color: colors.text }}>
                  {t("posts", "Posts")}
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View
              className="mb-4 rounded-2xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/post/[id]",
                    params: { id: item.id.toString() },
                  })
                }
              >
                <RichContentText
                  content={item.content}
                  fallback={t("media_only_post", "Media-only post")}
                  style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 24 }}
                />
                <PostMediaPreview media={item.media ?? []} />
              </Pressable>
              <View className="mt-4 flex-row flex-wrap gap-4">
                <Text className="text-xs" style={{ color: colors.textMuted }}>{item.likes_count} {t("likes", "likes")}</Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>{item.comments_count} {t("comments", "comments")}</Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>{item.reposts_count} {t("reposts", "reposts")}</Text>
                {effectiveIsOwner ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/edit-post/[id]",
                        params: { id: item.id.toString() },
                      })
                    }
                    className="rounded-full border px-3 py-1"
                    style={{ borderColor: colors.primary, backgroundColor: colors.primarySoft }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.accentText }}>
                      {t("edit_post", "Edit post")}
                    </Text>
                  </Pressable>
                ) : null}
                {effectiveIsOwner && item.can_delete ? (
                  <Pressable
                    onPress={() => deletePost(item.id)}
                    className="rounded-full border px-3 py-1"
                    style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.dangerText }}>
                      {t("delete_post", "Delete post")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            !profile.is_private ? (
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {t("this_user_has_not_posted", "This user has not posted yet.")}
              </Text>
            ) : null
          }
        />
      ) : null}
    </SafeAreaView>
  );
}
