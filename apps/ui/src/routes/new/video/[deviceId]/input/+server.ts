import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	const { deviceId } = params;
	const formData = await request.formData();
	const input = formData.get('input');

	try {
		const response = await fetch(`/api/video/devices/${deviceId}/input`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ input }),
		});

		if (!response.ok) {
			throw new Error(`Input command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Switched to ${input}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Input change failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
