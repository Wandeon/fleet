import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const formData = await request.formData();
	const device = formData.get('device') || 'all';
	const level = formData.get('level') || 'all';

	try {
		const response = await fetch(`/api/logs/export?device=${device}&level=${level}`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Export failed: ${response.statusText}`);
		}

		const data = await response.json();
		const filename = data.filename || 'logs.csv';

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Exported to ${filename}", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Export failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
