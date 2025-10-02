import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VideoService } from '$lib/api/gen';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { mute } = await request.json();

		if (typeof mute !== 'boolean') {
			return json({ error: 'Invalid mute parameter - must be boolean' }, { status: 400 });
		}

		const response = await VideoService.setVideoMute('pi-video-01', { mute });

		return json(
			{
				success: true,
				mute: response.mute,
				correlationId: response.jobId,
				message: mute ? 'Muted output' : 'Unmuted output',
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

		console.error('Video mute control error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Mute control failed' },
			{ status: 500 }
		);
	}
};
