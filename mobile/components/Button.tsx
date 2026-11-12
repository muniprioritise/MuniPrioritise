import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const { colors } = theme;

const VARIANTS: Record<Variant, { background: string; border: string; text: string }> = {
  primary: { background: colors.brand, border: colors.brand, text: colors.onBrand },
  secondary: { background: colors.surface, border: colors.brand, text: colors.brand },
  danger: { background: colors.surface, border: colors.danger, text: colors.danger },
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={20} color={palette.text} style={styles.icon} /> : null}
          <Text style={[styles.text, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.hit + 4,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center" },
  icon: { marginRight: theme.spacing.sm },
  text: { fontSize: theme.font.body, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
