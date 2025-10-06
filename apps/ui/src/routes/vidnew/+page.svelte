<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, onDestroy } from 'svelte';
	import type { PageData, ActionData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	let status = data.status || {
		pause: false,
		time_pos: 0,
		duration: 0,
		volume: 100,
		path: ''
	};

	let library = data.library || [];
	let selectedFile: string | null = null;
	let tvMessage = '';
	let videoMessage = '';
	let uploadMessage = '';
	let statusInterval: number;
	let isRefreshing = false;

	$: if (form) {
		if (form.status) {
			status = form.status;
		}
		if (form.library) {
			library = form.library;
		}
		if (form.message) {
			const action = (form as any).action || 'video';
			showMessage(action, form.message);
		}
		if (form.error) {
			const action = (form as any).action || 'video';
			showMessage(action, 'Error: ' + form.error);
		}
	}

	function showMessage(type: 'tv' | 'video' | 'upload', message: string) {
		if (type === 'tv') tvMessage = message;
		if (type === 'video') videoMessage = message;
		if (type === 'upload') uploadMessage = message;

		setTimeout(() => {
			if (type === 'tv') tvMessage = '';
			if (type === 'video') videoMessage = '';
			if (type === 'upload') uploadMessage = '';
		}, 5000);
	}

	function formatTime(seconds: number | null): string {
		if (!seconds) return '-';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function selectFile(path: string) {
		selectedFile = path;
		showMessage('video', 'Selected: ' + path.split('/').pop());
	}

	onMount(() => {
		statusInterval = setInterval(async () => {
			if (isRefreshing) return;
			isRefreshing = true;
			try {
				const response = await fetch('?/status', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
				});
				const result = await response.json();
				if (result.type === 'success' && result.data?.status) {
					status = result.data.status;
				}
			} catch (error) {
				console.error('Failed to refresh status:', error);
			} finally {
				isRefreshing = false;
			}
		}, 3000) as any;
	});

	onDestroy(() => {
		if (statusInterval) clearInterval(statusInterval);
	});
</script>

<svelte:head>
	<title>Video Player Control</title>
</svelte:head>

<div class="container">
	<h1>Video Player Control</h1>

	<!-- Current Status -->
	<div class="section">
		<h2>Current Status</h2>
		<div class="status-display">
			<div><span class="label">Status:</span> <span class="value">{status.pause ? 'Paused' : 'Playing'}</span></div>
			<div><span class="label">File:</span> <span class="value">{status.path ? status.path.split('/').pop() : '-'}</span></div>
			<div><span class="label">Position:</span> <span class="value">{formatTime(status.time_pos)}</span></div>
			<div><span class="label">Duration:</span> <span class="value">{formatTime(status.duration)}</span></div>
			<div><span class="label">Volume:</span> <span class="value">{status.volume}%</span></div>
		</div>
		<form method="POST" action="?/status" use:enhance>
			<button type="submit">Refresh Status</button>
		</form>
	</div>

	<!-- TV Controls -->
	<div class="section">
		<h2>TV Controls</h2>
		<p class="description">Control TV via HDMI-CEC</p>
		<div class="button-group">
			<form method="POST" action="?/tvPowerOn" use:enhance>
				<button type="submit">Power On</button>
			</form>
			<form method="POST" action="?/tvPowerOff" use:enhance>
				<button type="submit">Power Off</button>
			</form>
			<form method="POST" action="?/tvInput" use:enhance>
				<button type="submit">Switch Input</button>
			</form>
			<button disabled>Volume Up (Not Available)</button>
			<button disabled>Volume Down (Not Available)</button>
		</div>
		{#if tvMessage}
			<div class="message success">{tvMessage}</div>
		{/if}
	</div>

	<!-- Video Controls -->
	<div class="section">
		<h2>Video Controls</h2>
		<p class="description">Control video playback</p>
		<div class="button-group">
			<form method="POST" action="?/play" use:enhance>
				<input type="hidden" name="url" value={selectedFile || ''}>
				<button type="submit" disabled={!selectedFile}>Play Selected</button>
			</form>
			<form method="POST" action="?/stop" use:enhance>
				<button type="submit">Stop</button>
			</form>
			<form method="POST" action="?/pause" use:enhance>
				<button type="submit">Pause</button>
			</form>
			<form method="POST" action="?/resume" use:enhance>
				<button type="submit">Resume</button>
			</form>
		</div>
		{#if videoMessage}
			<div class="message success">{videoMessage}</div>
		{/if}
	</div>

	<!-- File Manager -->
	<div class="section">
		<h2>File Manager</h2>
		<p class="description">Upload and manage video files</p>

		<div class="button-group">
			<form method="POST" action="?/uploadFile" enctype="multipart/form-data" use:enhance={() => {
				uploadMessage = 'Uploading...';
				return async ({ result, update }) => {
					await update();
					uploadMessage = '';
				};
			}} id="upload-form">
				<label for="file-upload" class="file-input-label">Choose File to Upload</label>
				<input type="file" id="file-upload" name="file" accept="video/*" style="display: none;" on:change={(e) => (e.target as HTMLInputElement).form?.submit()}>
			</form>
			<form method="POST" action="?/loadLibrary" use:enhance>
				<button type="submit">Refresh Library</button>
			</form>
		</div>

		{#if uploadMessage}
			<div class="message success">{uploadMessage}</div>
		{/if}

		<div class="file-list">
			{#if library.length === 0}
				<p class="description">No files in library</p>
			{:else}
				{#each library as file}
					<div class="file-item">
						<span class="file-name">{file.filename}</span>
						<span class="file-size">{formatSize(file.size)}</span>
						<button on:click={() => selectFile(file.path)} class:selected={selectedFile === file.path}>
							{selectedFile === file.path ? '✓ Selected' : 'Select'}
						</button>
						<form method="POST" action="?/deleteFile" use:enhance style="display: inline;" on:submit={(e) => {
							if (!confirm(`Delete ${file.filename}?`)) e.preventDefault();
						}}>
							<input type="hidden" name="filename" value={file.filename}>
							<button type="submit">Delete</button>
						</form>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	:global(body) {
		background: #000;
		color: #fff;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}

	h1 {
		font-size: 24px;
		margin-bottom: 30px;
		font-weight: 600;
	}

	.section {
		background: #111;
		border: 1px solid #333;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 20px;
	}

	.section h2 {
		font-size: 18px;
		margin-bottom: 15px;
		color: #fff;
		font-weight: 500;
	}

	.status-display {
		background: #000;
		border: 1px solid #333;
		padding: 15px;
		border-radius: 4px;
		margin-bottom: 15px;
		font-family: 'Courier New', monospace;
		font-size: 13px;
	}

	.status-display .label {
		color: #888;
		display: inline-block;
		width: 100px;
	}

	.status-display .value {
		color: #fff;
	}

	.button-group {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 15px;
	}

	form {
		display: inline;
	}

	button {
		background: #fff;
		color: #000;
		border: 1px solid #fff;
		padding: 10px 20px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	button:hover:not(:disabled) {
		background: #000;
		color: #fff;
	}

	button:active:not(:disabled) {
		transform: scale(0.98);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	button.selected {
		background: #4ade80;
		color: #000;
		border-color: #4ade80;
	}

	.file-input-label {
		background: #fff;
		color: #000;
		border: 1px solid #fff;
		padding: 10px 20px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		display: inline-block;
		transition: all 0.2s;
	}

	.file-input-label:hover {
		background: #000;
		color: #fff;
	}

	.file-list {
		margin-top: 15px;
	}

	.file-item {
		background: #000;
		border: 1px solid #333;
		padding: 12px 15px;
		margin-bottom: 8px;
		border-radius: 4px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.file-item .file-name {
		font-size: 14px;
		flex: 1;
	}

	.file-item .file-size {
		color: #888;
		font-size: 12px;
		margin-right: 15px;
	}

	.file-item button {
		padding: 6px 12px;
		font-size: 12px;
	}

	.message {
		padding: 10px 15px;
		border-radius: 4px;
		margin-bottom: 15px;
		font-size: 14px;
		background: #0a4a0a;
		border: 1px solid #0f6e0f;
		color: #4ade80;
	}

	.description {
		color: #888;
		font-size: 13px;
		margin-bottom: 10px;
	}
</style>
