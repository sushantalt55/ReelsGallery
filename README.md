# ReelsGallery

A small video gallery for browsing a large local collection of reels (mp4), built with plain HTML, CSS and JavaScript. There is no framework and no build step. The videos, and the app itself, are served by nginx, which is not part of this project.

It started as a copy of IDLE Gallery, the image gallery in `E:\Code\idle_gallery`, and was turned into a video-only app. See [changelog.md](changelog.md) for the full history.

## Features

### Random grid

- The home page shows random videos from the whole collection as equal 9:16 tiles, with each video's length in the corner. Videos of other shapes are cropped to fit the tile.
- Hovering a tile plays a muted preview.
- More videos load as you scroll, up to 1000, after which a note suggests shuffling.
- The −/+ buttons change the number of columns (1–7), and **Shuffle** starts again with a fresh set.
- Clicking a tile opens that video.

### Video view

- The video fills the whole window. There is no top bar; the controls float over the video.
- **Info card (top left):**
  - The album, which is the video's folder.
  - The full folder path, e.g. `S/SPECIAL/FAVS/2025-03`.
  - The date and time, and the account, read from the file name. Reel files are named `<date>--<time>--<account>--<id>--<hash>.mp4`.
- **Buttons (top right):** close (also **Esc**), like, and a sliders button that switches the controls layout.
- **Next** plays another random video from the whole collection. It is picked and buffered while the current one plays, so it starts at once.
- **Previous** steps back through the videos watched since opening the view. Next then moves forward through them again before picking new ones.
- **When the mouse is still for 2 seconds,** the buttons, the arrows, the time and the pointer fade away. The info card stays when there is room for it beside the video, and fades too when it would cover the picture.

### Player controls

The browser's built-in controls put a dark shadow over the bottom of the video whenever the mouse moves, so the app has its own:

- **Seek line:** a thin line with no backdrop. It thickens under the mouse, and you can click or drag anywhere on it. While the mouse is still it stays, dimmed, as a progress line.
- **Buttons (bottom right):** play/pause, mute and full screen, plus the current time at the bottom left.
- **Layouts:** the line can run along the bottom (the default), down the right-hand side or along the top. The browser's own controls are the fourth choice. Pick one in the settings, or cycle through them with the sliders button in the video view.
- **Keys:** **Space** play/pause, **← / →** skip 5 seconds, **M** mute, **F** full screen, **Esc** close.
- **Mouse:** clicking the video plays or pauses it, and double-clicking goes full screen. Full screen covers the whole video view, so the app's controls stay available.

### Settings

The ⚙ button in the top bar opens the settings panel. Everything is saved in `localStorage` and applied on the next visit.

| Setting | What it does |
|---|---|
| Accent colour | Nineteen presets and a custom colour picker. |
| Gap | Spacing between the grid tiles, 0–16px. |
| Corner radius | How rounded the tiles are, 0–20px. |
| Videos per batch | How many random videos the grid adds at a time: 25, 50, 100 or 200. |
| Preview on hover | Whether hovering a tile plays a preview. |
| Loop | Whether a video starts again when it ends. |
| Start muted | Whether videos open muted. |
| Player controls | Seek line at the bottom, on the right or at the top, or the browser's own controls. |
| Infinite scroll | Whether the grid keeps loading as you scroll. Off means one batch per shuffle. |
| Hide arrows when idle | Whether the controls fade out when the mouse is still. |
| Animations | Turns transitions and animations off. |
| Clear all likes | Removes every liked video, after a confirmation. |
| Reset to defaults | Puts every setting back to its starting value. |

## How the grid stays light

- **Thumbnails are made in the browser.** When a tile comes within a screen of view, its video loads just long enough to copy one frame into a small JPEG, and is then let go.
  - At most four videos load at a time, so the grid never holds hundreds of live videos.
  - Tiles that scroll away before their turn are skipped.
  - This needs the page and the videos on the same origin, as they are when nginx serves both at `localhost`. Otherwise the tiles keep their videos as thumbnails, which is much heavier.
- **Nothing waits.** Every tile has the same shape, so tiles appear straight away and the thumbnails fill in.
- **Watching comes first.** Thumbnails pause while the video view is open.
- **The hover preview only exists while the mouse is on the tile.**
- **No blur effects.** Blur is expensive to redraw over moving video.

A server-side index with ready-made thumbnails and each video's size is planned. It would replace the in-browser thumbnails, so tiles could show a plain image straight away.

## Setup

1. **The video list:** `reels_paths.txt` in `E:\InstCurrent` lists every video, one path per line, relative to that folder, with forward slashes (e.g. `S/SPECIAL/FAVS/2025-03/<file>.mp4`). `list_reels.py` in that folder regenerates it. Rerun it after adding or moving videos, because the app only knows about what the list contains.
2. **nginx:** add these to the `server { listen 80; }` block of `nginx.conf`, then reload nginx. Both aliases need their trailing slash.

   ```nginx
   location /reels/ {
       alias E:/InstCurrent/;
       add_header Access-Control-Allow-Origin * always;
   }

   location /media/ {
       alias E:/Code/ReelsGallery/;
   }
   ```

   Optionally, compress the list, which is about 11 MB, by adding this to the `http { }` block:

   ```nginx
   gzip on;
   gzip_types text/plain application/json;
   ```

3. **Open the app** at `http://localhost/media/`.

To point at a different host, port or list file, edit `url`, `port` and `REEL_LIST` near the top of [JS/main.js](JS/main.js).

## Storage

Likes and settings are saved in the browser's `localStorage`. They live only in that browser and are not synced anywhere.

This app shares the `localhost` origin with the image gallery at `/gallery/`, so all its keys start with `reels:` to keep the two apart:

| Key | Meaning |
|---|---|
| `reels:settings` | Settings panel preferences (JSON) |
| `reels:vd:<folder>:<file>` | Liked video |

Earlier versions also stored `reels:sidebarHidden`, `reels:expanded` and `reels:pg:<folder>` (liked folders). These are no longer used. **Clear all likes** removes the old folder likes too.

## Project structure

| Path | Role |
|---|---|
| [index.html](index.html) | The app page: top bar, settings panel, grid and video view |
| [JS/main.js](JS/main.js) | Loading the list, the grid and its thumbnails, the video view, player controls, likes |
| [JS/settings.js](JS/settings.js) | Settings panel: stored preferences, accent colours, clearing likes |
| [CSS/style.css](CSS/style.css) | Colour variables, top bar, buttons and the grid |
| [CSS/modal.css](CSS/modal.css) | The video view's round floating buttons |
| [CSS/image-view.css](CSS/image-view.css) | The video view: layout, info card, seek line layouts, idle fading |
| [CSS/settings.css](CSS/settings.css) | Settings panel |

The page loads the Inter font from Google Fonts and icons from Font Awesome 4.7 (cdnjs), so it needs internet access for those. Without it, the app falls back to the system font and the icons are missing.

## Known limitations

- Videos that aren't 9:16 are cropped in their grid tiles. They play uncropped in the video view.
- Videos play only if the browser supports their format. Most mp4s (H.264) are fine; HEVC/H.265 may not play in some browsers.
- Videos whose index is stored at the end of the file take longer to show a first frame. Remuxing with `ffmpeg -movflags +faststart` fixes that without re-encoding.
