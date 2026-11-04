import React, { useState } from 'react';
import { Icon } from './SvgIcons';

// Generates a crisp deterministic 13x13 QR-style matrix from a seed string
function buildQrMatrix(seedStr) {
  const size = 13;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0, c0) => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const isBorder = r === 0 || r === 3 || c === 0 || c === 3;
        const isCenter = r >= 1 && r <= 2 && c >= 1 && c <= 2;
        grid[r0 + r][c0 + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 4);
  drawFinder(size - 4, 0);

  let hash = 2166136261;
  const str = String(seedStr || 'synctodo');
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinderTL = r < 5 && c < 5;
      const inFinderTR = r < 5 && c >= size - 5;
      const inFinderBL = r >= size - 5 && c < 5;
      if (inFinderTL || inFinderTR || inFinderBL) continue;
      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = (Math.abs(hash) % 10) < 5;
    }
  }
  return grid;
}

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
  const [nameInput, setNameInput] = useState(p2pInfo.deviceName || syncEngine.deviceName || 'My Device');
  const [sixDigitInput, setSixDigitInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState(null);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualIpInput, setManualIpInput] = useState('');
  const [serverUrlInput, setServerUrlInput] = useState(syncEngine.serverUrl || '');

  const myName = p2pInfo.deviceName || syncEngine.deviceName || 'My Device';
  const myCode = p2pInfo.pairingCode || '482913';
  const myIp = p2pInfo.myLocalIp || 'Local Wi-Fi';
  const myPort = p2pInfo.port || (deviceType === 'laptop' ? 4000 : 4567);

  const pairedDevices = p2pInfo.pairedDevices || [];
  const nearbyPeers = p2pInfo.nearbyPeers || [];
  const pendingRequests = p2pInfo.pendingRequests || [];
  const outgoingSession = p2pInfo.outgoingPairSession || null;

  const qrSeed = `synctodo://${myIp}:${myPort}?code=${myCode}&name=${encodeURIComponent(myName)}`;
  const qrGrid = buildQrMatrix(qrSeed);

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    await syncEngine.p2pEngine?.renameThisDevice(nameInput.trim());
    setIsEditingName(false);
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              gap: '10px'
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
            gap: '10px'
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

        {/* THIS DEVICE + QR & 6-DIGIT CODE CARD */}
        <div style={{
          padding: '16px',
          borderRadius: '16px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Device Name row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)'
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

          {/* QR + Enter 6-Digit Code Split */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: deviceType === 'phone' ? '1fr' : '116px 1fr',
            gap: '14px',
            alignItems: 'center',
            paddingTop: '10px',
            borderTop: '1px solid var(--border)'
          }}>
            {/* Visual QR Matrix */}
            <div style={{
              width: '108px',
              height: '108px',
              margin: deviceType === 'phone' ? '0 auto' : '0',
              padding: '8px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: `repeat(${qrGrid.length}, 1fr)`,
              gap: '1.5px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
            }} title={`Pairing QR for ${myName}`}>
              {qrGrid.flat().map((cell, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: cell ? '#0f172a' : 'transparent',
                    borderRadius: '1px'
                  }}
                />
              ))}
            </div>

            {/* Enter 6-Digit Code Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                Have a 6-digit code from another device?
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Open <b>Devices & Sync</b> on your phone or laptop and enter its 6-digit code below — or simply tap a nearby device from the list.
              </div>
              <form onSubmit={handlePairByCode} style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="e.g. 482 913"
                  value={sixDigitInput}
                  onChange={(e) => setSixDigitInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    letterSpacing: '2px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={isSubmittingCode}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--primary-gradient)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isSubmittingCode ? 'Pairing…' : (deviceType === 'phone' ? 'Pair' : 'Pair by Code')}
                </button>
              </form>
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
          </div>
        </div>

        {/* NEARBY ON THIS WI-FI (Zero-IP 1-Tap Discovery) */}
        <div>
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
        <div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pairedDevices.map((dev) => {
                const isOnline = dev.status === 'connected';
                return (
                  <div
                    key={dev.deviceId || dev.ip}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      background: 'var(--bg-subtle)',
                      border: isOnline ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '10px',
                        background: isOnline ? 'rgba(16, 185, 129, 0.14)' : 'var(--surface)',
                        color: isOnline ? '#10b981' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {renderDeviceIcon(dev.deviceType)}
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{dev.deviceName || 'Paired Device'}</span>
                          <span style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            backgroundColor: isOnline ? '#10b981' : 'var(--text-muted)'
                          }} />
                        </div>
                        <div style={{ fontSize: '11px', color: isOnline ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                          {isOnline
                            ? `Synced${dev.latency ? ` · ${dev.latency}ms` : ' · Live'}`
                            : 'Offline · Will auto-sync when on Wi-Fi'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {dev.ip && (
                        <button
                          onClick={() => syncEngine.p2pEngine?.syncWithPeer(dev.ip, dev.port)}
                          title="Sync now"
                          style={{
                            padding: '5px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Sync Now
                        </button>
                      )}
                      <button
                        onClick={() => syncEngine.p2pEngine?.removePeer(dev.deviceId || dev.ip)}
                        title="Unpair device"
                        style={{
                          padding: '5px 8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Unpair
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COLLAPSIBLE ADVANCED NETWORK SECTION */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
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
    </div>
  );
}
