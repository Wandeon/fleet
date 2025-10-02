import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	const { deviceId } = params;
	const formData = await request.formData();
	const enabled = formData.get('enabled') === 'true';

	try {
		const response = await fetch(`/api/camera/devices/${deviceId}/night-mode`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled }),
		});

		if (!response.ok) {
			throw new Error(`Night mode command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Night mode ${enabled ? 'enabled' : 'disabled'}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Night mode command failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
