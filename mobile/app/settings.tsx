import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import Button from "@/components/Button";
import Card from "@/components/Card";
import Screen, { CONTENT_EDGES } from "@/components/Screen";
import { theme } from "@/constants/theme";
import { usePreferences } from "@/hooks/usePreferences";
import type { MapStyle, ReportOrder } from "@/utils/preferences";

const { colors, spacing } = theme;

const MAP_STYLE_OPTIONS: { value: MapStyle; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "satellite", label: "Satellite" },
];

const ORDER_OPTIONS: { value: ReportOrder; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "severity", label: "Most severe" },
];

interface OptionPickerProps<T extends string> {
  label: string;
  hint: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

// A row of buttons where exactly one is selected.
function OptionPicker<T extends string>({ label, hint, options, selected, onSelect }: OptionPickerProps<T>) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const active = option.value === selected;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}: ${option.label}`}
              onPress={() => onSelect(option.value)}
              style={[styles.option, active && styles.optionActive]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export default function SettingsScreen() {
  const { preferences, update, reset } = usePreferences();

  return (
    <Screen scroll edges={[...CONTENT_EDGES]} contentContainerStyle={styles.content}>
      <OptionPicker
        label="Map style"
        hint="How the map on the Map tab is drawn."
        options={MAP_STYLE_OPTIONS}
        selected={preferences.mapStyle}
        onSelect={(value) => update("mapStyle", value)}
      />

      <OptionPicker
        label="Report order"
        hint="How your reports are sorted on the Home tab."
        options={ORDER_OPTIONS}
        selected={preferences.reportOrder}
        onSelect={(value) => update("reportOrder", value)}
      />

      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>Compact report cards</Text>
            <Text style={styles.hint}>Hide the description so more reports fit on the screen.</Text>
          </View>
          <Switch
            accessibilityLabel="Compact report cards"
            value={preferences.compactCards}
            onValueChange={(value) => update("compactCards", value)}
            trackColor={{ false: colors.stroke, true: colors.brand }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <Text style={styles.footnote}>Your choices are saved on this phone and stay when you close the app.</Text>

      <Button title="Reset to defaults" icon="refresh-outline" variant="secondary" onPress={reset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  card: { gap: spacing.sm },
  label: { fontSize: theme.font.body, fontWeight: "700", color: colors.text },
  hint: { fontSize: theme.font.small, color: colors.muted, lineHeight: 20 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  option: {
    minHeight: theme.hit,
    paddingHorizontal: spacing.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { fontSize: theme.font.small, fontWeight: "600", color: colors.text },
  optionTextActive: { color: colors.onBrand },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  switchText: { flex: 1, gap: spacing.xs },
  footnote: { fontSize: theme.font.caption, color: colors.muted, textAlign: "center" },
});
