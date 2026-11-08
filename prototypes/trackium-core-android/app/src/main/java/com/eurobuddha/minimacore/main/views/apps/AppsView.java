package com.eurobuddha.minimacore.main.views.apps;

import android.app.Activity;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import androidx.appcompat.app.AlertDialog;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.content.DialogInterface;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.drawable.Drawable;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.AdapterView;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.ListView;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.google.android.material.tabs.TabLayout;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.integrated.IntegratedApp;
import com.eurobuddha.minimacore.integrated.PandamoniumHooks;
import com.eurobuddha.minimacore.main.BaseView;
import com.eurobuddha.minimacore.receiver.ReceiverDB;
import com.eurobuddha.minimacore.utils.MinimaCMD;
import com.eurobuddha.minimacore.utils.MinimaCMDListener;
import com.eurobuddha.minimacore.utils.logger;

import java.util.List;

public class AppsView extends BaseView {

    ListView mAppsList;
    AppsAdapter mAppsAdapter;

    // Internal tab: our own integrated apps (Pandamonium only; empty elsewhere).
    TabLayout mTabs;
    View mInternalPane, mExternalPane;
    ListView mInternalList;
    IntegratedAppsAdapter mInternalAdapter;
    boolean mHasInternal;
    private AlertDialog infoDialog;

    public AppsView(Activity zActivity){
        super(zActivity, R.layout.view_apps);

        mAppsAdapter = new AppsAdapter(zActivity);

        mAppsList = getMainView().findViewById(R.id.wallet_apps_list);
        mAppsList.setAdapter(mAppsAdapter);

        mAppsList.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {

                //Get the selecetd app
                JSONObject app = (JSONObject) mAppsAdapter.getItem(position);

                showInfoDialog(app);
            }
        });

        //Internal tab — only when this build ships integrated apps (Pandamonium).
        mTabs          = getMainView().findViewById(R.id.apps_tabs);
        mInternalPane  = getMainView().findViewById(R.id.apps_internal_pane);
        mExternalPane  = getMainView().findViewById(R.id.apps_external_pane);
        mInternalList  = getMainView().findViewById(R.id.apps_internal_list);
        mInternalAdapter = new IntegratedAppsAdapter(zActivity);
        mInternalList.setAdapter(mInternalAdapter);

        List<IntegratedApp> integrated = PandamoniumHooks.integratedApps(zActivity);
        mHasInternal = !integrated.isEmpty();
        if (mHasInternal) {
            mInternalAdapter.setItems(integrated);
            mTabs.setVisibility(View.VISIBLE);
            mTabs.addTab(mTabs.newTab().setText(Language.text(getActivity(), l10n_apps_internal)));
            mTabs.addTab(mTabs.newTab().setText(Language.text(getActivity(), l10n_apps_external)));
            mTabs.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
                @Override public void onTabSelected(TabLayout.Tab tab) { showInternal(tab.getPosition() == 0); }
                @Override public void onTabUnselected(TabLayout.Tab tab) {}
                @Override public void onTabReselected(TabLayout.Tab tab) {}
            });
            showInternal(true); // open on Internal
        }
    }

    private void showInternal(boolean zInternal){
        mInternalPane.setVisibility(zInternal ? View.VISIBLE : View.GONE);
        mExternalPane.setVisibility(zInternal ? View.GONE : View.VISIBLE);
    }

    public void showInfoDialog(JSONObject zApp){

        LayoutInflater inflater = (LayoutInflater) mActivity.getSystemService(mActivity.LAYOUT_INFLATER_SERVICE);
        View dialogview = inflater.inflate(R.layout.dialog_apps_info, null);
        Language.apply(dialogview);

        final String packageclass   = (String)zApp.get("package");
        final String packageid      = (String)zApp.get("packageid");
        TextView packagec   = dialogview.findViewById(R.id.app_info_package);
        packagec.setText(packageclass);

        //TextView name       = dialogview.findViewById(R.id.app_info_name);
        //name.setText("not found..");

        final CheckBox cb = dialogview.findViewById(R.id.app_info_enabled);
        if((int)zApp.get("penabled") == 1){
            cb.setChecked(true);
        }

        //Security review 2026-11-07 (M-2): a row that has not proven its identity (one-time code) cannot be enabled when a
        //VERIFIED row for the same package exists - that is the spoof - and needs an explicit confirmation otherwise.
        final boolean verified = !zApp.containsKey("verified") || ((int)zApp.get("verified")) == 1;
        final boolean twin     = !verified && mAppsAdapter.getDatabase().hasVerifiedTwin(packageclass, packageid);
        cb.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (cb.isChecked() && twin) {
                    cb.setChecked(false);
                    new LanguageDialog(getActivity()).setTitle(Language.msg(l10n_apps_unverified_title))
                            .setMessage(Language.msg(l10n_apps_twin_refused))
                            .setPositiveButton(Language.msg(android.R.string.ok), null).show();
                    return;
                }
                if (cb.isChecked() && !verified) {
                    cb.setChecked(false);
                    new LanguageDialog(getActivity()).setTitle(Language.msg(l10n_apps_unverified_title))
                            .setMessage(Language.msg(l10n_apps_unverified_body, packageclass))
                            .setPositiveButton(Language.msg(l10n_apps_enable_anyway), new DialogInterface.OnClickListener() {
                                public void onClick(DialogInterface d, int w) {
                                    cb.setChecked(true);
                                    mAppsAdapter.getDatabase().setEnabled(packageclass, packageid, true);
                                }})
                            .setNegativeButton(Language.msg(android.R.string.cancel), null).show();
                    return;
                }
                mAppsAdapter.getDatabase().setEnabled(packageclass, packageid, cb.isChecked());
            }
        });

        final CheckBox admincb = dialogview.findViewById(R.id.app_info_admin);
        if((int)zApp.get("admin") == 1){
            admincb.setChecked(true);
        }

        admincb.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (admincb.isChecked() && twin) {   // M-2: never ADMIN for an unverified twin
                    admincb.setChecked(false);
                    new LanguageDialog(getActivity()).setTitle(Language.msg(l10n_apps_unverified_title))
                            .setMessage(Language.msg(l10n_apps_twin_refused))
                            .setPositiveButton(Language.msg(android.R.string.ok), null).show();
                    return;
                }
                if (admincb.isChecked() && !verified) {   // M-2: ADMIN for an unverified row needs the same explicit warning
                    admincb.setChecked(false);
                    new LanguageDialog(getActivity()).setTitle(Language.msg(l10n_apps_unverified_title))
                            .setMessage(Language.msg(l10n_apps_unverified_body, packageclass))
                            .setPositiveButton(Language.msg(l10n_apps_enable_anyway), new DialogInterface.OnClickListener() {
                                public void onClick(DialogInterface d, int w) {
                                    admincb.setChecked(true);
                                    mAppsAdapter.getDatabase().setAdmin(packageclass, packageid, true);
                                }})
                            .setNegativeButton(Language.msg(android.R.string.cancel), null).show();
                    return;
                }
                mAppsAdapter.getDatabase().setAdmin(packageclass, packageid, admincb.isChecked());
            }
        });

        //Get the ICON
        Drawable icon = null;
        String   pname = packageclass;
        try{
            PackageManager pkgmanager = mActivity.getPackageManager();

            ApplicationInfo appinfo = pkgmanager.getApplicationInfo(packageclass, 0);

            pname     = pkgmanager.getApplicationLabel(appinfo).toString();
            icon = pkgmanager.getApplicationIcon(appinfo);

        }catch (PackageManager.NameNotFoundException e){
            logger.log("Package not found.. "+packageclass+" "+e);
        }

        if (infoDialog != null) infoDialog.dismiss();
        infoDialog = new LanguageDialog(getActivity())
                .setTitle(pname)
                .setView(dialogview)
                .setIcon(icon)
                .setPositiveButton(Language.msg(android.R.string.ok), new DialogInterface.OnClickListener(){
                    public void onClick(DialogInterface dialog, int whichButton) {
                        AppsView.this.refreshView();
                    }})
                .setNegativeButton(Language.msg(l10n_backup_delete), new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        mAppsAdapter.getDatabase().delete(packageclass, packageid);
                        AppsView.this.refreshView();
                    }
                }).show();

    }

    @Override public void languageChanged() {
        if (mTabs.getTabCount() == 2) {
            mTabs.getTabAt(0).setText(Language.text(getActivity(), l10n_apps_internal));
            mTabs.getTabAt(1).setText(Language.text(getActivity(), l10n_apps_external));
        }
    }

    @Override public void onActivityDestroy() {
        if (infoDialog != null) { infoDialog.dismiss(); infoDialog = null; }
    }

    public void setDatabase(ReceiverDB zDB){
        mAppsAdapter.setDatabase(zDB);
    }

    @Override
    public void refreshView() {
        if (!isDisplayActive()) return;
        //Internal list is cheap and prefs-backed — keep it current with the drawer.
        if (mHasInternal) mInternalAdapter.setItems(PandamoniumHooks.integratedApps(mActivity));
        long generation = displayGeneration();
        mAppsList.post(new Runnable() {
            @Override
            public void run() {
                if (!isDisplayActive() || generation != displayGeneration()
                        || mAppsAdapter.getDatabase() == null) return;
                mAppsAdapter.updateValues();
                mAppsList.invalidate();
            }
        });
    }
}
