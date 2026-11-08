package com.eurobuddha.minimacore;

import android.content.Context;
import android.os.Build;
import android.view.View;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.material.tabs.TabLayout;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.main.StartupMode;
import com.eurobuddha.minimacore.main.views.home.HomeView;
import com.eurobuddha.minimacore.main.views.apps.AppsView;
import com.eurobuddha.minimacore.main.views.apps.AppsAdapter;
import com.eurobuddha.minimacore.main.views.apps.IntegratedAppsAdapter;
import com.eurobuddha.minimacore.integrated.IntegratedApp;
import com.eurobuddha.minimacore.receiver.ReceiverDB;
import com.eurobuddha.minimacore.testing.CoreViewsHarnessActivity;
import java.util.concurrent.atomic.AtomicReference;
import org.minima.utils.json.JSONObject;
import org.minima.utils.json.JSONArray;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static com.eurobuddha.minimacore.i18n.R.string.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.matcher.RootMatchers.isDialog;

/** Synthetic dashboard snapshots and uniquely identified disposable registration rows only. */
@RunWith(AndroidJUnit4.class)
public class HomeAppsLanguagesTest {
    private static final String[] CODES = {"en", "zh-Hans", "ru", "uk"};
    private static final String FIXTURE = "home-apps-language-fixture-v1";
    private static final String UNKNOWN = "test.missing.language.app";
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private ReceiverDB db;
    private boolean prepared;
    @Before public void prepare() {
        assertEquals("true", InstrumentationRegistry.getArguments().getString("bearLanguagesDisposable"));
        assertEquals("ranchu", Build.HARDWARE); assertNull(org.minima.system.Main.getInstance());
        android.content.SharedPreferences prefs = context.getSharedPreferences("main_prefs", 0);
        assertFalse(prefs.getBoolean("SEED_SET", false)); assertFalse(prefs.contains("SEED"));
        prepared = true; select("en");
    }
    @After public void clean() {
        if (!prepared) return;
        if (db != null) {
            db.delete(context.getPackageName(), FIXTURE); db.delete(UNKNOWN, FIXTURE); db.close();
        }
        assertNull(org.minima.system.Main.getInstance()); select("en");
    }
    private void settle() { android.os.SystemClock.sleep(500); InstrumentationRegistry.getInstrumentation().waitForIdleSync(); }
    private void select(String code) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> Language.select(context, code)); settle();
    }
    private String text(int id, Object... args) { return Language.text(context, id, args); }
    private String value(View root, int id) { return ((TextView)root.findViewById(id)).getText().toString(); }
    private static JSONObject obj(Object... pairs) {
        JSONObject value = new JSONObject(); for (int i=0;i<pairs.length;i+=2) value.put((String)pairs[i], pairs[i+1]); return value;
    }
    private void render(HomeView home, String peers) {
        JSONArray connections = new JSONArray();
        connections.add(obj("incoming",true,"host","self.example"));
        connections.add(obj("incoming",true,"host","127.113.1.2"));
        connections.add(obj("incoming",true,"host","remote.example"));
        connections.add(obj("incoming",false,"host","outgoing.example"));
        JSONObject[] result = {obj("response",obj("maxuses",123456)),obj("response",obj("peerslist",peers)),
                obj("response",obj("details",obj("connected",4,"p2p",obj("address","self.example:9001")),"connections",connections))};
        try {
            java.lang.reflect.Method method = HomeView.class.getDeclaredMethod("renderDashboard",JSONObject[].class);
            method.setAccessible(true); method.invoke(home,(Object)result);
        } catch (Exception e) { throw new AssertionError(e); }
    }
    private void snapshot(String name) throws Exception {
        java.io.File dir = new java.io.File(context.getExternalFilesDir(null), "language-tests");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        android.graphics.Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        try(java.io.FileOutputStream out = new java.io.FileOutputStream(new java.io.File(dir,name+".png"))) {
            assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out));
        } finally { bitmap.recycle(); }
    }
    @Test public void dashboardLabelsFollowLanguageWithoutChangingSnapshotOrStartingNode() throws Exception {
        AtomicReference<HomeView> view = new AtomicReference<>(); AtomicReference<CoreViewsHarnessActivity> first = new AtomicReference<>();
        try(ActivityScenario<CoreViewsHarnessActivity> screen = ActivityScenario.launch(CoreViewsHarnessActivity.class)) {
            screen.onActivity(a -> {
                first.set(a); HomeView home = new HomeView(a); view.set(home); a.show(home);
                assertEquals(text(l10n_home_connecting),value(home.getMainView(),R.id.home_keyuses));
                render(home,"");
            });
            for(String code:CODES) {
                select(code); screen.onActivity(a -> {
                    assertSame(first.get(),a); View root=view.get().getMainView();
                    assertEquals(text(l10n_home_waiting),value(root,R.id.home_status));
                    assertEquals(text(l10n_home_no_peers),value(root,R.id.home_peers));
                    assertEquals("123456",value(root,R.id.home_keyuses));
                    assertEquals("4",value(root,R.id.home_connections)); assertEquals("2",value(root,R.id.home_incoming));
                    boolean block=StartupMode.usesBlockKeys(a.getSharedPreferences("main_prefs",0));
                    assertEquals(text(block?l10n_home_key_block:l10n_restore_key_uses),value(root,R.id.home_keyuses_caption));
                    assertEquals(androidx.core.content.ContextCompat.getColor(a,R.color.core_text_faint),((TextView)root.findViewById(R.id.home_status)).getCurrentTextColor());
                });
                assertNull(org.minima.system.Main.getInstance());
            }
            screen.onActivity(a -> render(view.get(),"peer中文.example:9001"));
            for(String code:CODES) {
                select(code); screen.onActivity(a -> assertEquals("peer中文.example:9001",value(view.get().getMainView(),R.id.home_peers)));
            }
            snapshot("home-uk");
        }
    }
    @Test public void externalPermissionsAndRecycledRowsStayAccurateAcrossLanguages() throws Exception {
        db=new ReceiverDB(context);
        assertFalse(db.exists(context.getPackageName(),FIXTURE,"language-only"));
        assertFalse(db.exists(UNKNOWN,FIXTURE,"language-only"));
        db.insertApp(context.getPackageName(),FIXTURE,"language-only"); db.insertApp(UNKNOWN,FIXTURE,"language-only");
        db.setEnabled(context.getPackageName(),FIXTURE,true);
        AtomicReference<AppsView> page=new AtomicReference<>(); AtomicReference<View> missingRow=new AtomicReference<>();
        AtomicReference<CoreViewsHarnessActivity> first=new AtomicReference<>();
        long rawTime=(long)db.selectApp(UNKNOWN,FIXTURE,"language-only").get("lastused");
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)) {
            screen.onActivity(a -> {
                first.set(a); AppsView apps=new AppsView(a); page.set(apps); apps.setDatabase(db); a.show(apps);
                TabLayout tabs=apps.getMainView().findViewById(R.id.apps_tabs); if(tabs.getTabCount()==2)tabs.selectTab(tabs.getTabAt(1));
                AppsAdapter rows=new AppsAdapter(a);rows.setDatabase(db);rows.updateValues();
                int known=-1,missing=-1;
                for(int i=0;i<rows.getCount();i++) {
                    JSONObject item=(JSONObject)rows.getItem(i);
                    if(FIXTURE.equals(item.get("packageid"))) {
                        if(context.getPackageName().equals(item.get("package")))known=i;
                        if(UNKNOWN.equals(item.get("package")))missing=i;
                    }
                }
                assertTrue(known>=0&&missing>=0);
                View row=rows.getView(known,null,null);assertNotNull(((ImageView)row.findViewById(R.id.apps_icon)).getDrawable());
                row=rows.getView(missing,row,null);missingRow.set(row);
                assertNull(((ImageView)row.findViewById(R.id.apps_icon)).getDrawable());
                apps.showInfoDialog(db.selectApp(context.getPackageName(),FIXTURE,"language-only"));
            });
            onView(withId(R.id.app_info_admin)).inRoot(isDialog()).perform(click());
            onView(withId(R.id.app_info_enabled)).inRoot(isDialog()).perform(click());
            for(String code:CODES) {
                select(code);screen.onActivity(a -> {
                    assertSame(first.get(),a);assertEquals(UNKNOWN,value(missingRow.get(),R.id.apps_name));
                    assertEquals(UNKNOWN,value(missingRow.get(),R.id.apps_package));
                    assertEquals(text(l10n_apps_disabled),value(missingRow.get(),R.id.apps_enabled));
                    java.util.Locale locale=java.util.Locale.forLanguageTag(code);
                    String pattern=android.text.format.DateFormat.getBestDateTimePattern(locale,"yMMMdHms");
                    assertEquals(new java.text.SimpleDateFormat(pattern,locale).format(new java.util.Date(rawTime)),value(missingRow.get(),R.id.apps_lastused));
                });
                onView(withId(R.id.app_info_admin)).inRoot(isDialog()).check(matches(isChecked()));
                onView(withId(R.id.app_info_enabled)).inRoot(isDialog()).check(matches(isNotChecked()));
                onView(withText(text(l10n_apps_admin_warning))).inRoot(isDialog()).check(matches(isDisplayed()));
                JSONObject saved=db.selectApp(context.getPackageName(),FIXTURE,"language-only");
                assertEquals(1,saved.get("admin"));assertEquals(0,saved.get("penabled"));
                assertEquals(rawTime,(long)db.selectApp(UNKNOWN,FIXTURE,"language-only").get("lastused"));
            }
            snapshot("apps-permissions-uk");
            onView(withId(android.R.id.button1)).inRoot(isDialog()).perform(click());settle();
            snapshot("apps-external-uk");
            screen.onActivity(a -> page.get().showInfoDialog(db.selectApp(UNKNOWN,FIXTURE,"language-only")));
            onView(withId(R.id.app_info_package)).inRoot(isDialog()).check(matches(withText(UNKNOWN)));
            // Activity destruction must dismiss this remaining dialog without deleting the record.
        }
        assertTrue(db.exists(UNKNOWN,FIXTURE,"language-only"));
    }
    @Test public void internalTabsRowsAndSwitchesRetainSelectionAndPermissions() throws Exception {
        AtomicReference<AppsView> page=new AtomicReference<>();AtomicReference<CoreViewsHarnessActivity> first=new AtomicReference<>();
        java.util.List<View> rows=new java.util.ArrayList<>();
        android.content.SharedPreferences navigation=context.getSharedPreferences("pandamonium_navigation",0);
        java.util.Map<String,?> original=new java.util.HashMap<>(navigation.getAll());
        try(ActivityScenario<CoreViewsHarnessActivity> screen=ActivityScenario.launch(CoreViewsHarnessActivity.class)) {
            screen.onActivity(a -> {
                first.set(a);AppsView apps=new AppsView(a);page.set(apps);a.show(apps);
                TabLayout tabs=apps.getMainView().findViewById(R.id.apps_tabs);
                assertEquals(BuildConfig.PANDAMONIUM?2:0,tabs.getTabCount());
                if(BuildConfig.PANDAMONIUM)tabs.selectTab(tabs.getTabAt(1));
                IntegratedAppsAdapter adapter=new IntegratedAppsAdapter(a);
                adapter.setItems(java.util.Arrays.asList(new IntegratedApp(0,"Host 中文",null,true,true),
                        new IntegratedApp(1,"App Русский",null,true,false),new IntegratedApp(2,"App Українська",null,false,false)));
                for(int i=0;i<3;i++)rows.add(adapter.getView(i,null,new android.widget.FrameLayout(a)));
            });
            int[] states={l10n_apps_always_on,l10n_apps_in_drawer,l10n_apps_hidden};
            String[] names={"Host 中文","App Русский","App Українська"};
            for(String code:CODES) {
                select(code);screen.onActivity(a -> {
                    assertSame(first.get(),a);TabLayout tabs=page.get().getMainView().findViewById(R.id.apps_tabs);
                    if(BuildConfig.PANDAMONIUM) {
                        assertEquals(1,tabs.getSelectedTabPosition());assertEquals(text(l10n_apps_internal),tabs.getTabAt(0).getText());
                        assertEquals(text(l10n_apps_external),tabs.getTabAt(1).getText());
                        assertEquals(View.VISIBLE,page.get().getMainView().findViewById(R.id.apps_external_pane).getVisibility());
                    } else assertEquals(View.GONE,tabs.getVisibility());
                    for(int i=0;i<3;i++) {
                        assertEquals(names[i],value(rows.get(i),R.id.int_app_name));assertEquals(text(states[i]),value(rows.get(i),R.id.int_app_state));
                        MaterialSwitch sw=rows.get(i).findViewById(R.id.int_app_switch);assertEquals(i!=2,sw.isChecked());assertEquals(i!=0,sw.isEnabled());
                        assertEquals(text(l10n_apps_enable),sw.getContentDescription().toString());
                    }
                });
                assertEquals(original,navigation.getAll());
            }
            if(BuildConfig.PANDAMONIUM) {
                screen.onActivity(a -> { TabLayout tabs=page.get().getMainView().findViewById(R.id.apps_tabs);tabs.selectTab(tabs.getTabAt(0)); });settle();snapshot("apps-internal-uk");
            }
        }
    }
}
