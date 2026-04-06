import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { MentionInput } from "@/components/mention-input";
import { PostMediaPreview } from "@/components/post-media-preview";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_MEDIA_COUNT = 4;

type ExistingMedia = {
  id: number;
  type: string;
  url: string;
  mime_type?: string | null;
};

type SelectedFile = {
  name: string;
  size: number;
  mimeType: string;
  uri: string;
};

type PostDetail = {
  id: number;
  content?: string | null;
  parent_id?: number | null;
  media?: ExistingMedia[];
};

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch, token } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [content, setContent] = useState("");
  const [parentId, setParentId] = useState("");
  const [existingMedia, setExistingMedia] = useState<ExistingMedia[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<number[]>([]);
  const [media, setMedia] = useState<SelectedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const loadPost = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${id}`);
      const data = await parseJsonResponse<{ post: PostDetail }>(response);
      setContent(data.post.content ?? "");
      setParentId(data.post.parent_id ? String(data.post.parent_id) : "");
      setExistingMedia(data.post.media ?? []);
      setRemovedMediaIds([]);
      setMedia([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("could_not_update_post", "Could not update post."));
    } finally {
      setLoading(false);
    }
  }, [authFetch, id, t]);

  useFocusEffect(
    useCallback(() => {
      loadPost();
    }, [loadPost])
  );

  async function appendFiles(type: string | string[]) {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    const selectedFiles = result.assets.map((asset) => ({
      name: asset.name,
      size: asset.size ?? 0,
      mimeType: asset.mimeType ?? "application/octet-stream",
      uri: asset.uri,
    }));

    const oversizedFile = selectedFiles.find((file) => file.size > MAX_MEDIA_SIZE_BYTES);

    if (oversizedFile) {
      setError(`${oversizedFile.name} is larger than 50 MB.`);
      Alert.alert(t("file_too_large", "File too large"), `${oversizedFile.name} ${t("bigger_than_50mb", "is larger than 50 MB.")}`);
      return;
    }

    const remainingExistingCount = existingMedia.filter(
      (item) => !removedMediaIds.includes(item.id)
    ).length;

    if (remainingExistingCount + media.length + selectedFiles.length > MAX_MEDIA_COUNT) {
      setError(t("max_4_files", "You can upload up to 4 files per post."));
      Alert.alert(t("too_many_files", "Too many files"), t("max_4_files", "You can upload up to 4 files per post."));
      return;
    }

    setError("");
    setMedia((current) => [...current, ...selectedFiles]);
  }

  async function savePost() {
    if (!token) {
      setError(t("sign_in_required", "You need to log in first."));
      router.push("/login");
      return;
    }

    const remainingExistingCount = existingMedia.filter(
      (item) => !removedMediaIds.includes(item.id)
    ).length;

    if (!content.trim() && remainingExistingCount === 0 && media.length === 0) {
      setError(t("write_something_attach_file", "Write something or attach at least one file."));
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("content", content);

      if (parentId.trim()) {
        formData.append("parent_id", parentId);
      }

      removedMediaIds.forEach((mediaId) => {
        formData.append("remove_media[]", String(mediaId));
      });

      media.forEach((file, index) => {
        formData.append("media[]", {
          uri: file.uri,
          name: file.name || `upload-${index}`,
          type: file.mimeType,
        } as never);
      });

      const response = await authFetch(`${API_BASE_URL}/posts/${id}`, {
        method: "PATCH",
        body: formData,
      });

      await parseJsonResponse(response);
      Alert.alert(t("post_updated", "Post updated"), t("post_updated_success", "Your changes were saved successfully."));
      router.back();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : t("could_not_update_post", "Could not update post.");
      setError(message);
      Alert.alert(t("update_failed", "Update failed"), message);
    } finally {
      setProcessing(false);
    }
  }

  function confirmDelete() {
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
          onPress: () => {
            void deletePost();
          },
        },
      ]
    );
  }

  async function deletePost() {
    if (!token) {
      setError(t("sign_in_required", "You need to log in first."));
      router.push("/login");
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/posts/${id}`, {
        method: "DELETE",
      });

      await parseJsonResponse(response);
      Alert.alert(t("post_deleted", "Post deleted"), t("post_deleted_success", "Your post was deleted successfully."));
      router.replace("/");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : t("could_not_delete_post", "Could not delete post.");
      setError(message);
      Alert.alert(t("delete_failed", "Delete failed"), message);
    } finally {
      setDeleting(false);
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
              {t("back", "Back")}
            </Text>
          </Pressable>

          <View
            className="rounded-[28px] border p-4"
            style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
          >
            <Text className="text-2xl font-semibold" style={{ color: colors.text }}>
              {t("edit_post", "Edit post")}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
              {t("edit_post_description", "Update the text, keep attachments, remove old ones, or add new media.")}
            </Text>
          </View>

          {loading ? (
            <View className="mt-6 items-center py-8">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View
              className="mt-5 rounded-[28px] border p-4"
              style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
            >
              <View className="gap-2">
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("content", "Content")}
                </Text>
                <MentionInput
                  value={content}
                  onChangeText={setContent}
                  placeholder={t("what_is_happening", "What is happening?")}
                  minHeight={160}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              <View className="mt-4 gap-2">
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("parent_post_id", "Parent post ID")}
                </Text>
                <TextInput
                  value={parentId}
                  onChangeText={setParentId}
                  placeholder={t("optional", "Optional")}
                  placeholderTextColor="#64748B"
                  className="mt-2 rounded-2xl border p-3"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
                  textAlign={isRTL ? "right" : "left"}
                />
              </View>

              {existingMedia.length > 0 ? (
                <View className="mt-5">
                  <Text className="text-sm font-medium" style={{ color: colors.text }}>
                    {t("current_media", "Current media")}
                  </Text>
                  <View className="mt-3 gap-3">
                    {existingMedia
                      .filter((item) => !removedMediaIds.includes(item.id))
                      .map((item) => (
                        <View
                          key={item.id}
                          className="rounded-2xl border p-3"
                          style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
                        >
                          <PostMediaPreview media={[item]} />
                          <Pressable
                            onPress={() =>
                              setRemovedMediaIds((current) => [...current, item.id])
                            }
                            className="mt-3 self-start rounded-full border px-3 py-1"
                            style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
                          >
                            <Text className="text-xs font-semibold" style={{ color: colors.dangerText }}>
                              {t("remove", "Remove")}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                  </View>
                </View>
              ) : null}

              <View className="mt-5">
                <Text className="text-sm font-medium" style={{ color: colors.text }}>
                  {t("add_more_media", "Add more media")}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => appendFiles(["image/*"])}
                    className="rounded-full border px-4 py-2"
                    style={{ borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                      {t("add_picture", "Add picture")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => appendFiles(["video/*"])}
                    className="rounded-full border px-4 py-2"
                    style={{ borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                      {t("add_video", "Add video")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => appendFiles(["audio/*"])}
                    className="rounded-full border px-4 py-2"
                    style={{ borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.text }}>
                      {t("add_audio", "Add audio")}
                    </Text>
                  </Pressable>
                </View>

                {media.length > 0 ? (
                  <View
                    className="mt-4 rounded-2xl border p-3"
                    style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-medium" style={{ color: colors.text }}>
                        {t("new_files", "New files")}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setMedia([]);
                          setError("");
                        }}
                      >
                        <Text className="text-xs font-semibold" style={{ color: colors.textMuted }}>
                          {t("clear", "Clear")}
                        </Text>
                      </Pressable>
                    </View>

                    <View className="mt-3 gap-2">
                      {media.map((file, index) => (
                        <View
                          key={`${file.name}-${index}`}
                          className="flex-row items-center justify-between rounded-xl px-3 py-3"
                          style={{ backgroundColor: colors.inputBg }}
                        >
                          <View className="mr-3 flex-1">
                            <Text className="text-sm" style={{ color: colors.text }} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                              {formatSize(file.size)}
                            </Text>
                          </View>
                          <Ionicons name="document-outline" size={18} color={colors.textMuted} />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>

              {error ? (
                <View
                  className="mt-4 rounded-2xl border px-4 py-3"
                  style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
                >
                  <Text className="text-sm font-medium" style={{ color: colors.dangerText }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={savePost}
                disabled={processing || deleting}
                className="mt-5 flex-row items-center justify-center rounded-full px-5 py-3 disabled:opacity-60"
                style={{ backgroundColor: colors.primary }}
              >
                {processing ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>
                    {t("save_changes", "Save changes")}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={confirmDelete}
                disabled={processing || deleting}
                className="mt-3 flex-row items-center justify-center rounded-full border px-5 py-3 disabled:opacity-60"
                style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.dangerText} />
                ) : (
                  <Text className="text-sm font-semibold" style={{ color: colors.dangerText }}>
                    {t("delete_post", "Delete post")}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
