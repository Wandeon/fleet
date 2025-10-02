import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/audio/devices`);
		const data = await response.json();
		const device = data.devices?.find((d: any) => d.id === deviceId);

		if (!device) {
			return new Response(
				`<div class="text-red-400">Device ${deviceId} not found</div>`,
				{ headers: { 'Content-Type': 'text/html' } }
			);
		}

		const isOnline = device.status === 'online';
		const isPlaying = device.playback?.state === 'playing';
		const currentTrack = device.playback?.track || 'None';

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

			<!-- Playback Status -->
			<div class="bg-slate-800 rounded p-3">
				<div class="text-sm text-slate-400 mb-1">Now Playing</div>
				<div class="font-medium">${currentTrack}</div>
				<div class="text-xs text-slate-500 mt-1">
					${isPlaying ? '▶️ Playing' : '⏸️ Stopped'}
				</div>
			</div>

			<!-- Playback Controls -->
			<div class="flex gap-2">
				<button
					hx-post="/new/audio/${deviceId}/play"
					hx-swap="none"
					${!isOnline || isPlaying ? 'disabled' : ''}
					class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 rounded transition"
				>
					▶️ Play
				</button>
				<button
					hx-post="/new/audio/${deviceId}/stop"
					hx-swap="none"
					${!isOnline || !isPlaying ? 'disabled' : ''}
					class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 rounded transition"
				>
					⏸️ Stop
				</button>
			</div>

			<!-- Volume Control -->
			<div>
				<label class="text-sm text-slate-400 block mb-1">
					Volume: ${device.volume || 50}%
				</label>
				<input
					type="range"
					min="0"
					max="100"
					value="${device.volume || 50}"
					${!isOnline ? 'disabled' : ''}
					hx-post="/new/audio/${deviceId}/volume"
					hx-trigger="change"
					hx-swap="none"
					class="w-full"
				/>
			</div>

			<!-- Track Library -->
			<div class="border-t border-slate-800 pt-3 mt-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Audio Library</span>
					<button
						onclick="document.getElementById('audio-upload-${deviceId}').click()"
						${!isOnline ? 'disabled' : ''}
						class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded"
					>
						+ Upload
					</button>
					<input
						id="audio-upload-${deviceId}"
						type="file"
						accept="audio/*"
						class="hidden"
						hx-post="/new/audio/${deviceId}/library/upload"
						hx-encoding="multipart/form-data"
						hx-swap="none"
					/>
				</div>
				<div
					id="audio-library-${deviceId}"
					hx-get="/new/audio/${deviceId}/library"
					hx-trigger="load"
					hx-swap="innerHTML"
					class="space-y-1"
				>
					Loading...
				</div>
			</div>

			<!-- Playlist Section -->
			<div class="border-t border-slate-800 pt-3 mt-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Playlists</span>
					<button
						${!isOnline ? 'disabled' : ''}
						class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded"
						onclick="window.showToast('Playlist creation coming soon', 'info')"
					>
						+ Create
					</button>
				</div>
			</div>
		`;

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (error) {
		return new Response(
			`<div class="text-red-400">Error loading audio controls: ${error}</div>`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	}
};
