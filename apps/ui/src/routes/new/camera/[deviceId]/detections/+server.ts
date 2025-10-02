import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch, url }) => {
	const { deviceId } = params;
	const filter = url.searchParams.get('type') || 'all';

	try {
		const response = await fetch(`/api/camera/devices/${deviceId}/detections?hours=24&type=${filter}`);
		const data = await response.json();

		const detections = data.detections || [];

		if (detections.length === 0) {
			return new Response(
				`<div class="text-slate-400 text-sm">No detections found</div>`,
				{ headers: { 'Content-Type': 'text/html' } }
			);
		}

		const html = detections
			.map(
				(det: any) => `
			<div class="flex items-center justify-between p-2 bg-slate-800 rounded">
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<span class="text-sm">${det.tag || 'Unknown'}</span>
						<span class="text-xs px-2 py-0.5 rounded ${
							det.confidence > 0.8 ? 'bg-green-600/20 text-green-400' : 'bg-amber-600/20 text-amber-400'
						}">
							${Math.round(det.confidence * 100)}%
						</span>
					</div>
					<div class="text-xs text-slate-400">${new Date(det.timestamp).toLocaleString()}</div>
				</div>
				<div class="flex gap-1">
					<button
						hx-post="/new/camera/${deviceId}/detections/${det.id}/acknowledge"
						hx-swap="none"
						class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
						title="Acknowledge"
					>
						✓
					</button>
					<button
						hx-post="/new/camera/${deviceId}/detections/${det.id}/archive"
						hx-swap="none"
						class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
						title="Archive"
					>
						📁
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
			`<div class="text-red-400 text-sm">Failed to load detections: ${error}</div>`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	}
};
