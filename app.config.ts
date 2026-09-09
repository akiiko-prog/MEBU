import PackageJSON from "./package.json";

// Xcode Cloud sets CI_XCODE_CLOUD=TRUE — use a separate internal version
// so its sequential build numbers never conflict with manual uploads.
const isXcodeCloud = process.env.CI_XCODE_CLOUD === "TRUE";
const appVersion = isXcodeCloud ? "99.0.0" : PackageJSON.version;

if (!isXcodeCloud && PackageJSON.version === "99.0.0") {
  throw new Error("Version 99.0.0 is reserved for Xcode Cloud internal builds.");
}

const androidPreVersion = PackageJSON.version.replaceAll(".", "");
const androidVersionCode =
  androidPreVersion.length == 3
    ? parseInt(androidPreVersion + "00")
    : androidPreVersion.length == 4
      ? parseInt(androidPreVersion + "0")
      : parseInt(androidPreVersion);

module.exports = {
  expo: {
    name: "MEBU",
    slug: "mebu",
    version: appVersion,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: ["mebu", "izly", "skoapp-prod"],
    platforms: ["ios", "android"],
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    extra: {
      eas: {
        projectId: "7c73c7d8-e7cf-4840-9ec0-a4c5bc7ddcf1",
      },
    },

    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "cover",
      backgroundColor: "#0060D6",
    },
    ios: {
      appStoreUrl:
        "https://apps.apple.com/us/app/papillon-lappli-scolaire/id6477761165",
      bundleIdentifier: "fr.akiiko.mebu",
      associatedDomains: [],
      buildNumber: "4",
      icon: "./assets/app.icon",
      minimumOSVersion: "17.6",
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["papillon", "izly", "skoapp-prod"],
          },
        ],
        CADisableMinimumFrameDurationOnPhone: true,
        UIBackgroundModes: ["fetch", "remote-notification"],
        UISupportedInterfaceOrientations: [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
        ],
        "UISupportedInterfaceOrientations~ipad": [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
        ],
      },
      entitlements: {
        "com.apple.security.application-groups": ["group.fr.akiiko.mebu"]
      },
      supportsTablet: true,
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      versionCode: 83125,
      package: "fr.akiiko.mebu",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
        monochromeImage: "./assets/images/monochrome-icon.png",
      },
      edgeToEdgeEnabled: true,
      splash: {
        image: "./assets/images/splash_android.png",
        resizeMode: "cover",
        backgroundColor: "#0060D6",
      },
      supportsTablet: true,
      blockedPermissions: [
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.FOREGROUND_SERVICE_MICROPHONE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "./plugins/withXcodeSchemes",
      "./plugins/withRemoveAudioServices",
      "expo-router",
      "expo-font",
      "expo-video",
      "expo-localization",
      [
        "expo-image-picker",
        {
          photosPermission:
            "MEBU utilise ta galerie pour te permettre de personnaliser ta photo de profil",
        },
      ],
      "expo-web-browser",
      [
        "react-native-fast-tflite",
        {
          enableCoreMLDelegate: true,
          enableAndroidGpuLibraries: true,
        },
      ],
      "react-native-bottom-tabs",
      "expo-secure-store",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "MEBU utilise ton emplacement pour trouver les établissements autour de toi.",
          cameraPermission:
            "MEBU utilise ta caméra pour scanner des QR-codes pour te connecter, pour capturer des documents, ou pour des fonctionnalités amusantes telles que les réactions.",
        },
      ],
      [
        "react-native-edge-to-edge",
        {
          android: {
            parentTheme: "Material3",
            enforceNavigationBarContrast: false,
          },
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            enable16KbPageSizes: true,
          },
          ios: {
            extraPods: [
              { name: "SDWebImage", modular_headers: true },
              { name: "SDWebImageSVGCoder", modular_headers: true },
            ],
          },
        },
      ],
      [
        "react-native-widget-extension",
        {
          frequentUpdates: true,
          groupIdentifier: "group.app.chrysalide.epita"
        }
      ],
      [
        "@hot-updater/react-native",
        {
          channel: "production"
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
