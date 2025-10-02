<script>
	import { onMount } from 'svelte';

	let toast = '';
	let toastType = 'info'; // info, success, error

	function showToast(message, type = 'info') {
		toast = message;
		toastType = type;
		setTimeout(() => (toast = ''), 5000);
	}

	// Expose to window for HTMX responses
	onMount(() => {
		window.showToast = showToast;

		// Listen for HTMX toast triggers from server
		document.body.addEventListener('showToast', (event) => {
			const detail = event.detail;
			showToast(detail.message, detail.type || 'info');
		});

		// Listen for library refresh triggers
		document.body.addEventListener('refresh-library', () => {
			const videoLibrary = document.getElementById('video-library-pi-video-01');
			if (videoLibrary) {
				htmx.trigger(videoLibrary, 'refresh');
			}
		});
	});
</script>

<svelte:head>
	<title>Fleet Control</title>
	<script src="https://unpkg.com/htmx.org@1.9.10"></script>
	<script src="https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js" defer></script>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100">
	<!-- Toast Notifications -->
	{#if toast}
		<div
			class="fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg animate-slide-in {toastType ===
			'error'
				? 'bg-red-600'
				: toastType === 'success'
					? 'bg-green-600'
					: 'bg-blue-600'}"
		>
			{toast}
		</div>
	{/if}

	<!-- Header -->
	<header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
		<div class="container mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold">Fleet Control</h1>
					<p class="text-sm text-slate-400">Mission Control Dashboard</p>
				</div>
				<div
					id="fleet-status"
					hx-get="/new/status"
					hx-trigger="load, every 10s"
					hx-swap="innerHTML"
					class="text-right"
				>
					<div class="text-sm text-slate-400">Loading...</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="container mx-auto px-4 py-6">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Audio Control -->
			<section class="bg-slate-900 rounded-lg border border-slate-800 p-6">
				<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
					<span class="text-2xl">🔊</span>
					Audio Control
				</h2>

				<div
					id="audio-controls"
					hx-get="/new/audio/pi-audio-01"
					hx-trigger="load"
					hx-swap="innerHTML"
					class="space-y-3"
				>
					<div class="text-slate-400">Loading...</div>
				</div>
			</section>

			<!-- Video Control -->
			<section class="bg-slate-900 rounded-lg border border-slate-800 p-6">
				<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
					<span class="text-2xl">📺</span>
					Video Control
				</h2>

				<div
					id="video-controls"
					hx-get="/new/video/pi-video-01"
					hx-trigger="load"
					hx-swap="innerHTML"
					class="space-y-3"
				>
					<div class="text-slate-400">Loading...</div>
				</div>
			</section>

			<!-- Camera Control -->
			<section class="bg-slate-900 rounded-lg border border-slate-800 p-6">
				<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
					<span class="text-2xl">📷</span>
					Camera
				</h2>

				<div
					id="camera-controls"
					hx-get="/new/camera/pi-camera-01"
					hx-trigger="load"
					hx-swap="innerHTML"
					class="space-y-3"
				>
					<div class="text-slate-400">Loading...</div>
				</div>
			</section>

			<!-- Zigbee Control -->
			<section class="bg-slate-900 rounded-lg border border-slate-800 p-6">
				<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
					<span class="text-2xl">💡</span>
					Zigbee
				</h2>

				<div
					id="zigbee-controls"
					hx-get="/new/zigbee"
					hx-trigger="load"
					hx-swap="innerHTML"
					class="space-y-3"
				>
					<div class="text-slate-400">Loading...</div>
				</div>
			</section>
		</div>

		<!-- Logs -->
		<section class="mt-6 bg-slate-900 rounded-lg border border-slate-800 p-6">
			<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
				<span class="text-2xl">📋</span>
				Recent Logs
			</h2>

			<div
				id="logs-stream"
				hx-get="/new/logs"
				hx-trigger="load, every 5s"
				hx-swap="innerHTML"
				class="space-y-2 max-h-64 overflow-y-auto"
			>
				<div class="text-slate-400">Loading...</div>
			</div>
		</section>
	</main>
</div>

<style>
	@keyframes slide-in {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-slide-in {
		animation: slide-in 0.3s ease-out;
	}
</style>
