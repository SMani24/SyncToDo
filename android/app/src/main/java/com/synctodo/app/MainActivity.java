package com.synctodo.app;

import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private LocalPeerServer peerServer;
    private volatile boolean isModalOpen = false;
    private boolean isStylusButtonPressed = false;

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
                if (!isStylusButtonPressed) {
                    isStylusButtonPressed = true;
                    notifyStylusButton("down");
                }
                return true;
            } else if (event.getAction() == KeyEvent.ACTION_UP) {
                if (isStylusButtonPressed) {
                    isStylusButtonPressed = false;
                    notifyStylusButton("up");
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
            if (isEraserButton && !isStylusButtonPressed) {
                isStylusButtonPressed = true;
                notifyStylusButton("down");
            } else if (!isEraserButton && isStylusButtonPressed) {
                isStylusButtonPressed = false;
                notifyStylusButton("up");
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
            if (isEraserButton && !isStylusButtonPressed) {
                isStylusButtonPressed = true;
                notifyStylusButton("down");
            } else if (!isEraserButton && isStylusButtonPressed) {
                isStylusButtonPressed = false;
                notifyStylusButton("up");
            }
        }
        if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
            if (isStylusButtonPressed) {
                isStylusButtonPressed = false;
                notifyStylusButton("up");
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

        if (getWindow() != null && getWindow().getDecorView() != null) {
            getWindow().getDecorView().setBackgroundColor(0xFF090E17);
        }

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(0xFF090E17);
            bridge.getWebView().addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
            // Prevent Chromium WebView from double-subtracting IME keyboard height
            // because DecorView (SystemBars + adjustResize) already pads for IME & systemBars
            ViewCompat.setOnApplyWindowInsetsListener(bridge.getWebView(), (v, windowInsets) -> {
                WindowInsetsCompat stripped = new WindowInsetsCompat.Builder(windowInsets)
                    .setInsets(
                        WindowInsetsCompat.Type.ime() | WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(),
                        Insets.NONE
                    )
                    .build();
                return ViewCompat.onApplyWindowInsets(v, stripped);
            });
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
        if (getWindow() != null && getWindow().getDecorView() != null) {
            getWindow().getDecorView().setBackgroundColor(0xFF090E17);
        }

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(0xFF090E17);
            bridge.getWebView().addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
            // Prevent Chromium WebView from double-subtracting IME keyboard height
            // because DecorView (SystemBars + adjustResize) already pads for IME & systemBars
            ViewCompat.setOnApplyWindowInsetsListener(bridge.getWebView(), (v, windowInsets) -> {
                WindowInsetsCompat stripped = new WindowInsetsCompat.Builder(windowInsets)
                    .setInsets(
                        WindowInsetsCompat.Type.ime() | WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(),
                        Insets.NONE
                    )
                    .build();
                return ViewCompat.onApplyWindowInsets(v, stripped);
            });
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
