/* ============================================================
   APP.JS – Main viewer logic for World Cup Live Stream
   Features:
     - Fetches live match data from API-Football (via DataStore)
     - Shows all match times in viewer's LOCAL timezone
     - Auto-detects live / upcoming / finished status badges
     - Auto-refreshes every 30 seconds
     - Fullscreen, mobile nav, real‑time viewer count
   ============================================================ */

(function() {
    'use strict';

    // ---- Wait for DOM and DataStore ----
    if (typeof DataStore === 'undefined') {
        console.error('DataStore not loaded. Make sure data.js is included before app.js');
        return;
    }

    // ---- DOM references ----
    const mainIframe     = document.getElementById('mainIframe');
    const fullscreenBtn  = document.getElementById('fullscreenBtn');
    const videoWrapper   = document.getElementById('videoWrapper');
    const navToggle      = document.getElementById('navToggle');
    const navLinks       = document.getElementById('navLinks');
    const matchesContainer = document.getElementById('matchesContainer');
    const streamMatchLabel = document.getElementById('streamMatchLabel');
    const viewerCountEl    = document.getElementById('viewerCount');
    const heroTitle      = document.getElementById('heroMatchTitle');
    const heroDesc       = document.getElementById('heroMatchDesc');
    const liveDot        = document.querySelector('.live-dot');
    const liveIndicatorText = document.querySelector('.live-indicator');

    // ============================================================
    // 1. RENDER THE MATCH CARDS (with status badges)
    // ============================================================
    function renderMatches() {
        var matches = DataStore.getOrderedMatches();
        var activeMatch = DataStore.getActiveMatch();
        var html = '';

        if (matches.length === 0) {
            html = '<div class="no-matches"><i class="fas fa-futbol"></i><p>No matches in schedule yet.</p></div>';
            matchesContainer.innerHTML = html;
            return;
        }

        // Only show next 5 matches (live + upcoming, or closest finished)
        var displayMatches = matches.slice(0, 6);

        displayMatches.forEach(function(m) {
            var isActive = (activeMatch && m.id === activeMatch.id);
            var statusLabel = '';
            var statusClass = '';

            if (m.status === 'live') {
                statusLabel = '🔴 LIVE';
                statusClass = 'status-live';
            } else if (m.status === 'upcoming') {
                statusLabel = '⏳ Upcoming';
                statusClass = 'status-upcoming';
            } else {
                statusLabel = '✅ Finished';
                statusClass = 'status-finished';
            }

            // Show scores if available
            var scoreDisplay = '';
            if (m.scoreHome !== null && m.scoreAway !== null) {
                scoreDisplay = '<div class="match-score">' + m.scoreHome + ' - ' + m.scoreAway + '</div>';
            }

            html +=
                '<div class="match-card' + (isActive ? ' active-match' : '') + ' ' + statusClass + '" data-match-id="' + m.id + '">' +
                    '<span class="match-number">#' + m.id + '</span>' +
                    '<span class="status-badge-small ' + statusClass + '">' + statusLabel + '</span>' +
                    '<div class="teams">' +
                        '<span>' + getFlagEmoji(m.team1Flag) + ' ' + m.team1 + '</span>' +
                        '<span class="vs">vs</span>' +
                        '<span>' + getFlagEmoji(m.team2Flag) + ' ' + m.team2 + '</span>' +
                    '</div>' +
                    scoreDisplay +
                    '<div class="match-time"><i class="far fa-clock"></i> ' + m.matchTime + '</div>' +
                    (m.status === 'finished'
                        ? '<button class="btn btn-sm btn-disabled" disabled>Finished</button>'
                        : '<button class="btn btn-sm watch-btn" data-embed="' + m.embedUrl + '" data-match-id="' + m.id + '">' +
                            '<i class="fas fa-play"></i> ' + (isActive && m.status === 'live' ? 'Now Playing' : 'Watch') +
                          '</button>'
                    ) +
                '</div>';
        });

        matchesContainer.innerHTML = html;

        // ---- Attach watch button listeners ----
        document.querySelectorAll('.watch-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var embedUrl = this.getAttribute('data-embed');
                var matchId  = this.getAttribute('data-match-id');
                if (embedUrl) {
                    mainIframe.src = embedUrl;
                    DataStore.setActiveMatch(matchId);
                    updateStreamInfo();
                    renderMatches();
                    document.getElementById('video').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // ---- Click on card also triggers watch ----
        document.querySelectorAll('.match-card:not(.status-finished)').forEach(function(card) {
            card.addEventListener('click', function() {
                var btn = this.querySelector('.watch-btn');
                if (btn) btn.click();
            });
        });
    }

    // ---- Convert API flag URL to emoji fallback ----
    function getFlagEmoji(flag) {
        if (!flag) return '🏳️';
        // If it's already an emoji (like 🇧🇷), return as is
        if (flag.length <= 2) return flag;
        // If it's a URL (from API), return a generic flag
        if (flag.startsWith('http')) return '⚽';
        return flag;
    }

    // ============================================================
    // 2. UPDATE STREAM INFO BAR + HERO
    // ============================================================
    function updateStreamInfo() {
        var active = DataStore.getActiveMatch();

        // Stream info bar
        if (active && streamMatchLabel) {
            var statusEmoji = active.status === 'live' ? '🔴' : (active.status === 'upcoming' ? '⏳' : '✅');
            streamMatchLabel.innerHTML = statusEmoji + ' ' + active.team1 + ' vs ' + active.team2;
        } else if (streamMatchLabel) {
            streamMatchLabel.innerHTML = '⚽ No matches scheduled';
        }

        // Hero section
        if (active && heroTitle) {
            heroTitle.textContent = getFlagEmoji(active.team1Flag) + ' ' + active.team1 + ' vs ' + getFlagEmoji(active.team2Flag) + ' ' + active.team2;
        }
        if (active && heroDesc) {
            if (active.status === 'live') {
                heroDesc.innerHTML = active.matchTime + ' — <strong>Live Now!</strong>';
            } else if (active.status === 'upcoming') {
                heroDesc.innerHTML = active.matchTime + ' — Coming up next.';
            } else {
                heroDesc.innerHTML = 'Match finished. Check upcoming matches below.';
            }
        }

        // Live indicator
        if (liveDot && liveIndicatorText) {
            if (active && active.status === 'live') {
                liveDot.style.animation = 'pulse-dot 1.5s ease-in-out infinite';
                liveIndicatorText.innerHTML = '<span class="live-dot"></span> LIVE';
            } else {
                liveDot.style.animation = 'none';
                liveDot.style.opacity = '0.3';
                liveIndicatorText.innerHTML = '<span class="live-dot" style="background:#5a6a8a;animation:none;opacity:0.5;"></span> OFFLINE';
            }
        }
    }

    // ============================================================
    // 3. REAL-TIME VIEWER COUNT SIMULATION
    // ============================================================
    var viewerCount = 1247;
    function simulateViewers() {
        var change = Math.floor(Math.random() * 41) - 20;
        viewerCount = Math.max(500, viewerCount + change);
        if (viewerCountEl) {
            viewerCountEl.textContent = viewerCount.toLocaleString();
        }
    }

    // ============================================================
    // 4. AUTO-REFRESH every 30 seconds
    // ============================================================
    function autoRefresh() {
        renderMatches();
        updateStreamInfo();
    }

    // ============================================================
    // 5. LISTEN FOR NEW MATCH DATA FROM API
    // ============================================================
    document.addEventListener('matchesUpdated', function() {
        renderMatches();
        updateStreamInfo();
    });

    // ============================================================
    // 6. FULLSCREEN BUTTON
    // ============================================================
    fullscreenBtn.addEventListener('click', function() {
        var elem = videoWrapper;
        if (!document.fullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    });

    // ============================================================
    // 7. MOBILE NAVIGATION TOGGLE
    // ============================================================
    navToggle.addEventListener('click', function() {
        navLinks.classList.toggle('open');
        var icon = this.querySelector('i');
        icon.className = navLinks.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
    });

    navLinks.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
            navLinks.classList.remove('open');
            navToggle.querySelector('i').className = 'fas fa-bars';
        });
    });

    // ============================================================
    // 8. INIT
    // ============================================================
    function init() {
        renderMatches();
        updateStreamInfo();
    }

    init();

    // Auto-refresh every 30 seconds
    setInterval(autoRefresh, 30000);

    // Viewer count every 5 seconds
    setInterval(simulateViewers, 5000);
    simulateViewers();

})();