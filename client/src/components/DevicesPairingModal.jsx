import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Icon } from './SvgIcons';
import QrScannerModal from './QrScannerModal';

function formatSixDigit(code) {
  const clean = String(code || '------').replace(/\s+/g, '');
  if (clean.length === 6) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return clean;
}

export default function DevicesPairingModal({
  syncEngine,
  p2pInfo = {},
  deviceType = 'laptop',
  onClose
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(syncEngine.deviceName || p2pInfo.deviceName || 'My Device');
  const [sixDigitInput, setSixDigitInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState(null);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualIpInput, setManualIpInput] = useState('');
  const [serverUrlInput, setServerUrlInput] = useState(syncEngine.serverUrl || '');
  const [showScanner, setShowScanner] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const myName = syncEngine.deviceName || p2pInfo.deviceName || 'My Device';
  const myCode = p2pInfo.pairingCode || '482913';
  const myIp = p2pInfo.myLocalIp || 'Local Wi-Fi';
  const myPort = p2pInfo.port || (deviceType === 'laptop' ? 4000 : 4567);
  const myDeviceId = p2pInfo.deviceId || syncEngine.deviceId;

  const pairedDevices = p2pInfo.pairedDevices || [];
  const nearbyPeers = p2pInfo.nearbyPeers || [];
  const pendingRequests = p2pInfo.pendingRequests || [];
  const outgoingSession = p2pInfo.outgoingPairSession || null;

  // Generate crisp standard scannable QR Code (320px high-res)
  useEffect(() => {
    const qrSeed = `synctodo://${myIp}:${myPort}?code=${myCode}&deviceId=${encodeURIComponent(myDeviceId || '')}&name=${encodeURIComponent(myName)}`;
    QRCode.toDataURL(qrSeed, {
      width: 320,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.warn('QR generation error:', err));
  }, [myIp, myPort, myCode, myDeviceId, myName]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    await syncEngine.p2pEngine?.renameThisDevice(nameInput.trim());
    setIsEditingName(false);
  };

  const handleQrScan = async (scannedData) => {
    setShowScanner(false);
    setIsSubmittingCode(true);
    setCodeFeedback(null);
    try {
      const res = await syncEngine.p2pEngine?.pairWithScannedQr(scannedData);
      setIsSubmittingCode(false);
      if (res?.status === 'paired') {
        setCodeFeedback({
          type: 'success',
          text: `Paired & synced with ${res.data?.serverDevice?.deviceName || 'device'}!`
        });
      } else {
        setCodeFeedback({
          type: 'error',
          text: res?.message || 'Could not pair with scanned QR code. Try entering the 6-digit code.'
        });
      }
    } catch (err) {
      setIsSubmittingCode(false);
      setCodeFeedback({ type: 'error', text: 'Pairing failed: ' + err.message });
    }
  };

  const handlePairByCode = async (e) => {
    e.preventDefault();
    const cleaned = sixDigitInput.replace(/\s+/g, '');
    if (cleaned.length !== 6) {
      setCodeFeedback({ type: 'error', text: 'Enter the 6-digit code shown on your other device.' });
      return;
    }
    setIsSubmittingCode(true);
    setCodeFeedback(null);
    const res = await syncEngine.p2pEngine?.pairBySixDigitCode(cleaned);
    setIsSubmittingCode(false);
    if (res?.status === 'paired') {
      setSixDigitInput('');
      setCodeFeedback({ type: 'success', text: 'Devices paired & synced!' });
    } else {
      setCodeFeedback({
        type: 'error',
        text: res?.message || 'Could not find a nearby device with that code. Try tapping the device below.'
      });
    }
  };

  const handleManualPair = () => {
    if (!manualIpInput.trim()) return;
    syncEngine.p2pEngine?.addPeer(manualIpInput.trim());
    setManualIpInput('');
  };

  const handleSaveServerUrl = () => {
    if (serverUrlInput.trim()) {
      syncEngine.setServerUrl(serverUrlInput.trim());
    }
  };

  const renderDeviceIcon = (type) => {
    if (type === 'phone') return <Icon name="phone" size={18} />;
    if (type === 'tablet') return <Icon name="tablet" size={18} />;
    return <Icon name="laptop" size={18} />;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(6, 10, 20, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 220,
        padding: deviceType === 'phone' ? 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px' : '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '22px',
          padding: deviceType === 'phone' ? '18px' : '24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          color: 'var(--text)',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: 'var(--tag-bg)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="wifi" size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16.5px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
                Devices & Sync
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Wi-Fi pairing & real-time sync across your devices
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* INCOMING PAIR REQUEST BANNER (1-Tap Allow / Decline) */}
        {pendingRequests.length > 0 && pendingRequests.map((req) => (
          <div
            key={req.deviceId}
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.2)', color: '#10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {renderDeviceIcon(req.deviceType)}
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>
                    “{req.deviceName || 'Nearby Device'}” wants to pair
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Confirm code matches: <strong style={{ color: '#10b981', fontFamily: 'monospace', fontSize: '13px' }}>{formatSixDigit(req.code || myCode)}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => syncEngine.p2pEngine?.respondToPairRequest(req, 'decline')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '9px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Decline
              </button>
              <button
                onClick={() => syncEngine.p2pEngine?.respondToPairRequest(req, 'allow')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '9px',
                  border: 'none',
                  background: '#10b981',
                  color: '#042f2e',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ✓ Allow & Sync
              </button>
            </div>
          </div>
        ))}

        {/* OUTGOING PAIR STEPPER (When user clicks Pair on a nearby device) */}
        {outgoingSession && (
          <div style={{
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--bg-subtle)',
            border: '1.5px solid var(--primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--primary)' }}>
                {outgoingSession.status === 'paired'
                  ? 'Step 3 of 3 · Paired & Syncing!'
                  : outgoingSession.status === 'waiting'
                  ? 'Step 2 of 3 · Confirm on Other Device'
                  : outgoingSession.status === 'error' || outgoingSession.status === 'declined'
                  ? 'Pairing Notice'
                  : 'Step 1 of 3 · Connecting...'}
              </span>
              <button
                onClick={() => syncEngine.p2pEngine?.cancelOutgoingPairSession()}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
              >
                Close
              </button>
            </div>

            {outgoingSession.status === 'waiting' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700 }}>
                    Waiting for approval on “{outgoingSession.peer?.deviceName || 'Device'}”…
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tap <b>Allow</b> on the other screen, or verify this 6-digit code matches:
                  </div>
                </div>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '3px',
                  color: 'var(--primary)'
                }}>
                  {formatSixDigit(outgoingSession.code)}
                </div>
              </div>
            )}

            {outgoingSession.status === 'paired' && (
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="check" size={16} /> Connected to “{outgoingSession.peer?.deviceName}” — tasks and lists are in sync!
              </div>
            )}

            {(outgoingSession.status === 'error' || outgoingSession.status === 'declined') && (
              <div style={{ fontSize: '12.5px', color: '#ef4444', fontWeight: 600 }}>
                {outgoingSession.errorMsg || 'Could not complete pairing.'}
              </div>
            )}
          </div>
        )}

        {/* CARD 1: THIS DEVICE & BIG CRISP QR CODE */}
        <div style={{
          padding: '16px',
          borderRadius: '16px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxSizing: 'border-box',
          width: '100%',
          flexShrink: 0
        }}>
          {/* Device Name and Device Code Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)', flexShrink: 0
              }}>
                {renderDeviceIcon(deviceType)}
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                  This Device Name
                </div>
                {!isEditingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{myName}</span>
                    <button
                      onClick={() => { setNameInput(myName); setIsEditingName(true); }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--primary)',
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: '2px 4px'
                      }}
                    >
                      Rename
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveName} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      autoFocus
                      style={{
                        padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--primary)',
                        background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontWeight: 600, width: '160px'
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: '4px 10px', borderRadius: '6px', border: 'none',
                        background: 'var(--primary)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                This Device Code
              </div>
              <div style={{
                fontSize: '19px',
                fontWeight: 800,
                fontFamily: 'monospace',
                letterSpacing: '2.5px',
                color: 'var(--primary)'
              }}>
                {formatSixDigit(myCode)}
              </div>
            </div>
          </div>

          {/* Centered Big Scannable High-DPI QR Code */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: '6px',
            gap: '8px'
          }}>
            <div style={{
              width: '160px',
              height: '160px',
              padding: '10px',
              borderRadius: '16px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.14)',
              boxSizing: 'border-box'
            }} title={`Pairing QR for ${myName}`}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${myName}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', imageRendering: 'pixelated' }}
                />
              ) : (
                <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>Generating QR…</div>
              )}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
              Scan this QR code from another device's camera to pair instantly
            </div>
          </div>
        </div>

        {/* CARD 2: PAIR ANOTHER DEVICE */}
        <div style={{
          padding: '16px',
          borderRadius: '16px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
          width: '100%',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text)' }}>
              Pair another device
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
              Scan the QR code on your other screen, or enter its 6-digit code below:
            </div>
          </div>

          <form onSubmit={handlePairByCode} style={{ display: 'flex', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={7}
              placeholder="e.g. 482 913"
              value={sixDigitInput}
              onChange={(e) => setSixDigitInput(e.target.value)}
              style={{
                flex: '1 1 0%',
                minWidth: 0,
                width: '100%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: 'monospace',
                letterSpacing: '1px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="submit"
              disabled={isSubmittingCode}
              style={{
                flexShrink: 0,
                height: '40px',
                padding: '0 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--primary-gradient)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
              }}
            >
              {isSubmittingCode ? 'Pairing…' : (deviceType === 'phone' ? 'Pair' : 'Pair by Code')}
            </button>
          </form>

          {/* Camera QR Scanner Button */}
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            style={{
              height: '40px',
              width: '100%',
              borderRadius: '10px',
              border: '1.5px solid var(--primary)',
              backgroundColor: 'var(--tag-bg)',
              color: 'var(--primary)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
          >
            <Icon name="camera" size={14} />
            <span>Scan QR Code with Camera</span>
          </button>

          {codeFeedback && (
            <div style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: codeFeedback.type === 'success' ? '#10b981' : '#ef4444'
            }}>
              {codeFeedback.text}
            </div>
          )}
        </div>

        {/* NEARBY ON THIS WI-FI (Zero-IP 1-Tap Discovery) */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              Nearby on this Wi-Fi ({nearbyPeers.length})
            </span>
            <button
              onClick={() => syncEngine.p2pEngine?.scanLocalNetwork()}
              disabled={p2pInfo.isScanning}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: p2pInfo.isScanning ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Icon name="search" size={13} />
              <span>{p2pInfo.isScanning ? 'Scanning Wi-Fi…' : 'Scan Wi-Fi'}</span>
            </button>
          </div>

          {nearbyPeers.length === 0 ? (
            <div style={{
              padding: deviceType === 'phone' ? 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px' : '16px',
              borderRadius: '12px',
              background: 'var(--bg-subtle)',
              border: '1px dashed var(--border)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center'
            }}>
              {p2pInfo.isScanning
                ? 'Searching your local Wi-Fi for nearby phones, tablets & laptops…'
                : 'No unpaired devices spotted yet. Make sure SyncToDo is open on the same Wi-Fi and tap Scan Wi-Fi.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {nearbyPeers.map((peer) => (
                <div
                  key={peer.deviceId || peer.ip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: 'var(--tag-bg)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {renderDeviceIcon(peer.deviceType)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>
                        {peer.deviceName || 'SyncToDo Device'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Same Wi-Fi · {typeof peer.tasksCount === 'number' ? `${peer.tasksCount} tasks` : 'Ready to pair'}
                      </div>
                    </div>
                  </div>

                  {peer.isPaired ? (
                    <span style={{
                      padding: '5px 10px',
                      borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.14)',
                      color: '#10b981',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      ✓ Paired
                    </span>
                  ) : (
                    <button
                      onClick={() => syncEngine.p2pEngine?.requestPairingWithPeer(peer)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '9px',
                        border: 'none',
                        background: 'var(--primary-gradient)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Pair
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PAIRED DEVICES (Auto-Reconnecting by Device ID) */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Paired Devices ({pairedDevices.length})
          </div>

          {pairedDevices.length === 0 ? (
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              No paired devices yet. Pair once above and your devices will stay linked automatically.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pairedDevices.map((dev) => {
                const isOnline = dev.status === 'connected';
                return (
                  <div
                    key={dev.deviceId || dev.ip}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: 'var(--bg-subtle)',
                      border: isOnline ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)',
                      boxSizing: 'border-box',
                      width: '100%'
                    }}
                  >
                    {/* Row 1: Device Identity (Left) & Live Status Badge Pill (Right) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface)',
                          color: isOnline ? '#10b981' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {renderDeviceIcon(dev.deviceType)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {dev.deviceName || 'Paired Device'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {dev.ip ? `${dev.ip}:${dev.port || (dev.deviceType === 'laptop' ? 4000 : 4567)}` : 'Wi-Fi P2P Mesh'}
                          </div>
                        </div>
                      </div>

                      {/* Right-aligned Status Badge Pill */}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.1)',
                        border: isOnline ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)',
                        color: isOnline ? '#10b981' : 'var(--text-muted)',
                        fontSize: '11px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? '#10b981' : 'var(--text-muted)',
                          boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.7)' : 'none'
                        }} />
                        <span>{isOnline ? (dev.latency ? `${dev.latency}ms` : 'Live') : 'Offline'}</span>
                      </div>
                    </div>

                    {/* Row 2: Matched Action Buttons spanning width */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <button
                        onClick={() => syncEngine.p2pEngine?.syncWithPeer(dev.ip, dev.port)}
                        title="Sync now"
                        style={{
                          flex: 1,
                          height: '34px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: isOnline ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)',
                          background: isOnline ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface)',
                          color: isOnline ? '#10b981' : 'var(--text)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box'
                        }}
                      >
                        <Icon name="repeat" size={13} />
                        <span>Sync Now</span>
                      </button>

                      <button
                        onClick={() => syncEngine.p2pEngine?.removePeer(dev.deviceId || dev.ip)}
                        title="Unpair device"
                        style={{
                          flex: 1,
                          height: '34px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: '#ef4444',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box'
                        }}
                      >
                        <Icon name="x" size={13} />
                        <span>Unpair</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COLLAPSIBLE ADVANCED NETWORK SECTION */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0'
            }}
          >
            <span>Advanced Network Diagnostics (IP / Port / WebSocket)</span>
            <span style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
              <Icon name="chev" size={14} />
            </span>
          </button>

          {showAdvanced && (
            <div style={{
              marginTop: '10px',
              padding: '12px',
              borderRadius: '12px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>This Device Local Address:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{myIp}:{myPort}</span>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Direct IP:Port Pair (Fallback if router blocks UDP broadcast):
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.45:4000"
                    value={manualIpInput}
                    onChange={(e) => setManualIpInput(e.target.value)}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: '12px', fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleManualPair}
                    style={{
                      padding: '7px 12px', borderRadius: '8px', border: 'none',
                      background: 'var(--primary)', color: '#fff', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Connect
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  WebSocket Signaling Server URL:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: '12px', fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveServerUrl}
                    style={{
                      padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: 'var(--surface-elevated)', color: 'var(--text)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera QR Scanner Overlay Modal */}
      {showScanner && (
        <QrScannerModal
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
