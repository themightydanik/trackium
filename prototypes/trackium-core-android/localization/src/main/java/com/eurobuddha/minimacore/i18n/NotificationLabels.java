package com.eurobuddha.minimacore.i18n;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;


/** Updates only names/descriptions on existing channels; user sound, vibration and importance stay intact. */
public final class NotificationLabels {
    private NotificationLabels() {}
    public static void update(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        update(context, manager, "mint_engine", R.string.l10n_creative_mint_channel, R.string.l10n_creative_mint_channel_help);
        update(context, manager, "salon_activity", R.string.l10n_creative_salon_channel, 0);
        update(context, manager, "MinimaServiceChannel", R.string.l10n_notification_node, 0);
        update(context, manager, "MinimaHealthChannel", R.string.l10n_notification_health, R.string.l10n_notification_health_help);
        update(context, manager, "KeetChatChannel_v1", R.string.l10n_notification_chat, R.string.l10n_notification_chat_help);
        update(context, manager, "MinimaChatChannel_v2", R.string.l10n_notification_parlons, R.string.l10n_notification_parlons_help);
        update(context, manager, "fcnext_fg", R.string.l10n_future_guardian, R.string.l10n_future_notice_watching);
        update(context, manager, "fcnext_alert", R.string.l10n_future_notice_alerts, R.string.l10n_future_notice_alerts_help);
        update(context, manager, "casino_fg", R.string.l10n_casino_background_channel, 0);
        update(context, manager, "casino_alert", R.string.l10n_casino_results_channel, 0);
        update(context, manager, "casino_timeouts", R.string.l10n_casino_timeout_channel, 0);
        update(context, manager, "merchinbox", R.string.l10n_mall_inbox_orders, 0);
        update(context, manager, "merchshop", R.string.l10n_mall_shop_channel, 0);
        update(context, manager, "swap_fg", R.string.l10n_atomix_notice_watcher, 0);
        update(context, manager, "atomix", R.string.l10n_atomix_notice_alerts, 0);
        update(context, manager, "swap_offline", R.string.l10n_atomix_notice_offline, 0);
        update(context, manager, "pandadex_keepalive", R.string.l10n_dex_notice_watcher, 0);
        update(context, manager, "pandadex_alert", R.string.l10n_dex_notice_alerts, 0);
        update(context, manager, "pp_keepalive", R.string.l10n_pools_keeper_channel, 0);
        update(context, manager, "pp_stranding", R.string.l10n_pools_keeper_warning_channel, R.string.l10n_pools_keeper_warning_help);
    }
    private static void update(Context context, NotificationManager manager, String id, int name, int description) {
        NotificationChannel channel = manager.getNotificationChannel(id);
        if (channel == null) return;
        String title = Language.text(context,name), detail = description == 0 ? channel.getDescription() : Language.text(context,description);
        if (title.contentEquals(channel.getName() == null ? "" : channel.getName()) && java.util.Objects.equals(detail,channel.getDescription())) return;
        channel.setName(title);channel.setDescription(detail);manager.createNotificationChannel(channel);
    }
}
