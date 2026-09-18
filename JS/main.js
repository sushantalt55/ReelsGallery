// Videos are served from the /reels route, which points at the E:\InstCurrent folder.
// reels_paths.txt in that folder lists every video, one path per line, relative to it.
// g_reelServer holds the full address of that route.
//globals

Array.prototype.random = function () {
    return this[Math.floor((Math.random() * this.length))];
}

var g_jsonIndex = [] // all avilabel paths indexed
var g_currentBuffer = []

var colcount = 4;

// Only files with these extensions are shown
var VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov', 'ogv']

function isVideoFile(name) {
    return VIDEO_EXTENSIONS.includes(name.split('.').pop().toLowerCase())
}

// Location of the video server. Depends on dev or prod environment
var url = window.location.hostname;
// url = 'localhost'
// url = '192.168.29.254'
var port = 80
var g_reelServer = `http://${url}:${port}/reels/`;
var REEL_LIST = 'reels_paths.txt'

// This app can share an origin (and so localStorage) with the image gallery,
// so every key it stores starts with this
var STORE_PREFIX = 'reels:'



// Entry point to the app
appEntry();

function appEntry() {
    document.addEventListener('mousemove', wakeControls)
    // Esc leaves the video view, which has no top bar with a close button
    document.addEventListener('keydown', onPlayerKey)
    document.addEventListener('fullscreenchange', updateFullscreenButton)
    let bar = document.querySelector('.player-bar')
    bar.addEventListener('pointerdown', startSeek)
    bar.addEventListener('pointermove', moveSeek)
    bar.addEventListener('pointerup', endSeek)
    bar.addEventListener('pointercancel', endSeek)
    window.addEventListener('scroll', maybeLoadMore, { passive: true })
    window.addEventListener('resize', maybeLoadMore)
    window.addEventListener('resize', function () {
        if (videoViewOpen()) fitVideoInfo()
    })
    setColumns(colcount)

    // Fetch the text file listing every video
    fetch(g_reelServer + REEL_LIST)
        .then(response => {
            if (!response.ok) throw new Error(`${response.status} for ${g_reelServer + REEL_LIST}`)
            return response.text()
        })
        .then(data => {
            let paths = data.split('\n').map(path => path.trim()).filter(path => path !== '' && isVideoFile(path));
            g_jsonIndex = paths.map(function (path, sl) {
                let t = path.split('/')
                return {
                    'sl': sl,
                    'url': g_reelServer + t.map(encodeURIComponent).join('/'),
                    'file': t.pop(),
                    // The folder path as it is in the list, e.g. S/SPECIAL/FAVS/2025-03
                    'folder': t.join('/')
                }
            })

            // Build current paths form index
            buildCurrentBuffer()
        })
        .catch(error => console.error(error));
}



// "Shuffle" button: pick a new random set for the grid
function render() {
    if (g_jsonIndex.length == 0) return;
    buildCurrentBuffer()
    window.scrollTo({ top: 0 })
}

function buildCurrentBuffer() {
    // clearing current videos while preserving the refrence.
    g_currentBuffer.length = 0
    g_currentBuffer.push(...randomGridItems())
    createLayout()
}

// A batch of random videos for the main grid
function randomGridItems() {
    let batch = []
    if (g_jsonIndex.length == 0) return batch
    for (let i = 0; i < g_settings.gridCount; i++) {
        batch.push(g_jsonIndex.random())
    }
    return batch
}



// ---------- Grid ----------
// Every tile has the same 9:16 shape, so tiles go on the page straight away,
// without waiting for any video to load. Thumbnails fill in as tiles come near
// the screen (see the thumbnail section below).

// Everything belonging to the grid on screen, replaced on every shuffle
var g_grid = null

function createLayout() {
    let row = document.getElementById('imagerow')
    g_loadingMore = false
    document.querySelector('.grid-end').classList.add('hidden')

    if (g_grid) clearGrid(g_grid)
    row.replaceChildren()
    g_grid = {
        thumbUrls: [],
        // Starts a tile's thumbnail when it comes within a screen or so of view,
        // and cancels it if the tile scrolls away before its turn
        observer: new IntersectionObserver(onTilesVisible, { rootMargin: '100% 0px' })
    }
    addTiles(g_currentBuffer)
}

function addTiles(items) {
    let row = document.getElementById('imagerow')
    let fragment = document.createDocumentFragment()
    items.forEach(function (item) {
        let tile = createVideoTile(item)
        fragment.appendChild(tile)
        g_grid.observer.observe(tile)
    })
    row.appendChild(fragment)
}

// Drop a grid that is being replaced: its pending thumbnails and their memory
function clearGrid(grid) {
    grid.observer.disconnect()
    g_thumbQueue.length = 0
    g_thumbJobs.forEach(cancelThumb)
    g_thumbJobs.length = 0
    grid.thumbUrls.forEach(url => URL.revokeObjectURL(url))
}

function createVideoTile(item) {
    let tile = document.createElement('div')
    tile.className = 'video-tile'
    tile.item = item

    let badge = document.createElement('span')
    badge.className = 'video-badge'
    badge.innerHTML = '<i class="fa fa-play"></i><span class="video-duration"></span>'
    tile.appendChild(badge)

    tile.addEventListener('click', function () {
        openVideo(item)
    })
    tile.addEventListener('mouseenter', startHoverPreview)
    tile.addEventListener('mouseleave', stopHoverPreview)
    return tile
}

// The number of columns is only a CSS variable, so changing it needs no rebuild
function setColumns(count) {
    colcount = count
    document.documentElement.style.setProperty('--cols', count)
    maybeLoadMore()
}

function zoomOut() {
    if (colcount < 7) setColumns(colcount + 1)
}

function zoomIn() {
    if (colcount > 1) setColumns(colcount - 1)
}

// Infinite scroll: keep adding batches to the grid as it nears the bottom
var g_loadingMore = false
var MAX_GRID_ITEMS = 1000

function maybeLoadMore() {
    if (!g_settings.infinite || g_jsonIndex.length == 0 || !g_grid) return;
    if (g_currentBuffer.length >= MAX_GRID_ITEMS) {
        document.querySelector('.grid-end').classList.remove('hidden')
        return;
    }
    if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 1200) return;

    let batch = randomGridItems()
    g_currentBuffer.push(...batch)
    addTiles(batch)
}

// ---------- Thumbnails ----------
// A tile's thumbnail is made by loading its video just long enough to copy one
// frame into a small JPEG. The video is then let go, so only MAX_THUMB_LOADS
// videos exist at any moment, however long the grid gets.
// (Copying a frame only works because the page and the videos share an origin.
// If they didn't, the video itself is kept as the thumbnail instead.)

var MAX_THUMB_LOADS = 4
var THUMB_WIDTH = 270
var THUMB_TIMEOUT = 15000
var g_thumbQueue = [] // tiles near the screen, waiting for a turn
var g_thumbJobs = []  // tiles whose video is loading now

function onTilesVisible(entries) {
    entries.forEach(function (entry) {
        let tile = entry.target
        if (tile.thumbDone) return;
        if (entry.isIntersecting) {
            if (!g_thumbQueue.includes(tile) && !g_thumbJobs.includes(tile)) g_thumbQueue.push(tile)
        }
        else {
            // Scrolled away before its turn came
            let i = g_thumbQueue.indexOf(tile)
            if (i >= 0) g_thumbQueue.splice(i, 1)
        }
    })
    pumpThumbs()
}

function pumpThumbs() {
    // The video being watched gets the connection to itself
    if (videoViewOpen()) return;
    while (g_thumbJobs.length < MAX_THUMB_LOADS && g_thumbQueue.length) {
        makeThumb(g_thumbQueue.shift())
    }
}

function makeThumb(tile) {
    g_thumbJobs.push(tile)
    let video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    tile.thumbVideo = video

    let finish = function (ok) {
        // Already finished, or cancelled by a shuffle
        if (tile.thumbVideo !== video) return
        clearTimeout(timer)
        tile.thumbVideo = null
        tile.thumbDone = true
        g_thumbJobs.splice(g_thumbJobs.indexOf(tile), 1)
        g_grid.observer.unobserve(tile)
        if (!ok) tile.classList.add('failed')
        pumpThumbs()
    }
    let timer = setTimeout(function () {
        releaseVideo(video)
        finish(false)
    }, THUMB_TIMEOUT)

    video.addEventListener('loadeddata', function () {
        tile.querySelector('.video-duration').innerText = formatDuration(video.duration)
        let canvas = document.createElement('canvas')
        canvas.width = THUMB_WIDTH
        canvas.height = video.videoWidth ? Math.round(THUMB_WIDTH * video.videoHeight / video.videoWidth) : Math.round(THUMB_WIDTH * 16 / 9)
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        try {
            canvas.toBlob(function (blob) {
                // The grid was shuffled away while the JPEG was being made
                if (tile.thumbVideo !== video) return
                if (!blob) return keepVideoAsThumb(tile, video, finish)
                let thumbUrl = URL.createObjectURL(blob)
                g_grid.thumbUrls.push(thumbUrl)
                let img = document.createElement('img')
                img.className = 'thumb'
                img.src = thumbUrl
                tile.prepend(img)
                releaseVideo(video)
                finish(true)
            }, 'image/jpeg', 0.8)
        }
        catch (e) {
            // A video from another origin can't be copied
            keepVideoAsThumb(tile, video, finish)
        }
    })
    video.addEventListener('error', function () {
        finish(false)
    })
    // Start a little way in, so the thumbnail isn't a black first frame
    video.src = tile.item.url + '#t=0.1'
}

function keepVideoAsThumb(tile, video, finish) {
    video.className = 'thumb'
    tile.prepend(video)
    finish(true)
}

function cancelThumb(tile) {
    if (!tile.thumbVideo) return;
    let video = tile.thumbVideo
    tile.thumbVideo = null
    releaseVideo(video)
}

// Stop a video downloading and free what it holds
function releaseVideo(video) {
    video.removeAttribute('src')
    video.load()
}

function formatDuration(seconds) {
    if (!isFinite(seconds)) return ''
    seconds = Math.round(seconds)
    let h = Math.floor(seconds / 3600)
    let m = Math.floor(seconds / 60) % 60
    let s = String(seconds % 60).padStart(2, '0')
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// A muted preview plays over the thumbnail while the mouse is on a tile.
// The video only exists for as long as the mouse stays.
function startHoverPreview(e) {
    if (!g_settings.hoverPreview) return;
    let tile = e.currentTarget
    let video = document.createElement('video')
    video.className = 'preview'
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.src = tile.item.url
    // Shown once it is actually playing, so the thumbnail doesn't flash away
    video.addEventListener('playing', function () {
        video.classList.add('playing')
    })
    tile.appendChild(video)
    video.play().catch(function () { })
}

function stopHoverPreview(e) {
    let video = e.currentTarget.querySelector('.preview')
    if (!video) return;
    releaseVideo(video)
    video.remove()
}

// ---------- Video view ----------

var g_idleTimer = null

// Show the floating arrow buttons, then fade them out after 2s without mouse movement
function wakeControls() {
    document.body.classList.remove('controls-idle')
    clearTimeout(g_idleTimer)
    if (!g_settings.autoHideNav) return;
    g_idleTimer = setTimeout(function () {
        // Keep them while the pointer rests on one
        if (document.querySelector('.nav-btn:hover, .side-btn:hover')) return wakeControls()
        document.body.classList.add('controls-idle')
    }, 2000)
}

function videoViewOpen() {
    return document.querySelector('#image-view').style.display == 'block'
}

// Videos played in the video view, so the previous button can step back
// through them. g_historyPos is the one showing now. The entry after it is
// picked in advance, so it can start loading before Next is pressed.
var g_history = []
var g_historyPos = -1
var g_preloaded = null // { item, video } for the next video

// Open the video view on this video, from the grid
function openVideo(item) {
    g_history = [item]
    g_historyPos = 0
    // The mouse is on the tile, so its preview would keep playing underneath
    document.querySelectorAll('.video-tile .preview').forEach(function (video) {
        releaseVideo(video)
        video.remove()
    })
    showVideo(item)
}

// Next plays a new random video, or moves forward again after going back
function nextVideo() {
    if (g_historyPos == g_history.length - 1) g_history.push(g_jsonIndex.random())
    g_historyPos++
    showVideo(g_history[g_historyPos])
}

function prevVideo() {
    if (g_historyPos <= 0) return;
    g_historyPos--
    showVideo(g_history[g_historyPos])
}

function showVideo(item) {
    let videoView = document.querySelector('#image-view')
    let opening = !videoViewOpen()
    videoView.style.display = 'block'
    document.body.classList.add('video-open')
    let container = videoView.querySelector('.image-container')
    let old = container.querySelector('video')
    if (old) releaseVideo(old)
    container.replaceChildren();

    let video
    if (g_preloaded && g_preloaded.item === item) {
        video = g_preloaded.video
        g_preloaded = null
    }
    else {
        video = document.createElement('video')
        video.src = item.url
    }
    setUpPlayer(video)
    container.appendChild(video);
    applyPlayerControls()
    playVideo(video)

    showVideoInfo(item)
    videoView.querySelector('.nav-btn.prev').classList.toggle('hidden', g_historyPos == 0)
    setLikeButton(videoView.querySelector('.image-liked'), localStorage.getItem(videoLikeId(item)))
    if (opening) wakeControls()
    preloadNext()
}

function setUpPlayer(video) {
    video.controls = g_settings.playerControls == 'browser'
    video.playsInline = true
    video.loop = g_settings.loopVideos
    video.muted = g_settings.muteVideos

    // Keep the app's own controls in step with the video
    video.addEventListener('play', function () {
        updatePlayButton()
        requestAnimationFrame(tickProgress)
    })
    video.addEventListener('pause', updatePlayButton)
    video.addEventListener('volumechange', updateMuteButton)
    // Its shape is only known once it starts loading
    video.addEventListener('loadedmetadata', fitVideoInfo)
    ;['loadedmetadata', 'durationchange', 'timeupdate', 'progress', 'seeked'].forEach(function (type) {
        video.addEventListener(type, updateProgress)
    })
    // With the app's controls, clicking the video plays or pauses it
    // (the browser's own controls already do this themselves)
    video.addEventListener('click', function () {
        if (!video.controls) togglePlay()
    })
    video.addEventListener('dblclick', function () {
        if (!video.controls) toggleFullscreen()
    })
}

// ---------- Info card ----------

// Reel files are named <date>--<time>--<account>--<id>--<hash>.mp4,
// e.g. 2025-03-01--203502--someaccount--6095557--7df098470a6a.mp4
var REEL_NAME = /^(\d{4})-(\d{2})-(\d{2})--(\d{2})(\d{2})(\d{2})--(.+?)--/

function parseReelName(file) {
    let m = file.match(REEL_NAME)
    if (!m) return {}
    return {
        date: new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]),
        account: m[7]
    }
}

// "1 Mar 2025 · 20:35"
function formatReelDate(date) {
    if (!date || isNaN(date)) return ''
    let day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    let time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return `${day} · ${time}`
}

function showVideoInfo(item) {
    let info = document.querySelector('.video-info')
    let parts = item.folder.split('/')
    let reel = parseReelName(item.file)
    info.querySelector('.info-album').innerText = parts[parts.length - 1] || '/'
    info.querySelector('.info-path').innerText = item.folder
    info.querySelector('.info-date span').innerText = formatReelDate(reel.date)
    info.querySelector('.info-user span').innerText = reel.account || ''
    fitVideoInfo()
}

// Leave the card showing while the controls are hidden, but only when there is
// room for it in the black space beside the video, so it never covers the picture
function fitVideoInfo() {
    let view = document.querySelector('#image-view')
    let video = currentVideo()
    let info = view.querySelector('.video-info')
    let fits = false
    if (video && video.videoWidth) {
        let scale = Math.min(innerWidth / video.videoWidth, innerHeight / video.videoHeight)
        let freeLeft = (innerWidth - video.videoWidth * scale) / 2
        fits = freeLeft >= info.offsetLeft + info.offsetWidth + 8
    }
    view.classList.toggle('info-fits', fits)
}

// ---------- Player controls ----------
// The browser's own controls come with a dark shadow over the bottom of the
// video, so the app has its own instead: a thin seek line with no backdrop,
// plus play, mute and full screen buttons in the column at the top right.
// The playerControls setting picks where the seek line goes, or switches
// back to the browser's controls.

var PLAYER_LAYOUTS = ['bottom', 'side', 'top', 'browser']
var PLAYER_LAYOUT_NAMES = {
    bottom: 'Thin bar at the bottom',
    side: 'Bar down the right side',
    top: 'Thin bar at the top',
    browser: "Browser's own controls"
}

function currentVideo() {
    return document.querySelector('.image-container video')
}

// Show the controls for the chosen layout. Called on opening a video and on changing the setting.
function applyPlayerControls() {
    let mode = g_settings.playerControls
    let view = document.querySelector('#image-view')
    PLAYER_LAYOUTS.forEach(function (layout) {
        view.classList.toggle('controls-' + layout, layout == mode)
    })
    view.querySelector('.layout-btn').title = `Controls: ${PLAYER_LAYOUT_NAMES[mode]}. Click to switch.`
    let video = currentVideo()
    if (video) video.controls = mode == 'browser'
    updatePlayButton()
    updateMuteButton()
    updateProgress()
}

// The button in the video view that tries the next layout
function cycleControls() {
    let next = PLAYER_LAYOUTS[(PLAYER_LAYOUTS.indexOf(g_settings.playerControls) + 1) % PLAYER_LAYOUTS.length]
    setSetting('playerControls', next)
    showPlayerToast(PLAYER_LAYOUT_NAMES[next])
}

var g_toastTimer = null

function showPlayerToast(text) {
    let toast = document.querySelector('.player-toast')
    toast.innerText = text
    toast.classList.add('show')
    clearTimeout(g_toastTimer)
    g_toastTimer = setTimeout(function () {
        toast.classList.remove('show')
    }, 1500)
}

function togglePlay() {
    let video = currentVideo()
    if (!video) return;
    if (video.paused) playVideo(video)
    else video.pause()
}

function toggleMute() {
    let video = currentVideo()
    if (video) video.muted = !video.muted
}

// Full screen covers the whole video view, so the app's controls come along
function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.querySelector('#image-view').requestFullscreen().catch(function () { })
}

function updatePlayButton() {
    let video = currentVideo()
    let playing = video && !video.paused
    document.querySelector('.play-btn .fa').className = playing ? 'fa fa-pause' : 'fa fa-play'
}

function updateMuteButton() {
    let video = currentVideo()
    let muted = video && video.muted
    document.querySelector('.mute-btn .fa').className = muted ? 'fa fa-volume-off' : 'fa fa-volume-up'
}

function updateFullscreenButton() {
    document.querySelector('.fs-btn .fa').className = document.fullscreenElement ? 'fa fa-compress' : 'fa fa-expand'
}

// The seek line reads how far through the video is, and how much has
// downloaded, from two CSS variables. That works for every layout.
function updateProgress() {
    let video = currentVideo()
    let bar = document.querySelector('.player-bar')
    let played = 0, buffered = 0
    if (video && video.duration) {
        played = video.currentTime / video.duration
        if (video.buffered.length) buffered = video.buffered.end(video.buffered.length - 1) / video.duration
    }
    bar.style.setProperty('--played', played)
    bar.style.setProperty('--buffered', buffered)
    document.querySelector('.player-time').innerText = video && video.duration
        ? `${formatDuration(video.currentTime)} / ${formatDuration(video.duration)}`
        : ''
}

// timeupdate only fires a few times a second, so while playing the line is
// moved on every frame to keep it smooth
function tickProgress() {
    let video = currentVideo()
    if (!video || video.paused || !videoViewOpen()) return;
    updateProgress()
    requestAnimationFrame(tickProgress)
}

// Click or drag anywhere along the seek line
var g_seeking = false

function seekTo(e) {
    let video = currentVideo()
    if (!video || !video.duration) return;
    let rect = e.currentTarget.getBoundingClientRect()
    let fraction = g_settings.playerControls == 'side'
        ? (e.clientY - rect.top) / rect.height
        : (e.clientX - rect.left) / rect.width
    video.currentTime = Math.max(0, Math.min(1, fraction)) * video.duration
    updateProgress()
}

function startSeek(e) {
    if (e.button != 0) return;
    g_seeking = true
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add('seeking')
    seekTo(e)
}

function moveSeek(e) {
    if (g_seeking) seekTo(e)
}

function endSeek(e) {
    if (!g_seeking) return;
    g_seeking = false
    e.currentTarget.classList.remove('seeking')
}

// Keys in the video view: Esc closes, Space plays or pauses, the arrows skip
// 5 seconds, M mutes and F goes full screen
function onPlayerKey(e) {
    if (!videoViewOpen()) return;
    if (e.key == 'Escape') {
        // Esc leaves full screen by itself; only close when not in it
        if (!document.fullscreenElement) closeVideoView()
        return;
    }
    let video = currentVideo()
    // The browser's own controls handle keys themselves once the video has focus
    if (!video || document.activeElement === video) return;
    if (e.key == ' ') togglePlay()
    else if (e.key == 'ArrowRight') video.currentTime += 5
    else if (e.key == 'ArrowLeft') video.currentTime -= 5
    else if (e.key == 'm' || e.key == 'M') toggleMute()
    else if (e.key == 'f' || e.key == 'F') toggleFullscreen()
    else return;
    e.preventDefault()
}

// Start loading the video Next will play, so it starts at once
function preloadNext() {
    if (g_historyPos == g_history.length - 1) g_history.push(g_jsonIndex.random())
    let item = g_history[g_historyPos + 1]
    if (g_preloaded && g_preloaded.item === item) return;
    dropPreloaded()
    let video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.src = item.url
    g_preloaded = { item: item, video: video }
}

function dropPreloaded() {
    if (!g_preloaded) return;
    releaseVideo(g_preloaded.video)
    g_preloaded = null
}

function playVideo(video) {
    video.play().catch(function () {
        // The browser refused to autoplay with sound, so try again muted
        if (video.muted || !video.isConnected) return;
        video.muted = true
        video.play().catch(function () { })
    })
}

function closeVideoView() {
    if (document.fullscreenElement) document.exitFullscreen()
    document.querySelector("#image-view").style.display = "none"
    document.body.classList.remove('video-open')
    // Removing the video is what stops it playing
    let container = document.querySelector('.image-container')
    let video = container.querySelector('video')
    if (video) releaseVideo(video)
    container.replaceChildren()
    dropPreloaded()
    // Thumbnails were paused while the video played
    pumpThumbs()
}

function setLikeButton(btn, liked) {
    btn.classList.toggle('liked', !!liked)
    btn.querySelector('.fa').className = liked ? 'fa fa-heart' : 'fa fa-heart-o'
}

// Replay the little heart bounce
function popLikeButton(btn) {
    btn.classList.remove('pop')
    btn.offsetWidth
    btn.classList.add('pop')
}

// Video likes are keyed by folder and file name
function videoLikeId(item) {
    return STORE_PREFIX + "vd:" + item.folder + ":" + item.file
}

function videoLike() {
    let videoId = videoLikeId(g_history[g_historyPos])
    if (localStorage.getItem(videoId)) {
        localStorage.removeItem(videoId)
    }
    else {
        localStorage.setItem(videoId, 1)
    }
    let btn = document.querySelector('.image-liked')
    setLikeButton(btn, localStorage.getItem(videoId))
    popLikeButton(btn)
}
