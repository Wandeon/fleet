import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, fetch }) => {
	const { deviceId } = params;

	try {
		const response = await fetch(`/api/zigbee/devices/${deviceId}`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			throw new Error(`Remove command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Device removed", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Remove failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
