package com.athulm.testapp

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.ReactApplication

class RecordingHeadlessTask : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        return HeadlessJsTaskConfig(
            "BackgroundRecordingTask",
            Arguments.createMap(),
            0,
            true
        )
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, RecordingHeadlessTask::class.java)
            HeadlessJsTaskService.acquireWakeLockNow(context)
            context.startService(intent)
        }
    }
}
