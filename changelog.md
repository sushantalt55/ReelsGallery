# Changelog

All notable changes to ReelsGallery are logged here, newest first.

Each entry covers one stage of work, under the date it was done, and uses these headings where relevant: **Added**, **Changed**, **Fixed**, **Removed**.

## 2026-09-19: Named ReelsGallery

### Changed
- The app is named **ReelsGallery** in the browser tab title, the top bar and the README.
- The README's nginx setup points at `E:/Code/ReelsGallery/`, ahead of the folder being renamed from `media_gallery`.
- Rewrote `README.md`: features, how the grid stays light, setup (with the optional gzip setting), storage keys, project structure and known limitations.

### Added
- `changelog.md`.

## 2026-09-19: Info card in the video view

### Added
- An info card at the top left of the video view. It shows the album (the video's folder), the full folder path, and the date, time and account, all read from the file name (`<date>--<time>--<account>--<id>--<hash>.mp4`). Rows that can't be read from the name are left out.
- The card stays up while the other controls are hidden, as long as it fits in the empty space beside the video. When it would cover the picture it fades with the rest. This is rechecked when a video loads and when the window is resized.

### Removed
- The small folder label that the card replaces.

## 2026-09-19: Custom player controls

### Added
- The app's own player controls, replacing the browser's controls and the dark shadow they put over the bottom of the video:
  - A thin seek line with no backdrop. It thickens under the mouse and can be clicked or dragged. When the mouse is still it stays, dimmed, as a progress line. It moves smoothly while playing and also shows how much has downloaded.
  - Play/pause, mute and full-screen buttons at the bottom right, and the current time at the bottom left.
- Three layouts for the seek line: along the bottom (default), down the right-hand side, or along the top. The browser's own controls are a fourth choice.
- A **Player controls** setting, and a sliders button in the video view that cycles through the layouts, naming each for a moment.
- Keys in the video view: **Space** play/pause, **← / →** skip 5 seconds, **M** mute, **F** full screen. Clicking the video plays or pauses it, and double-clicking goes full screen.
- Full screen covers the whole video view, so the app's controls stay available in it.

### Changed
- Buttons are split into two stacks: close, like and the layout switch at the top right, and play, mute and full screen at the bottom right. This keeps them clear of the Next arrow on short windows.

### Fixed
- The grid's scrollbar showed behind the video view and took 10px off its right edge. The page no longer scrolls while a video is open, and the grid keeps its scroll position when the video is closed.

## 2026-09-19: Full-window video view

### Changed
- The video view has no top bar. The video fills the whole window, and the controls float over it:
  - The folder name at the top left.
  - Close and like as round buttons at the top right.
- After 2 seconds without mouse movement, the floating controls, the arrows and the mouse pointer fade away.

### Added
- **Esc** closes the video view.

## 2026-09-19: Performance

### Added
- **Thumbnails made in the browser.** Each tile's video loads just long enough to copy one frame into a small JPEG, and is then let go.
  - Before, every tile kept a live video element.
  - At most four videos load at a time, and only for tiles within about a screen of view. Tiles that scroll away before their turn are skipped.
  - Thumbnails pause while a video is being watched.
  - If the videos are on another origin, so a frame can't be copied, the tile keeps its video instead.
- **The next video is preloaded.** It is picked and buffered while the current one plays, so Next starts at once.

### Changed
- **The grid uses equal 9:16 tiles** instead of uneven columns of different heights. Tiles appear straight away instead of waiting for each video to load in order. Changing the column count no longer rebuilds the grid.
- **The hover preview video** only exists while the mouse is on the tile.

### Removed
- The blur behind the top bar and the floating buttons, the tile fade-in, and the brightness change on hover. They are costly to redraw over moving video.

## 2026-09-19: Grid and single video only

### Changed
- The app is just the random grid and a single-video view. Clicking a tile plays that video.
- **Next** plays a random video from the whole collection. **Previous** steps back through the videos watched since opening the view, and Next then moves forward through them again.
- The video view shows the video's folder in place of the old "6 / 1998" position counter.
- The settings panel opens over the grid on the left, now that the sidebar is gone.
- The likes summary and **Clear all likes** cover videos only. Old folder likes are removed along with them.

### Removed
- The sidebar, with its folder tree and search.
- The folder view, with folder likes and previous/next/random folder.
- The random-video button in the video view (Next already plays a random video).
- `CSS/page-view.css`, which only styled the folder view.

## 2026-09-19: New video location and folder tree

### Changed
- Videos are served from `E:\InstCurrent` (131,184 videos in 227 folders) through the existing `/reels/` route.

### Added
- The sidebar shows the folder structure as a tree, however deeply nested:
  - Each folder has an expand/collapse arrow and a count that includes its subfolders.
  - The expanded folders are remembered.
  - Opening a folder from anywhere expands the folders above it and scrolls it into view.
  - Search matches folder names and opens up the folders above each match.
- Opening a folder shows every video in it and its subfolders.

### Fixed
- Opening two folders in quick succession could leave the sidebar scrolled to the first one.

*The folder tree was removed later the same day (see "Grid and single video only").*

## 2026-09-19: Videos only

### Changed
- The app works only with videos from the reels folder. Images from the IDLE collection are no longer loaded.
- The sidebar lists folders exactly as their paths appear in the video list (e.g. `SomeReels/2025-03`), instead of grouping videos by account. Names are no longer capitalised.
- The folder view loads 60 videos at a time as you scroll, because one folder can hold thousands.
- The main grid adds 50 videos per batch by default (choices 25–200), up to 1000.
- Every `localStorage` key starts with `reels:`. The app shares the `localhost` origin with the image gallery, and this stops the two overwriting each other's likes and settings.
- Labels say "folder" and "video" instead of "album" and "image". The app is titled "Reel Gallery".

### Removed
- Image support, image zoom and pan, and the "Main grid shows" setting.

## 2026-09-18: Reels alongside images

### Added
- The app loads two lists in parallel: images from `/content/` (`data-imagepaths.txt`) and reels from a new `/reels/` route (`reels_paths.txt`). If one list fails to load, the other still shows.
- Reels are grouped into one album per account, read from the file name.
- Albums containing videos have a film icon in the sidebar.

## 2026-09-18: Video support

### Added
- Video files (mp4, m4v, webm, mov, ogv) are recognised by extension and shown alongside images.
- Video tiles in the grids show a frame as a thumbnail, a play badge with the video's length, and a muted preview on hover.
- Videos play in the single view with the browser's controls, filling the screen. Zoom is hidden for videos, and closing the view stops playback.
- Video settings: preview on hover, loop and start muted. Also a "Main grid shows" setting: everything, images only or videos only.
- Only four video thumbnails load at a time, so images keep loading alongside them. The grid opened last loads first, and replaced grids cancel their downloads.

## Starting point

A copy of IDLE Gallery (`E:\Code\idle_gallery`, as of commit `6c13136`), a photo gallery with a random grid, album view, image view with zoom, sidebar, likes and a settings panel.
