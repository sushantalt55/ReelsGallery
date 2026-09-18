// Settings panel. Opens on the left, over the grid, and stores everything in localStorage
// under the "reels:settings" key. Loaded before main.js, which reads g_settings.

// Prefixed because this app can share localStorage with the image gallery
var SETTINGS_KEY = 'reels:settings'
var VIDEO_LIKE_PREFIX = 'reels:vd:'
// Folder likes (reels:pg:) are from an older version, and are cleared along with the rest
var LIKE_PREFIXES = ['reels:pg:', VIDEO_LIKE_PREFIX]

// Eighteen vivid colours spread right around the hue wheel, plus a silver
var ACCENT_PRESETS = [
    { name: 'Red', color: '#ef4444' },
    { name: 'Coral', color: '#f9603c' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Amber', color: '#f59e0b' },
    { name: 'Yellow', color: '#eab308' },
    { name: 'Lime', color: '#84cc16' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Emerald', color: '#10b981' },
    { name: 'Teal', color: '#14b8a6' },
    { name: 'Cyan', color: '#06b6d4' },
    { name: 'Sky', color: '#0ea5e9' },
    { name: 'Electric blue', color: '#3b82f6' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Violet', color: '#8b5cf6' },
    { name: 'Purple', color: '#a855f7' },
    { name: 'Fuchsia', color: '#d946ef' },
    { name: 'Pink', color: '#ec4899' },
    { name: 'Rose', color: '#f43f5e' },
    { name: 'Silver', color: '#cbd5e1' }
]

var DEFAULT_SETTINGS = {
    accent: '#3b82f6',
    gap: 4,
    imgRadius: 6,
    gridCount: 50,
    infinite: true,
    autoHideNav: true,
    animations: true,
    hoverPreview: true,
    loopVideos: true,
    muteVideos: false,
    // 'bottom', 'side' or 'top' for the app's own seek line, 'browser' for the browser's controls
    playerControls: 'bottom'
}

var g_settings = Object.assign({}, DEFAULT_SETTINGS, readSettings())

function readSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}
    }
    catch (e) {
        return {}
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(g_settings))
}

// Push the settings into the CSS variables and body classes the rest of the app uses
function applySettings() {
    let root = document.documentElement
    root.style.setProperty('--accent', g_settings.accent)
    root.style.setProperty('--accent-hover', lighten(g_settings.accent, 0.3))
    root.style.setProperty('--accent-glow', withAlpha(g_settings.accent, 0.35))
    root.style.setProperty('--gap', g_settings.gap + 'px')
    root.style.setProperty('--img-radius', g_settings.imgRadius + 'px')
    document.body.classList.toggle('no-anim', !g_settings.animations)
    if (!g_settings.autoHideNav) {
        // Cancel a countdown started before the setting was switched off.
        // Read off window because main.js has not run yet on first load.
        clearTimeout(window.g_idleTimer)
        document.body.classList.remove('controls-idle')
    }
}

function setSetting(key, value) {
    g_settings[key] = value
    saveSettings()
    applySettings()
    syncSettingsForm()
    if (key == 'gridCount') buildCurrentBuffer()
    if (key == 'infinite' && value) maybeLoadMore()
    if (key == 'playerControls') applyPlayerControls()
}

function resetSettings() {
    g_settings = Object.assign({}, DEFAULT_SETTINGS)
    saveSettings()
    applySettings()
    syncSettingsForm()
    applyPlayerControls()
    buildCurrentBuffer()
}

function toHexParts(hex) {
    let h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// Mix the colour with white for the hover shade
function lighten(hex, amount) {
    let c = toHexParts(hex).map(v => Math.round(v + (255 - v) * amount))
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

function withAlpha(hex, alpha) {
    let c = toHexParts(hex)
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`
}

function toggleSettings() {
    if (document.querySelector('.settings-panel').classList.contains('hidden')) openSettings()
    else closeSettings()
}

function openSettings() {
    buildAccentSwatches()
    syncSettingsForm()
    document.querySelector('.settings-panel').classList.remove('hidden')
}

function closeSettings() {
    document.querySelector('.settings-panel').classList.add('hidden')
}

function buildAccentSwatches() {
    let holder = document.querySelector('.swatches')
    if (holder.children.length) return;
    ACCENT_PRESETS.forEach(function (preset) {
        let swatch = document.createElement('button')
        swatch.className = 'swatch'
        swatch.title = preset.name
        swatch.dataset.color = preset.color
        swatch.style.background = preset.color
        swatch.addEventListener('click', function () {
            setSetting('accent', preset.color)
        })
        holder.appendChild(swatch)
    })
}

// Show the stored values in the panel
function syncSettingsForm() {
    document.querySelectorAll('.swatch').forEach(function (swatch) {
        swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() == g_settings.accent.toLowerCase())
    })
    document.querySelector('#set-accent').value = g_settings.accent
    document.querySelector('#set-gap').value = g_settings.gap
    document.querySelector('#gap-value').innerText = g_settings.gap + 'px'
    document.querySelector('#set-radius').value = g_settings.imgRadius
    document.querySelector('#radius-value').innerText = g_settings.imgRadius + 'px'
    document.querySelector('#set-count').value = g_settings.gridCount
    document.querySelector('#set-infinite').checked = g_settings.infinite
    document.querySelector('#set-autohide').checked = g_settings.autoHideNav
    document.querySelector('#set-anim').checked = g_settings.animations
    document.querySelector('#set-hover').checked = g_settings.hoverPreview
    document.querySelector('#set-loop').checked = g_settings.loopVideos
    document.querySelector('#set-mute').checked = g_settings.muteVideos
    document.querySelector('#set-controls').value = g_settings.playerControls
    document.querySelector('#likes-summary').innerText = likesSummary()
}

function likesSummary() {
    let keys = Object.keys(localStorage)
    let videos = keys.filter(k => k.startsWith(VIDEO_LIKE_PREFIX)).length
    return `${videos} liked video${videos == 1 ? '' : 's'}`
}

function clearLikes() {
    if (!confirm('Remove every liked video? This cannot be undone.')) return;
    Object.keys(localStorage).forEach(function (key) {
        if (LIKE_PREFIXES.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key)
    })
    let imageLiked = document.querySelector('.image-liked')
    if (imageLiked) setLikeButton(imageLiked, false)
    syncSettingsForm()
}

applySettings()
