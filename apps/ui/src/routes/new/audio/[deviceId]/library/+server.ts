import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/audio/devices/${deviceId}/library`);
		const data = await response.json();

		const tracks = data.tracks || [];

		if (tracks.length === 0) {
			return new Response(
				`<div class="text-slate-400 text-sm">No tracks in library</div>`,
				{ headers: { 'Content-Type': 'text/html' } }
			);
		}

		const html = tracks
			.map(
				(track: any) => `
			<div class="flex items-center justify-between p-2 bg-slate-800 rounded hover:bg-slate-700 transition">
				<div class="flex-1">
					<div class="text-sm">${track.filename}</div>
					<div class="text-xs text-slate-400">${track.duration || '00:00'} • ${(track.size / 1024 / 1024).toFixed(1)} MB</div>
				</div>
				<div class="flex gap-2">
					<button
						hx-post="/new/audio/${deviceId}/library/play"
						hx-vals='{"filename": "${track.filename}"}'
						hx-swap="none"
						class="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded"
					>
						▶️ Play
					</button>
					<button
						hx-delete="/new/audio/${deviceId}/library/${encodeURIComponent(track.filename)}"
						hx-confirm="Delete ${track.filename}?"
						hx-target="#audio-library-${deviceId}"
						hx-swap="innerHTML"
						class="text-xs px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded"
					>
						Delete
					</button>
				</div>
			</div>
		`
			)
			.join('');

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (error) {
		return new Response(
			`<div class="text-red-400 text-sm">Failed to load library: ${error}</div>`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	}
};
