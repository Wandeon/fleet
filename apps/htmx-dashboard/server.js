const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const API_BASE = process.env.API_BASE || 'http://fleet-api:3015';
const API_TOKEN = process.env.FLEET_API_TOKEN || process.env.API_BEARER || '';

app.use(express.static('public'));
app.use(express.json());

// Helper to call Fleet API
async function callAPI(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}

// Audio Overview - returns HTML fragment
app.get('/api/audio/overview', async (req, res) => {
    try {
        const data = await callAPI('/audio/overview');
        const devices = data.devices || [];

        let html = '';
        for (const device of devices) {
            const isOnline = device.status === 'online';
            const current = device.playback?.track || 'Nothing playing';
            const volume = device.volume || 50;
            const state = device.playback?.state || 'stopped';

            html += `
                <div class="device">
                    <div class="device-header">
                        <span class="device-name">${device.id}</span>
                        <div class="device-status ${isOnline ? 'online' : ''}">
                            <div class="dot"></div>
                            <span>${isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>
                    <div class="current-track">
                        🎵 ${current}
                    </div>
                    <div class="controls">
                        <button hx-post="api/audio/devices/${device.id}/resume" hx-swap="none" ${!isOnline || state === 'playing' ? 'disabled' : ''}>
                            ▶️ Play
                        </button>
                        <button hx-post="api/audio/devices/${device.id}/pause" hx-swap="none" ${!isOnline || state !== 'playing' ? 'disabled' : ''}>
                            ⏸️ Pause
                        </button>
                        <button hx-post="api/audio/devices/${device.id}/stop" hx-swap="none" ${!isOnline || state === 'stopped' ? 'disabled' : ''}>
                            ⏹️ Stop
                        </button>
                    </div>
                    <div class="volume-control">
                        <div class="volume-label">
                            <span>Volume</span>
                            <span id="vol-${device.id}">${volume}%</span>
                        </div>
                        <input type="range" min="0" max="100" value="${volume}"
                               onchange="updateVolume('${device.id}', 'audio', this.value); document.getElementById('vol-${device.id}').textContent = this.value + '%'"
                               ${!isOnline ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        }

        res.send(html || '<div class="loading">No audio devices found</div>');
    } catch (error) {
        res.send(`<div class="error-message">Failed to load audio devices: ${error.message}</div>`);
    }
});

// Video Devices - returns HTML fragment
app.get('/api/video/devices', async (req, res) => {
    try {
        const data = await callAPI('/video/devices');
        const devices = data.devices || [];

        let html = '';
        for (const device of devices) {
            const isOnline = device.status === 'online';
            const powerOn = device.power === 'on';
            const currentInput = device.input || 'unknown';
            const volume = device.volumePercent || 50;

            html += `
                <div class="device">
                    <div class="device-header">
                        <span class="device-name">${device.id}</span>
                        <div class="device-status ${isOnline ? 'online' : ''}">
                            <div class="dot"></div>
                            <span>${isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>
                    <div class="current-track">
                        📡 Input: ${currentInput} | Power: ${powerOn ? 'ON' : 'OFF'}
                    </div>
                    <div class="controls">
                        <button class="success" hx-post="api/video/devices/${device.id}/power" hx-vals='{"power":"on"}' hx-swap="none" ${!isOnline || powerOn ? 'disabled' : ''}>
                            ⚡ Power On
                        </button>
                        <button class="danger" hx-post="api/video/devices/${device.id}/power" hx-vals='{"power":"standby"}' hx-swap="none" ${!isOnline || !powerOn ? 'disabled' : ''}>
                            ⏻ Power Off
                        </button>
                        <select hx-post="api/video/devices/${device.id}/input" hx-trigger="change" hx-swap="none" name="input" ${!isOnline ? 'disabled' : ''}>
                            <option value="HDMI1" ${currentInput === 'HDMI1' ? 'selected' : ''}>HDMI 1</option>
                            <option value="HDMI2" ${currentInput === 'HDMI2' ? 'selected' : ''}>HDMI 2</option>
                            <option value="HDMI3" ${currentInput === 'HDMI3' ? 'selected' : ''}>HDMI 3</option>
                            <option value="CHROMECAST" ${currentInput === 'CHROMECAST' ? 'selected' : ''}>Chromecast</option>
                        </select>
                    </div>
                    <div class="volume-control">
                        <div class="volume-label">
                            <span>Volume</span>
                            <span id="vol-${device.id}">${volume}%</span>
                        </div>
                        <input type="range" min="0" max="100" value="${volume}"
                               onchange="updateVolume('${device.id}', 'video', this.value); document.getElementById('vol-${device.id}').textContent = this.value + '%'"
                               ${!isOnline ? 'disabled' : ''}>
                    </div>
                    <div class="controls">
                        <button hx-post="api/video/devices/${device.id}/mute" hx-vals='{"mute":true}' hx-swap="none" ${!isOnline ? 'disabled' : ''}>
                            🔇 Mute
                        </button>
                    </div>
                </div>
            `;
        }

        res.send(html || '<div class="loading">No video devices found</div>');
    } catch (error) {
        res.send(`<div class="error-message">Failed to load video devices: ${error.message}</div>`);
    }
});

// Zigbee Overview - returns HTML fragment
app.get('/api/zigbee/overview', async (req, res) => {
    try {
        const data = await callAPI('/zigbee/overview');
        const hub = data.hub || {};
        const devices = data.devices || [];
        const pairing = data.pairing || {};

        let html = `
            <div class="device-header">
                <span class="device-name">Zigbee Hub</span>
                <div class="device-status ${hub.status === 'online' ? 'online' : ''}">
                    <div class="dot"></div>
                    <span>${hub.status === 'online' ? 'Online' : 'Offline'} ${hub.channel ? `(Ch ${hub.channel})` : ''}</span>
                </div>
            </div>
        `;

        if (pairing.active) {
            html += `
                <div class="pairing-status active">
                    ⏱️ Pairing active (${pairing.remaining || 60}s remaining)
                    <button hx-delete="api/zigbee/pairing" hx-swap="none" class="danger">Cancel</button>
                </div>
            `;
        } else {
            html += `
                <div class="controls">
                    <button hx-post="api/zigbee/pairing" hx-vals='{"duration":60}' hx-swap="none" ${hub.status !== 'online' ? 'disabled' : ''}>
                        🔗 Start Pairing (60s)
                    </button>
                </div>
            `;
        }

        if (devices.length > 0) {
            html += '<div style="margin-top: 15px;">';
            for (const device of devices) {
                const state = device.state || 'unknown';
                html += `
                    <div class="zigbee-device">
                        <div class="zigbee-info">
                            <div class="zigbee-name">${device.name || device.id}</div>
                            <div class="zigbee-type">${device.type} - ${state}</div>
                        </div>
                        <div class="controls">
                            ${device.type === 'light' || device.type === 'switch' ? `
                                <button hx-post="api/zigbee/devices/${device.id}/command" hx-vals='{"command":"toggle"}' hx-swap="none">
                                    ${state === 'on' ? '💡 On' : '⚪ Off'}
                                </button>
                            ` : ''}
                            <button class="danger" hx-delete="api/zigbee/devices/${device.id}" hx-confirm="Remove ${device.name || device.id}?" hx-swap="none">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        } else {
            html += '<div class="loading" style="margin-top: 10px;">No devices paired</div>';
        }

        res.send(html);
    } catch (error) {
        res.send(`<div class="error-message">Failed to load Zigbee: ${error.message}</div>`);
    }
});

// Camera Summary - returns HTML fragment
app.get('/api/camera/summary', async (req, res) => {
    try {
        const data = await callAPI('/camera/summary');
        const camera = data.camera || {};
        const events = data.events || [];

        let html = `
            <div class="device-header">
                <span class="device-name">Camera</span>
                <div class="device-status ${camera.status === 'online' ? 'online' : ''}">
                    <div class="dot"></div>
                    <span>${camera.status === 'online' ? 'Online' : 'Offline'}</span>
                </div>
            </div>
        `;

        if (camera.streamUrl) {
            html += `
                <video class="camera-stream" autoplay muted controls>
                    <source src="${camera.streamUrl}" type="application/x-mpegURL">
                    Stream not available
                </video>
            `;
        }

        if (events.length > 0) {
            html += '<h3 style="margin-top: 15px; margin-bottom: 10px;">Recent Events</h3><div class="event-list">';
            for (const event of events.slice(0, 10)) {
                html += `
                    <div class="event-item">
                        <div class="event-info">
                            <div>${event.type || 'Motion'}</div>
                            <div class="event-time">${new Date(event.timestamp).toLocaleString()}</div>
                        </div>
                        <button hx-post="api/camera/events/${event.id}/ack" hx-swap="none">✓ Ack</button>
                    </div>
                `;
            }
            html += '</div>';
        }

        res.send(html);
    } catch (error) {
        res.send(`<div class="error-message">Failed to load camera: ${error.message}</div>`);
    }
});

// Proxy GET requests to API (for fleet state, etc.)
app.get('/api/fleet/state', async (req, res) => {
    try {
        const data = await callAPI('/fleet/state');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proxy POST/DELETE requests to API
app.post('/api/*', async (req, res) => {
    const endpoint = req.url.replace(/^\/api/, '');
    try {
        await callAPI(endpoint, {
            method: 'POST',
            body: JSON.stringify(req.body)
        });
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Error');
    }
});

app.delete('/api/*', async (req, res) => {
    const endpoint = req.url.replace(/^\/api/, '');
    try {
        await callAPI(endpoint, { method: 'DELETE' });
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Error');
    }
});

// Log stream endpoint (Server-Sent Events)
app.get('/api/logs/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Connect to Fleet API log stream
    try {
        const response = await fetch(`${API_BASE}/logs/stream`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Accept': 'text/event-stream'
            }
        });

        response.body.pipe(res);
    } catch (error) {
        res.write(`data: ${JSON.stringify({level: 'error', msg: 'Log stream unavailable', ts: new Date()})}\n\n`);
    }
});

app.listen(PORT, () => {
    console.log(`Dashboard server running on port ${PORT}`);
    console.log(`API Base: ${API_BASE}`);
});
