import { useMemo } from "react";
import { StyleProp, Text, TextStyle } from "react-native";
import { router } from "expo-router";
import { useAppSettings } from "@/providers/app-settings-provider";

type RichContentTextProps = {
  content?: string | null;
  fallback?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

type Segment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; username: string }
  | { type: "hashtag"; value: string; hashtag: string };

const TOKEN_REGEX = /(@[A-Za-z0-9_]+|#[A-Za-z0-9_]+)/g;

function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(TOKEN_REGEX)) {
    const value = match[0];
    const startIndex = match.index ?? 0;

    if (startIndex > lastIndex) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex, startIndex),
      });
    }

    if (value.startsWith("@")) {
      segments.push({
        type: "mention",
        value,
        username: value.slice(1),
      });
    } else {
      segments.push({
        type: "hashtag",
        value,
        hashtag: value.slice(1),
      });
    }

    lastIndex = startIndex + value.length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      value: content.slice(lastIndex),
    });
  }

  if (!segments.length) {
    segments.push({
      type: "text",
      value: content,
    });
  }

  return segments;
}

export function RichContentText({
  content,
  fallback,
  style,
  numberOfLines,
}: RichContentTextProps) {
  const { colors } = useAppSettings();
  const resolvedContent = content?.trim() || fallback || "";

  const segments = useMemo(() => parseSegments(resolvedContent), [resolvedContent]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <Text key={`text-${index}`}>{segment.value}</Text>;
        }

        if (segment.type === "mention") {
          return (
            <Text
              key={`mention-${segment.username}-${index}`}
              suppressHighlighting
              onPress={() =>
                router.push({
                  pathname: "/profile/[username]",
                  params: { username: segment.username },
                })
              }
              style={{ color: colors.accentText, fontWeight: "600" }}
            >
              {segment.value}
            </Text>
          );
        }

        return (
          <Text
            key={`hashtag-${segment.hashtag}-${index}`}
            suppressHighlighting
            onPress={() =>
              router.push({
                pathname: "/hashtag/[name]",
                params: { name: segment.hashtag },
              })
            }
            style={{ color: colors.accentText, fontWeight: "600" }}
          >
            {segment.value}
          </Text>
        );
      })}
    </Text>
  );
}
