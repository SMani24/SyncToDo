package com.synctodo.app;

import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private LocalPeerServer peerServer;
    private volatile boolean isModalOpen = false;
    private long lastStylusToggleTime = 0;

    public class AndroidBridge {
        @JavascriptInterface
        public void setModalOpen(boolean open) {
            isModalOpen = open;
        }
    }

    private void notifyStylusButton(String action) {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('stylusbutton', { detail: { action: '" + action + "' } }));",
                        null
                    );
                }
            });
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        // Android Stylus Button keycodes (308: Primary, 309: Secondary, 310: Tertiary, 311: Tail)
        if (code == 308 || code == 309 || code == 310 || code == 311 ||
            code == KeyEvent.KEYCODE_BUTTON_1 || code == KeyEvent.KEYCODE_BUTTON_2) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                long now = System.currentTimeMillis();
                if (now - lastStylusToggleTime > 250) {
                    lastStylusToggleTime = now;
                    notifyStylusButton("toggle");
                }
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        if (event.isFromSource(InputDevice.SOURCE_STYLUS) || (event.getSource() & InputDevice.SOURCE_CLASS_POINTER) != 0) {
            int buttonState = event.getButtonState();
            boolean isEraserButton = (buttonState & MotionEvent.BUTTON_STYLUS_PRIMARY) != 0 ||
                                     (buttonState & MotionEvent.BUTTON_SECONDARY) != 0;
            if (isEraserButton) {
                notifyStylusButton("eraser_active");
            }
        }
        return super.dispatchGenericMotionEvent(event);
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.isFromSource(InputDevice.SOURCE_STYLUS) || (event.getSource() & InputDevice.SOURCE_CLASS_POINTER) != 0) {
            int buttonState = event.getButtonState();
            boolean isEraserButton = (buttonState & MotionEvent.BUTTON_STYLUS_PRIMARY) != 0 ||
                                     (buttonState & MotionEvent.BUTTON_SECONDARY) != 0;
            if (isEraserButton) {
                notifyStylusButton("eraser_active");
            }
        }
        return super.dispatchTouchEvent(event);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Start embedded Decentralized P2P LAN Server
        // Allows Phone and Tablet to sync directly over Wi-Fi without any laptop
        peerServer = new LocalPeerServer(this);
        peerServer.start();

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (isModalOpen) {
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().post(new Runnable() {
                            @Override
                            public void run() {
                                bridge.getWebView().evaluateJavascript(
                                    "if (window.__handleAndroidBack) { window.__handleAndroidBack(); }",
                                    null
                                );
                            }
                        });
                    }
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        }
    }

    @Override
    public void onBackPressed() {
        if (isModalOpen) {
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        bridge.getWebView().evaluateJavascript(
                            "if (window.__handleAndroidBack) { window.__handleAndroidBack(); }",
                            null
                        );
                    }
                });
            }
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void onDestroy() {
        if (peerServer != null) {
            peerServer.stop();
        }
        super.onDestroy();
    }
}
