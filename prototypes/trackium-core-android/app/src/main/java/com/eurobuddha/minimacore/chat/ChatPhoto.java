package com.eurobuddha.minimacore.chat;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * One photo-for-sending pipeline, shared by the keets and Parlons chat
 * screens: decode, apply the EXIF orientation (cameras store rotation as
 * metadata and decodeStream ignores it - without this, portrait photos
 * arrive rotated, the known bug from the family's earlier chat apps),
 * bound to 1280px, re-encode JPEG q80.
 */
public final class ChatPhoto {

    private ChatPhoto() {
    }

    /** The send-ready JPEG bytes for a picked image. */
    public static byte[] encodeForSend(Context zCtx, Uri zUri) throws Exception {
        Bitmap bm;
        try (InputStream in = zCtx.getContentResolver().openInputStream(zUri)) {
            if (in == null) {
                throw new Exception("could not open image");
            }
            bm = BitmapFactory.decodeStream(in);
        }
        if (bm == null) {
            throw new Exception("could not read image");
        }
        try (InputStream exifIn = zCtx.getContentResolver().openInputStream(zUri)) {
            ExifInterface exif = new ExifInterface(exifIn);
            int o = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL);
            Matrix mx = new Matrix();
            switch (o) {
                case ExifInterface.ORIENTATION_ROTATE_90:  mx.postRotate(90);  break;
                case ExifInterface.ORIENTATION_ROTATE_180: mx.postRotate(180); break;
                case ExifInterface.ORIENTATION_ROTATE_270: mx.postRotate(270); break;
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: mx.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL:   mx.postScale(1, -1); break;
                case ExifInterface.ORIENTATION_TRANSPOSE:  mx.postRotate(90);  mx.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_TRANSVERSE: mx.postRotate(270); mx.postScale(-1, 1); break;
            }
            if (!mx.isIdentity()) {
                bm = Bitmap.createBitmap(bm, 0, 0, bm.getWidth(), bm.getHeight(), mx, true);
            }
        } catch (Exception e) {
            // no exif - keep as decoded
        }
        int max = 1280;
        if (bm.getWidth() > max || bm.getHeight() > max) {
            float sc = Math.min((float) max / bm.getWidth(), (float) max / bm.getHeight());
            bm = Bitmap.createScaledBitmap(bm,
                    Math.round(bm.getWidth() * sc), Math.round(bm.getHeight() * sc), true);
        }
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        bm.compress(Bitmap.CompressFormat.JPEG, 80, bos);
        return bos.toByteArray();
    }
}
