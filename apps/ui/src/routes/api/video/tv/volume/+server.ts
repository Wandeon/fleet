import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VideoService } from '$lib/api/gen';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { volume } = await request.json();

		if (typeof volume !== 'number' || volume < 0 || volume > 100) {
			return json(
				{ error: 'Invalid volume parameter - must be number between 0 and 100' },
				{ status: 400 }
			);
		}

		const response = await VideoService.setVideoVolume('pi-video-01', {
			volumePercent: Math.round(volume),
		});

		return json(
			{
				success: true,
				volume: response.volumePercent,
				correlationId: response.jobId,
				message: `Volume set to ${volume}%`,
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

		console.error('Video volume control error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Volume control failed' },
			{ status: 500 }
		);
	}
};
