# doc2pdf.js

Free, private, 100% client-side **DOCX / Markdown / TXT → PDF** converter. Nothing is uploaded — files are parsed and rendered in your browser tab.

Live: https://doc2pdfs.js.org

## Features
- Drag-and-drop `.docx`, `.md`, `.txt`; live, editable preview
- Page size A4 / Letter, portrait / landscape, margins (mm), output filename
- Optional AI assist via Ollama Cloud: *Fix grammar*, *Summarise to top*, *Add table of contents*
- Dark, terminal-flavoured UI; no build step, no backend

**Not supported:** legacy binary `.doc` (Word 97–2003). Re-save as `.docx`.

## Stack (CDN)
[mammoth.js](https://github.com/mwilliamson/mammoth.js) · [marked](https://marked.js.org) · [DOMPurify](https://github.com/cure53/DOMPurify) · [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) (jsPDF + html2canvas)

## Run locally
```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## AI panel & CORS
The key you paste is stored only in your browser's `localStorage` and sent only to the endpoint in the panel.
As of Oct 2026, `https://ollama.com/api/chat` does **not** return CORS headers (preflight `OPTIONS` → 405, no `Access-Control-Allow-Origin`), so browsers block direct calls. The tool shows a clear message in that case. Workarounds:
- Point the *endpoint* field at a small CORS proxy you control (e.g. a Cloudflare Worker forwarding to ollama.com), or
- Use local Ollama: `OLLAMA_ORIGINS=https://doc2pdfs.js.org ollama serve`, endpoint `http://localhost:11434/api/chat`.

## Limitations
- PDF is rasterised (html2canvas) → text is not selectable; large docs make large PDFs.
- mammoth maps semantic structure (headings, lists, tables, images, bold/italic); exact Word layout, fonts, headers/footers, page numbers are not preserved.

## Hosting on js.org
1. Push this folder to a public GitHub repo, enable **Pages** (branch `main`, root). `CNAME` already contains `doc2pdfs.js.org`.
2. Check the site works at `https://<user>.github.io/<repo>/`.
3. Fork [js-org/js.org](https://github.com/js-org/js.org), add to `cnames_active.js` (alphabetical):
   `"doc2pdf": "<user>.github.io/<repo>",`
4. Open a PR; follow the template (the site must have real JS-related content). After merge, enable *Enforce HTTPS* in Pages settings.

## License
MIT
