package com.eurobuddha.minimacore.main.views.apps;

import android.content.Context;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import com.google.android.material.materialswitch.MaterialSwitch;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.integrated.IntegratedApp;
import com.eurobuddha.minimacore.integrated.PandamoniumHooks;

import java.util.ArrayList;
import java.util.List;

/** The Apps tab's Internal list: our integrated apps, each with an on/off switch.
 *  Turning one off removes it from the Pandamonium app drawer until re-enabled. */
public class IntegratedAppsAdapter extends BaseAdapter {

    private final Context mContext;
    private final LayoutInflater mInflater;
    private List<IntegratedApp> mItems = new ArrayList<>();

    public IntegratedAppsAdapter(Context zContext) {
        mContext = zContext;
        mInflater = LayoutInflater.from(zContext);
    }

    public void setItems(List<IntegratedApp> zItems) {
        mItems = zItems != null ? zItems : new ArrayList<>();
        notifyDataSetChanged();
    }

    @Override public int getCount() { return mItems.size(); }
    @Override public Object getItem(int position) { return mItems.get(position); }
    @Override public long getItemId(int position) { return mItems.get(position).id; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View row = convertView != null ? convertView
                : mInflater.inflate(R.layout.view_apps_internal_row, parent, false);

        Language.apply(row);
        final IntegratedApp app = mItems.get(position);
        ImageView icon = row.findViewById(R.id.int_app_icon);
        TextView name  = row.findViewById(R.id.int_app_name);
        TextView state = row.findViewById(R.id.int_app_state);
        MaterialSwitch hide = row.findViewById(R.id.int_app_switch);
        MaterialSwitch freeze = row.findViewById(R.id.int_app_freeze);

        icon.setImageDrawable(app.icon);
        name.setText(app.name);
        CharSequence shown = Language.text(mContext, app.locked ? l10n_apps_always_on
                : app.enabled ? l10n_apps_in_drawer : l10n_apps_hidden);
        state.setText(app.frozen ? shown + " · " + Language.text(mContext, l10n_apps_frozen) : shown);

        // Clear listeners before setChecked so recycled rows don't fire a toggle.
        hide.setOnCheckedChangeListener(null);
        freeze.setOnCheckedChangeListener(null);
        hide.setChecked(!app.enabled);
        freeze.setChecked(app.frozen);
        hide.setEnabled(!app.locked);
        freeze.setEnabled(!app.locked);
        if (!app.locked) {
            hide.setOnCheckedChangeListener((btn, checked) -> {
                PandamoniumHooks.setIntegratedEnabled(mContext, app.id, !checked);
                // Rebuild from the saved state so the model and every row stay in sync.
                setItems(PandamoniumHooks.integratedApps(mContext));
            });
            freeze.setOnCheckedChangeListener((btn, checked) -> {
                CharSequence refused = PandamoniumHooks.setIntegratedFrozen(mContext, app.id, checked);
                if (refused != null) android.widget.Toast.makeText(mContext, refused.toString(),
                        android.widget.Toast.LENGTH_LONG).show();
                setItems(PandamoniumHooks.integratedApps(mContext));
            });
        }
        return row;
    }
}
