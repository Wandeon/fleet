import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, fetch }) => {
	const { deviceId, filename } = params;

	try {
		const response = await fetch(`/api/video/devices/${deviceId}/library/${encodeURIComponent(filename)}`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			throw new Error(`Delete failed: ${response.statusText}`);
		}

		// Return updated library
		const libraryResponse = await fetch(`/api/video/devices/${deviceId}/library`);
		const data = await libraryResponse.json();
		const videos = data.videos || [];

		if (videos.length === 0) {
			return new Response(
				`<div class="text-slate-400 text-sm">No videos in library</div>`,
				{
					headers: {
						'Content-Type': 'text/html',
						'HX-Trigger': `{"showToast": {"message": "Deleted ${filename}", "type": "success"}}`,
					},
				}
			);
		}

		const html = videos
			.map(
				(video: any) => `
			<div class="flex items-center justify-between p-2 bg-slate-800 rounded hover:bg-slate-700 transition">
				<div class="flex-1">
					<div class="text-sm">${video.filename}</div>
					<div class="text-xs text-slate-400">${(video.size / 1024 / 1024).toFixed(1)} MB</div>
				</div>
				<div class="flex gap-2">
					<button
						hx-post="/new/video/${deviceId}/library/play"
						hx-vals='{"filename": "${video.filename}"}'
						hx-swap="none"
						class="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded"
					>
						▶️ Play
					</button>
					<button
						hx-delete="/new/video/${deviceId}/library/${encodeURIComponent(video.filename)}"
						hx-confirm="Delete ${video.filename}?"
						hx-target="#video-library-${deviceId}"
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
			headers: {
				'Content-Type': 'text/html',
				'HX-Trigger': `{"showToast": {"message": "Deleted ${filename}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(
			`<div class="text-red-400 text-sm">Delete failed: ${error}</div>`,
			{
				status: 500,
				headers: {
					'Content-Type': 'text/html',
					'HX-Trigger': `{"showToast": {"message": "Delete failed: ${error}", "type": "error"}}`,
				},
			}
		);
	}
};
