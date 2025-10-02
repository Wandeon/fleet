import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const response = await fetch('/api/health/summary');
		const data = await response.json();

		const html = `
			<div class="text-right">
				<div class="text-sm font-medium ${data.summary?.total ? 'text-green-400' : 'text-slate-400'}">
					${data.summary?.online || 0}/${data.summary?.total || 0} Online
				</div>
				<div class="text-xs text-slate-500">
					${new Date().toLocaleTimeString()}
				</div>
			</div>
		`;

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (error) {
		return new Response(
			'<div class="text-sm text-red-400">Status unavailable</div>',
			{
				headers: { 'Content-Type': 'text/html' },
			}
		);
	}
};
