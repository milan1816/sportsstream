/* ============================================================
   DATA.JS – Live match data from API-Football
   Features:
     - Fetches real World Cup 2026 fixtures from API-Football
     - Uses Netlify function when deployed, CORS proxy when local
     - Auto-detects live/upcoming/finished based on viewer's clock
     - Shows all times in viewer's LOCAL timezone
     - Caches results in localStorage (12 hours)
     - Falls back to pre-programmed schedule silently
   ============================================================ */

const DataStore = (function() {
    'use strict';

    // ---- API-FOOTBALL KEY ----
    var API_KEY = '23ede1d64a5ae30a2ae3aecba72c2a43';
    var API_HOST = 'v3.football.api-sports.io';

    var LEAGUE_ID = 1;  // FIFA World Cup
    var SEASON = 2026;

    // Storage
    var CACHE_KEY = 'worldcup_cache';
    var OVERRIDE_KEY = 'worldcup_overrides';
    var CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours

    var MATCH_DURATION_HOURS = 3;

    // ============================================================
    // API ENDPOINTS
    // ============================================================
    var NETLIFY_FN_URL = '/.netlify/functions/fetch-fixtures';
    var DIRECT_API_URL = 'https://' + API_HOST + '/fixtures?league=' + LEAGUE_ID + '&season=' + SEASON;

    var CORS_PROXIES = [
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url=',
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
        'Uruguay': '🇺🇾', 'South Korea': '🇰🇷', 'Japan': '🇯🇵', 'Senegal': '🇸🇳'
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

            if (IS_NETLIFY) {
                attempts.push({ url: NETLIFY_FN_URL, headers: {} });
            }

            CORS_PROXIES.forEach(function(proxy) {
                attempts.push({
                    url: proxy + encodeURIComponent(DIRECT_API_URL),
                    headers: {
                        'x-apisports-key': API_KEY,
                        'x-rapidapi-host': API_HOST
                    }
                });
            });

            var tryNext = function(index) {
                if (index >= attempts.length) {
                    reject(new Error('All fetch methods failed'));
                    return;
                }

                var attempt = attempts[index];

                fetch(attempt.url, { method: 'GET', headers: attempt.headers })
                    .then(function(r) {
                        if (!r.ok) throw new Error('Status ' + r.status);
                        return r.json();
                    })
                    .then(function(data) {
                        if (data && data.response && data.response.length > 0) {
                            resolve(data.response);
                        } else {
                            tryNext(index + 1);
                        }
                    })
                    .catch(function() {
                        tryNext(index + 1);
                    });
            };

            tryNext(0);
        });
    }

    // ============================================================
    // PARSE API FIXTURES
    // ============================================================
    function parseFixture(fixture) {
        var homeTeam = fixture.teams ? fixture.teams.home.name : fixture.team1;
        var awayTeam = fixture.teams ? fixture.teams.away.name : fixture.team2;
        var homeFlag = fixture.teams ? fixture.teams.home.logo : fixture.team1Flag;
        var awayFlag = fixture.teams ? fixture.teams.away.logo : fixture.team2Flag;
        var matchDate = fixture.fixture ? new Date(fixture.fixture.date) : new Date(fixture.date || fixture.startDate);
        var scoreHome = fixture.goals ? fixture.goals.home : null;
        var scoreAway = fixture.goals ? fixture.goals.away : null;

        return {
            id: fixture.id || (fixture.fixture ? fixture.fixture.id : Date.now()),
            team1: homeTeam,
            team2: awayTeam,
            team1Flag: homeFlag || (COUNTRY_FLAGS[homeTeam] || '🏳️'),
            team2Flag: awayFlag || (COUNTRY_FLAGS[awayTeam] || '🏳️'),
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
            var matchDate = f.startDate instanceof Date ? f.startDate : new Date(f.date || f.startDate);
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

    // ---- Refresh from API (silent - never shows errors) ----
    function refreshFromAPI(callback) {
        fetchFromAPI()
            .then(function(fixtures) {
                if (fixtures && fixtures.length > 0) {
                    var parsed = fixtures.map(parseFixture);
                    saveCache(parsed);
                    try { document.dispatchEvent(new CustomEvent('matchesUpdated')); } catch(e) {}
                    if (callback) callback(null, parsed);
                } else {
                    saveCache(FALLBACK_FIXTURES);
                    if (callback) callback(null, FALLBACK_FIXTURES);
                }
            })
            .catch(function() {
                saveCache(FALLBACK_FIXTURES);
                if (callback) callback(null, FALLBACK_FIXTURES);
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