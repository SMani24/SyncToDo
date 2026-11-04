import React from 'react';

export const ALL_THEMES = [
  // 4 Dark Themes
  {
    id: 'nordic',
    name: 'Nordic Glass',
    type: 'dark',
    tagline: 'Ambient Frosted Glass',
    desc: 'Deep slate-navy with translucent frosted glass and soft indigo/violet glow.',
    color: '#6366f1',
    bg: '#090e17',
    surface: '#1e293b'
  },
  {
    id: 'cyber',
    name: 'Cyber Matrix',
    type: 'dark',
    tagline: 'OLED Pitch Black',
    desc: 'Ultra-contrast black canvas with neon emerald and cyan focus highlights.',
    color: '#10b981',
    bg: '#030712',
    surface: '#111827'
  },
  {
    id: 'monolith',
    name: 'Midnight Monolith',
    type: 'dark',
    tagline: 'Onyx & Brushed Titanium',
    desc: 'Architectural monochrome minimalism with titanium silver and ice white accents.',
    color: '#e4e4e7',
    bg: '#121214',
    surface: '#202024'
  },
  {
    id: 'dracula',
    name: 'Dracula Velvet',
    type: 'dark',
    tagline: 'Obsidian & Lavender',
    desc: 'Luxurious deep royal violet with soft lavender and coral accents.',
    color: '#c084fc',
    bg: '#0f0c1b',
    surface: '#1e1933'
  },

  // 4 Light Themes
  {
    id: 'minimal',
    name: 'Clean Studio',
    type: 'light',
    tagline: 'Porcelain White & Indigo',
    desc: 'Crisp Scandinavian design with high-contrast typography and subtle borders.',
    color: '#2563eb',
    bg: '#f8fafc',
    surface: '#ffffff'
  },
  {
    id: 'editorial',
    name: 'Warm Journal',
    type: 'light',
    tagline: 'Cream Parchment & Terracotta',
    desc: 'Warm paper feel with calming sepia tones and warm amber accents.',
    color: '#c2410c',
    bg: '#fcf9f2',
    surface: '#ffffff'
  },
  {
    id: 'matcha',
    name: 'Matcha Botanical',
    type: 'light',
    tagline: 'Sage Linen & Forest Mint',
    desc: 'Earthy botanical sage linen with bamboo green highlights. Calming for long reading.',
    color: '#15803d',
    bg: '#f2f7f3',
    surface: '#ffffff'
  },
  {
    id: 'sakura',
    name: 'Tokyo Sakura',
    type: 'light',
    tagline: 'Rose Petal & Plum Blossom',
    desc: 'Soft blush paper tone with vibrant sakura magenta and deep slate accents.',
    color: '#db2777',
    bg: '#fdf7f9',
    surface: '#ffffff'
  }
];

export default function ThemeSettingsModal({
  themeConfig,
  onUpdateThemeConfig,
  currentAppliedTheme,
  onApplyTheme,
  onClose
}) {
  const darkThemes = ALL_THEMES.filter(t => t.type === 'dark');
  const lightThemes = ALL_THEMES.filter(t => t.type === 'light');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 210,
      padding: 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '680px',
        backgroundColor: 'var(--surface)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh',
        color: 'var(--text)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🎨</span>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                Themes, Pairing & Auto-Schedule
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                4 Dark & 4 Light handcrafted aesthetics with smart ambient swapping
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Schedule Mode Selector */}
          <div style={{
            padding: 'max(14px, var(--sat)) 12px max(18px, var(--sab)) 12px',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            marginBottom: '24px'
          }}>
            <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
              🌓 Theme Switching Behavior
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onUpdateThemeConfig({ mode: 'manual' })}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: themeConfig.mode === 'manual' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: themeConfig.mode === 'manual' ? 'var(--surface)' : 'transparent',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div>🔒 Manual Lock</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Always use selected theme
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateThemeConfig({ mode: 'system' })}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: themeConfig.mode === 'system' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: themeConfig.mode === 'system' ? 'var(--surface)' : 'transparent',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div>💻 Follow Device OS</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Sync with Phone / PC dark mode
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateThemeConfig({ mode: 'scheduled' })}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: themeConfig.mode === 'scheduled' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: themeConfig.mode === 'scheduled' ? 'var(--surface)' : 'transparent',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div>⏰ Day/Night Schedule</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Auto-swap by hour of day
                </div>
              </button>
            </div>

            {/* Time schedule inputs */}
            {themeConfig.mode === 'scheduled' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>☀️ Light Theme Start:</span>
                  <input
                    type="time"
                    value={themeConfig.lightStartTime || '07:00'}
                    onChange={(e) => onUpdateThemeConfig({ lightStartTime: e.target.value })}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>🌙 Dark Theme Start:</span>
                  <input
                    type="time"
                    value={themeConfig.darkStartTime || '19:00'}
                    onChange={(e) => onUpdateThemeConfig({ darkStartTime: e.target.value })}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dark Themes Section */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                🌙 Dark Theme Pair (Select 1 of 4)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                Selected: {darkThemes.find(t => t.id === themeConfig.darkThemeId)?.name}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {darkThemes.map(t => {
                const isPairSelected = themeConfig.darkThemeId === t.id;
                const isCurrentlyActive = currentAppliedTheme === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      onUpdateThemeConfig({ darkThemeId: t.id });
                      if (themeConfig.mode === 'manual' || currentAppliedTheme === themeConfig.darkThemeId) {
                        onApplyTheme(t.id);
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isPairSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: isPairSelected ? 'var(--surface-elevated)' : 'var(--bg-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{t.name}</span>
                      </div>
                      {isCurrentlyActive && (
                        <span style={{ fontSize: '10px', background: 'var(--tag-bg)', color: 'var(--tag-text)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          Active Now
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {t.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Light Themes Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                ☀️ Light Theme Pair (Select 1 of 4)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                Selected: {lightThemes.find(t => t.id === themeConfig.lightThemeId)?.name}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {lightThemes.map(t => {
                const isPairSelected = themeConfig.lightThemeId === t.id;
                const isCurrentlyActive = currentAppliedTheme === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      onUpdateThemeConfig({ lightThemeId: t.id });
                      if (themeConfig.mode === 'manual' || currentAppliedTheme === themeConfig.lightThemeId) {
                        onApplyTheme(t.id);
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isPairSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: isPairSelected ? 'var(--surface-elevated)' : 'var(--bg-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{t.name}</span>
                      </div>
                      {isCurrentlyActive && (
                        <span style={{ fontSize: '10px', background: 'var(--tag-bg)', color: 'var(--tag-text)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          Active Now
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {t.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface-elevated)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary-gradient)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
