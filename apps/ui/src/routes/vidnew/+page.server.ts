import { env } from '$env/dynamic/private';

const API_BASE = 'http://pi-video-01:8082';
const API_TOKEN = env.HDMI_PI_VIDEO_01_TOKEN || 'changeme-token';

async function apiCall(endpoint: string, method = 'GET', body: any = null) {
	const options: RequestInit = {
		method,
		headers: {
			Authorization: `Bearer ${API_TOKEN}`
		}
	};

	if (body && !(body instanceof FormData)) {
		options.headers = { ...options.headers, 'Content-Type': 'application/json' };
		options.body = JSON.stringify(body);
	} else if (body instanceof FormData) {
		options.body = body;
	}

	const response = await fetch(`${API_BASE}${endpoint}`, options);

	if (!response.ok) {
		throw new Error(`API error: ${response.status} ${response.statusText}`);
	}

	const contentType = response.headers.get('content-type');
	if (contentType?.includes('application/json')) {
		return await response.json();
	}

	return await response.text();
}

export async function load() {
	try {
		const [status, libraryData] = await Promise.all([
			apiCall('/status'),
			apiCall('/library')
		]);

		return {
			status,
			library: libraryData.videos || []
		};
	} catch (error) {
		console.error('Failed to load initial data:', error);
		return {
			status: { pause: false, time_pos: 0, duration: 0, volume: 100, path: '' },
			library: []
		};
	}
}

export const actions = {
	status: async () => {
		try {
			const status = await apiCall('/status');
			return { success: true, status };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	tvPowerOn: async () => {
		try {
			await apiCall('/tv/power_on', 'POST');
			return { success: true, message: 'TV Power On command sent' };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	tvPowerOff: async () => {
		try {
			await apiCall('/tv/power_off', 'POST');
			return { success: true, message: 'TV Power Off command sent' };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	tvInput: async () => {
		try {
			await apiCall('/tv/input', 'POST');
			return { success: true, message: 'TV Input switch command sent' };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	play: async ({ request }) => {
		const data = await request.formData();
		const url = data.get('url');

		try {
			await apiCall('/play', 'POST', { url });
			return { success: true, message: `Playing: ${url}` };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	stop: async () => {
		try {
			await apiCall('/stop', 'POST');
			return { success: true, message: 'Playback stopped' };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	pause: async () => {
		try {
			await apiCall('/pause', 'POST');
			return { success: true, message: 'Playback paused' };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	resume: async () => {
		try {
			await apiCall('/resume', 'POST');
			return { success: true, message: 'Playback resumed' };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	loadLibrary: async () => {
		try {
			const data = await apiCall('/library');
			return { success: true, library: data.videos || [] };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	deleteFile: async ({ request }) => {
		const data = await request.formData();
		const filename = data.get('filename');

		try {
			await apiCall(`/library/${filename}`, 'DELETE');
			return { success: true, message: `Deleted: ${filename}` };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	},

	uploadFile: async ({ request }) => {
		const data = await request.formData();
		const file = data.get('file') as File;

		if (!file || !file.name) {
			return { success: false, error: 'No file selected' };
		}

		try {
			const uploadData = new FormData();
			uploadData.append('file', file);
			await apiCall('/library/upload', 'POST', uploadData);
			const libraryData = await apiCall('/library');
			return { success: true, message: `Uploaded: ${file.name}`, library: libraryData.videos || [] };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	}
};
