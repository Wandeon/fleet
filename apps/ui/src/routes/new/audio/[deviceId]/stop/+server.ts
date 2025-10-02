import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/audio/devices/${deviceId}/stop`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Stop command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Audio stopped", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Stop failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
