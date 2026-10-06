# anamnesis

A Chromium side panel that answers job application questions from your own story bank. Search and the optional rewrite both run in the browser; nothing about you leaves the machine.

You click a text box on an application form. The panel reads the question, shows the closest answers from your Markdown files, and inserts the one you pick. It never submits anything.

## How it works

- **Content script** (`entrypoints/content.ts`) watches focus on text fields in every frame, reads the question (`aria-labelledby`, `label[for]`, wrapping label, `legend`, nearby text) and any length limit (`maxlength`, "500 characters" hints).
- **Story bank** (`lib/stories/`) reads a folder you pick through the File System Access API. `StorySource` is the seam: today it is `folderSource`, and anything that can `list()` and `save()` can replace it.
- **Search** (`lib/search/`) embeds questions and answers with EmbeddingGemma 300M (`onnx-community/embeddinggemma-300m-ONNX`, q8, WASM) in a worker, caches vectors in IndexedDB by content hash, and ranks by cosine. Language variants of the same story are grouped, and the one matching the question's language wins.
- **Adapt** (`lib/llm/`) loads a WebLLM model in a worker only when you ask for it, and asks it to shorten, refocus or translate one source answer under the field's limit. The prompt forbids new facts, and the panel flags any number in the output that is not in the source.

## Story bank format

Pick a folder. Two kinds of files are read; everything else is ignored.

`answer-*.md`: one story per file. The first `#` heading is the question; the rest is the answer.

```markdown
---
lang: en              # optional; also inferred from -ptbr/-en suffixes or the text
group: prod-incident  # optional; files with the same group are language variants
aliases:              # optional; other ways the question is asked
  - Describe a bug you shipped
---
# Tell us about a time your code broke in production. | Describe a production incident

In July 2026 ...
```

`facts*.md`: short exact answers, one per `##` heading. Alternatives go after `|`. See [`examples/facts.md`](examples/facts.md).

"Save to bank" in the editor writes a new `answer-saved-<question>.md` next to the others. It never overwrites a file.

## Setup

```bash
bun install
bun run build
```

Open `chrome://extensions`, enable Developer mode, **Load unpacked**, pick `.output/chrome-mv3`. Click the toolbar icon (or `Alt+Shift+A`) to open the panel, then choose your folder. Chromium asks to re-grant folder access once per session.

First use downloads models into the browser cache: about 300 MB for search (from huggingface.co) and, only if you use Adapt, 1–3 GB for the chosen LLM (huggingface.co and raw.githubusercontent.com).

That happens once per browser profile. The cache lives in the extension's own storage, which `unlimitedStorage` keeps from being evicted. **Reload** in `chrome://extensions` keeps it; **Remove** clears it. Moving `.output/chrome-mv3` also starts over, because an unpacked extension's ID comes from its path.

### WebGPU on Linux

Search does not need a GPU. Adapt does, and Chromium on Linux ships WebGPU behind a flag:

```bash
chromium --enable-unsafe-webgpu --enable-features=Vulkan
```

The flag exposes WebGPU to every site you visit in that browser process, which is why it is off by default on Linux. Either add it to `~/.config/chromium-flags.conf` and accept that, or run a separate profile only for applications:

```bash
chromium --user-data-dir="$HOME/.config/chromium-jobs" --enable-unsafe-webgpu --enable-features=Vulkan
```

On hybrid laptops WebLLM asks for the high-performance adapter. NVIDIA through Vulkan reports no `shader-f16`, so the panel picks `q4f32` builds there.

| Model | VRAM |
| --- | --- |
| Qwen3 4B (default) | ~4.3 GB |
| Qwen3.5 4B | ~4.7 GB |
| Qwen3 1.7B | ~2.6 GB |

## Develop

```bash
bun run test      # vitest: parsing, ranking, prompt guards, field reading and insertion
bun run compile   # tsc
bun run dev       # WXT dev mode with reload
```

## Known limits

- Workday and other sites with custom widgets may hide the question from the generic reader; paste it into the panel instead.
- Rich-text editors get text through `execCommand('insertText')`, with a `textContent` fallback that some editors ignore.
- Small models still make things up. Read every adapted answer before inserting it; the number check catches only one kind of invention.
