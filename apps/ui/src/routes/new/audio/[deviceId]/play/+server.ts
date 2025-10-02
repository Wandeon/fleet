import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/audio/devices/${deviceId}/play`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Play command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Playing audio", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Play failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
