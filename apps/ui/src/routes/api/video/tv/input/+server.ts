import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VideoService } from '$lib/api/gen';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { input } = await request.json();

		if (typeof input !== 'string' || !input.trim()) {
			return json({ error: 'Invalid input parameter - must be non-empty string' }, { status: 400 });
		}

		const response = await VideoService.setVideoInput('pi-video-01', { input });

		return json(
			{
				success: true,
				input: response.input,
				correlationId: response.jobId,
				message: `Switched to ${input}`,
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

		console.error('Video input control error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Input control failed' },
			{ status: 500 }
		);
	}
};
