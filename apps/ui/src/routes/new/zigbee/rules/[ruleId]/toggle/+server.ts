import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, fetch }) => {
	const { ruleId } = params;

	try {
		const response = await fetch(`/api/zigbee/rules/${ruleId}/toggle`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Toggle rule failed: ${response.statusText}`);
		}

		const data = await response.json();
		const enabled = data.enabled || false;

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Rule ${enabled ? 'enabled' : 'disabled'}", "type": "success"}}`,
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
