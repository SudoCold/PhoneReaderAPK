import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Expand, Pause, Play, RotateCcw, SlidersHorizontal, X, ZoomIn } from 'lucide-react';
import { makeSteps, stepAtOffset, type Reading, type Settings } from '../lib/model';
import { Preferences } from './Preferences';
import { Dialog } from './Dialog';

export function Reader({ reading, settings, onSettings, onClose, onProgress }: { reading: Reading; settings: Settings; onSettings: (settings: Settings) => void; onClose: () => void; onProgress: (id: string, offset: number, completed: boolean) => void }) {
  const steps = useMemo(() => makeSteps(reading.blocks, settings.words), [reading.blocks, settings.words]);
  const [offset, setOffset] = useState(reading.completed ? 0 : reading.position);
  const [finished, setFinished] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [failedImage, setFailedImage] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLParagraphElement>(null);
  const index = stepAtOffset(steps, offset);
  const step = steps[index];
  // Fit this one chunk to the available phone screen. Never turn it into a scrolling page.
  useLayoutEffect(() => {
    if (step?.type !== 'text') return;
    const container = contentRef.current;
    const words = wordsRef.current;
    if (!container || !words) return;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      const css = getComputedStyle(container);
      const height = container.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
      const width = container.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      let size = settings.fontSize * rootSize / 16;
      words.style.fontSize = `${size}px`;
      while (size > 16 && (words.scrollHeight > height + 1 || words.scrollWidth > width + 1)) {
        size -= 1;
        words.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    void document.fonts.ready.then(fit);
    return () => { alive = false; observer.disconnect(); };
  }, [step, settings.fontSize, settings.font, finished]);
  const move = useCallback((direction: 1 | -1) => {
    setPlaying(false);
    if (finished && direction === -1) { setFinished(false); return; }
    const nextIndex = stepAtOffset(steps, offset) + direction;
    if (nextIndex >= steps.length) { setFinished(true); return; }
    setOffset(steps[Math.max(0, nextIndex)]?.offset ?? 0);
  }, [finished, offset, steps]);

  useEffect(() => { onProgress(reading.id, finished ? (steps.at(-1)?.endOffset ?? 0) : offset, finished); }, [offset, finished, onProgress, reading.id, steps]);
  useEffect(() => { if (step?.type === 'image' || finished || preferences || expanded) setPlaying(false); }, [step, finished, preferences, expanded]);
  useEffect(() => {
    if (!playing || step?.type !== 'text' || finished || document.hidden) return;
    const delay = Math.max(300, step.text.split(/\s+/u).length * 60000 / settings.wpm);
    const timer = window.setTimeout(() => {
      if (index === steps.length - 1) { setFinished(true); setPlaying(false); }
      else setOffset(steps[index + 1].offset);
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, step, finished, settings.wpm, index, steps]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (preferences || expanded || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,button'))) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === ' ' && !finished && step?.type === 'text') { event.preventDefault(); setPlaying(p => !p); }
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [move, expanded, preferences, finished, step, onClose]);

  const progress = finished ? 100 : Math.round(index / steps.length * 100);
  return <main className="reader-screen">
    <header className="reader-header"><button className="icon-button" aria-label="Back to library" onClick={onClose}><ArrowLeft size={22} /></button><div className="reader-document"><span className="eyebrow">NOW READING</span><h1>{reading.title}</h1></div><button className="reader-settings" aria-label="Reading preferences" onClick={() => setPreferences(true)}><span>{settings.words} words</span><SlidersHorizontal size={19} /></button></header>
    <div className="reader-progress" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div style={{ width: `${progress}%` }} /></div>
    {finished ? <section className="finished-screen"><span className="finished-mark"><Check size={32} /></span><span className="eyebrow">A MOMENT WELL SPENT</span><h2>One read.<br />A little richer.</h2><p>You’ve reached the end of <strong>{reading.title}</strong>.</p><button className="button primary" onClick={onClose}>Back to my library <BookOpen size={18} /></button><button className="button text-button" onClick={() => { setOffset(0); setFinished(false); }}><RotateCcw size={16} /> Read again</button><button className="button text-button" onClick={() => move(-1)}><ArrowLeft size={16} /> Back to last step</button></section> : <>
      <section className={`reading-stage ${step?.type === 'image' ? 'image-stage' : ''}`} aria-label="Tap left to go back; tap right to continue">
        <div className="stage-top"><span className="eyebrow">{step?.type === 'image' ? 'A MOMENT FOR THE PICTURE' : 'ONE LITTLE THOUGHT AT A TIME'}</span>{step?.page && <span className="page-number">Page {step.page}</span>}</div>
        <div ref={contentRef} className="reading-content" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
          {step?.type === 'text' ? <p ref={wordsRef} className={`reading-words ${settings.font === 'sans' ? 'font-sans' : ''}`} style={{ fontSize: `${settings.fontSize / 16}rem` }}>{step.text}</p> : step?.type === 'image' && <figure className="reading-figure">{failedImage === step.src ? <p className="image-failure">This image is unavailable.<br />You can continue to the next step.</p> : <img src={step.src} alt={step.alt} onError={() => setFailedImage(step.src)} />}<figcaption>{step.alt}</figcaption></figure>}
        </div>
        <div className="tap-zones"><button data-testid="previous-zone" className="tap-zone previous-zone" aria-label="Previous words or image" disabled={index === 0} onClick={() => move(-1)}><span><ChevronLeft size={17} /> Tap to go back</span></button><button data-testid="next-zone" className="tap-zone next-zone" aria-label="Next words or image" onClick={() => move(1)}><span>Tap to continue <ChevronRight size={17} /></span></button></div>
      </section>
      <footer className="reader-footer"><div className="reader-position"><span>{String(index + 1).padStart(2, '0')} <span className="muted">/ {String(steps.length).padStart(2, '0')}</span></span><span className="muted">{step?.type === 'image' ? 'Image · take your time' : `${progress}% of the way`}</span></div><div className="playback-controls"><button className="icon-button" aria-label="Previous step" disabled={index === 0} onClick={() => move(-1)}><ChevronLeft /></button>{step?.type === 'image' ? <button className="button secondary" onClick={() => { setZoom(1); setExpanded(true); }} disabled={failedImage === step.src}><Expand size={18} /> View image</button> : <button className={`play-button ${playing ? 'is-playing' : ''}`} aria-label={playing ? 'Pause auto-read' : 'Start auto-read'} onClick={() => setPlaying(p => !p)}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>}<button className="icon-button" aria-label="Next step" onClick={() => move(1)}><ChevronRight /></button></div><p className="reader-footnote">{step?.type === 'image' ? 'Tap the right side when you’re ready.' : playing ? 'At your pace. Pause whenever you like.' : 'Your words. Your pace.'}</p></footer>
    </>}
    {preferences && <Dialog title="Find your rhythm." onClose={() => setPreferences(false)}><Preferences settings={settings} onChange={onSettings} compact /><button className="button primary full" onClick={() => setPreferences(false)}>Back to reading <ArrowRight size={18} /></button></Dialog>}
    {expanded && step?.type === 'image' && <Dialog title="A closer look." onClose={() => setExpanded(false)} wide><div className="image-zoom"><img src={step.src} alt={step.alt} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} /></div><p className="image-caption">{step.alt}</p><label className="zoom-control"><ZoomIn size={20} /><span>Zoom</span><input type="range" aria-label="Zoom" min="1" max="3" step="0.25" value={zoom} onChange={event => setZoom(+event.target.value)} /><span>{Math.round(zoom * 100)}%</span></label><button className="button secondary full" onClick={() => setExpanded(false)}><X size={18} /> Return to reading</button></Dialog>}
  </main>;
}
