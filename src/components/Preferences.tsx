import { Minus, Moon, Monitor, Plus, Sun } from 'lucide-react';
import type { Settings } from '../lib/model';

export function Preferences({ settings, onChange, compact = false }: { settings: Settings; onChange: (settings: Settings) => void; compact?: boolean }) {
  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return <div className={`preferences ${compact ? 'compact' : ''}`}>
    <section className="setting-section"><div className="setting-heading"><div><h3>Words per tap</h3><p>A few words. A little more focus.</p></div><span className="setting-value">{settings.words}</span></div>
      <div className="stepper"><button className="icon-button" aria-label="Fewer words per tap" disabled={settings.words <= 1} onClick={() => update({ words: settings.words - 1 })}><Minus size={20} /></button><input type="range" aria-label="Words per tap" min="1" max="12" step="1" value={settings.words} onChange={event => update({ words: +event.target.value })} /><button className="icon-button" aria-label="More words per tap" disabled={settings.words >= 12} onClick={() => update({ words: settings.words + 1 })}><Plus size={20} /></button></div>
      <div className="range-labels"><span>One word</span><span>A few words</span></div>
    </section>
    <section className="setting-section"><div className="setting-heading"><div><h3>Text size</h3><p>Make a little room for your eyes.</p></div><span className="setting-value">{settings.fontSize}</span></div><input type="range" aria-label="Text size" min="24" max="64" step="2" value={settings.fontSize} onChange={event => update({ fontSize: +event.target.value })} /></section>
    <section className="setting-section"><h3>Reading font</h3><div className="font-options"><button className={`font-serif ${settings.font === 'serif' ? 'selected' : ''}`} aria-pressed={settings.font === 'serif'} onClick={() => update({ font: 'serif' })}><span>Aa</span>Bookish serif</button><button className={settings.font === 'sans' ? 'selected' : ''} aria-pressed={settings.font === 'sans'} onClick={() => update({ font: 'sans' })}><span>Aa</span>Clean sans</button></div></section>
    <section className="setting-section"><h3>Appearance</h3><div className="theme-options">{([{ id: 'light', title: 'Paper', icon: Sun }, { id: 'dark', title: 'Evening', icon: Moon }, { id: 'system', title: 'Device', icon: Monitor }] as const).map(option => <button key={option.id} aria-pressed={settings.theme === option.id} className={settings.theme === option.id ? 'selected' : ''} onClick={() => update({ theme: option.id })}><option.icon size={20} />{option.title}</button>)}</div></section>
    <section className="setting-section"><div className="setting-heading"><div><h3>Auto-read pace</h3><p>Optional playback. Always pauses at images.</p></div><span className="setting-value">{settings.wpm}<small> WPM</small></span></div><input type="range" aria-label="Auto-read words per minute" min="60" max="600" step="20" value={settings.wpm} onChange={event => update({ wpm: +event.target.value })} /></section>
    <div className="settings-preview"><span className="eyebrow">A LITTLE PREVIEW</span><p style={{ fontFamily: settings.font === 'serif' ? 'var(--serif)' : 'var(--sans)', fontSize: `${settings.fontSize / 16}rem` }}>A quieter way to read.</p></div>
    {!compact && <p className="local-note">Your settings and reading progress stay on this device.<br />Origin Reader · 2.0</p>}
  </div>;
}
