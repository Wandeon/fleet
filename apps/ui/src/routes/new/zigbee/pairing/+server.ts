import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const formData = await request.formData();
	const duration = Number(formData.get('duration')) || 60;

	try {
		const response = await fetch(`/api/zigbee/pairing`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ duration }),
		});

		if (!response.ok) {
			throw new Error(`Pairing command failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Pairing mode enabled for ${duration}s", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Pairing failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
