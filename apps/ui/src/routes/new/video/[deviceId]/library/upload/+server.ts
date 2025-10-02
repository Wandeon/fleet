import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	const { deviceId } = params;

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			throw new Error('No file provided');
		}

		if (file.size > 500 * 1024 * 1024) {
			throw new Error('File too large (max 500MB)');
		}

		const uploadFormData = new FormData();
		uploadFormData.append('file', file);

		const response = await fetch(`/api/video/devices/${deviceId}/library/upload`, {
			method: 'POST',
			body: uploadFormData,
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: response.statusText }));
			throw new Error(error.message || 'Upload failed');
		}

		return new Response(null, {
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Uploaded ${file.name}", "type": "success"}, "refresh-library": true}`,
			},
		});
	} catch (error) {
		return new Response(null, {
			status: 500,
			headers: {
				'HX-Trigger': `{"showToast": {"message": "Upload failed: ${error}", "type": "error"}}`,
			},
		});
	}
};
