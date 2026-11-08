package com.eurobuddha.minimacore.service;

import static android.app.PendingIntent.FLAG_IMMUTABLE;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.minima.utils.MinimaLogger;

public class Alarm extends BroadcastReceiver
{
    @Override
    public void onReceive(Context context, Intent intent){
        MinimaLogger.log("MINIMA ALARM RECEIVED : Start Service");

        //Create the Minima Service Intent
        try{
            Intent serviceintent = new Intent(context, MinimaService.class);
            context.startForegroundService(serviceintent);
        }catch(Exception exc){
            MinimaLogger.log("Cannot start foreground service : "+exc);
        }

        //This hourly tick is the app's only background scheduler, so the node health
        //check rides it. It is a no-op when the node is not up.
        try{
            NodeHealthMonitor.checkAsync(context);
        }catch(Exception exc){
            MinimaLogger.log("Node health check failed to start : "+exc);
        }

        //Send a start service JOB
        //ServiceStarterJobService.enqueueWork(context, new Intent());
    }

    public void setAlarm(Context context){
        //MinimaLogger.log("MINIMA ALARM SET");

        AlarmManager am =( AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, Alarm.class);

        PendingIntent pi = PendingIntent.getBroadcast(context, 0, intent, FLAG_IMMUTABLE);

        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis(), AlarmManager.INTERVAL_HOUR , pi); // Millisec * Second * Minute
//        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis(), 1000 * 60 * 1 , pi); // Millisec * Second * Minute
    }

    /**
     * One shot, soon. Used after an automatic resync: the in-process restart is a Handler post
     * and dies with the process, which Android may kill the moment the service is gone. This
     * survives that. Inexact on purpose - exact alarms need a runtime permission on 31+ and a
     * few seconds either way does not matter here.
     */
    public void setOnce(Context context, long delayMillis){
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, Alarm.class);
        PendingIntent pi = PendingIntent.getBroadcast(context, 1, intent, FLAG_IMMUTABLE);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delayMillis, pi);
    }

    public void cancelAlarm(Context context){
        //MinimaLogger.log("MINIMA ALARM CANCELLED");

        Intent intent = new Intent(context, Alarm.class);

        PendingIntent pi = PendingIntent.getBroadcast(context, 0, intent, FLAG_IMMUTABLE);

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarmManager.cancel(pi);
    }
}
