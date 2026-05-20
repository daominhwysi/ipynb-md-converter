import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Copy,
  Download,
  Trash2,
  Check,
  ExternalLink,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { marked } from 'marked';
import { convertIpynbToMarkdown } from './utils/ipynbParser';
import type { ParseOptions, NotebookJSON } from './utils/ipynbParser';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  jsonContent: NotebookJSON;
  markdownContent: string;
  cellCount: { code: number; markdown: number; raw: number };
}

function App() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Options state
  const [options, setOptions] = useState<ParseOptions>({
    includeOutputs: true,
    includeExecutionCount: false,
    includeImages: true,
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown' | 'json'>('preview');
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sync dark mode class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [isDarkMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFile = uploadedFiles.find((f) => f.id === activeFileId) || null;

  // Re-compile whenever options change for the active file
  useEffect(() => {
    if (!activeFile) return;
    try {
      const compiled = convertIpynbToMarkdown(activeFile.jsonContent, options);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === activeFile.id ? { ...f, markdownContent: compiled } : f))
      );
    } catch (e) {
      console.error('Re-compile error:', e);
    }
  }, [options, activeFileId]);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.ipynb')) {
      alert(`Invalid format: ${file.name} is not a .ipynb Jupyter Notebook file.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const jsonContent = JSON.parse(text) as NotebookJSON;

        if (!jsonContent.cells || !Array.isArray(jsonContent.cells)) {
          throw new Error('Invalid Jupyter Notebook: missing "cells" list.');
        }

        let code = 0, markdown = 0, raw = 0;
        jsonContent.cells.forEach((c) => {
          if (c.cell_type === 'code') code++;
          else if (c.cell_type === 'markdown') markdown++;
          else raw++;
        });

        const markdownContent = convertIpynbToMarkdown(jsonContent, options);

        const newFile: UploadedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          jsonContent,
          markdownContent,
          cellCount: { code, markdown, raw },
        };

        setUploadedFiles((prev) => [...prev, newFile]);
        setActiveFileId(newFile.id);
      } catch (err: any) {
        alert(`Parsing error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(processFile);
    }
  };

  const handleCopyToClipboard = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (file: UploadedFile) => {
    const blob = new Blob([file.markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.name.replace('.ipynb', '.md'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    uploadedFiles.forEach((file, index) => {
      setTimeout(() => {
        handleDownload(file);
      }, index * 200);
    });
  };

  const handleRemoveFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeFileId === id) {
      const remaining = uploadedFiles.filter((f) => f.id !== id);
      setActiveFileId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const activeMarkdownHtml = activeFile
    ? marked.parse(activeFile.markdownContent, { gfm: true })
    : '';

  const hasFiles = uploadedFiles.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground py-10 md:py-20 px-4 md:px-8 flex flex-col justify-start items-center">
      <div className={`w-full transition-all duration-300 ${
        hasFiles ? 'max-w-[1280px]' : 'max-w-[640px]'
      }`}>
        {!hasFiles ? (
          /* Empty state: standard centered layout */
          <div className="flex flex-col space-y-12 animate-fade-in">
            {/* HEADER SECTION */}
            <header className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-widest text-muted uppercase">
                  Notebook Compiler
                </span>
                <div className="flex items-center space-x-3.5">
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="text-xs text-muted hover:text-accent flex items-center space-x-1.5 transition-colors cursor-pointer select-none"
                    title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    <span>{isDarkMode ? 'Light' : 'Dark'}</span>
                  </button>
                  <span className="text-border text-xs select-none">|</span>
                  <a 
                    href="https://github.com/jupyter/nbformat" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs text-muted hover:text-accent flex items-center space-x-1 transition-colors"
                  >
                    <span>nbformat v4</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <h1 className="text-2xl tracking-tight text-foreground font-medium">
                Jupyter to Markdown
              </h1>
              <p className="text-sm text-muted leading-relaxed font-normal">
                Convert `.ipynb` files to clean, standard markdown directly in your browser. All processing is local — your files never leave your device.
              </p>
            </header>

            {/* DRAG AND DROP ZONE */}
            <section className="flex flex-col space-y-2">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed border-border rounded-md py-10 px-6 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center space-y-3 ${
                  isDragging ? 'bg-surface border-accent' : 'bg-transparent hover:bg-surface'
                }`}
              >
                <UploadCloud className="h-6 w-6 text-muted" />
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium">
                    Choose file or drag here
                  </span>
                  <span className="text-xs text-muted">
                    Supports standard .ipynb files
                  </span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".ipynb"
                  multiple
                  className="hidden"
                />
              </div>
            </section>

            {/* SETTINGS / CONFIGURATION */}
            <section className="flex flex-col space-y-4 pt-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
                Conversion Parameters
              </h3>
              <div className="flex flex-col space-y-3">
                {/* Include Outputs */}
                <label className="flex items-start space-x-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={options.includeOutputs}
                    onChange={(e) => setOptions((prev) => ({ ...prev, includeOutputs: e.target.checked }))}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 mt-0.5 transition-colors group-hover:border-accent ${
                    options.includeOutputs ? 'bg-foreground border-foreground text-background' : 'bg-transparent text-transparent'
                  }`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-normal text-foreground leading-none">
                      Include cell code outputs
                    </span>
                    <span className="text-xs text-muted mt-1 leading-normal">
                      Renders notebook stream outputs (stdout/stderr) directly in codeblocks.
                    </span>
                  </div>
                </label>

                {/* Include Images */}
                <label className={`flex items-start space-x-3 select-none ${options.includeOutputs ? 'cursor-pointer group' : 'opacity-40 cursor-default'}`}>
                  <input
                    type="checkbox"
                    checked={options.includeImages}
                    disabled={!options.includeOutputs}
                    onChange={(e) => setOptions((prev) => ({ ...prev, includeImages: e.target.checked }))}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    options.includeOutputs ? 'group-hover:border-accent' : ''
                  } ${
                    options.includeImages && options.includeOutputs ? 'bg-foreground border-foreground text-background' : 'bg-transparent text-transparent'
                  }`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-normal text-foreground leading-none">
                      Extract generated charts & images
                    </span>
                    <span className="text-xs text-muted mt-1 leading-normal">
                      Decodes base64 plot data (e.g. Matplotlib) into self-contained markdown image tags.
                    </span>
                  </div>
                </label>

                {/* Include Execution Count */}
                <label className="flex items-start space-x-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={options.includeExecutionCount}
                    onChange={(e) => setOptions((prev) => ({ ...prev, includeExecutionCount: e.target.checked }))}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 mt-0.5 transition-colors group-hover:border-accent ${
                    options.includeExecutionCount ? 'bg-foreground border-foreground text-background' : 'bg-transparent text-transparent'
                  }`}>
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-normal text-foreground leading-none">
                      Include cell index details
                    </span>
                    <span className="text-xs text-muted mt-1 leading-normal">
                      Prepends source cells with execution number comments `{"<!-- In[#]: -->"}`.
                    </span>
                  </div>
                </label>
              </div>
            </section>
          </div>
        ) : (
          /* Active files state: 2-column layout on large screens, single column on small screens */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start animate-fade-in">
            
            {/* Sidebar Column: Header, Drag-drop, Parameters, Mounted Files */}
            <aside className="lg:col-span-4 flex flex-col space-y-6 lg:sticky lg:top-8 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              
              {/* Header (More compact) */}
              <header className="flex flex-col space-y-2 border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium tracking-widest text-muted uppercase">
                    Notebook Compiler
                  </span>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="text-xs text-muted hover:text-accent flex items-center space-x-1.5 transition-colors cursor-pointer select-none"
                      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    >
                      {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                      <span>{isDarkMode ? 'Light' : 'Dark'}</span>
                    </button>
                  </div>
                </div>
                <h1 className="text-xl tracking-tight text-foreground font-medium">
                  Jupyter to Markdown
                </h1>
              </header>

              {/* Drag & Drop Zone (More compact) */}
              <section className="flex flex-col space-y-2">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed border-border rounded-md py-6 px-4 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center space-y-2 ${
                    isDragging ? 'bg-surface border-accent' : 'bg-transparent hover:bg-surface'
                  }`}
                >
                  <UploadCloud className="h-5 w-5 text-muted" />
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-xs font-medium">
                      Add another notebook
                    </span>
                    <span className="text-[10px] text-muted">
                      Drag here or click
                    </span>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".ipynb"
                    multiple
                    className="hidden"
                  />
                </div>
              </section>

              {/* Parameters (Compact) */}
              <section className="flex flex-col space-y-3 bg-surface/50 p-4 border border-border rounded-md">
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted">
                  Parameters
                </h3>
                <div className="flex flex-col space-y-3">
                  {/* Include Outputs */}
                  <label className="flex items-start space-x-2.5 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={options.includeOutputs}
                      onChange={(e) => setOptions((prev) => ({ ...prev, includeOutputs: e.target.checked }))}
                      className="sr-only"
                    />
                    <span className={`w-3.5 h-3.5 rounded border border-border flex items-center justify-center shrink-0 mt-0.5 transition-colors group-hover:border-accent ${
                      options.includeOutputs ? 'bg-foreground border-foreground text-background' : 'bg-transparent text-transparent'
                    }`}>
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span className="text-xs text-foreground leading-normal">
                      Include cell code outputs
                    </span>
                  </label>

                  {/* Include Images */}
                  <label className={`flex items-start space-x-2.5 select-none ${options.includeOutputs ? 'cursor-pointer group' : 'opacity-40 cursor-default'}`}>
                    <input
                      type="checkbox"
                      checked={options.includeImages}
                      disabled={!options.includeOutputs}
                      onChange={(e) => setOptions((prev) => ({ ...prev, includeImages: e.target.checked }))}
                      className="sr-only"
                    />
                    <span className={`w-3.5 h-3.5 rounded border border-border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      options.includeOutputs ? 'group-hover:border-accent' : ''
                    } ${
                      options.includeImages && options.includeOutputs ? 'bg-foreground border-foreground text-background' : 'bg-transparent text-transparent'
                    }`}>
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span className="text-xs text-foreground leading-normal">
                      Extract generated charts & images
                    </span>
                  </label>

                  {/* Include Execution Count */}
                  <label className="flex items-start space-x-2.5 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={options.includeExecutionCount}
                      onChange={(e) => setOptions((prev) => ({ ...prev, includeExecutionCount: e.target.checked }))}
                      className="sr-only"
                    />
                    <span className={`w-3.5 h-3.5 rounded border border-border flex items-center justify-center shrink-0 mt-0.5 transition-colors group-hover:border-accent ${
                      options.includeExecutionCount ? 'bg-foreground border-foreground text-background' : 'bg-transparent text-transparent'
                    }`}>
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span className="text-xs text-foreground leading-normal">
                      Include cell index details
                    </span>
                  </label>
                </div>
              </section>

              {/* Files list */}
              <section className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    Mounted Notebooks ({uploadedFiles.length})
                  </h3>
                  {uploadedFiles.length > 1 && (
                    <button
                      onClick={handleDownloadAll}
                      className="text-[10px] text-muted hover:text-foreground flex items-center space-x-1 transition-colors cursor-pointer select-none font-medium"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download All</span>
                    </button>
                  )}
                </div>
                <div className="border border-border rounded-md divide-y divide-border bg-surface max-h-[220px] overflow-y-auto">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setActiveFileId(file.id)}
                      className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                        activeFileId === file.id ? 'bg-background font-medium' : 'hover:bg-background/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate flex-1 mr-2">
                        <FileText className={`h-3.5 w-3.5 shrink-0 ${activeFileId === file.id ? 'text-accent' : 'text-muted'}`} />
                        <span className={`text-xs truncate ${activeFileId === file.id ? 'text-foreground font-medium' : 'text-muted hover:text-foreground transition-colors'}`}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-muted shrink-0">
                        <span>{(file.size / 1024).toFixed(0)} KB</span>
                        <button
                          onClick={(e) => handleRemoveFile(file.id, e)}
                          className="text-muted hover:text-red-500 p-0.5 transition-colors"
                          title="Remove notebook"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            </aside>

            {/* Main Content Column: Converted Workspace */}
            <main className="lg:col-span-8 flex flex-col space-y-4">
              {activeFile ? (
                <>
                  {/* Header with active file details & copy/download */}
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 border-b border-border pb-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-none">{activeFile.name}</span>
                      <ChevronRight className="h-3 w-3 text-muted shrink-0" />
                      <span className="text-xs text-muted shrink-0">
                        Code: {activeFile.cellCount.code} / MD: {activeFile.cellCount.markdown}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleCopyToClipboard}
                        className="flex items-center space-x-1.5 px-3 py-1.5 border border-border rounded text-xs hover:bg-surface text-foreground/80 hover:text-foreground transition-colors cursor-pointer select-none"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-foreground" />
                            <span className="text-foreground font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleDownload(activeFile)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-foreground hover:bg-foreground/90 text-background rounded text-xs transition-colors font-medium cursor-pointer select-none"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download MD</span>
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex space-x-4 border-b border-border pb-1">
                    <button
                      onClick={() => setActiveTab('preview')}
                      className={`text-xs pb-2 transition-all font-medium ${
                        activeTab === 'preview'
                          ? 'text-foreground border-b border-foreground'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setActiveTab('markdown')}
                      className={`text-xs pb-2 transition-all font-medium ${
                        activeTab === 'markdown'
                          ? 'text-foreground border-b border-foreground'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      Raw Markdown
                    </button>
                    <button
                      onClick={() => setActiveTab('json')}
                      className={`text-xs pb-2 transition-all font-medium ${
                        activeTab === 'json'
                          ? 'text-foreground border-b border-foreground'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      Notebook JSON
                    </button>
                  </div>

                  {/* Tab content panel */}
                  <div className="pt-2">
                    
                    {/* Live HTML Preview */}
                    {activeTab === 'preview' && (
                      <div
                        dangerouslySetInnerHTML={{ __html: activeMarkdownHtml }}
                        className="markdown-body select-text overflow-x-auto"
                      />
                    )}

                    {/* Raw Markdown */}
                    {activeTab === 'markdown' && (
                      <textarea
                        readOnly
                        value={activeFile.markdownContent}
                        className="w-full h-[600px] p-4 border border-border rounded-md bg-surface text-xs font-mono resize-none outline-none leading-relaxed overflow-y-auto select-text"
                      />
                    )}

                    {/* Original JSON */}
                    {activeTab === 'json' && (
                      <pre className="w-full h-[600px] p-4 border border-border rounded-md bg-surface text-xs font-mono overflow-auto select-text text-muted">
                        {JSON.stringify(activeFile.jsonContent, null, 2)}
                      </pre>
                    )}

                  </div>
                </>
              ) : (
                <div className="border border-dashed border-border rounded-md p-12 text-center flex flex-col items-center justify-center space-y-2">
                  <span className="text-sm font-medium text-muted">No notebook selected</span>
                  <span className="text-xs text-muted/60">Select one of the mounted notebooks from the sidebar list.</span>
                </div>
              )}
            </main>

          </div>
        )}
      </div>
    </div>
  );
}

export default App;
