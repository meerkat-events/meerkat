import type { Theme } from "../types.ts";

const purple = "#7235ED";
const text = "#160B2B";
const outline = "#2211441A";

export const devcon8: Theme = {
  brandColor: purple,
  brandHoverColor: "#9668F1",
  contrastColor: "#FFFFFF",
  background: "linear-gradient(0deg, #E5EBFF 19.98%, #FBFAFC 100%)",
  textColor: text,
  mutedTextColor: "#594D73",
  accentColor: purple,
  highlightColor: "#F5F1FE",
  shadowColor: "#160B2B33",
  inputOutlineColor: outline,
  successToastColor: "#D5F4DD",
  voteTextColor: text,
  voteOutlineColor: outline,
  questionControlSize: "32px",
  minTapTarget: "44px",
  // Fits the widest time ("06:46 AM", 54.5px in Poppins at textStyle xs).
  sessionTimeWidth: "3.5rem",
  headingFontFamily: "Poppins",
  bodyFontFamily: "Poppins",
  systemTheme: "light",
};
