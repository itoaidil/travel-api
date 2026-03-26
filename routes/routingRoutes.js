const express = require('express');
const router = express.Router();
const https = require('https');

/**
 * GET /api/route?origin=lat,lng&destination=lat,lng
 *
 * Proxy endpoint for driving directions.
 * - If GOOGLE_DIRECTIONS_KEY env var is set: uses Google Directions API
 * - Otherwise: falls back to OSRM (open-source, free, no key needed)
 *
 * Returns: { success: true, points: [[lat,lng], ...] }
 */
router.get('/', async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({
      success: false,
      message: 'origin and destination query params are required (format: lat,lng)'
    });
  }

  const [oLat, oLng] = origin.split(',').map(Number);
  const [dLat, dLng] = destination.split(',').map(Number);

  if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
    return res.status(400).json({ success: false, message: 'Invalid coordinates' });
  }

  // ── Try Google Directions API if key is available ────────────────────────
  const googleKey = process.env.GOOGLE_DIRECTIONS_KEY;
  if (googleKey) {
    try {
      const points = await fetchGoogleDirections(oLat, oLng, dLat, dLng, googleKey);
      if (points && points.length > 1) {
        return res.json({ success: true, source: 'google', points });
      }
    } catch (err) {
      console.warn('⚠️ [ROUTE] Google Directions failed, falling back to OSRM:', err.message);
    }
  }

  // ── Fallback: OSRM ───────────────────────────────────────────────────────
  try {
    const points = await fetchOsrmRoute(oLat, oLng, dLat, dLng);
    return res.json({ success: true, source: 'osrm', points });
  } catch (err) {
    console.error('⚠️ [ROUTE] OSRM also failed:', err.message);
    // Last resort: straight line
    return res.json({
      success: true,
      source: 'straight',
      points: [[oLat, oLng], [dLat, dLng]]
    });
  }
});

// ── Google Directions API ────────────────────────────────────────────────────
function fetchGoogleDirections(oLat, oLng, dLat, dLng, key) {
  return new Promise((resolve, reject) => {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${oLat},${oLng}&destination=${dLat},${dLng}` +
      `&mode=driving&key=${key}`;

    https.get(url, (resp) => {
      let body = '';
      resp.on('data', chunk => { body += chunk; });
      resp.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.status !== 'OK') {
            return reject(new Error(`Google status: ${data.status} – ${data.error_message || ''}`));
          }
          const encoded = data.routes[0].overview_polyline.points;
          resolve(decodePolyline(encoded));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ── OSRM ─────────────────────────────────────────────────────────────────────
function fetchOsrmRoute(oLat, oLng, dLat, dLng) {
  return new Promise((resolve, reject) => {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${oLng},${oLat};${dLng},${dLat}` +
      `?overview=full&geometries=geojson`;

    https.get(url, (resp) => {
      let body = '';
      resp.on('data', chunk => { body += chunk; });
      resp.on('end', () => {
        try {
          const data = JSON.parse(body);
          const routes = data.routes;
          if (!routes || routes.length === 0) {
            return reject(new Error('No OSRM routes found'));
          }
          const coords = routes[0].geometry.coordinates;
          // OSRM returns [lng, lat] — flip to [lat, lng]
          resolve(coords.map(c => [c[1], c[0]]));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ── Polyline decoder ─────────────────────────────────────────────────────────
function decodePolyline(encoded) {
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    poly.push([lat / 1e5, lng / 1e5]);
  }
  return poly;
}

module.exports = router;
