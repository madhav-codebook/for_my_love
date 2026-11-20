# Our Little Scrapbook

The current preview covers the animated letter, a soft original piano-style
waltz, and the guided journey: **01 The Letter** &rarr; **02 Things I Adore
About You** (her solo photos) &rarr; **03 A Little Game** (the original Catch
the Hearts game) &rarr; **04 Our Little Story** (couple photos, chronological).
Winning the game reveals the surprise page in the same frame, and its
"Begin the story" button lands on Our Little Story — the memory lane.
Browsers block sound before any interaction, so the music
starts automatically with the first click or key press (the header button
still mutes or restarts it). The legacy standalone pages in `master/` and
`gallery/` are superseded by the new journey.

## Preview locally

From this directory, in PowerShell:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://127.0.0.1:8000/). Use the server rather than
double-clicking `index.html`; the JavaScript modules, embedded SVG document,
and photo manifest need to load from the same HTTP origin.

The HTML is the UI, the CSS controls layout and reveal, and the JS modules
each own a feature: `main.js` switches chapters, `envelope.js` runs the
flap-then-card sequence via `contentDocument`, `music.js` synthesizes the
waltz without a recording download, and `gallery.js` renders the photo data.

## Add photos later (Windows)

Keep the 484 MB originals outside this folder, ideally backed up. Sort them
into folders such as `C:\PrivatePhotos\Couple` and `C:\PrivatePhotos\Solo`.
No photos are uploaded by this tool. With Python 3.11 or newer, install the
local converter once:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\tools\requirements.txt
```

Import a folder at a time:

```powershell
.\.venv\Scripts\python.exe .\tools\prepare_photos.py 'C:\PrivatePhotos\Couple' --category us
.\.venv\Scripts\python.exe .\tools\prepare_photos.py 'C:\PrivatePhotos\Solo' --category her
```

Couple (`us`) photos appear in the Story chapter and solo (`her`) photos in
Things I Adore About You. For HEIC or other unsupported formats, first export
JPEG copies into an input folder.

The converter creates two WebPs per photo in `assets/photos/web` and keeps
[memories.json](./data/memories.json) grouped into two keys — `"her"` (Things
I Adore) and `"us"` (Our Little Story) — with each group re-sorted oldest to
newest on every run. The `date` is filled automatically from camera metadata
(or a date in the filename) when available; otherwise it stays blank for you
to fill in as `YYYY-MM-DD`. Edit `caption` (your note shown under the photo)
and `alt` (a short description read aloud by screen readers) when ready.

**Adding photos**: drop the new originals in a folder and run the import
command above — existing records, captions, and dates are untouched, and each
group stays date-ordered. **Deleting photos**: remove the photo's record from
`data/memories.json`, then run:

```powershell
.\.venv\Scripts\python.exe .\tools\prepare_photos.py --prune
```

This deletes the orphaned WebP files (so they are no longer reachable by
direct URL) and also drops any record whose WebPs are missing. The Story and
Adore chapters sort dated photos first and open the larger copy only when
clicked. Reimporting identical originals does not duplicate records or
overwrite edits. If the manifest is ever lost, re-running the import commands
rebuilds it (captions are lost, dates re-extract automatically).

## Size and privacy

Display versions have a maximum long edge of 1,600 pixels and a 160 KiB
per-file budget. Thumbnails max out at 480 pixels and 32 KiB. Large files
are resized further if needed to fit. That puts 125 photos at **at most
23.5 MiB of generated images** (about 24.6 MB), plus the small site files.
This is a budget, not a measured total for your collection. Thumbnails
lazy-load; display versions are fetched on demand. Generated files omit
camera metadata; review the images themselves for anything sensitive.

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
allows published sites up to 1 GB, so the raw total alone is not the hard
blocker. **Size and access are separate decisions.** Do not push the originals
or publish personal photos to a public Pages site. An unlisted link or a
`noindex` tag does not make the site private. Before deploying, choose HTTPS
hosting with authenticated access covering both the HTML and direct image
URLs; deploy only the needed site files, not originals or local tooling.