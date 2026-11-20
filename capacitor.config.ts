import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.icodeforbananas.wordclimb",
  appName: "Word Climb",
  webDir: "dist",
  backgroundColor: "#dcebf7",
  ios: {
    contentInset: "never",
    // Keeps the WebView from rubber-banding the whole screen when a kid drags.
    scrollEnabled: false,
  },
};

export default config;
