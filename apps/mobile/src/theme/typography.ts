import type { TextStyle } from "react-native";

export const bloomFonts = {
  display: "DMSerifDisplay",
  regular: "DMSans",
  medium: "DMSansMedium",
  semibold: "DMSansSemiBold",
} as const;

export const bloomType = {
  display: { fontFamily: bloomFonts.display, fontSize: 34, lineHeight: 42, fontWeight: "400" },
  heading: { fontFamily: bloomFonts.display, fontSize: 26, lineHeight: 34, fontWeight: "400" },
  section: { fontFamily: bloomFonts.semibold, fontSize: 20, lineHeight: 28, fontWeight: "600" },
  body: { fontFamily: bloomFonts.regular, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: bloomFonts.regular, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: bloomFonts.medium, fontSize: 12, lineHeight: 18, letterSpacing: 1 },
  button: { fontFamily: bloomFonts.semibold, fontSize: 16, lineHeight: 23, fontWeight: "600" },
} satisfies Record<string, TextStyle>;
