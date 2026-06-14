/* ============================================================
   ADMIN.JS – Admin Dashboard for World Cup 2026
   Manages embed URLs for API-loaded match data.
   Features:
     - Shows real match data fetched from API-Football
     - Only editable field: Embed URL for each match
     - Refresh from API button + cache info display
     - Password: milan156
   ============================================================ */

(function() {
    'use strict';

    var ADMIN_PASSWORD = 'milan156';

    if (typeof DataStore === 'undefined') {
        console.error('Admin requires DataStore. Make sure ../../js/data.js is loaded.');
        return;
    }

    // ---- DOM references ----
    const editorGrid = document.getElementById('matchEditorGrid');
    const saveAllBtn = document.getElementById('saveAllBtn');
    const resetBtn   = document.getElementById('resetBtn');
    const toastEl    = document.getElementById('toast');
    const loginOverlay = document.getElementById('loginOverlay');
    const loginBtn     = document.getElementById('loginBtn');
    const passwordInput = document.getElementById('passwordInput');
    const loginError   = document.getElementById('loginError');
    const refreshBtn   = document.getElementById('refreshBtn');
    const cacheInfoEl  = document.getElementById('cacheInfo');

    var toastTimeout = null;
    function showToast(message, isError, duration) {
        if (toastTimeout) clearTimeout(toastTimeout);
        toastEl.textContent = message;
        toastEl.className = 'toast' + (isError ? ' error' : '');
        void toastEl.offsetWidth;
        toastEl.classList.add('show');
        toastTimeout = setTimeout(function() {
            toastEl.classList.remove('show');
        }, duration || 3000);
    }

    var ENTITY_AMP = String.fromCharCode(38) + 'amp;';
    var ENTITY_LT = String.fromCharCode(38) + 'lt;';
    var ENTITY_GT = String.fromCharCode(38) + 'gt;';
    var ENTITY_QUOT = String.fromCharCode(38) + 'quot;';

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, ENTITY_AMP)
            .replace(/</g, ENTITY_LT)
            .replace(/>/g, ENTITY_GT)
            .replace(/"/g, ENTITY_QUOT);
    }

    function getFlagEmoji(flag) {
        if (!flag) return '🏳️';
        if (flag.length <= 2) return flag;
        if (flag.startsWith('http')) return '⚽';
        return flag;
    }

    // ============================================================
    // LOGIN
    // ============================================================
    function attemptLogin() {
        var password = passwordInput.value.trim();
        if (password === ADMIN_PASSWORD) {
            loginOverlay.classList.add('hidden');
            loginError.textContent = '';
            passwordInput.value = '';
            updateCacheInfo();
        } else {
            loginError.textContent = 'Incorrect password.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    loginBtn.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') attemptLogin();
    });
    passwordInput.focus();

    // ============================================================
    // CACHE INFO DISPLAY
    // ============================================================
    function updateCacheInfo() {
        var info = DataStore.getCacheInfo();
        if (cacheInfoEl) {
            if (info.lastUpdated !== 'Never') {
                cacheInfoEl.innerHTML = '<i class="fas fa-database"></i> Last API update: ' + info.lastUpdated +
                    (info.isFresh ? ' <span style="color:#2ea043;">(fresh)</span>' : ' <span style="color:#e43f5a;">(expired)</span>');
            } else {
                cacheInfoEl.innerHTML = '<i class="fas fa-database"></i> No data fetched yet. Click "Refresh from API".';
            }
        }
    }

    // ============================================================
    // RENDER MATCH EDITORS
    // ============================================================
    function renderEditors() {
        var matches = DataStore.getAllMatches();
        var html = '';

        if (matches.length === 0) {
            html = '<div class="no-matches" style="padding:3rem;text-align:center;color:#5a6a8a;">' +
                   '<i class="fas fa-futbol" style="font-size:3rem;opacity:0.4;"></i>' +
                   '<p>No match data available. Click "Refresh from API" to load fixtures.</p></div>';
            editorGrid.innerHTML = html;
            return;
        }

        matches.forEach(function(m) {
            var statusText = m.status === 'live' ? 'LIVE NOW' : (m.status === 'upcoming' ? 'Upcoming' : 'Finished');
            var statusClass = m.status === 'live' ? 'active-badge' : 'inactive-badge';
            var matchNum = m.id.toString().slice(-4); // Shorten API IDs

            html +=
                '<div class="match-editor-card' + (m.status === 'live' ? ' active-match-editor' : '') + '">' +

                    '<div class="match-editor-header">' +
                        '<span class="match-number-badge"><i class="fas fa-futbol"></i> ' +
                            getFlagEmoji(m.team1Flag) + ' ' + m.team1 + ' vs ' + getFlagEmoji(m.team2Flag) + ' ' + m.team2 +
                        '</span>' +
                        '<span class="status-badge ' + statusClass + '">' +
                            (m.status === 'live' ? '<i class="fas fa-play"></i> ' : '') + statusText +
                        '</span>' +
                    '</div>' +

                    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-bottom:0.8rem; padding:0.6rem; background:#1a2238; border-radius:8px;">' +
                        '<div style="font-size:0.8rem; color:#b0b8d1;"><i class="far fa-clock"></i> ' + m.matchTime + '</div>' +
                        '<div style="font-size:0.8rem; color:#b0b8d1;"><i class="fas fa-hashtag"></i> Match ID: ' + m.id + '</div>' +
                    '</div>' +

                    '<div class="admin-form" style="grid-template-columns:1fr;">' +
                        '<div class="form-group full-width">' +
                            '<label for="embed_' + m.id + '">Embed URL (paste your Stream Link)</label>' +
                            '<input type="text" id="embed_' + m.id + '" value="' + escapeHtml(m.embedUrl) + '" placeholder="https://..." style="font-family:monospace;" />' +
                        '</div>' +
                    '</div>' +

                    '<div class="card-actions" style="margin-top:0.5rem;">' +
                        '<button class="btn btn-sm btn-secondary test-embed-btn" data-match-id="' + m.id + '">' +
                            '<i class="fas fa-external-link-alt"></i> Test Link' +
                        '</button>' +
                    '</div>' +

                '</div>';
        });

        editorGrid.innerHTML = html;

        document.querySelectorAll('.test-embed-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var matchId = this.getAttribute('data-match-id');
                var input = document.getElementById('embed_' + matchId);
                if (input && input.value.trim()) {
                    window.open(input.value.trim(), '_blank');
                } else {
                    showToast('Enter an embed URL first.', true);
                }
            });
        });

        updateCacheInfo();
    }

    // ============================================================
    // SAVE EMBED URLS
    // ============================================================
    function collectAndSave() {
        // We need to save overrides using the match IDs from the DOM
        var overrides = [];
        document.querySelectorAll('[id^="embed_"]').forEach(function(input) {
            var matchId = input.id.replace('embed_', '');
            var url = input.value.trim();
            if (url) {
                overrides.push({ id: parseInt(matchId, 10) || matchId, embedUrl: url });
            }
        });

        if (overrides.length === 0) {
            showToast('No embed URLs entered.', true);
            return;
        }

        localStorage.setItem(DataStore.STORAGE_KEY, JSON.stringify(overrides));
        showToast('Saved ' + overrides.length + ' stream links! Viewer auto-updates.');
    }

    // ============================================================
    // REFRESH FROM API
    // ============================================================
    function refreshFromAPI() {
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
        showToast('Fetching latest fixtures from API...', false, 10000);

        DataStore.refreshFromAPI(function(err, data) {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh from API';
            }
            var count = data ? data.length : 0;
            showToast('Updated! ' + count + ' matches loaded.', false, 3000);
            renderEditors();
        });
    }

    // ============================================================
    // RESET
    // ============================================================
    function resetToDefaults() {
        if (!confirm('Reset all embed URLs to defaults?')) return;
        localStorage.removeItem(DataStore.STORAGE_KEY);
        showToast('Reset to default embed URLs.');
        renderEditors();
    }

    // ============================================================
    // INIT
    // ============================================================
    renderEditors();

    saveAllBtn.addEventListener('click', collectAndSave);
    resetBtn.addEventListener('click', resetToDefaults);
    if (refreshBtn) refreshBtn.addEventListener('click', refreshFromAPI);

})();