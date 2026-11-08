import { MaterialCommunityIcons } from "@expo/vector-icons";

import { CATEGORY_ICONS } from "@/constants/categories";
import type { ReportCategory } from "@/types/report";

interface CategoryIconProps {
  category: string;
  size: number;
  color: string;
}

// Jobs carry the category as a plain string, so match it case-insensitively.
function toCategory(category: string) {
  return (category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()) as ReportCategory;
}

export default function CategoryIcon({ category, size, color }: CategoryIconProps) {
  const name = CATEGORY_ICONS[toCategory(category)] ?? "alert-circle-outline";
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
