import { useRef, useState, type ClipboardEvent } from 'react';
import { ArrowRight, FileUp, ImagePlus, LoaderCircle, Plus, X } from 'lucide-react';
import { ACCEPT, importFiles, newReading, parseRichText, storeImage, validateFile } from '../lib/importer';
import type { Reading } from '../lib/model';
import { Dialog } from './Dialog';

export function AddReading({ onClose, onAdd }: { onClose: () => void; onAdd: (readings: Reading[]) => Promise<void> }) {
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [dragging, setDragging] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  function showError(message: string) { setError(message); requestAnimationFrame(() => errorRef.current?.focus()); }
  function pickFiles(picked: File[]) {
    try { picked.forEach(validateFile); setFiles(picked); setError(''); setNeedsPassword(false); setPassword(''); }
    catch (error) { showError((error as Error).message); }
  }
  async function attach(file: File) {
    try {
      validateFile(file); setBusy(true); setProgress('Preparing image…');
      const src = await storeImage(file);
      const id = `attachment:${crypto.randomUUID()}`;
      const start = textarea.current?.selectionStart ?? text.length;
      const end = textarea.current?.selectionEnd ?? start;
      const marker = `\n![${file.name.replace(/[\[\]]/g, '') || 'Attached image'}](${id})\n`;
      setAttachments(old => new Map(old).set(id, src));
      setText(old => old.slice(0, start) + marker + old.slice(end));
      setError('');
      requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(start + marker.length, start + marker.length); });
    } catch (error) { showError((error as Error).message); } finally { setBusy(false); }
  }
  async function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.clipboardData.files).find(file => file.type.startsWith('image/'));
    if (file) { event.preventDefault(); await attach(file); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true); setProgress('Preparing your reading…');
    try {
      const readings = tab === 'file' ? await importFiles(files, setProgress, password || undefined) : [newReading(title, 'NOTE', await parseRichText(text, false, attachments))];
      if (!readings.length) throw new Error('Choose a document or some images to continue.');
      await onAdd(readings);
      onClose();
    } catch (error) {
      if ((error as Error).name === 'PasswordException') { setNeedsPassword(true); showError(password ? 'That password did not unlock the PDF. Try again.' : 'This PDF needs a password. Enter it below.'); }
      else showError((error as Error).message || 'This file could not be opened. Try another file.');
    } finally { setBusy(false); }
  }
  return <Dialog title="Something worth reading." onClose={busy ? () => {} : onClose}>
    <p className="dialog-intro">Bring your words. Keep the pictures.</p>
    <div className="segmented" role="tablist" aria-label="Add reading method">
      <button role="tab" aria-selected={tab === 'file'} aria-controls="file-panel" id="file-tab" onClick={() => { setTab('file'); setError(''); }} disabled={busy}>Upload a file</button>
      <button role="tab" aria-selected={tab === 'paste'} aria-controls="paste-panel" id="paste-tab" onClick={() => { setTab('paste'); setError(''); }} disabled={busy}>Paste text</button>
    </div>
    <form onSubmit={submit}>
      {tab === 'file' ? <div role="tabpanel" id="file-panel" aria-labelledby="file-tab">
        <label className={`file-drop ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) pickFiles(Array.from(event.dataTransfer.files)); }}>
          <input type="file" accept={ACCEPT} multiple disabled={busy} onChange={event => pickFiles(Array.from(event.target.files || []))} aria-label="Select documents and images" />
          <span className="upload-icon"><FileUp size={26} /></span><strong>{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Find your next read'}</strong>
          <span className="muted">Tap to browse, or drop files here</span>
          <span className="file-types">PDF, TXT, Markdown, HTML & images · up to 100 MB each</span>
        </label>
        {!!files.length && <ul className="selected-files">{files.map((file, i) => <li key={`${file.name}-${i}`}><span>{file.name}</span><button type="button" className="icon-button" aria-label={`Remove ${file.name} from selection`} disabled={busy} onClick={() => setFiles(old => old.filter((_, n) => n !== i))}><X size={16} /></button></li>)}</ul>}
        <p className="helper">For Markdown or HTML with local pictures, select the document and its image files together.</p>
        {needsPassword && <label className="field">PDF password<input autoComplete="off" type="password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
      </div> : <div role="tabpanel" id="paste-panel" aria-labelledby="paste-tab">
        <label className="field">Title <span className="muted">(optional)</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="A name for these words" maxLength={180} disabled={busy} /></label>
        <label className="field">Your text<textarea ref={textarea} value={text} onChange={event => setText(event.target.value)} onPaste={onPaste} placeholder="Paste a passage, an article, or a thought…" rows={7} disabled={busy} aria-describedby="paste-help" /></label>
        <div className="attach-row"><label className="button secondary attach-button"><ImagePlus size={18} /> Add image<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void attach(file); event.target.value = ''; }} /></label><span className="muted">At your cursor position</span></div>
        <p id="paste-help" className="helper">Images keep their place between your words. You can also paste an image from your clipboard.</p>
      </div>}
      {!!error && <p className="error" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
      <button className="button primary full" type="submit" disabled={busy || (tab === 'file' ? !files.length : !text.trim())}>{busy ? <><LoaderCircle className="spinning" size={18} />{progress}</> : <>Add to my library <ArrowRight size={18} /></>}</button>
    </form>
    <p className="privacy-note"><Plus size={12} /> A little more space for what matters. Saved on your device.</p>
  </Dialog>;
}
