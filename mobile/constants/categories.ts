import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

import type { ReportCategory } from "@/types/report";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export const CATEGORY_ICONS: Record<ReportCategory, IconName> = {
  Water: "water",
  Electricity: "flash",
  Roads: "road-variant",
  Refuse: "trash-can",
  Sanitation: "toilet",
};
