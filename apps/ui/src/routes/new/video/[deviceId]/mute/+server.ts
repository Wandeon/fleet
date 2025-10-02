import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	const { deviceId } = params;
	const formData = await request.formData();
	const mute = formData.get('mute') === 'true';

	try {
		const response = await fetch(`/api/video/devices/${deviceId}/mute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mute }),
		});

		if (!response.ok) {
			throw new Error(`Mute command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "${mute ? 'Muted' : 'Unmuted'}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Mute command failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
