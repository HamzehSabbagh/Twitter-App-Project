import * as VideoThumbnails from "expo-video-thumbnails";
import { useEvent } from "expo";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useAppSettings } from "@/providers/app-settings-provider";

type BaseMediaProps = {
  label?: string;
  mimeType?: string | null;
};

type SharedMediaPlayer = {
  pause: () => void | Promise<void>;
};

let activeMediaPlayer: SharedMediaPlayer | null = null;

async function pauseSharedMediaPlayer(player: SharedMediaPlayer | null) {
  if (!player) {
    return;
  }

  try {
    await player.pause();
  } catch {
    // Ignore pause failures from players that are already stopped/unmounted.
  }
}

async function claimActiveMediaPlayer(player: SharedMediaPlayer) {
  if (activeMediaPlayer && activeMediaPlayer !== player) {
    await pauseSharedMediaPlayer(activeMediaPlayer);
  }

  activeMediaPlayer = player;
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function ImagePreviewCard({ uri, label }: { uri: string; label?: string }) {
  const { colors } = useAppSettings();

  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
    >
      <Image source={{ uri }} className="h-72 w-full" resizeMode="contain" />
      {label ? (
        <View className="border-t px-3 py-3" style={{ borderColor: colors.borderSoft, backgroundColor: colors.inputBg }}>
          <Text className="text-sm" style={{ color: colors.text }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function VideoPreviewCard({
  uri,
  label,
  mimeType,
}: BaseMediaProps & {
  uri: string;
}) {
  const { colors, t } = useAppSettings();
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = false;
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const { status, error } = useEvent(player, "statusChange", { status: player.status, error: undefined });
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnail() {
      try {
        const result = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 800,
        });

        if (!cancelled) {
          setThumbnailUri(result.uri);
        }
      } catch {
        if (!cancelled) {
          setThumbnailUri(null);
        }
      }
    }

    loadThumbnail();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    if (isPlaying) {
      void claimActiveMediaPlayer(player);
      return;
    }

    if (activeMediaPlayer === player) {
      activeMediaPlayer = null;
    }
  }, [isPlaying, player]);

  useEffect(() => {
    return () => {
      if (activeMediaPlayer === player) {
        void pauseSharedMediaPlayer(player);
        activeMediaPlayer = null;
      }
    };
  }, [player]);

  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
    >
      <View style={{ width: "100%", height: 240, backgroundColor: "#000" }}>
        {!isPlaying && thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : null}
        {!isPlaying ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(2, 6, 23, 0.6)" }}>
              <Ionicons name="play" size={26} color="#FFFFFF" />
            </View>
          </View>
        ) : null}
        <VideoView
          player={player}
          nativeControls
          style={{ width: "100%", height: 240 }}
          contentFit="contain"
        />
      </View>
      <View className="gap-2 border-t px-4 py-3" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold" style={{ color: colors.text }} numberOfLines={1}>
              {label || t("video", "Video")}
            </Text>
            <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
              {mimeType || t("video_attachment", "Video attachment")}
            </Text>
          </View>
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: isPlaying ? colors.primarySoft : colors.surfaceAlt }}
          >
            <Text className="text-xs font-semibold" style={{ color: isPlaying ? colors.accentText : colors.textMuted }}>
              {isPlaying ? t("playing", "Playing") : t("paused", "Paused")}
            </Text>
          </View>
        </View>
        {status === "error" ? (
          <Text className="text-xs" style={{ color: colors.dangerText }}>
            {error?.message || t("video_could_not_load", "This video could not be loaded.")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function VideoPreviewPosterCard({
  uri,
  label,
  mimeType,
  onPress,
}: BaseMediaProps & {
  uri: string;
  onPress?: () => void;
}) {
  const { colors, t } = useAppSettings();
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnail() {
      try {
        const result = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 800,
        });

        if (!cancelled) {
          setThumbnailUri(result.uri);
        }
      } catch {
        if (!cancelled) {
          setThumbnailUri(null);
        }
      }
    }

    loadThumbnail();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
    >
      <View style={{ width: "100%", height: 240, backgroundColor: "#000" }}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="videocam" size={34} color="#FFFFFF" />
          </View>
        )}

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(2, 6, 23, 0.65)" }}>
            <Ionicons name="play" size={26} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <View className="border-t px-4 py-3" style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}>
        <Text className="text-sm font-semibold" style={{ color: colors.text }} numberOfLines={1}>
          {label || t("video", "Video")}
        </Text>
        <Text className="mt-1 text-xs" style={{ color: colors.textMuted }} numberOfLines={1}>
          {mimeType || t("video_attachment", "Video attachment")}
        </Text>
        <Text className="mt-2 text-xs font-semibold" style={{ color: colors.accentText }}>
          {t("open_post_to_play_video", "Open the post to play this video.")}
        </Text>
      </View>
    </Pressable>
  );
}

export function AudioPreviewCard({
  uri,
  label,
  mimeType,
}: BaseMediaProps & {
  uri: string;
}) {
  const { colors, t } = useAppSettings();
  const player = useAudioPlayer({ uri }, { updateInterval: 500, downloadFirst: true });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || player.duration || 0;
  const currentTime = status.currentTime || player.currentTime || 0;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    return () => {
      if (activeMediaPlayer === player) {
        void pauseSharedMediaPlayer(player);
        activeMediaPlayer = null;
      }
    };
  }, [player]);

  useEffect(() => {
    if (!status.playing && activeMediaPlayer === player) {
      activeMediaPlayer = null;
    }
  }, [player, status.playing]);

  async function seekBy(seconds: number) {
    const maxTime = duration > 0 ? duration : currentTime;
    const targetTime = Math.max(0, Math.min(maxTime, currentTime + seconds));

    try {
      await player.seekTo(targetTime);
    } catch {
      // no-op if seeking is not currently available
    }
  }

  async function togglePlayback() {
    if (status.playing) {
      player.pause();

      if (activeMediaPlayer === player) {
        activeMediaPlayer = null;
      }

      return;
    }

    await claimActiveMediaPlayer(player);

    if (status.didJustFinish || (duration > 0 && currentTime >= duration - 0.25)) {
      try {
        await player.seekTo(0);
      } catch {
        // no-op, the player can still attempt playback from the current position
      }
    }

    await player.play();
  }

  return (
    <View
      className="rounded-2xl border px-4 py-4"
      style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color: colors.text }} numberOfLines={1}>
            {label || t("audio", "Audio")}
          </Text>
          <Text className="mt-1 text-xs" style={{ color: colors.textMuted }} numberOfLines={1}>
            {mimeType || t("audio_attachment", "Audio attachment")}
          </Text>
        </View>
        <Text className="text-xs font-semibold" style={{ color: colors.textMuted }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>

      <View className="mt-4 flex-row items-center justify-center gap-4">
        <View className="items-center">
          <Pressable
            onPress={() => {
              void seekBy(-10);
            }}
            className="h-11 w-11 items-center justify-center rounded-full border"
            style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
          >
            <Ionicons name="play-back" size={18} color={colors.text} />
          </Pressable>
          <Text className="mt-2 text-[11px] font-semibold" style={{ color: colors.textMuted }}>
            -10s
          </Text>
        </View>

        <Pressable
          onPress={togglePlayback}
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.primarySoft }}
        >
          <Ionicons
            name={status.playing ? "pause" : "play"}
            size={24}
            color={colors.accentText}
          />
        </Pressable>

        <View className="items-center">
          <Pressable
            onPress={() => {
              void seekBy(10);
            }}
            className="h-11 w-11 items-center justify-center rounded-full border"
            style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
          >
            <Ionicons name="play-forward" size={18} color={colors.text} />
          </Pressable>
          <Text className="mt-2 text-[11px] font-semibold" style={{ color: colors.textMuted }}>
            +10s
          </Text>
        </View>
      </View>

      <View className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.inputBorder }}>
        <View
          className="h-full rounded-full"
          style={{ width: `${progress}%`, backgroundColor: colors.primary }}
        />
      </View>
    </View>
  );
}

export function AudioPreviewSummaryCard({
  label,
  mimeType,
  onPress,
}: BaseMediaProps & {
  onPress?: () => void;
}) {
  const { colors, t } = useAppSettings();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="rounded-2xl border px-4 py-4"
      style={{ borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.primarySoft }}
        >
          <Ionicons name="musical-notes" size={22} color={colors.accentText} />
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color: colors.text }} numberOfLines={1}>
            {label || t("audio", "Audio")}
          </Text>
          <Text className="mt-1 text-xs" style={{ color: colors.textMuted }} numberOfLines={1}>
            {mimeType || t("audio_attachment", "Audio attachment")}
          </Text>
          <Text className="mt-2 text-xs font-semibold" style={{ color: colors.accentText }}>
            {t("open_post_to_play_audio", "Open the post to play this audio.")}
          </Text>
        </View>

        <View
          className="h-11 w-11 items-center justify-center rounded-full border"
          style={{ borderColor: colors.borderSoft, backgroundColor: colors.surface }}
        >
          <Ionicons name="play" size={18} color={colors.text} />
        </View>
      </View>
    </Pressable>
  );
}
