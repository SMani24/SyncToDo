package com.synctodo.app;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private LocalPeerServer peerServer;
    private volatile boolean isModalOpen = false;

    public class AndroidBridge {
        @JavascriptInterface
        public void setModalOpen(boolean open) {
            isModalOpen = open;
        }
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
