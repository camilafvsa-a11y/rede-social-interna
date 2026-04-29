const primary = "#2563EB";
const primaryLight = "#3B82F6";
const primaryDark = "#1D4ED8";
const accent = "#FFD700";

export default {
  light: {
    // Text
    text: "#1C1C1E",
    textSecondary: "#6C6C70",
    textMuted: "#AEAEB2",

    // Backgrounds (iOS system colors)
    background: "#F2F2F7",
    backgroundSecondary: "#FFFFFF",

    // Surfaces (cards, sheets)
    surface: "#FFFFFF",
    surfaceAlt: "#F2F2F7",
    surfaceElevated: "#FFFFFF",

    // Borders & separators
    border: "rgba(60,60,67,0.18)",
    borderLight: "rgba(60,60,67,0.10)",
    separator: "rgba(60,60,67,0.10)",

    // Brand
    tint: primary,
    tintLight: primaryLight,
    tintDark: primaryDark,
    accent,

    // Tab bar
    tabIconDefault: "#AEAEB2",
    tabIconSelected: primary,

    // Semantic colors
    danger: "#FF3B30",
    dangerLight: "#FFF1F0",
    warning: "#FF9500",
    warningLight: "#FFF8F0",
    success: "#34C759",
    successLight: "#F0FDF4",
    info: "#007AFF",
    infoLight: "#EFF6FF",

    // Input
    inputBg: "#FFFFFF",
    inputBorder: "rgba(60,60,67,0.2)",
    placeholder: "#AEAEB2",

    // Card
    card: "#FFFFFF",
    cardShadow: "rgba(0,0,0,0.07)",

    // Overlay
    overlay: "rgba(0,0,0,0.5)",

    // Tag colors
    tagColors: {
      marketing: { bg: "#FFF3CD", text: "#856404" },
      adm:       { bg: "#DBEAFE", text: "#1E40AF" },
      socio:     { bg: "#F3E8FF", text: "#6B21A8" },
      posto:     { bg: "#DCFCE7", text: "#166534" },
      churrascaria: { bg: "#FFE4E6", text: "#9F1239" },
      gerente:   { bg: "#E0F2FE", text: "#075985" },
    },
  },
};
