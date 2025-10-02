import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	const { deviceId } = params;
	const formData = await request.formData();
	const power = formData.get('power');

	try {
		const response = await fetch(`/api/video/devices/${deviceId}/power`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ power }),
		});

		if (!response.ok) {
			throw new Error(`Power command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "TV power ${power}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Power command failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
