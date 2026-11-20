const { withAppBuildGradle } = require("expo/config-plugins");

// Credentials are read by Gradle, never written into generated source or JS.
const marker = "// CB Connect owner release signing";
module.exports = function withOwnerAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") throw new Error("Unsupported Android Gradle format");
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `
${marker}
def cbSigningNames = ['CB_ANDROID_RELEASE_KEYSTORE', 'CB_ANDROID_RELEASE_STORE_PASSWORD', 'CB_ANDROID_RELEASE_ALIAS', 'CB_ANDROID_RELEASE_KEY_PASSWORD']
def cbHasOwnerSigning = cbSigningNames.every { System.getenv(it)?.trim() }
android {
    signingConfigs {
        ownerRelease {
            if (cbHasOwnerSigning) {
                storeFile file(System.getenv('CB_ANDROID_RELEASE_KEYSTORE'))
                storePassword System.getenv('CB_ANDROID_RELEASE_STORE_PASSWORD')
                keyAlias System.getenv('CB_ANDROID_RELEASE_ALIAS')
                keyPassword System.getenv('CB_ANDROID_RELEASE_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
        release {
            signingConfig cbHasOwnerSigning ? signingConfigs.ownerRelease : null
            debuggable false
        }
    }
}
gradle.taskGraph.whenReady { graph ->
    if (graph.allTasks.any { it.project.path == ':app' && it.name.toLowerCase().contains('release') } && !cbHasOwnerSigning) {
        throw new GradleException('Release requires the owner signing environment; debug signing is forbidden')
    }
}
`;
    }
    return mod;
  });
};
