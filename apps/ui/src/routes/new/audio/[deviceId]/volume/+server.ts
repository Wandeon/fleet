import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	const { deviceId } = params;
	const formData = await request.formData();
	const volume = formData.get('volume');

	try {
		const response = await fetch(`/api/audio/devices/${deviceId}/volume`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ volume: Number(volume) }),
		});

		if (!response.ok) {
			throw new Error(`Volume command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Volume set to ${volume}%", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Volume change failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
