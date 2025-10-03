import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VideoService } from '$lib/api/gen';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { on } = await request.json();

		if (typeof on !== 'boolean') {
			return json({ error: 'Invalid on parameter - must be boolean' }, { status: 400 });
		}

		const power = on ? 'on' : 'standby';
		const response = await VideoService.setVideoPower('pi-video-01', { power });

		return json(
			{
				success: true,
				power: response.power,
				correlationId: response.jobId,
				message: `Display ${on ? 'powered on' : 'powered off'}`,
			},
			{ status: 202 }
		);
	} catch (error: unknown) {
		if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
			return json(
				{
					error: 'Device busy - please wait for current operation to complete',
					code: 'concurrent_command',
				},
				{ status: 409 }
			);
		}

		console.error('Video power control error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Power control failed' },
			{ status: 500 }
		);
	}
};
