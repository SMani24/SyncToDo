package com.synctodo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private LocalPeerServer peerServer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Start embedded Decentralized P2P LAN Server
        // Allows Phone and Tablet to sync directly over Wi-Fi without any laptop
        peerServer = new LocalPeerServer(this);
        peerServer.start();
    }

    @Override
    public void onDestroy() {
        if (peerServer != null) {
            peerServer.stop();
        }
        super.onDestroy();
    }
}
