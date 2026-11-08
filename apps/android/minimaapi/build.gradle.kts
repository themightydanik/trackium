plugins { id("com.android.library") }
android {
 namespace="com.eurobuddha.minimaapi"
 compileSdk=36
 testOptions { unitTests.isReturnDefaultValues=true }
 defaultConfig { minSdk=28 }
 compileOptions { sourceCompatibility=JavaVersion.VERSION_11; targetCompatibility=JavaVersion.VERSION_11 }
}

dependencies { testImplementation("junit:junit:4.13.2"); testImplementation("org.mockito:mockito-core:5.12.0"); testImplementation("org.json:json:20240303") }
