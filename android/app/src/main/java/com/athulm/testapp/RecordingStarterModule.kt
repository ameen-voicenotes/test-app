package com.athulm.testapp

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RecordingStarterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RecordingStarter")

    Function("startService") {
      val ctx = appContext.reactContext ?: return@Function null
      val intent = Intent(ctx, RecordingService::class.java)
      ctx.startForegroundService(intent)
      null
    }

    Function("stopService") {
      val ctx = appContext.reactContext ?: return@Function null
      val intent = Intent(ctx, RecordingService::class.java)
      ctx.stopService(intent)
      null
    }
  }
}
