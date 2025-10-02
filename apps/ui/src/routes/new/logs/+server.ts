import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, url }) => {
	try {
		const device = url.searchParams.get('device') || 'all';
		const level = url.searchParams.get('level') || 'all';

		const response = await fetch(`/api/logs/recent?device=${device}&level=${level}&limit=20`);
		const data = await response.json();

		const logs = data.logs || [];

		const levelColors: Record<string, string> = {
			error: 'text-red-400',
			warn: 'text-amber-400',
			info: 'text-blue-400',
			debug: 'text-slate-400',
		};

		const html = `
			<div class="flex gap-2 mb-3">
				<select
					hx-get="/new/logs"
					hx-trigger="change"
					hx-include="[name='level']"
					name="device"
					class="text-sm px-3 py-1 bg-slate-800 border border-slate-700 rounded"
				>
					<option value="all" ${device === 'all' ? 'selected' : ''}>All Devices</option>
					<option value="pi-audio-01" ${device === 'pi-audio-01' ? 'selected' : ''}>Audio 01</option>
					<option value="pi-audio-02" ${device === 'pi-audio-02' ? 'selected' : ''}>Audio 02</option>
					<option value="pi-video-01" ${device === 'pi-video-01' ? 'selected' : ''}>Video 01</option>
					<option value="pi-camera-01" ${device === 'pi-camera-01' ? 'selected' : ''}>Camera 01</option>
				</select>

				<select
					hx-get="/new/logs"
					hx-trigger="change"
					hx-include="[name='device']"
					name="level"
					class="text-sm px-3 py-1 bg-slate-800 border border-slate-700 rounded"
				>
					<option value="all" ${level === 'all' ? 'selected' : ''}>All Levels</option>
					<option value="error" ${level === 'error' ? 'selected' : ''}>Error</option>
					<option value="warn" ${level === 'warn' ? 'selected' : ''}>Warn</option>
					<option value="info" ${level === 'info' ? 'selected' : ''}>Info</option>
					<option value="debug" ${level === 'debug' ? 'selected' : ''}>Debug</option>
				</select>

				<button
					hx-post="/new/logs/export"
					hx-vals='{"device": "${device}", "level": "${level}"}'
					hx-swap="none"
					class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded ml-auto"
				>
					📥 Export
				</button>
			</div>

			${
				logs.length === 0
					? `
				<div class="text-slate-400 text-sm text-center py-6">
					No logs found
				</div>
			`
					: `
				<div class="space-y-1 font-mono text-xs">
					${logs
						.map(
							(log: any) => `
						<div class="flex gap-3 p-2 bg-slate-800/50 rounded hover:bg-slate-800 transition">
							<span class="text-slate-500">${new Date(log.timestamp).toLocaleTimeString()}</span>
							<span class="${levelColors[log.level] || 'text-slate-400'} uppercase w-12">${log.level}</span>
							<span class="text-slate-500">${log.device || 'system'}</span>
							<span class="flex-1 ${log.level === 'error' ? 'text-red-300' : 'text-slate-300'}">
								${log.message}
							</span>
							${
								log.correlationId
									? `
								<button
									onclick="navigator.clipboard.writeText('${log.correlationId}'); window.showToast('Correlation ID copied', 'success')"
									class="text-slate-500 hover:text-slate-300"
									title="${log.correlationId}"
								>
									🔗
								</button>
							`
									: ''
							}
						</div>
					`
						)
						.join('')}
				</div>
			`
			}
		`;

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (error) {
		return new Response(
			`<div class="text-red-400 text-sm">Error loading logs: ${error}</div>`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	}
};
