import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	const { deviceId } = params;
	const formData = await request.formData();
	const filename = formData.get('filename');

	try {
		const response = await fetch(`/api/video/devices/${deviceId}/library/play`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename }),
		});

		if (!response.ok) {
			throw new Error(`Play command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Playing ${filename}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Playback failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
