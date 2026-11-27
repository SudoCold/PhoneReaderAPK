import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ArrowRight, BookOpen, Check, ChevronRight, FileText, Image, Leaf, Library, LoaderCircle, Plus, Search, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { imageCount, makeSteps, stepAtOffset, wordCount, type Reading, type Settings } from './lib/model';
import { deleteReading, loadLibrary, loadSettings, saveReading, saveSettings } from './lib/storage';
import { AddReading } from './components/AddReading';
import { Preferences } from './components/Preferences';
import { Reader } from './components/Reader';
import { Dialog } from './components/Dialog';

type Filter = 'all' | 'progress' | 'finished';
function Cover({ reading, large = false }: { reading: Reading; large?: boolean }) {
  return <div className={`book-cover cover-${reading.cover} ${large ? 'cover-large' : ''}`} aria-hidden="true"><span className="cover-overline">ORIGIN EDITIONS</span><span className="cover-title">{reading.title}</span><span className="cover-art"><span /><span /><span /></span><span className="cover-bottom">A LITTLE GOOD READING</span></div>;
}

export default function App() {
  const [library, setLibrary] = useState<Reading[]>([]);
  const [settings, setSettings] = useState(loadSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'library' | 'settings'>('library');
  const [active, setActive] = useState<Reading | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Reading | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState('recent');
  const [toast, setToast] = useState('');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = settings.theme === 'dark' || settings.theme === 'system' && systemDark;

  const refresh = useCallback(() => {
    setLoading(true); setLoadError('');
    loadLibrary().then(setLibrary).catch(() => setLoadError('Your library could not be opened. Check that storage is enabled, then try again.')).finally(() => setLoading(false));
  }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171e1a' : '#f5f3ec');
    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
      void StatusBar.setBackgroundColor({ color: dark ? '#171e1a' : '#f5f3ec' }).catch(() => {});
    }
  }, [dark]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener('backButton', () => {
      // Close the top native HTML dialog first so Android Back matches its close button.
      const dialog = Array.from(document.querySelectorAll('dialog[open]')).at(-1);
      if (dialog) { dialog.dispatchEvent(new Event('cancel', { cancelable: true })); return; }
      if (active) setActive(null);
      else if (tab === 'settings') setTab('library');
      else void NativeApp.minimizeApp();
    });
    return () => { void listener.then(l => l.remove()); };
  }, [active, tab]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    try { saveSettings(next); } catch { setToast('Settings could not be saved. Device storage may be full.'); }
  }, []);
  const updateProgress = useCallback((id: string, position: number, completed: boolean) => {
    setLibrary(current => current.map(reading => reading.id === id ? { ...reading, position, completed } : reading));
  }, []);
  // Debounced writes also flush on background/close. The library remains responsive during taps.
  useEffect(() => {
    if (loading || !library.length) return;
    const persist = () => { for (const reading of library) void saveReading(reading).catch(() => setToast('Your progress could not be saved. Device storage may be full.')); };
    const timer = setTimeout(persist, 180);
    const hide = () => { if (document.hidden) persist(); };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', hide);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', hide); };
  }, [library, loading]);
  const openReading = (reading: Reading) => {
    const updated = { ...reading, openedAt: Date.now() };
    setLibrary(current => current.map(item => item.id === reading.id ? updated : item));
    setActive(updated);
  };
  const addReadings = async (readings: Reading[]) => {
    for (const reading of readings) await saveReading(reading);
    setLibrary(current => [...current, ...readings]);
    setTab('library'); setFilter('all'); setQuery('');
    setToast(`${readings.length === 1 ? 'Your reading is' : 'Your readings are'} ready. Make yourself comfortable.`);
  };
  const recent = useMemo(() => [...library].filter(item => !item.completed).sort((a, b) => b.openedAt - a.openedAt)[0], [library]);
  const visible = useMemo(() => library.filter(reading => reading.title.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || filter === 'finished' && reading.completed || filter === 'progress' && reading.position > 0 && !reading.completed)).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'added' ? b.addedAt - a.addedAt : b.openedAt - a.openedAt), [library, filter, query, sort]);
  const percentage = (reading: Reading) => { const steps = makeSteps(reading.blocks, settings.words); return reading.completed ? 100 : Math.round(stepAtOffset(steps, reading.position) / steps.length * 100); };

  if (active) return <Reader key={active.id} reading={active} settings={settings} onSettings={updateSettings} onClose={() => setActive(null)} onProgress={updateProgress} />;

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header"><a className="brand" href="#" aria-label="Origin Reader home" onClick={event => { event.preventDefault(); setTab('library'); }}><span className="brand-mark"><BookOpen size={24} strokeWidth={1.6} /></span><span>origin<span className="brand-sub">READER</span></span></a><div className="header-right"><span className="device-note"><ShieldCheck size={15} /> Your own little corner</span><button className="icon-button add-top" aria-label="Add a reading" onClick={() => setAdding(true)} disabled={loading}><Plus size={22} /></button></div></header>
    <main id="main" className="home-main">
      {tab === 'library' ? <>
        <section className="welcome"><div className="eyebrow welcome-eyebrow"><span className="small-rule" /> MAKE A LITTLE ROOM</div><h1>A few words.<br /><em>A world of your own.</em></h1><p>Settle in. Pick up where you left off.</p></section>
        {loading ? <div className="empty-state" role="status"><LoaderCircle className="spinning" /><p>Finding your words…</p></div> : loadError ? <div className="empty-state"><p role="alert">{loadError}</p><button className="button primary" onClick={refresh}>Try again</button></div> : <>
          {recent && <section className="continue-card" aria-label="Continue reading"><div className="continue-copy"><span className="eyebrow"><span className="live-dot" /> {recent.position ? 'RIGHT WHERE YOU LEFT OFF' : 'YOUR NEXT QUIET MOMENT'}</span><h2>{recent.title}</h2><p>{wordCount(recent.blocks)} words{imageCount(recent.blocks) ? ` · ${imageCount(recent.blocks)} image${imageCount(recent.blocks) === 1 ? '' : 's'}` : ''} <span className="continue-time">· {Math.max(1, Math.ceil(wordCount(recent.blocks) / settings.wpm))} min read</span></p><button className="continue-button" onClick={() => openReading(recent)}>{recent.position ? 'Continue reading' : 'Start reading'}<ArrowRight size={18} /></button></div><Cover reading={recent} large /><div className="continue-progress" aria-hidden="true"><span style={{ width: `${percentage(recent)}%` }} /></div></section>}
          <section className="library-section"><div className="section-heading"><h2>Your bookshelf <span>{library.length.toString().padStart(2, '0')}</span></h2><div className="section-tools"><button className="icon-button" aria-label={searching ? 'Close search' : 'Search library'} aria-expanded={searching} onClick={() => { setSearching(s => !s); setQuery(''); }}>{searching ? <X size={19} /> : <Search size={19} />}</button><label className="sort-control" title="Sort library"><ArrowDownUp size={18} /><select aria-label="Sort library" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently read</option><option value="added">Recently added</option><option value="title">Title A–Z</option></select></label></div></div>
            {searching && <label className="search-field"><Search size={18} /><input autoFocus type="search" aria-label="Search by title" placeholder="Find a little something…" value={query} onChange={event => setQuery(event.target.value)} /></label>}
            <div className="library-filters" aria-label="Filter library">{([{ id: 'all', label: 'All readings' }, { id: 'progress', label: 'In progress' }, { id: 'finished', label: 'Finished' }] as const).map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
            <div className="book-list">{visible.length ? visible.map(reading => <article className="book-row" key={reading.id}><button className="book-open" onClick={() => openReading(reading)} aria-label={`Read ${reading.title}`}><Cover reading={reading} /><span className="book-details"><span className="book-format">{reading.format}{imageCount(reading.blocks) > 0 && <span><Image size={12} /> WITH IMAGES</span>}</span><h3>{reading.title}</h3><span className="book-meta">{wordCount(reading.blocks)} words <span>·</span> {reading.completed ? <><Check size={13} /> Finished</> : reading.position ? `${percentage(reading)}% read` : 'Ready when you are'}</span>{reading.position > 0 && !reading.completed && <span className="tiny-progress"><span style={{ width: `${percentage(reading)}%` }} /></span>}</span><ChevronRight className="book-chevron" size={18} /></button><button className="icon-button remove-button" aria-label={`Remove ${reading.title}`} onClick={() => setRemoving(reading)}><Trash2 size={16} /></button></article>) : <div className="empty-state"><BookOpen size={32} /><h3>{query ? 'No words found.' : filter === 'finished' ? 'Good endings take their time.' : filter === 'progress' ? 'Your next read is waiting.' : 'Your shelf, your stories.'}</h3><p>{query ? 'Try another title.' : filter === 'all' ? 'Add a document or paste something you’d love to read.' : 'Choose a reading from your bookshelf to begin.'}</p>{filter !== 'all' && <button className="button secondary" onClick={() => setFilter('all')}>Browse all readings</button>}</div>}</div>
            <button className="add-reading-card" onClick={() => setAdding(true)}><span className="add-circle"><Plus size={22} /></span><span><strong>Make room for another.</strong><span>Upload a document or paste your words</span></span><ArrowRight size={18} /></button>
          </section>
          <div className="home-endnote"><Leaf size={17} strokeWidth={1.5} /><p>Less scrolling. More being here.</p><span>Just you and the next few words.</span></div>
        </>}
      </> : <><section className="welcome settings-welcome"><span className="eyebrow">MAKE IT YOURS</span><h1>Find your<br /><em>reading rhythm.</em></h1><p>A little adjustment. A better kind of focus.</p></section><Preferences settings={settings} onChange={updateSettings} /></>}
    </main>
    <nav className="bottom-nav" aria-label="Main navigation"><button aria-current={tab === 'library' ? 'page' : undefined} className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}><Library size={21} strokeWidth={1.7} /><span>Library</span></button><span className="nav-divider" /><button aria-current={tab === 'settings' ? 'page' : undefined} className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings2 size={21} strokeWidth={1.7} /><span>Preferences</span></button></nav>
    {adding && <AddReading onClose={() => setAdding(false)} onAdd={addReadings} />}
    {removing && <Dialog title="Make a little space?" onClose={() => setRemoving(null)}><p className="dialog-intro">Remove “{removing.title}” and its saved position from this device? Your original file stays where it is.</p><div className="dialog-actions"><button className="button secondary" onClick={() => setRemoving(null)}>Keep it</button><button className="button danger" onClick={async () => { try { await deleteReading(removing.id); setLibrary(current => current.filter(item => item.id !== removing.id)); setRemoving(null); setToast('Reading removed from your library.'); } catch { setToast('This reading could not be removed. Try again.'); } }}><Trash2 size={17} /> Remove</button></div></Dialog>}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast && <><Check size={17} /><span>{toast}</span></>}</div>
    <span className="sr-only"><FileText />Origin Reader. Tap right to advance, left to go back.</span>
  </div>;
}
