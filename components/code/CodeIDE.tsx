'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import { ArrowsClockwise, CheckCircle, ClockCounterClockwise, Copy, DotsThreeVertical, DownloadSimple, FileCode, Gear, Play, Plus, Sparkle, Warning, XCircle, Info, CircleNotch } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { useMentor } from '@/lib/client/stores';
import { syntaxCheck, vexLint, type Diag } from '@/lib/vexcode/check';
import { VEX_SYMBOLS } from '@/lib/vexcode/stub';
import { timeAgo } from '@/lib/format';
import { useDerived } from '../viewer3d/Viewer';
import { DiffView } from '../mentor/Chat';
import { Dialog, Drawer } from '../ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../ui/Menu';
import { Spinner } from '../ui/bits';
import { Tip } from '../ui/Tip';
import { toast } from '../ui/Toast';
import { SerialConsole } from './SerialConsole';
import { AutonPreview } from './AutonPreview';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CodeFile { id: string; path: string; content: string; generated: boolean; updatedAt: number; updatedBy: string | null }
interface CodeData { build: { id: string; name: string; drawingPrefix: string; autonStart: { x: number; y: number; heading: number } | null }; files: CodeFile[]; devices: string[]; lastCompile: null | { ok: boolean; engine: string; diagnostics: Diag[]; createdAt: number } }
type DiagX = Diag & { fileId?: string | null };
type Panel = 'problems' | 'output' | 'serial' | 'auton';

const HONEST = 'Compile checks your code against the VEX V5 C++ API. To run it on the robot, download the project and open it in VEXcode V5 or the VEX VS Code extension.';
let providersReady = false;

function TextareaEditor({ value, onChange, readOnly, onBlur, jump }: { value: string; onChange: (v: string) => void; readOnly: boolean; onBlur: () => void; jump: { line: number; n: number } | null }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lines = value.split('\n').length;
  useEffect(() => {
    if (!jump || !ref.current) return;
    const idx = value.split('\n').slice(0, jump.line - 1).join('\n').length + (jump.line > 1 ? 1 : 0);
    ref.current.focus(); ref.current.setSelectionRange(idx, idx);
    ref.current.scrollTop = (jump.line - 5) * 19;
  }, [jump]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex h-full overflow-hidden bg-code-bg font-mono text-[13px] leading-[19px]">
      <div aria-hidden className="select-none overflow-hidden px-2 py-2 text-right text-[#5C6370]">{Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}</div>
      <textarea ref={ref} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} spellCheck={false} aria-label="Code editor"
        onScroll={(e) => { const g = e.currentTarget.previousSibling as HTMLElement; g.scrollTop = e.currentTarget.scrollTop; }}
        onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; onChange(value.slice(0, s) + '  ' + value.slice(t.selectionEnd)); requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2)); } }}
        className="h-full flex-1 resize-none whitespace-pre bg-transparent py-2 pr-4 text-[#D4D4D4] outline-none" />
    </div>
  );
}

export function CodeIDE({ buildId, embedded = false }: { buildId: string; embedded?: boolean }) {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const openMentor = useMentor((s) => s.openDrawer);
  const q = useQuery({ queryKey: ['code', buildId], queryFn: () => api.get<CodeData>(`/api/builds/${buildId}/code`) });
  const derived = useDerived(buildId);
  const files = useMemo(() => q.data?.files ?? [], [q.data]);
  const [active, setActive] = useState<string | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [panel, setPanel] = useState<Panel>((['problems', 'output', 'serial', 'auton'].includes(sp.get('panel') ?? '') ? sp.get('panel') : 'problems') as Panel);
  const [panelOpen, setPanelOpen] = useState(true);
  const [diags, setDiags] = useState<DiagX[] | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState<'check' | 'compile' | null>(null);
  const [monacoFailed, setMonacoFailed] = useState(false);
  const [monacoReady, setMonacoReady] = useState(false);
  const [jump, setJump] = useState<{ line: number; n: number } | null>(null);
  const [history, setHistory] = useState(false);
  const [regen, setRegen] = useState<null | { version: number; files: { path: string; before: string; after: string }[] }>(null);
  const [newFile, setNewFile] = useState(false);
  const [newPath, setNewPath] = useState('src/');
  const [renaming, setRenaming] = useState<CodeFile | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const timers = useRef<Record<string, any>>({});

  // initial file from ?file= or ?line=, else main.cpp
  useEffect(() => {
    if (!files.length || active) return;
    const want = sp.get('file');
    const f = files.find((x) => x.id === want) ?? files.find((x) => x.path === 'src/main.cpp') ?? files[0];
    setActive(f.id); setTabs([f.id]);
    const line = Number(sp.get('line'));
    if (line) setJump({ line, n: Date.now() });
  }, [files, active, sp]);
  useEffect(() => { if (q.data?.lastCompile && diags === null) { setDiags(q.data.lastCompile.diagnostics.map((d) => ({ ...d, fileId: files.find((f) => f.path === d.file)?.id }))); setEngine(q.data.lastCompile.engine); } }, [q.data, diags, files]);
  // Monaco loads from a CDN; if that's blocked (some school networks), fall back to the built-in editor
  useEffect(() => {
    let live = true;
    loader.init().catch(() => { if (live) setMonacoFailed(true); });
    const t = setTimeout(() => { if (live && !monacoReady) setMonacoFailed(true); }, 9000);
    return () => { live = false; clearTimeout(t); };
  }, [monacoReady]);

  const file = files.find((f) => f.id === active);
  const content = file ? drafts[file.id] ?? file.content : '';
  const projectFiles = useMemo(() => files.map((f) => ({ path: f.path, content: drafts[f.id] ?? f.content })), [files, drafts]);

  const save = useCallback(async (id: string) => {
    const f = files.find((x) => x.id === id);
    const text = drafts[id];
    if (!f || f.generated || text === undefined || text === f.content) return;
    clearTimeout(timers.current[id]);
    setSaving((s) => ({ ...s, [id]: 'saving' }));
    try {
      await api.put(`/api/code/files/${id}`, { content: text });
      qc.setQueryData<CodeData>(['code', buildId], (d) => d && { ...d, files: d.files.map((x) => (x.id === id ? { ...x, content: text, updatedAt: Date.now() } : x)) });
      setDrafts((dr) => { const n = { ...dr }; if (n[id] === text) delete n[id]; return n; });
      setSaving((s) => ({ ...s, [id]: 'saved' }));
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) { setSaving((s) => ({ ...s, [id]: 'error' })); toast.error('Autosave failed', (e as ClientError).message); }
  }, [files, drafts, qc, buildId]);

  const onChange = (v: string) => {
    if (!file || file.generated) return;
    setDrafts((d) => ({ ...d, [file.id]: v }));
    clearTimeout(timers.current[file.id]);
    const id = file.id;
    timers.current[id] = setTimeout(() => saveRef.current(id), 2000);
  };
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(drafts).length) { e.preventDefault(); } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drafts]);

  const openFile = (id: string, line?: number) => {
    setActive(id); setTabs((t) => (t.includes(id) ? t : [...t, id]));
    if (line) setJump({ line, n: Date.now() });
  };
  const closeTab = (id: string) => { save(id); setTabs((t) => { const n = t.filter((x) => x !== id); if (active === id) setActive(n[n.length - 1] ?? null); return n; }); };

  // monaco markers + jump
  useEffect(() => {
    const m = monacoRef.current, ed = editorRef.current;
    if (!m || !ed || !file) return;
    const model = ed.getModel();
    if (!model) return;
    const sev = { error: m.MarkerSeverity.Error, warning: m.MarkerSeverity.Warning, note: m.MarkerSeverity.Info };
    m.editor.setModelMarkers(model, 'vex', (diags ?? []).filter((d) => d.file === file.path).map((d) => ({ startLineNumber: d.line, startColumn: d.col, endLineNumber: d.line, endColumn: d.col + 40, message: d.message, severity: sev[d.severity] })));
  }, [diags, file, monacoReady, content]);
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !jump) return;
    ed.revealLineInCenter(jump.line); ed.setPosition({ lineNumber: jump.line, column: 1 }); ed.focus();
  }, [jump, active, monacoReady]);

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed; monacoRef.current = monaco; setMonacoReady(true); setMonacoFailed(false);
    monaco.editor.defineTheme('fdrhs', { base: 'vs-dark', inherit: true, rules: [{ token: 'comment', foreground: '6A9955' }, { token: 'string', foreground: 'CE9178' }, { token: 'number', foreground: 'B5CEA8' }, { token: 'keyword', foreground: '569CD6' }], colors: { 'editor.background': '#1E1E1E' } });
    monaco.editor.setTheme('fdrhs');
    ed.onDidBlurEditorText(() => { const id = ed.getModel()?.uri.path.slice(1); if (id) saveRef.current(id); });
    if (!providersReady) {
      providersReady = true;
      monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: (model: any, pos: any) => {
          const w = model.getWordUntilPosition(pos);
          const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
          const devs: string[] = (window as any).__vexDevices ?? [];
          return { suggestions: [...devs.map((d) => ({ label: d, kind: monaco.languages.CompletionItemKind.Variable, insertText: d, detail: 'device (robot-config)', range })), ...VEX_SYMBOLS.map((s) => ({ label: s, kind: monaco.languages.CompletionItemKind.Function, insertText: s, detail: 'VEX V5 API', range }))] };
        },
      });
      monaco.languages.registerHoverProvider('cpp', {
        provideHover: (model: any, pos: any) => {
          const w = model.getWordAtPosition(pos);
          if (!w || !VEX_SYMBOLS.includes(w.word)) return null;
          return { contents: [{ value: `**${w.word}** — VEX V5 C++ API` }, { value: `[Open the VEX API reference](https://api.vex.com/v5/home/cpp/index.html)` }] };
        },
      });
    }
  };
  useEffect(() => { (window as any).__vexDevices = q.data?.devices ?? []; }, [q.data?.devices]);

  const flush = async () => { for (const id of Object.keys(drafts)) await save(id); };
  const check = () => {
    setBusy('check');
    const code = projectFiles.filter((f) => /\.(cpp|h|hpp)$/.test(f.path));
    const d = [...code.flatMap(syntaxCheck), ...vexLint(code, q.data?.devices ?? [])].map((x) => ({ ...x, fileId: files.find((f) => f.path === x.file)?.id }));
    setDiags(d); setEngine('Checked (syntax + VEX rules)'); setLog(d.map((x) => `${x.file}:${x.line}:${x.col}: ${x.severity}: ${x.message}`).join('\n') || 'No problems found.');
    setPanel('problems'); setPanelOpen(true); setBusy(null);
    return d;
  };
  const compile = async () => {
    setBusy('compile');
    try {
      await flush();
      const r = await api.post<{ ok: boolean; engine: string; errors: number; warnings: number; diagnostics: DiagX[]; log: string }>(`/api/builds/${buildId}/code/compile`, {});
      setDiags(r.diagnostics); setEngine(r.engine); setLog(r.log);
      if (r.errors) { setPanel('problems'); setPanelOpen(true); toast.error(`${r.errors} error${r.errors > 1 ? 's' : ''}`, r.engine); }
      else toast.ok(r.warnings ? `No errors · ${r.warnings} warning${r.warnings > 1 ? 's' : ''}` : 'No errors', r.engine);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      return r;
    } catch (e) { toast.error('Compile failed', (e as ClientError).message); return null; }
    finally { setBusy(null); }
  };
  const auton = () => { const d = check(); if (d.some((x) => x.severity === 'error')) { toast.error('Fix the errors first', 'Auton Preview needs code that parses.'); return; } setPanel('auton'); setPanelOpen(true); };
  useEffect(() => { if (sp.get('panel') === 'auton') setPanel('auton'); }, [sp]);
  const openRegen = async () => { try { setRegen(await api.get(`/api/builds/${buildId}/code/regenerate`)); } catch (e) { toast.error('Could not preview', (e as ClientError).message); } };
  const applyRegen = async () => { try { await api.post(`/api/builds/${buildId}/code/regenerate`); setRegen(null); qc.invalidateQueries({ queryKey: ['code', buildId] }); toast.ok('robot-config regenerated from the build'); } catch (e) { toast.error('Could not regenerate', (e as ClientError).message); } };
  const askMentor = (kind: 'explain' | 'fix') => {
    if (!file) return;
    const sel = editorRef.current?.getModel()?.getValueInRange(editorRef.current.getSelection()) as string | undefined;
    const errs = (diags ?? []).filter((d) => d.severity === 'error');
    const message = kind === 'explain'
      ? sel?.trim() ? `Explain this part of ${file.path} step by step:\n\n\`\`\`cpp\n${sel.slice(0, 6000)}\n\`\`\`` : `Explain ${file.path} step by step.`
      : `Help me fix these compile errors:\n${errs.slice(0, 15).map((d) => `- ${d.file}:${d.line}: ${d.message}`).join('\n')}`;
    openMentor({ message, buildId, codeContext: { fileId: file.id } });
  };
  const createFile = async () => {
    try { const r = await api.post<{ id: string }>(`/api/builds/${buildId}/code/files`, { path: newPath.trim() }); await qc.invalidateQueries({ queryKey: ['code', buildId] }); setNewFile(false); openFile(r.id); }
    catch (e) { toast.error('Could not create the file', (e as ClientError).message); }
  };
  const renameFile = async () => {
    if (!renaming) return;
    try { await api.patch(`/api/code/files/${renaming.id}`, { path: newPath.trim() }); qc.invalidateQueries({ queryKey: ['code', buildId] }); setRenaming(null); }
    catch (e) { toast.error('Could not rename', (e as ClientError).message); }
  };
  const deleteFile = async (f: CodeFile) => {
    if (!confirm(`Delete ${f.path}? Its history is deleted too.`)) return;
    try { await api.del(`/api/code/files/${f.id}`); closeTab(f.id); qc.invalidateQueries({ queryKey: ['code', buildId] }); }
    catch (e) { toast.error('Could not delete', (e as ClientError).message); }
  };

  const errors = (diags ?? []).filter((d) => d.severity === 'error').length;
  const warnings = (diags ?? []).filter((d) => d.severity === 'warning').length;
  const tree = useMemo(() => {
    const groups: Record<string, CodeFile[]> = {};
    for (const f of files) { const dir = f.path.includes('/') ? f.path.split('/')[0] : ''; (groups[dir] ??= []).push(f); }
    return Object.entries(groups).sort(([a], [b]) => (a === 'src' ? -1 : b === 'src' ? 1 : a.localeCompare(b)));
  }, [files]);

  if (q.isLoading) return <div className="flex h-full min-h-[400px] items-center justify-center bg-code-bg"><Spinner /></div>;
  if (q.isError) return <div className="p-6 text-[13px] text-ink-500">{(q.error as Error).message}</div>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181A1D] text-[#D4D4D4]">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-2 py-1.5">
        {!embedded && <span className="mr-2 truncate px-1 text-[13px] font-semibold text-white">{q.data?.build.name}</span>}
        <Tip label="Rewrite robot-config.* from the current build (shows the diff first)"><button className="btn btn-dark h-8 text-[12px]" onClick={openRegen}><ArrowsClockwise size={14} />Regenerate config</button></Tip>
        <Tip label="Fast check in the browser (syntax + VEX rules)"><button className="btn btn-dark h-8 text-[12px]" onClick={check} disabled={!!busy}><CheckCircle size={14} />Check</button></Tip>
        <Tip label={HONEST}><button className="btn btn-primary h-8 text-[12px]" onClick={compile} disabled={!!busy}>{busy === 'compile' ? <Spinner size={13} /> : <Gear size={14} />}Compile</button></Tip>
        <Tip label="Check, then simulate autonomous on the field"><button className="btn btn-dark h-8 text-[12px]" onClick={auton}><Play size={14} weight="fill" />Auton Preview</button></Tip>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <Tip label="Download project (.zip)"><button aria-label="Download project" className="btn btn-dark h-8 w-8 p-0" onClick={async () => { await flush(); download(`/api/builds/${buildId}/code/zip`); }}><DownloadSimple size={15} /></button></Tip>
        <Tip label="Copy file"><button aria-label="Copy file" className="btn btn-dark h-8 w-8 p-0" onClick={() => { navigator.clipboard.writeText(content).then(() => toast.ok('Copied')); }}><Copy size={15} /></button></Tip>
        <Tip label="History"><button aria-label="History" className="btn btn-dark h-8 w-8 p-0" disabled={!file} onClick={() => setHistory(true)}><ClockCounterClockwise size={15} /></button></Tip>
        <Menu>
          <MenuTrigger asChild><button className="btn btn-dark h-8 text-[12px]"><Sparkle size={14} className="text-[#FF8A80]" />Ask Mentor</button></MenuTrigger>
          <MenuContent width={230}>
            <MenuItem onSelect={() => askMentor('explain')}>Explain the selection / file</MenuItem>
            <MenuItem disabled={!errors} onSelect={() => askMentor('fix')}>Fix the errors ({errors})</MenuItem>
          </MenuContent>
        </Menu>
        <span className="ml-auto flex items-center gap-1.5 px-2 text-[11.5px] text-white/60">
          {diags === null ? <><span className="h-2 w-2 rounded-full bg-white/30" />Not checked yet</> : errors ? <><span className="h-2 w-2 rounded-full bg-[#F14C4C]" />{errors} error{errors > 1 ? 's' : ''}</> : <><span className="h-2 w-2 rounded-full bg-[#1FA84F]" />No errors</>}
          {engine && <span className="hidden text-white/40 md:inline">· {engine}</span>}
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* file tree */}
        <aside className="scroll-thin hidden w-[210px] shrink-0 overflow-y-auto border-r border-white/10 py-2 sm:block" aria-label="Files">
          <div className="flex items-center justify-between px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/40">Project<button aria-label="New file" onClick={() => { setNewPath('src/'); setNewFile(true); }} className="rounded p-0.5 hover:bg-white/10 hover:text-white"><Plus size={13} /></button></div>
          {tree.map(([dir, fs]) => (
            <div key={dir}>
              {dir && <div className="px-3 pt-2 text-[11.5px] text-white/50">{dir}/</div>}
              {fs.map((f) => (
                <div key={f.id} className={`group flex items-center ${active === f.id ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5'}`}>
                  <button onClick={() => openFile(f.id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-5 pr-1 text-left text-[12.5px]">
                    <FileCode size={14} className="shrink-0 text-[#4EC9B0]" /><span className="truncate">{f.path.split('/').pop()}</span>
                    {f.generated && <span className="rounded bg-white/10 px-1 text-[9.5px] font-bold text-white/60">GEN</span>}
                    {drafts[f.id] !== undefined && <span className="h-1.5 w-1.5 rounded-full bg-white/60" aria-label="unsaved" />}
                  </button>
                  {!f.generated && f.path !== 'src/main.cpp' && (
                    <Menu>
                      <MenuTrigger asChild><button aria-label={`${f.path} options`} className="mr-1 rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100"><DotsThreeVertical size={14} /></button></MenuTrigger>
                      <MenuContent width={160}>
                        <MenuItem onSelect={() => { setNewPath(f.path); setRenaming(f); }}>Rename</MenuItem>
                        <MenuSeparator />
                        <MenuItem danger onSelect={() => deleteFile(f)}>Delete</MenuItem>
                      </MenuContent>
                    </Menu>
                  )}
                </div>
              ))}
            </div>
          ))}
        </aside>
        {/* editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="scroll-thin flex shrink-0 overflow-x-auto border-b border-white/10 bg-[#1B1D20]">
            {tabs.map((id) => { const f = files.find((x) => x.id === id); if (!f) return null; return (
              <div key={id} className={`flex items-center gap-1.5 border-r border-white/10 px-3 py-1.5 text-[12px] ${active === id ? 'bg-code-bg text-white' : 'text-white/60 hover:text-white'}`}>
                <button onClick={() => setActive(id)}>{f.path.split('/').pop()}{f.generated && <span className="ml-1 text-[9.5px] text-white/40">GEN</span>}</button>
                <span className="w-3 text-center text-[10px]">{saving[id] === 'saving' ? <CircleNotch size={10} className="animate-spin" /> : drafts[id] !== undefined ? '●' : ''}</span>
                <button aria-label={`Close ${f.path}`} onClick={() => closeTab(id)} className="text-white/40 hover:text-white">×</button>
              </div>
            ); })}
          </div>
          {file?.generated && <div className="shrink-0 bg-[#2B2F35] px-3 py-1 text-[11.5px] text-white/70">Generated from the build — read-only. Change the build, then use <b>Regenerate config</b>.</div>}
          <div className="min-h-0 flex-1">
            {file && (monacoFailed && !monacoReady ? (
              <TextareaEditor value={content} onChange={onChange} readOnly={file.generated} onBlur={() => save(file.id)} jump={jump} />
            ) : (
              <Editor height="100%" path={file.id} defaultLanguage="cpp" language={file.path.endsWith('.md') ? 'markdown' : 'cpp'} value={content} onChange={(v) => onChange(v ?? '')} onMount={onMount} theme="vs-dark"
                loading={<div className="flex h-full items-center justify-center bg-code-bg text-[12px] text-white/50"><Spinner />&nbsp;Loading editor…</div>}
                options={{ readOnly: file.generated, fontFamily: 'var(--font-mono), JetBrains Mono, monospace', fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 2, automaticLayout: true, renderWhitespace: 'none', fixedOverflowWidgets: true }} />
            ))}
          </div>
          {/* bottom panel */}
          <div className={`shrink-0 border-t border-white/10 ${panelOpen ? (panel === 'auton' ? 'h-[min(560px,55%)]' : 'h-[200px]') : 'h-[33px]'} flex flex-col`}>
            <div className="flex items-center border-b border-white/10 text-[11.5px]">
              {([['problems', `Problems${diags ? ` (${errors + warnings})` : ''}`], ['output', 'Output'], ['serial', 'Serial Console'], ['auton', 'Auton Preview']] as [Panel, string][]).map(([k, l]) => (
                <button key={k} onClick={() => { setPanel(k); setPanelOpen(true); }} className={`px-3 py-2 font-semibold uppercase tracking-wide ${panel === k && panelOpen ? 'border-b-2 border-fdr-red text-white' : 'text-white/50 hover:text-white'}`}>{l}</button>
              ))}
              <button className="ml-auto px-3 text-white/50 hover:text-white" onClick={() => setPanelOpen(!panelOpen)} aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'}>{panelOpen ? '▾' : '▴'}</button>
            </div>
            {panelOpen && (
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
                {panel === 'problems' && (
                  diags === null ? <p className="p-3 text-[12px] text-white/50">Not checked yet. {HONEST}</p> : !diags.length ? <p className="flex items-center gap-1.5 p-3 text-[12px] text-[#89D185]"><CheckCircle size={14} />No problems. <span className="text-white/40">{engine}</span></p> : (
                    <ul className="py-1 text-[12px]">
                      {diags.map((d, i) => (
                        <li key={i}><button onClick={() => { const f = files.find((x) => x.path === d.file); if (f) openFile(f.id, d.line); }} className="flex w-full items-start gap-2 px-3 py-1 text-left hover:bg-white/5">
                          {d.severity === 'error' ? <XCircle size={14} className="mt-0.5 shrink-0 text-[#F14C4C]" /> : d.severity === 'warning' ? <Warning size={14} className="mt-0.5 shrink-0 text-[#CCA700]" /> : <Info size={14} className="mt-0.5 shrink-0 text-[#75BEFF]" />}
                          <span className="flex-1">{d.message}</span><span className="shrink-0 text-white/40">{d.file}:{d.line}</span>
                        </button></li>
                      ))}
                    </ul>
                  )
                )}
                {panel === 'output' && <pre className="whitespace-pre-wrap p-3 font-mono text-[11.5px] text-white/80">{log || `No output yet. ${HONEST}`}</pre>}
                {panel === 'serial' && <SerialConsole />}
                {panel === 'auton' && <AutonPreview files={projectFiles} metrics={derived.data?.metrics} buildId={buildId} start={q.data?.build.autonStart ?? null} onJump={(path, line) => { const f = files.find((x) => x.path === path); if (f) openFile(f.id, line); }} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {history && file && <HistoryDrawer file={file} current={content} onClose={() => setHistory(false)} onRestored={() => { setDrafts((d) => { const n = { ...d }; delete n[file.id]; return n; }); qc.invalidateQueries({ queryKey: ['code', buildId] }); }} />}
      <Dialog open={!!regen} onOpenChange={(o) => !o && setRegen(null)} title="Regenerate robot-config" description={regen ? `From build version v${regen.version}. Only the generated files change — your main.cpp is untouched.` : ''} width={820}
        footer={<><button className="btn btn-outline" onClick={() => setRegen(null)}>Cancel</button><button className="btn btn-primary" disabled={regen?.files.every((f) => f.before === f.after)} onClick={applyRegen}>Apply</button></>}>
        {regen?.files.map((f) => <div key={f.path} className="mb-4"><div className="mb-1 font-mono text-[12px] font-semibold text-ink-800">{f.path}{f.before === f.after && <span className="ml-2 font-sans font-normal text-ink-400">no changes</span>}</div>{f.before !== f.after && <DiffView before={f.before} after={f.after} />}</div>)}
      </Dialog>
      <Dialog open={newFile || !!renaming} onOpenChange={(o) => { if (!o) { setNewFile(false); setRenaming(null); } }} title={renaming ? `Rename ${renaming.path}` : 'New file'} description="Use src/name.cpp or include/name.h" width={420}
        footer={<><button className="btn btn-outline" onClick={() => { setNewFile(false); setRenaming(null); }}>Cancel</button><button className="btn btn-primary" onClick={renaming ? renameFile : createFile}>{renaming ? 'Rename' : 'Create'}</button></>}>
        <input autoFocus className="input font-mono" value={newPath} onChange={(e) => setNewPath(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (renaming ? renameFile : createFile)(); }} />
      </Dialog>
    </div>
  );
}

function HistoryDrawer({ file, current, onClose, onRestored }: { file: CodeFile; current: string; onClose: () => void; onRestored: () => void }) {
  const q = useQuery({ queryKey: ['code-versions', file.id], queryFn: () => api.get<{ versions: { id: string; content: string; message: string | null; author: string; createdAt: number }[] }>(`/api/code/files/${file.id}/versions`) });
  const [sel, setSel] = useState<string | null>(null);
  const v = q.data?.versions.find((x) => x.id === sel) ?? q.data?.versions[1] ?? q.data?.versions[0];
  const restore = async () => {
    if (!v) return;
    try { await api.post(`/api/code/files/${file.id}/versions/${v.id}/restore`); onRestored(); onClose(); toast.ok('Restored'); } catch (e) { toast.error('Could not restore', (e as ClientError).message); }
  };
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={`History — ${file.path}`} width={860}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><div className="text-[15px] font-bold text-ink-900">History — <span className="font-mono">{file.path}</span></div><button className="btn btn-outline h-8 text-[12px]" onClick={onClose}>Close</button></div>
      <div className="flex min-h-0 flex-1">
        <ul className="scroll-thin w-[260px] shrink-0 overflow-y-auto border-r border-line">
          {q.data?.versions.map((x) => (
            <li key={x.id}><button onClick={() => setSel(x.id)} className={`w-full px-4 py-2 text-left text-[12.5px] ${v?.id === x.id ? 'bg-[#FFF0F0]' : 'hover:bg-[#F6F7F9]'}`}>
              <div className="font-semibold text-ink-900">{x.author}</div><div className="text-ink-500">{x.message ?? 'saved'} · {timeAgo(x.createdAt)}</div>
            </button></li>
          ))}
        </ul>
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {v ? <>
            <div className="mb-2 flex items-center justify-between text-[12.5px] text-ink-600"><span>Changes from this version to the current file</span>{!file.generated && <button className="btn btn-primary h-8 text-[12px]" onClick={restore}>Restore this version</button>}</div>
            <DiffView before={v.content} after={current} />
          </> : <Spinner />}
        </div>
      </div>
    </Drawer>
  );
}
