package com.eurobuddha.minimacore.main.views.apps;

import android.content.Context;
import com.eurobuddha.minimacore.i18n.Language;
import static com.eurobuddha.minimacore.i18n.R.string.*;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.drawable.Drawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import org.minima.utils.json.JSONArray;
import org.minima.utils.json.JSONObject;
import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.receiver.ReceiverDB;
import com.eurobuddha.minimacore.service.MinimaService;
import com.eurobuddha.minimacore.utils.TokenUtils;
import com.eurobuddha.minimacore.utils.logger;

import java.util.Date;

public class AppsAdapter extends BaseAdapter {

    Context mContext;

    private final LayoutInflater inflater;

    ReceiverDB mDatabase;

    JSONArray mCurrentValues = new JSONArray();

    public AppsAdapter(Context zContext){
        super();
        mContext = zContext;
        inflater = (LayoutInflater) zContext.getSystemService(Context.LAYOUT_INFLATER_SERVICE);
    }

    public void setDatabase(ReceiverDB zDatabase){
        mDatabase = zDatabase;
    }

    public ReceiverDB getDatabase(){
        return mDatabase;
    }

    public void updateValues(){
        mCurrentValues = mDatabase.selectAllApps();
        notifyDataSetChanged();
    }

    @Override
    public int getCount() {
        return mCurrentValues.size();
    }

    @Override
    public Object getItem(int position) {
        return mCurrentValues.get(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View row = convertView;
        if(row == null){
            row = inflater.inflate(R.layout.view_apps_row, null);
        }

        Language.apply(row);
        ImageView img         = row.findViewById(R.id.apps_icon);
        TextView appname      = row.findViewById(R.id.apps_name);
        TextView apppackage  = row.findViewById(R.id.apps_package);
        TextView appenabled   = row.findViewById(R.id.apps_enabled);
        TextView applastused   = row.findViewById(R.id.apps_lastused);

        //Get the app..
        JSONObject app = (JSONObject) mCurrentValues.get(position);

        String packageclass = (String)app.get("package");
        apppackage.setText(packageclass);
        appname.setText(packageclass);
        img.setImageDrawable(null);

        //Get the ICON
        try{
            PackageManager pkgmanager = mContext.getPackageManager();

            ApplicationInfo appinfo = pkgmanager.getApplicationInfo(packageclass, 0);

            String name     = pkgmanager.getApplicationLabel(appinfo).toString();
            appname.setText(name);

            Drawable icon   = pkgmanager.getApplicationIcon(appinfo);
            img.setImageDrawable(icon);

        }catch (PackageManager.NameNotFoundException e){
            logger.log("Package not found.. "+packageclass+" "+e);
        }

        CharSequence state = Language.msg((int)app.get("penabled") == 0
                ? l10n_apps_disabled : l10n_wallet_bio_enabled);
        Language.setText(appenabled, (int)app.get("admin") == 1
                ? Language.join(state, Language.msg(l10n_apps_admin_tag)) : state);

        // Display dates follow the selected language; stored timestamps remain unchanged.
        long timemilli = (long)app.get("lastused");
        Language.setText(applastused, Language.stamp(timemilli, "yMMMdHms"));

        return row;
    }
}
