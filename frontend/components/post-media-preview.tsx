import { View } from "react-native";
import {
  AudioPreviewCard,
  AudioPreviewSummaryCard,
  ImagePreviewCard,
  VideoPreviewCard,
  VideoPreviewPosterCard,
} from "@/components/media-preview-cards";
import { useAppSettings } from "@/providers/app-settings-provider";

type PostMedia = {
  id: number;
  type: string;
  url: string;
  mime_type?: string | null;
};

export function PostMediaPreview({
  media,
  interactive = true,
  onOpenPost,
}: {
  media: PostMedia[];
  interactive?: boolean;
  onOpenPost?: () => void;
}) {
  const { t } = useAppSettings();

  if (!media.length) {
    return null;
  }

  return (
    <View
      className="mt-4 gap-3"
      onStartShouldSetResponder={() => interactive}
    >
      {media.slice(0, 2).map((item) => {
        if (item.type === "image") {
          return <ImagePreviewCard key={item.id} uri={item.url} />;
        }

        if (item.type === "video") {
          if (!interactive) {
            return (
              <VideoPreviewPosterCard
                key={item.id}
                uri={item.url}
                mimeType={item.mime_type}
                label={t("video", "Video")}
                onPress={onOpenPost}
              />
            );
          }

          return <VideoPreviewCard key={item.id} uri={item.url} mimeType={item.mime_type} />;
        }

        if (item.type === "audio") {
          if (!interactive) {
            return (
              <AudioPreviewSummaryCard
                key={item.id}
                mimeType={item.mime_type}
                label={t("audio", "Audio")}
                onPress={onOpenPost}
              />
            );
          }

          return <AudioPreviewCard key={item.id} uri={item.url} mimeType={item.mime_type} />;
        }

        return null;
      })}
    </View>
  );
}
