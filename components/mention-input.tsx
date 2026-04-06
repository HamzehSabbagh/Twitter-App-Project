import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  NativeSyntheticEvent,
  Pressable,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  View,
} from "react-native";
import { API_BASE_URL, parseJsonResponse } from "@/lib/api";
import { getProfileImageSource } from "@/lib/profile-images";
import { useAuth } from "@/providers/auth-provider";
import { useAppSettings } from "@/providers/app-settings-provider";

type MentionUser = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username: string;
  picture_url?: string | null;
};

type MentionInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  minHeight?: number;
  multiline?: boolean;
  textAlign?: "left" | "right" | "center";
};

type ActiveMention = {
  query: string;
  start: number;
  end: number;
};

function getDisplayName(user: MentionUser) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username;
}

function getActiveMention(value: string, cursor: number): ActiveMention | null {
  const prefix = value.slice(0, cursor);
  const match = prefix.match(/(^|\s)@([A-Za-z0-9_]*)$/);

  if (!match) {
    return null;
  }

  const query = match[2] ?? "";
  const start = cursor - query.length - 1;

  return {
    query,
    start,
    end: cursor,
  };
}

export function MentionInput({
  value,
  onChangeText,
  placeholder,
  minHeight = 112,
  multiline = true,
  textAlign = "left",
}: MentionInputProps) {
  const { authFetch } = useAuth();
  const { colors } = useAppSettings();
  const [selectionStart, setSelectionStart] = useState(value.length);
  const [pendingSelection, setPendingSelection] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const activeMention = useMemo(
    () => getActiveMention(value, selectionStart),
    [selectionStart, value]
  );

  useEffect(() => {
    if (!activeMention || activeMention.query.length === 0) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setLoadingSuggestions(true);

      try {
        const response = await authFetch(
          `${API_BASE_URL}/users/search?query=${encodeURIComponent(activeMention.query)}`
        );
        const data = await parseJsonResponse<MentionUser[]>(response);

        if (!cancelled) {
          setSuggestions(data);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeMention, authFetch]);

  function handleSelectionChange(
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) {
    setSelectionStart(event.nativeEvent.selection.start);
  }

  function applySuggestion(user: MentionUser) {
    if (!activeMention) {
      return;
    }

    const replacement = `@${user.username} `;
    const nextValue =
      value.slice(0, activeMention.start) +
      replacement +
      value.slice(activeMention.end);

    const nextCursor = activeMention.start + replacement.length;
    onChangeText(nextValue);
    setSuggestions([]);
    setPendingSelection(nextCursor);
    setSelectionStart(nextCursor);
  }

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        multiline={multiline}
        textAlignVertical="top"
        selection={pendingSelection !== null ? { start: pendingSelection, end: pendingSelection } : undefined}
        onSelectionChange={handleSelectionChange}
        onLayout={() => {
          if (pendingSelection !== null) {
            setPendingSelection(null);
          }
        }}
        className="mt-2 rounded-2xl border p-3"
        style={{
          minHeight,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBg,
          color: colors.text,
        }}
        textAlign={textAlign}
      />

      {activeMention ? (
        <View
          className="mt-2 rounded-2xl border"
          style={{ borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt }}
        >
          {loadingSuggestions ? (
            <View className="items-center py-4">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <Pressable
                key={suggestion.id}
                onPress={() => applySuggestion(suggestion)}
                className="flex-row items-center px-4 py-3"
                style={{
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <View className="mr-3 overflow-hidden rounded-full border" style={{ borderColor: colors.borderSoft }}>
                  <Image
                    source={getProfileImageSource(suggestion.picture_url)}
                    className="h-10 w-10"
                    resizeMode="cover"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                    {getDisplayName(suggestion)}
                  </Text>
                  <Text className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                    @{suggestion.username}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : activeMention.query.length > 0 ? (
            <View className="px-4 py-3">
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                No matching users found.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
