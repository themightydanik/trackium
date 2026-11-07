plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
 namespace="tech.trackium.cargo"
 compileSdk=36
 defaultConfig { applicationId="tech.trackium.cargo"; minSdk=28; targetSdk=36; versionCode=1; versionName="0.1.0-native-foundation" }
 compileOptions { sourceCompatibility=JavaVersion.VERSION_17; targetCompatibility=JavaVersion.VERSION_17 }
 kotlinOptions { jvmTarget="17" }
 testOptions { unitTests.isReturnDefaultValues=true }
 buildTypes { getByName("release") { isMinifyEnabled=false } }
}
dependencies { implementation(project(":minimaapi")); testImplementation("junit:junit:4.13.2"); testImplementation("org.json:json:20240303") }
