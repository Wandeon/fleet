import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/zigbee/devices/${deviceId}/toggle`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Toggle command failed: ${response.statusText}`);
		}

		const data = await response.json();
		const state = data.state || 'unknown';

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Device ${state}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Toggle failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
