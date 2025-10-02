import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/camera/devices`);
		const data = await response.json();
		const device = data.devices?.find((d: any) => d.id === deviceId);

		if (!device) {
			return new Response(
				`<div class="text-red-400">Device ${deviceId} not found</div>`,
				{ headers: { 'Content-Type': 'text/html' } }
			);
		}

		const isOnline = device.status === 'online';
		const nightMode = device.nightMode || false;
		const streamUrl = device.streamUrl || '';

		const html = `
			<!-- Device Status -->
			<div class="flex items-center gap-2 text-sm">
				<div class="w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}"></div>
				<span class="${isOnline ? 'text-green-400' : 'text-red-400'}">
					${isOnline ? 'Online' : 'Offline'}
				</span>
			</div>

			${
				!isOnline
					? `
				<div class="bg-amber-900/30 border border-amber-600/50 rounded p-3 text-amber-200 text-sm">
					⚠️ Device offline. Check network connection
				</div>
			`
					: ''
			}

			<!-- Live Feed -->
			${
				isOnline && streamUrl
					? `
				<div class="bg-slate-950 rounded border border-slate-800 p-2">
					<div class="text-sm text-slate-400 mb-2">Live Feed</div>
					<video
						id="camera-stream-${deviceId}"
						class="w-full rounded"
						autoplay
						muted
						playsinline
						src="${streamUrl}"
					>
						Stream not available
					</video>
					<div class="flex gap-2 mt-2">
						<button
							onclick="document.getElementById('camera-stream-${deviceId}').requestFullscreen()"
							class="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded"
						>
							⛶ Fullscreen
						</button>
						<button
							onclick="window.showToast('Screenshot captured', 'success')"
							class="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded"
						>
							📷 Capture
						</button>
					</div>
				</div>
			`
					: `
				<div class="bg-slate-800 rounded p-6 text-center text-slate-400">
					<div class="text-4xl mb-2">📷</div>
					<div>Live feed unavailable</div>
				</div>
			`
			}

			<!-- Night Mode Toggle -->
			<div class="flex items-center justify-between p-3 bg-slate-800 rounded">
				<span class="text-sm">Night Mode</span>
				<button
					hx-post="/new/camera/${deviceId}/night-mode"
					hx-vals='{"enabled": ${!nightMode}}'
					hx-swap="none"
					${!isOnline ? 'disabled' : ''}
					class="px-4 py-2 ${nightMode ? 'bg-blue-600' : 'bg-slate-700'} hover:bg-slate-600 disabled:bg-slate-800 rounded transition"
				>
					${nightMode ? '🌙 Enabled' : '☀️ Disabled'}
				</button>
			</div>

			<!-- AI Detections -->
			<div class="border-t border-slate-800 pt-3 mt-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">AI Detections (24h)</span>
					<select class="text-sm px-2 py-1 bg-slate-800 border border-slate-700 rounded">
						<option value="all">All</option>
						<option value="person">Person</option>
						<option value="vehicle">Vehicle</option>
						<option value="animal">Animal</option>
					</select>
				</div>
				<div
					id="camera-detections-${deviceId}"
					hx-get="/new/camera/${deviceId}/detections"
					hx-trigger="load, every 10s"
					hx-swap="innerHTML"
					class="space-y-2 max-h-48 overflow-y-auto"
				>
					Loading detections...
				</div>
			</div>
		`;

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (error) {
		return new Response(
			`<div class="text-red-400">Error loading camera controls: ${error}</div>`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	}
};
