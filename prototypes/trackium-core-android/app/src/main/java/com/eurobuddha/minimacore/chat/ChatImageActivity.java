package com.eurobuddha.minimacore.chat;

import androidx.appcompat.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.FileProvider;

import com.eurobuddha.minimacore.R;
import com.eurobuddha.minimacore.i18n.Language;
import com.eurobuddha.minimacore.i18n.LanguageDialog;
import static com.eurobuddha.minimacore.i18n.R.string.*;


import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;

/**
 * Full-screen photo viewer: pinch-zoom / pan / double-tap (ZoomImageView), plus
 * Share and Save-to-Photos. Loads from the shared chat image cache (P2P fetch on
 * first view); the image file is hash-pinned by its keets:// url.
 */
public class ChatImageActivity extends AppCompatActivity {

    private String mRef;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat_image);
        Language.apply(findViewById(android.R.id.content));

        mRef = getIntent().getStringExtra("ref");
        if (mRef == null) { finish(); return; }

        Toolbar tb = findViewById(R.id.imgview_toolbar);
        setSupportActionBar(tb);
        getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        getSupportActionBar().setTitle("");
        tb.setNavigationOnClickListener(v -> finish());


        String caption = getIntent().getStringExtra("caption");
        TextView cap = findViewById(R.id.imgview_caption);
        if (caption != null && !caption.equals("")) { cap.setText(caption); cap.setVisibility(View.VISIBLE); }

        ZoomImageView img = findViewById(R.id.imgview_photo);
        ProgressBar spin = findViewById(R.id.imgview_progress);
        TextView err = findViewById(R.id.imgview_error);

        ChatImages.load(this, mRef, bm -> {
            if (isFinishing() || isDestroyed()) return;
            spin.setVisibility(View.GONE);
            if (bm == null) {
                err.setVisibility(View.VISIBLE);
            } else {
                img.setImageBitmap(bm);
            }
        });
    }

    @Override public boolean onCreateOptionsMenu(android.view.Menu menu) {
        getMenuInflater().inflate(R.menu.chat_image_menu, menu);
        refreshMenu(findViewById(R.id.imgview_toolbar));
        return true;
    }
    @Override public boolean onOptionsItemSelected(android.view.MenuItem item) {
        if (item.getItemId() == R.id.imgmenu_share) { share(); return true; }
        if (item.getItemId() == R.id.imgmenu_save) { saveToPhotos(); return true; }
        return super.onOptionsItemSelected(item);
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        Language.configurationChanged(this);
        refreshMenu(findViewById(R.id.imgview_toolbar));
    }
    private void refreshMenu(Toolbar toolbar) {
        if (toolbar.getMenu().findItem(R.id.imgmenu_share) != null) toolbar.getMenu().findItem(R.id.imgmenu_share).setTitle(Language.text(this, l10n_logs_share));
        if (toolbar.getMenu().findItem(R.id.imgmenu_save) != null) toolbar.getMenu().findItem(R.id.imgmenu_save).setTitle(Language.text(this, l10n_chat_save_photos));
    }

    private void share() {
        File f = ChatImages.file(this, mRef);
        if (!f.exists()) { Toast.makeText(this, Language.msg(l10n_chat_photo_not_loaded), Toast.LENGTH_SHORT).show(); return; }
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".ipcresponses", f);
        Intent it = new Intent(Intent.ACTION_SEND)
                .setType("image/jpeg")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(it, Language.text(this, l10n_chat_share_photo)));
    }

    private void saveToPhotos() {
        File f = ChatImages.file(this, mRef);
        if (!f.exists()) { Toast.makeText(this, Language.msg(l10n_chat_photo_not_loaded), Toast.LENGTH_SHORT).show(); return; }
        new Thread(() -> {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, "keetchat-" + System.currentTimeMillis() + ".jpg");
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/KeetChat");
                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("MediaStore refused");
                try (OutputStream os = getContentResolver().openOutputStream(uri);
                     FileInputStream is = new FileInputStream(f)) {
                    byte[] buf = new byte[8192];
                    int r;
                    while ((r = is.read(buf)) != -1) os.write(buf, 0, r);
                }
                runOnUiThread(() -> Toast.makeText(this, Language.msg(l10n_chat_saved_photo), Toast.LENGTH_SHORT).show());
            } catch (Exception exc) {
                runOnUiThread(() -> Toast.makeText(this, Language.msg(l10n_chat_save_failed, ChatMessages.error(exc)), Toast.LENGTH_LONG).show());
            }
        }, "chat-image-save").start();
    }
}
