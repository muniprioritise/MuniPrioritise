// Brand tokens. Colours match the supervisor dashboard so both clients read as one product.
export const theme = {
  colors: {
    brand: "#165D5A",
    brandStrong: "#114B49",
    brandSoft: "#E8F0EE",
    accent: "#F2B705",
    background: "#F5F7F8",
    surface: "#FFFFFF",
    surfaceSoft: "#EEF2F3",
    text: "#1A2D34",
    muted: "#5C6F75",
    stroke: "#D5DDE0",
    onBrand: "#FFFFFF",
    danger: "#8D2D2D",
    dangerSoft: "#FBE9E9",
    warning: "#A15B07",
    warningSoft: "#FFF1DC",
    ok: "#276749",
    okSoft: "#E3F2E9",
    info: "#1D3557",
    infoSoft: "#E4EAF3",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  font: { title: 26, heading: 18, body: 16, small: 14, caption: 12 },
  // Minimum touch target, for residents with low digital literacy (NFR-04).
  hit: 48,
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  },
} as const;
