import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { formatDateInput, getLatestAllowedBirthDate, parseDateInput } from "@/lib/date";
import { useAppSettings } from "@/providers/app-settings-provider";

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
  const latestAllowedDate = useMemo(() => getLatestAllowedBirthDate(), []);
  const selectedDate = parseDateInput(value) ?? latestAllowedDate;
  const resolvedLabel = label ?? t("birth_date", "Birth date");
  const resolvedPlaceholder = placeholder || t("select_birth_date", "Select your birth date");

  function handleChange(event: DateTimePickerEvent, nextDate?: Date) {
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

      <Text
        className="mt-2 text-xs"
        style={{ color: colors.textMuted, textAlign: isRTL ? "right" : "left" }}
      >
        {t("age_requirement", "You must be 18 or older to create an account.")}
      </Text>

      {showPicker ? (
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
