import { useMemo, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { formatDateInput, getLatestAllowedBirthDate, parseDateInput } from "@/lib/date";
import { useAppSettings } from "@/providers/app-settings-provider";

type DateTimePickerModule = typeof import("@react-native-community/datetimepicker");
type DatePickerChangeEvent = {
  type?: "set" | "dismissed" | string;
};

let cachedPickerModule: DateTimePickerModule | null | undefined;

function getDateTimePickerModule() {
  if (cachedPickerModule !== undefined) {
    return cachedPickerModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedPickerModule = require("@react-native-community/datetimepicker") as DateTimePickerModule;
  } catch (error) {
    console.warn("DateTimePicker unavailable, falling back to text birth date input.", error);
    cachedPickerModule = null;
  }

  return cachedPickerModule;
}

type BirthDateFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function BirthDateField({
  label,
  value,
  onChange,
  placeholder,
}: BirthDateFieldProps) {
  const { t, isRTL, colors } = useAppSettings();
  const [showPicker, setShowPicker] = useState(false);
  const pickerModule = useMemo(() => getDateTimePickerModule(), []);
  const DateTimePicker = pickerModule?.default;
  const latestAllowedDate = useMemo(() => getLatestAllowedBirthDate(), []);
  const selectedDate = parseDateInput(value) ?? latestAllowedDate;
  const resolvedLabel = label ?? t("birth_date", "Birth date");
  const resolvedPlaceholder = placeholder || t("select_birth_date", "Select your birth date");
  const supportsNativePicker = !!DateTimePicker;

  function handleChange(event: DatePickerChangeEvent, nextDate?: Date) {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (event.type === "dismissed" || !nextDate) {
      return;
    }

    onChange(formatDateInput(nextDate));
  }

  return (
    <View>
      <Text
        className="text-sm font-medium"
        style={{ color: colors.text, textAlign: isRTL ? "right" : "left" }}
      >
        {resolvedLabel}
      </Text>

      {supportsNativePicker ? (
        <Pressable
          onPress={() => setShowPicker(true)}
          className="mt-2 rounded-xl border px-4 py-3"
          style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg }}
        >
          <Text
            className="text-sm"
            style={{
              color: value ? colors.text : colors.textMuted,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {value || resolvedPlaceholder}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || "1999-05-14"}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          className="mt-2 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.text }}
          textAlign={isRTL ? "right" : "left"}
        />
      )}

      <Text
        className="mt-2 text-xs"
        style={{ color: colors.textMuted, textAlign: isRTL ? "right" : "left" }}
      >
        {t("age_requirement", "You must be 18 or older to create an account.")}
      </Text>

      {showPicker && DateTimePicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          maximumDate={latestAllowedDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
