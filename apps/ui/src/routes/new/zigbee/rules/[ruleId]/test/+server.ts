import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, fetch }) => {
	const { ruleId } = params;

	try {
		const response = await fetch(`/api/zigbee/rules/${ruleId}/test`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Test rule failed: ${response.statusText}`);
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Rule test triggered", "type": "success"}}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Test failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
