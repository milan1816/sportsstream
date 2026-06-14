// ============================================================
// NETLIFY FUNCTION: fetch-fixtures
// Fetches World Cup 2026 fixtures from api.worldcupapi.com
// Uses Node.js built-in https module (no dependencies needed).
// ============================================================

var https = require('https');

var API_KEY = 'BPvmwmkL89duI3tP';
var API_HOST = 'api.worldcupapi.com';

exports.handler = function(event, context, callback) {
    if (event.httpMethod !== 'GET') {
        return callback(null, { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) });
    }

    var apiPath = '/fixtures?key=' + API_KEY;

    var options = {
        hostname: API_HOST,
        path: apiPath,
        method: 'GET',
        headers: {}
    };

    var req = https.request(options, function(res) {
        var body = '';
        res.on('data', function(chunk) { body += chunk; });
        res.on('end', function() {
            try {
                var data = JSON.parse(body);
                // The API returns data directly or wrapped in a data property
                var fixtures = data;

                // Try to extract fixtures array
                if (data && data.data) fixtures = data.data;
                else if (data && data.fixtures) fixtures = data.fixtures;
                else if (Array.isArray(data)) fixtures = data;

                // Normalize to array
                if (!Array.isArray(fixtures)) {
                    fixtures = data.response || Object.values(data).find(function(v) { return Array.isArray(v); }) || [];
                }

                callback(null, {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=43200'
                    },
                    body: JSON.stringify({ response: fixtures })
                });
            } catch (e) {
                sendFallback(callback, 'JSON parse failed: ' + e.message);
            }
        });
    });

    req.on('error', function(error) {
        sendFallback(callback, error.message);
    });

    req.end();
};

function sendFallback(callback, reason) {
    // Return fallback in World Cup API format
    var fallback = [
        { id: 1001, homeTeam: { name: 'Brazil', logo: '' }, awayTeam: { name: 'Argentina', logo: '' }, matchDate: '2026-06-14T18:00:00Z', score: { home: null, away: null } },
        { id: 1002, homeTeam: { name: 'France', logo: '' }, awayTeam: { name: 'Germany', logo: '' }, matchDate: '2026-06-15T20:00:00Z', score: { home: null, away: null } },
        { id: 1003, homeTeam: { name: 'England', logo: '' }, awayTeam: { name: 'Portugal', logo: '' }, matchDate: '2026-06-16T21:00:00Z', score: { home: null, away: null } },
        { id: 1004, homeTeam: { name: 'Netherlands', logo: '' }, awayTeam: { name: 'Spain', logo: '' }, matchDate: '2026-06-17T19:00:00Z', score: { home: null, away: null } },
        { id: 1005, homeTeam: { name: 'Italy', logo: '' }, awayTeam: { name: 'Croatia', logo: '' }, matchDate: '2026-06-18T18:30:00Z', score: { home: null, away: null } },
        { id: 1006, homeTeam: { name: 'Belgium', logo: '' }, awayTeam: { name: 'Morocco', logo: '' }, matchDate: '2026-06-19T17:00:00Z', score: { home: null, away: null } },
        { id: 1007, homeTeam: { name: 'Uruguay', logo: '' }, awayTeam: { name: 'South Korea', logo: '' }, matchDate: '2026-06-20T15:00:00Z', score: { home: null, away: null } },
        { id: 1008, homeTeam: { name: 'Japan', logo: '' }, awayTeam: { name: 'Senegal', logo: '' }, matchDate: '2026-06-21T18:00:00Z', score: { home: null, away: null } }
    ];

    callback(null, {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ response: fallback, fromFallback: true, reason: reason })
    });
}