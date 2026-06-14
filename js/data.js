/* ============================================================
   DATA.JS – Live match data from World Cup API
   Features:
     - Fetches real World Cup 2026 fixtures from api.worldcupapi.com
     - Uses Netlify function when deployed, direct API when possible
     - Auto-detects live/upcoming/finished based on viewer's clock
     - Shows all times in viewer's LOCAL timezone
     - Caches results in localStorage (12 hours)
     - Falls back to pre-programmed schedule silently
   ============================================================ */

const DataStore = (function() {
    'use strict';

    // World Cup API
    var API_KEY = 'BPvmwmkL89duI3tP';
    var API_HOST = 'api.worldcupapi.com';

    // Storage
    var CACHE_KEY = 'worldcup_cache';
    var OVERRIDE_KEY = 'worldcup_overrides';
    var CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours

    var MATCH_DURATION_HOURS = 3;

    // ============================================================
    // API ENDPOINTS
    // ============================================================
    var NETLIFY_FN_URL = '/.netlify/functions/fetch-fixtures';
    var DIRECT_API_URL = 'https://' + API_HOST + '/fixtures?key=' + API_KEY;

    // CORS proxies (fallback when Netlify function unavailable)
    var CORS_PROXIES = [
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url='
    ];

    var IS_NETLIFY = (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== '' && window.location.protocol !== 'file:');

    // ============================================================
    // FALLBACK SCHEDULE (8 pre-programmed World Cup matches)
    // ============================================================
    var FALLBACK_FIXTURES = [
        { id: 1001, team1: 'Brazil', team2: 'Argentina', team1Flag: '🇧🇷', team2Flag: '🇦🇷', date: '2026-06-14T18:00:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' },
        { id: 1002, team1: 'France', team2: 'Germany', team1Flag: '🇫🇷', team2Flag: '🇩🇪', date: '2026-06-15T20:00:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' },
        { id: 1003, team1: 'England', team2: 'Portugal', team1Flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', team2Flag: '🇵🇹', date: '2026-06-16T21:00:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' },
        { id: 1004, team1: 'Netherlands', team2: 'Spain', team1Flag: '🇳🇱', team2Flag: '🇪🇸', date: '2026-06-17T19:00:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' },
        { id: 1005, team1: 'Italy', team2: 'Croatia', team1Flag: '🇮🇹', team2Flag: '🇭🇷', date: '2026-06-18T18:30:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' },
        { id: 1006, team1: 'Belgium', team2: 'Morocco', team1Flag: '🇧🇪', team2Flag: '🇲🇦', date: '2026-06-19T17:00:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' },
        { id: 1007, team1: 'Uruguay', team2: 'South Korea', team1Flag: '🇺🇾', team2Flag: '🇰🇷', date: '2026-06-20T15:00:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' },
        { id: 1008, team1: 'Japan', team2: 'Senegal', team1Flag: '🇯🇵', team2Flag: '🇸🇳', date: '2026-06-21T18:00:00', embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa' }
    ];

    var COUNTRY_FLAGS = {
        'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
        'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Spain': '🇪🇸',
        'Italy': '🇮🇹', 'Croatia': '🇭🇷', 'Belgium': '🇧🇪', 'Morocco': '🇲🇦',
        'Uruguay': '🇺🇾', 'South Korea': '🇰🇷', 'Japan': '🇯🇵', 'Senegal': '🇸🇳',
        'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦', 'Ecuador': '🇪🇨',
        'Qatar': '🇶🇦', 'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷', 'Tunisia': '🇹🇳',
        'Australia': '🇦🇺', 'Denmark': '🇩🇰', 'Switzerland': '🇨🇭', 'Cameroon': '🇨🇲',
        'Serbia': '🇷🇸', 'Poland': '🇵🇱', 'Senegal': '🇸🇳', 'Ghana': '🇬🇭',
        'South Korea': '🇰🇷', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Uruguay': '🇺🇾'
    };

    // ============================================================
    // STORAGE HELPERS
    // ============================================================
    function loadCache() {
        var raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            try {
                var data = JSON.parse(raw);
                if (data && data.timestamp && (Date.now() - data.timestamp < CACHE_DURATION)) {
                    return data.fixtures;
                }
            } catch(e) {}
        }
        return null;
    }

    function saveCache(fixtures) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            fixtures: fixtures
        }));
    }

    function loadOverrides() {
        var raw = localStorage.getItem(OVERRIDE_KEY);
        if (raw) {
            try { return JSON.parse(raw); } catch(e) {}
        }
        return null;
    }

    // ============================================================
    // API FETCHING
    // ============================================================
    function fetchFromAPI() {
        return new Promise(function(resolve, reject) {
            var attempts = [];

            // On Netlify: use serverless function (bypasses CORS)
            if (IS_NETLIFY) {
                attempts.push({ url: NETLIFY_FN_URL, headers: {} });
            }

            // Direct API call (works if API allows CORS)
            attempts.push({ url: DIRECT_API_URL, headers: {} });

            // CORS proxy fallbacks
            CORS_PROXIES.forEach(function(proxy) {
                attempts.push({
                    url: proxy + encodeURIComponent(DIRECT_API_URL),
                    headers: {}
                });
            });

            var tryNext = function(index) {
                if (index >= attempts.length) {
                    reject(new Error('All fetch methods failed'));
                    return;
                }

                var attempt = attempts[index];
                console.log('Trying fetch method ' + (index + 1) + ': ' + attempt.url.substring(0, 80) + '...');

                fetch(attempt.url, { method: 'GET', headers: attempt.headers })
                    .then(function(r) {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.json();
                    })
                    .then(function(data) {
                        var fixtures = extractFixtures(data);
                        if (fixtures && fixtures.length > 0) {
                            console.log('Success! Got ' + fixtures.length + ' fixtures');
                            resolve(fixtures);
                        } else {
                            console.warn('Method returned empty, trying next...');
                            tryNext(index + 1);
                        }
                    })
                    .catch(function(err) {
                        console.warn('Method failed: ' + err.message);
                        tryNext(index + 1);
                    });
            };

            tryNext(0);
        });
    }

    // Extract fixtures from various API response formats
    function extractFixtures(data) {
        if (!data) return [];

        // Direct array
        if (Array.isArray(data)) return data;

        // Nested in data property
        if (data.data && Array.isArray(data.data)) return data.data;
        if (data.fixtures && Array.isArray(data.fixtures)) return data.fixtures;
        if (data.response && Array.isArray(data.response)) return data.response;
        if (data.matches && Array.isArray(data.matches)) return data.matches;

        // Try to find an array in any top-level property
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
            if (Array.isArray(data[keys[i]])) return data[keys[i]];
        }

        return [];
    }

    // ============================================================
    // PARSE FIXTURES (handles multiple API formats)
    // ============================================================
    function parseFixture(fixture) {
        // Format 1: World Cup API format (api.worldcupapi.com)
        // { homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Argentina' }, matchDate: '...' }
        // Format 2: API-Football format
        // { teams: { home: { name: 'Brazil' } }, fixture: { date: '...' } }
        // Format 3: Simple fallback format
        // { team1: 'Brazil', team2: 'Argentina', date: '...' }

        var homeTeam, awayTeam, homeFlag, awayFlag, matchDate, scoreHome, scoreAway, id;

        if (fixture.homeTeam && fixture.homeTeam.name) {
            // World Cup API format
            homeTeam = fixture.homeTeam.name;
            awayTeam = fixture.awayTeam.name;
            homeFlag = fixture.homeTeam.logo || COUNTRY_FLAGS[homeTeam] || '🏳️';
            awayFlag = fixture.awayTeam.logo || COUNTRY_FLAGS[awayTeam] || '🏳️';
            matchDate = new Date(fixture.matchDate || fixture.date || fixture.start_time || '');
            scoreHome = fixture.score ? fixture.score.home : null;
            scoreAway = fixture.score ? fixture.score.away : null;
            id = fixture.id || fixture.match_id || fixture.matchId || Date.now();
        } else if (fixture.teams && fixture.teams.home) {
            // API-Football format
            homeTeam = fixture.teams.home.name;
            awayTeam = fixture.teams.away.name;
            homeFlag = fixture.teams.home.logo || COUNTRY_FLAGS[homeTeam] || '🏳️';
            awayFlag = fixture.teams.away.logo || COUNTRY_FLAGS[awayTeam] || '🏳️';
            matchDate = new Date(fixture.fixture ? fixture.fixture.date : fixture.date || '');
            scoreHome = fixture.goals ? fixture.goals.home : null;
            scoreAway = fixture.goals ? fixture.goals.away : null;
            id = fixture.id || (fixture.fixture ? fixture.fixture.id : Date.now());
        } else {
            // Simple/fallback format
            homeTeam = fixture.team1 || fixture.home || fixture.home_team || 'TBD';
            awayTeam = fixture.team2 || fixture.away || fixture.away_team || 'TBD';
            homeFlag = fixture.team1Flag || COUNTRY_FLAGS[homeTeam] || '🏳️';
            awayFlag = fixture.team2Flag || COUNTRY_FLAGS[awayTeam] || '🏳️';
            matchDate = new Date(fixture.date || fixture.matchDate || fixture.start_time || '');
            scoreHome = fixture.scoreHome !== undefined ? fixture.scoreHome : (fixture.score ? fixture.score.home : null);
            scoreAway = fixture.scoreAway !== undefined ? fixture.scoreAway : (fixture.score ? fixture.score.away : null);
            id = fixture.id || Date.now();
        }

        return {
            id: id,
            team1: homeTeam,
            team2: awayTeam,
            team1Flag: homeFlag,
            team2Flag: awayFlag,
            startDate: matchDate,
            endDate: new Date(matchDate.getTime() + MATCH_DURATION_HOURS * 60 * 60 * 1000),
            scoreHome: scoreHome,
            scoreAway: scoreAway,
            embedUrl: 'https://junkieembeds.pages.dev/embed/fox-usa'
        };
    }

    // ============================================================
    // STATUS & TIME FORMATTING
    // ============================================================
    function getStatus(match, now) {
        var start = match.startDate;
        var end = match.endDate;
        if (!start || isNaN(start.getTime())) return 'upcoming';
        if (now >= start && now <= end) return 'live';
        if (now < start) return 'upcoming';
        return 'finished';
    }

    function formatLocalTime(date) {
        if (!date || isNaN(date.getTime())) return 'Date TBD';
        var now = new Date();
        var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        var dayName = days[date.getDay()];
        var month = months[date.getMonth()];
        var day = date.getDate();
        var hours = date.getHours();
        var minutes = date.getMinutes().toString().padStart(2, '0');
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;

        var tz = '';
        try { tz = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || ''; } catch(e) {}

        if (date.toDateString() === now.toDateString()) return 'Today, ' + hours + ':' + minutes + ' ' + ampm + ' ' + tz;
        var tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow, ' + hours + ':' + minutes + ' ' + ampm + ' ' + tz;
        return dayName + ', ' + month + ' ' + day + ' • ' + hours + ':' + minutes + ' ' + ampm + ' ' + tz;
    }

    // ============================================================
    // BUILD SCHEDULE
    // ============================================================
    function buildSchedule(fixturesData, overrides) {
        var now = new Date();

        return fixturesData.map(function(f) {
            var matchDate = f.startDate instanceof Date ? f.startDate : new Date(f.date || f.startDate || f.matchDate || '');
            var matchEnd = new Date(matchDate.getTime() + MATCH_DURATION_HOURS * 60 * 60 * 1000);

            var embedUrl = f.embedUrl;
            if (overrides) {
                var found = overrides.find(function(o) { return o.id === f.id; });
                if (found && found.embedUrl) embedUrl = found.embedUrl;
            }

            return {
                id: f.id,
                team1: f.team1,
                team2: f.team2,
                team1Flag: f.team1Flag,
                team2Flag: f.team2Flag,
                startDate: matchDate,
                endDate: matchEnd,
                matchTime: formatLocalTime(matchDate),
                embedUrl: embedUrl,
                status: getStatus({ startDate: matchDate, endDate: matchEnd }, now),
                scoreHome: f.scoreHome !== undefined ? f.scoreHome : null,
                scoreAway: f.scoreAway !== undefined ? f.scoreAway : null
            };
        });
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    function getAllMatches() {
        var cached = loadCache();
        var overrides = loadOverrides();
        if (cached && cached.length > 0) return buildSchedule(cached, overrides);
        saveCache(FALLBACK_FIXTURES);
        return buildSchedule(FALLBACK_FIXTURES, overrides);
    }

    function getActiveMatch() {
        var matches = getAllMatches();
        var live = matches.find(function(m) { return m.status === 'live'; });
        if (live) return live;
        var upcoming = matches.find(function(m) { return m.status === 'upcoming'; });
        if (upcoming) return upcoming;
        return matches[matches.length - 1] || null;
    }

    function getOrderedMatches() {
        var matches = getAllMatches();
        return matches.sort(function(a, b) {
            var order = { live: 0, upcoming: 1, finished: 2 };
            return order[a.status] - order[b.status] || a.startDate - b.startDate;
        });
    }

    function setActiveMatch(matchId) { return true; }

    function updateMatch(matchId, newData) {
        var overrides = loadOverrides() || [];
        var existing = overrides.find(function(o) { return o.id === matchId; });
        if (existing) {
            if (newData.embedUrl) existing.embedUrl = newData.embedUrl;
        } else {
            overrides.push({ id: matchId, embedUrl: newData.embedUrl });
        }
        localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
        return true;
    }

    function resetToDefaults() {
        localStorage.removeItem(OVERRIDE_KEY);
    }

    // ---- Refresh from API ----
    function refreshFromAPI(callback) {
        fetchFromAPI()
            .then(function(fixtures) {
                var parsed = fixtures.map(parseFixture);
                saveCache(parsed);
                try { document.dispatchEvent(new CustomEvent('matchesUpdated')); } catch(e) {}
                callback(null, { source: 'api', count: parsed.length, data: parsed });
            })
            .catch(function(err) {
                console.warn('All API methods failed:', err.message);
                saveCache(FALLBACK_FIXTURES);
                callback(null, { source: 'fallback', count: FALLBACK_FIXTURES.length, data: FALLBACK_FIXTURES, reason: err.message });
            });
    }

    function getCacheInfo() {
        var raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            try {
                var data = JSON.parse(raw);
                return {
                    lastUpdated: new Date(data.timestamp).toLocaleString(),
                    isFresh: (Date.now() - data.timestamp < CACHE_DURATION),
                    count: (data.fixtures || []).length
                };
            } catch(e) {}
        }
        return { lastUpdated: 'Never', isFresh: false, count: 0 };
    }

    return {
        getAllMatches: getAllMatches,
        getActiveMatch: getActiveMatch,
        getOrderedMatches: getOrderedMatches,
        setActiveMatch: setActiveMatch,
        updateMatch: updateMatch,
        resetToDefaults: resetToDefaults,
        refreshFromAPI: refreshFromAPI,
        getCacheInfo: getCacheInfo,
        getFallbackFixtures: function() { return FALLBACK_FIXTURES; },
        STORAGE_KEY: OVERRIDE_KEY
    };

})();