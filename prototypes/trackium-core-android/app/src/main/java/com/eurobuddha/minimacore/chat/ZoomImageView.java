package com.eurobuddha.minimacore.chat;

import android.content.Context;
import android.graphics.Matrix;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.util.AttributeSet;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;

import androidx.appcompat.widget.AppCompatImageView;

/**
 * Pinch-zoom / pan / double-tap photo view (the Parlons viewer behaviours):
 * fit-to-screen base scale, pinch 1x..5x around the gesture focus, pan clamped to
 * the image edges, double-tap animates between fit and 2.5x at the tap point.
 */
public class ZoomImageView extends AppCompatImageView {

    private static final float MAX_ZOOM = 5f;
    private static final float DOUBLE_TAP_ZOOM = 2.5f;

    private final Matrix mMatrix = new Matrix();
    private float mBaseScale = 1f;   // fit-to-screen
    private float mScale = 1f;       // multiplier over base
    private final ScaleGestureDetector mPinch;
    private final GestureDetector mGestures;

    public ZoomImageView(Context zContext, AttributeSet zAttrs) {
        super(zContext, zAttrs);
        setScaleType(ScaleType.MATRIX);

        mPinch = new ScaleGestureDetector(zContext, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override
            public boolean onScale(ScaleGestureDetector d) {
                float factor = d.getScaleFactor();
                float target = Math.max(1f, Math.min(mScale * factor, MAX_ZOOM));
                factor = target / mScale;
                mScale = target;
                mMatrix.postScale(factor, factor, d.getFocusX(), d.getFocusY());
                clamp();
                setImageMatrix(mMatrix);
                return true;
            }
        });

        mGestures = new GestureDetector(zContext, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onScroll(MotionEvent e1, MotionEvent e2, float dx, float dy) {
                mMatrix.postTranslate(-dx, -dy);
                clamp();
                setImageMatrix(mMatrix);
                return true;
            }

            @Override
            public boolean onSingleTapConfirmed(MotionEvent e) {
                performClick();
                return true;
            }

            @Override
            public boolean onDoubleTap(MotionEvent e) {
                animateTo(mScale > 1.01f ? 1f : DOUBLE_TAP_ZOOM, e.getX(), e.getY());
                return true;
            }
        });
    }

    public ZoomImageView(Context zContext) { this(zContext, null); }

    @Override
    public void setImageDrawable(Drawable zDrawable) {
        super.setImageDrawable(zDrawable);
        post(this::fit);
    }

    @Override
    protected void onSizeChanged(int w, int h, int ow, int oh) {
        super.onSizeChanged(w, h, ow, oh);
        fit();
    }

    /** Reset to fit-to-screen, centred. */
    private void fit() {
        Drawable d = getDrawable();
        if (d == null || getWidth() == 0 || d.getIntrinsicWidth() <= 0) return;
        mBaseScale = Math.min((float) getWidth() / d.getIntrinsicWidth(),
                              (float) getHeight() / d.getIntrinsicHeight());
        mScale = 1f;
        mMatrix.reset();
        mMatrix.postScale(mBaseScale, mBaseScale);
        mMatrix.postTranslate((getWidth() - d.getIntrinsicWidth() * mBaseScale) / 2f,
                              (getHeight() - d.getIntrinsicHeight() * mBaseScale) / 2f);
        setImageMatrix(mMatrix);
    }

    /** Keep the image covering the view: centre an axis that fits, clamp edges otherwise. */
    private void clamp() {
        Drawable d = getDrawable();
        if (d == null) return;
        RectF r = new RectF(0, 0, d.getIntrinsicWidth(), d.getIntrinsicHeight());
        mMatrix.mapRect(r);
        float dx = 0, dy = 0;
        if (r.width() <= getWidth()) dx = (getWidth() - r.width()) / 2f - r.left;
        else if (r.left > 0) dx = -r.left;
        else if (r.right < getWidth()) dx = getWidth() - r.right;
        if (r.height() <= getHeight()) dy = (getHeight() - r.height()) / 2f - r.top;
        else if (r.top > 0) dy = -r.top;
        else if (r.bottom < getHeight()) dy = getHeight() - r.bottom;
        mMatrix.postTranslate(dx, dy);
    }

    private void animateTo(float zTargetScale, float zFx, float zFy) {
        final float start = mScale;
        final long t0 = System.currentTimeMillis();
        final long dur = 180;
        Runnable step = new Runnable() {
            @Override
            public void run() {
                float t = Math.min(1f, (System.currentTimeMillis() - t0) / (float) dur);
                float eased = 1 - (1 - t) * (1 - t);
                float want = start + (zTargetScale - start) * eased;
                float factor = want / mScale;
                mScale = want;
                mMatrix.postScale(factor, factor, zFx, zFy);
                clamp();
                setImageMatrix(mMatrix);
                if (t < 1f) postOnAnimation(this); else if (zTargetScale == 1f) fit();
            }
        };
        postOnAnimation(step);
    }

    @Override
    public boolean onTouchEvent(MotionEvent zEvent) {
        boolean a = mPinch.onTouchEvent(zEvent);
        boolean b = mGestures.onTouchEvent(zEvent);
        return a || b || super.onTouchEvent(zEvent);
    }

    @Override
    public boolean performClick() { return super.performClick(); }
}
