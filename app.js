(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const preview = $('#preview'), status = $('#status');
  const LS = 'doc2pdf.';
  let loaded = false;

  const setStatus = (msg, err) => { status.textContent = '> ' + msg; status.classList.toggle('err', !!err); };
  const sanitize = (html) => (window.DOMPurify ? DOMPurify.sanitize(html) : html);
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function setDoc(html, name) {
    preview.innerHTML = sanitize(html);
    loaded = true;
    $('#export').disabled = $('#editToggle').disabled = false;
    document.querySelectorAll('[data-ai]').forEach((b) => (b.disabled = false));
    $('#docTitle').textContent = name;
    $('#fname').value = name.replace(/\.[^.]+$/, '') + '.pdf';
  }

  async function handleFile(file) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'doc') throw new Error('Legacy .doc is not supported in-browser. Open it in Word/LibreOffice and save as .docx.');
      setStatus('reading ' + file.name + '…');
      if (ext === 'docx') {
        const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { styleMap: ["p[style-name='Title'] => h1.title:fresh", "p[style-name='Subtitle'] => h2.subtitle:fresh"] });
        setDoc(res.value, file.name);
        setStatus('converted ' + file.name + (res.messages.length ? ` (${res.messages.length} warnings)` : ''));
      } else if (ext === 'md' || ext === 'markdown') {
        setDoc(marked.parse(await file.text()), file.name); setStatus('rendered markdown ✓');
      } else if (ext === 'txt') {
        setDoc('<pre style="font-family:inherit;background:none;padding:0">' + escapeHtml(await file.text()) + '</pre>', file.name); setStatus('loaded text ✓');
      } else throw new Error('Unsupported file type: .' + ext);
    } catch (e) { setStatus(e.message || String(e), true); }
  }

  const drop = $('#drop');
  $('#file').addEventListener('change', (e) => handleFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => { e.preventDefault(); if (!drop.contains(e.target)) handleFile(e.dataTransfer.files[0]); });

  function applyLayout() {
    const m = Math.max(0, +$('#margin').value || 0);
    preview.className = 'paper ' + $('#page').value + ' ' + $('#orient').value;
    preview.style.padding = m + 'mm';
  }
  ['#page', '#orient', '#margin'].forEach((s) => $(s).addEventListener('input', applyLayout));
  applyLayout();

  $('#editToggle').addEventListener('click', () => {
    const on = preview.isContentEditable;
    preview.contentEditable = String(!on);
    $('#editToggle').textContent = on ? '✎ Edit preview' : '✓ Done editing';
  });

  function pdfOptions() {
    let name = $('#fname').value.trim() || 'document.pdf';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    return {
      margin: Math.max(0, +$('#margin').value || 0), filename: name,
      image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: $('#page').value, orientation: $('#orient').value },
      pagebreak: { mode: ['css', 'legacy'] },
    };
  }
  function exportClone() {
    const c = preview.cloneNode(true);
    c.removeAttribute('contenteditable'); c.style.padding = '0'; c.style.boxShadow = 'none'; c.style.width = 'auto';
    return c;
  }
  // exposed for testing / power users
  window.doc2pdf = { toBlob: () => html2pdf().set(pdfOptions()).from(exportClone()).outputPdf('blob') };

  $('#export').addEventListener('click', async () => {
    if (!loaded) return;
    setStatus('rendering PDF…');
    try { await html2pdf().set(pdfOptions()).from(exportClone()).save(); setStatus('saved ' + pdfOptions().filename + ' ✓'); }
    catch (e) { setStatus('PDF export failed: ' + e.message, true); }
  });

  // ---------- AI (Ollama Cloud) ----------
  const keyEl = $('#key'), modelEl = $('#model'), epEl = $('#endpoint'), aiStatus = $('#aiStatus');
  keyEl.value = localStorage.getItem(LS + 'key') || '';
  modelEl.value = localStorage.getItem(LS + 'model') || 'gpt-oss:20b';
  epEl.value = localStorage.getItem(LS + 'endpoint') || 'https://ollama.com/api/chat';
  keyEl.addEventListener('change', () => localStorage.setItem(LS + 'key', keyEl.value.trim()));
  modelEl.addEventListener('change', () => localStorage.setItem(LS + 'model', modelEl.value.trim()));
  epEl.addEventListener('change', () => localStorage.setItem(LS + 'endpoint', epEl.value.trim()));
  $('#forget').addEventListener('click', () => { localStorage.removeItem(LS + 'key'); keyEl.value = ''; aiStatus.textContent = 'key removed.'; });

  const PROMPTS = {
    grammar: 'Fix spelling and grammar in this HTML document. Keep all HTML structure, tags and meaning. Return ONLY the corrected HTML, no commentary, no code fences.',
    summary: 'Write a concise summary (3-6 bullet points) of this HTML document. Return ONLY an HTML fragment: <h2>Summary</h2><ul>...</ul>. No code fences.',
    toc: 'Create a table of contents for this HTML document based on its headings. Return ONLY an HTML fragment: <h2>Contents</h2><ol>...</ol>. No code fences.',
  };
  const stripFences = (s) => s.replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '');

  async function runAI(kind) {
    const key = keyEl.value.trim();
    if (!key) { aiStatus.textContent = 'Paste an Ollama API key first (ollama.com → Settings → Keys).'; return; }
    aiStatus.textContent = 'thinking with ' + modelEl.value + '…';
    let res;
    try {
      res = await fetch(epEl.value.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model: modelEl.value.trim(), stream: false,
          messages: [{ role: 'system', content: PROMPTS[kind] }, { role: 'user', content: preview.innerHTML.slice(0, 60000) }] }),
      });
    } catch (e) {
      aiStatus.innerHTML = '⚠ Request blocked before reaching a response — almost certainly <b>CORS</b>: ollama.com does not send ' +
        '<code>Access-Control-Allow-Origin</code>, so browsers refuse direct calls from web pages. Options: run a tiny proxy ' +
        '(e.g. a Cloudflare Worker) and put its URL in “endpoint”, or use a local Ollama with <code>OLLAMA_ORIGINS=https://doc2pdfs.js.org</code> ' +
        'and endpoint <code>http://localhost:11434/api/chat</code>. Your document was not changed.';
      return;
    }
    if (!res.ok) { aiStatus.textContent = `API error ${res.status}: ${(await res.text()).slice(0, 200)}`; return; }
    const data = await res.json();
    const out = stripFences((data.message && data.message.content) || '');
    if (!out) { aiStatus.textContent = 'Empty response from model.'; return; }
    if (kind === 'grammar') preview.innerHTML = sanitize(out);
    else preview.insertAdjacentHTML('afterbegin', '<div class="ai-block">' + sanitize(out) + '</div>');
    aiStatus.textContent = 'done ✓ (review before exporting)';
  }
  document.querySelectorAll('[data-ai]').forEach((b) => b.addEventListener('click', () => runAI(b.dataset.ai)));
})();
