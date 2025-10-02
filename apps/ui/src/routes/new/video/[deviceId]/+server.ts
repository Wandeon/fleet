import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/video/devices`);
		const data = await response.json();
		const device = data.devices?.find((d: any) => d.id === deviceId);

		if (!device) {
			return new Response(
				`<div class="text-red-400">Device ${deviceId} not found</div>`,
				{ headers: { 'Content-Type': 'text/html' } }
			);
		}

		const isOnline = device.status === 'online';
		const powerState = device.power || 'off';

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
					⚠️ Device offline. Check network connection at 100.123.206.6:8080
				</div>
			`
					: ''
			}

			<!-- Power Controls -->
			<div class="flex gap-2">
				<button
					hx-post="/new/video/${deviceId}/power"
					hx-vals='{"power": "on"}'
					hx-swap="none"
					${!isOnline || powerState === 'on' ? 'disabled' : ''}
					class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 rounded transition"
				>
					Power On
				</button>
				<button
					hx-post="/new/video/${deviceId}/power"
					hx-vals='{"power": "standby"}'
					hx-swap="none"
					${!isOnline || powerState === 'standby' ? 'disabled' : ''}
					class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 rounded transition"
				>
					Power Off
				</button>
			</div>

			<!-- Input Selection -->
			<div>
				<label class="text-sm text-slate-400 block mb-1">HDMI Input</label>
				<select
					hx-post="/new/video/${deviceId}/input"
					hx-trigger="change"
					hx-swap="none"
					${!isOnline ? 'disabled' : ''}
					class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded"
				>
					<option value="HDMI1" ${device.input === 'HDMI1' ? 'selected' : ''}>HDMI 1</option>
					<option value="HDMI2" ${device.input === 'HDMI2' ? 'selected' : ''}>HDMI 2</option>
					<option value="CHROMECAST" ${device.input === 'CHROMECAST' ? 'selected' : ''}>Chromecast</option>
				</select>
			</div>

			<!-- Volume Control -->
			<div>
				<label class="text-sm text-slate-400 block mb-1">
					Volume: ${device.volumePercent || 30}%
				</label>
				<input
					type="range"
					min="0"
					max="100"
					value="${device.volumePercent || 30}"
					${!isOnline ? 'disabled' : ''}
					hx-post="/new/video/${deviceId}/volume"
					hx-trigger="change"
					hx-swap="none"
					class="w-full"
				/>
			</div>

			<!-- Mute Toggle -->
			<button
				hx-post="/new/video/${deviceId}/mute"
				hx-vals='{"mute": ${!device.mute}}'
				hx-swap="none"
				${!isOnline ? 'disabled' : ''}
				class="w-full px-4 py-2 ${device.mute ? 'bg-red-600' : 'bg-slate-700'} hover:bg-slate-600 disabled:bg-slate-800 rounded transition"
			>
				${device.mute ? '🔇 Unmute' : '🔊 Mute'}
			</button>

			<!-- Video Library -->
			<div class="border-t border-slate-800 pt-3 mt-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Video Library</span>
					<button
						onclick="document.getElementById('video-upload-${deviceId}').click()"
						${!isOnline ? 'disabled' : ''}
						class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded"
					>
						+ Upload
					</button>
					<input
						id="video-upload-${deviceId}"
						type="file"
						accept="video/*"
						class="hidden"
						hx-post="/new/video/${deviceId}/library/upload"
						hx-encoding="multipart/form-data"
						hx-swap="none"
					/>
				</div>
				<div
					id="video-library-${deviceId}"
					hx-get="/new/video/${deviceId}/library"
					hx-trigger="load"
					hx-swap="innerHTML"
					class="space-y-1"
				>
					Loading...
				</div>
			</div>
		`;

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (error) {
		return new Response(
			`<div class="text-red-400">Error loading video controls: ${error}</div>`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	}
};
