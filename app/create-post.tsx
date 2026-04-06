import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
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
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_MEDIA_COUNT = 4;

type SelectedFile = {
  name: string;
  size: number;
  mimeType: string;
  uri: string;
};

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default function CreatePostScreen() {
  const { authFetch, token } = useAuth();
  const { t, isRTL, colors } = useAppSettings();
  const [content, setContent] = useState("");
  const [parentId, setParentId] = useState("");
  const [media, setMedia] = useState<SelectedFile[]>([]);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

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

    if (media.length + selectedFiles.length > MAX_MEDIA_COUNT) {
      setError(t("max_4_files", "You can upload up to 4 files per post."));
      Alert.alert(t("too_many_files", "Too many files"), t("max_4_files", "You can upload up to 4 files per post."));
      return;
    }

    setError("");
    setMedia((current) => [...current, ...selectedFiles]);
  }

  async function publishPost() {
    if (!token) {
      const message = t("sign_in_required", "You need to log in first.");
      setError(message);
      Alert.alert(t("login", "Log in"), message);
      router.push("/login");
      return;
    }

    if (!content.trim() && media.length === 0) {
      setError(t("write_something_attach_file", "Write something or attach at least one file."));
      Alert.alert(t("missing_content_title", "Missing content"), t("write_something_attach_file", "Write something or attach at least one file."));
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const formData = new FormData();

      if (content.trim()) {
        formData.append("content", content);
      }

      if (parentId.trim()) {
        formData.append("parent_id", parentId);
      }

      media.forEach((file, index) => {
        formData.append("media[]", {
          uri: file.uri,
          name: file.name || `upload-${index}`,
          type: file.mimeType,
        } as never);
      });

      const response = await authFetch(`${API_BASE_URL}/posts`, {
        method: "POST",
        body: formData,
      });

      await parseJsonResponse(response);

      Alert.alert(t("post_created", "Post created"), t("post_created_success", "Your post was submitted successfully."));
      setContent("");
      setParentId("");
      setMedia([]);
      router.back();
    } catch (submissionError) {
      console.log(submissionError);
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Could not publish post.";
      setError(message);
      Alert.alert(t("publish_failed", "Publish failed"), message);
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
            <Text className="text-xs font-semibold" style={{ color: colors.text }}>{t("back_home", "Back to Home")}</Text>
          </Pressable>

          <View className="rounded-[28px] border p-4" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
            <Text className="text-2xl font-semibold" style={{ color: colors.text }}>{t("create_post_screen_title", "Create post")}</Text>
            <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
              {t("create_post_screen_description", "Publish a new post or enter a parent post ID to make it part of a thread.")}
            </Text>
          </View>

          <View className="mt-5 rounded-[28px] border p-4" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
            <View className="gap-2">
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("content", "Content")}</Text>
              <MentionInput
                value={content}
                onChangeText={setContent}
                placeholder={t("what_is_happening", "What is happening?")}
                minHeight={160}
                textAlign={isRTL ? "right" : "left"}
              />
            </View>

            <View className="mt-4 gap-2">
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("parent_post_id", "Parent post ID")}</Text>
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

            <View className="mt-5">
              <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("attach_media", "Attach media")}</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Pressable
                  onPress={() => appendFiles(["image/*"])}
                  className="rounded-full border px-4 py-2"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt }}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.text }}>{t("add_picture", "Add picture")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => appendFiles(["video/*"])}
                  className="rounded-full border px-4 py-2"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt }}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.text }}>{t("add_video", "Add video")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => appendFiles(["audio/*"])}
                  className="rounded-full border px-4 py-2"
                  style={{ borderColor: colors.inputBorder, backgroundColor: colors.surfaceAlt }}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.text }}>{t("add_audio", "Add audio")}</Text>
                </Pressable>
              </View>

              {media.length > 0 ? (
                <View className="mt-4 rounded-2xl border p-3" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium" style={{ color: colors.text }}>{t("selected_files", "Selected files")}</Text>
                    <Pressable
                      onPress={() => {
                        setMedia([]);
                        setError("");
                      }}
                    >
                        <Text className="text-xs font-semibold" style={{ color: colors.textMuted }}>{t("clear", "Clear")}</Text>
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
              <View className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }}>
                <Text className="text-sm font-medium" style={{ color: colors.dangerText }}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={publishPost}
              disabled={processing}
              className="mt-5 flex-row items-center justify-center rounded-full px-5 py-3 disabled:opacity-60"
              style={{ backgroundColor: colors.primary }}
            >
              {processing ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                  <Text className="text-sm font-semibold" style={{ color: colors.primaryText }}>{t("publish_post", "Publish post")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
