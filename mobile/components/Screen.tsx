import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

// For screens under a navigation header, which already covers the top inset.
export const CONTENT_EDGES: Edge[] = ["left", "right", "bottom"];

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  background?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

// Safe area, background and keyboard handling in one place, so each screen does not rebuild them.
export default function Screen({
  children,
  scroll = false,
  edges = ["top", "left", "right"],
  background = theme.colors.background,
  contentContainerStyle,
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: background }]} edges={edges}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
