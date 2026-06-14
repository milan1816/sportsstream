// ============================================================
// NETLIFY FUNCTION: fetch-fixtures
// Calls API-Football server-side to fetch World Cup 2026 fixtures.
// Uses Node.js built-in https module (no dependencies needed).
// ============================================================

const https = require('https');

const API_KEY = '23ede1d64a5ae30a2ae3aecba72c2a43';
const API_HOST = 'v3.football.api-sports.io';
const LEAGUE_ID = 1;   // FIFA World Cup
const SEASON = 2026;

exports.handler = function(event, context, callback) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return callback(null, {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        });
    }

    var apiPath = '/fixtures?league=' + LEAGUE_ID + '&season=' + SEASON;

    var options = {
        hostname: API_HOST,
        path: apiPath,
        method: 'GET',
        headers: {
            'x-apisports-key': API_KEY,
            'x-rapidapi-host': API_HOST
        }
    };

    var req = https.request(options, function(res) {
        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            try {
                var data = JSON.parse(body);

                // Send successful response with cache headers
                callback(null, {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=43200' // Cache 12 hours
                    },
                    body: JSON.stringify(data)
                });
            } catch (e) {
                // If JSON parse fails, return fallback
                sendFallback(callback);
            }
        });
    });

    req.on('error', function(error) {
        console.error('API call failed:', error.message);
        sendFallback(callback);
    });

    req.end();
};

// Return fallback fixture data if the API call fails
function sendFallback(callback) {
    var fallback = [
        { teams: { home: { name: 'Brazil', logo: '' }, away: { name: 'Argentina', logo: '' } }, fixture: { id: 1001, date: '2026-06-14T18:00:00' }, goals: { home: null, away: null } },
        { teams: { home: { name: 'France', logo: '' }, away: { name: 'Germany', logo: '' } }, fixture: { id: 1002, date: '2026-06-15T20:00:00' }, goals: { home: null, away: null } },
        { teams: { home: { name: 'England', logo: '' }, away: { name: 'Portugal', logo: '' } }, fixture: { id: 1003, date: '2026-06-16T21:00:00' }, goals: { home: null, away: null } },
        { teams: { home: { name: 'Netherlands', logo: '' }, away: { name: 'Spain', logo: '' } }, fixture: { id: 1004, date: '2026-06-17T19:00:00' }, goals: { home: null, away: null } },
        { teams: { home: { name: 'Italy', logo: '' }, away: { name: 'Croatia', logo: '' } }, fixture: { id: 1005, date: '2026-06-18T18:30:00' }, goals: { home: null, away: null } },
        { teams: { home: { name: 'Belgium', logo: '' }, away: { name: 'Morocco', logo: '' } }, fixture: { id: 1006, date: '2026-06-19T17:00:00' }, goals: { home: null, away: null } },
        { teams: { home: { name: 'Uruguay', logo: '' }, away: { name: 'South Korea', logo: '' } }, fixture: { id: 1007, date: '2026-06-20T15:00:00' }, goals: { home: null, away: null } },
        { teams: { home: { name: 'Japan', logo: '' }, away: { name: 'Senegal', logo: '' } }, fixture: { id: 1008, date: '2026-06-21T18:00:00' }, goals: { home: null, away: null } }
    ];

    callback(null, {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ response: fallback, fromFallback: true })
    });
}