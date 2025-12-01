package com.athulm.testapp

import android.app.Service
import android.app.Notification
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

class RecordingService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        val notification: Notification = NotificationCompat.Builder(this, "recording_channel")
            .setContentTitle("Recording…")
            .setContentText("Active background recording")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()

        startForeground(1, notification)

        // Trigger JS headless task
        RecordingHeadlessTask.start(this)

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
