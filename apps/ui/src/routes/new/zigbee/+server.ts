import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const response = await fetch(`/api/zigbee/status`);
		const data = await response.json();

		const isOnline = data.status === 'online';
		const devices = data.devices || [];
		const rules = data.automationRules || [];

		const html = `
			<!-- Coordinator Status -->
			<div class="flex items-center gap-2 text-sm mb-3">
				<div class="w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}"></div>
				<span class="${isOnline ? 'text-green-400' : 'text-red-400'}">
					Coordinator ${isOnline ? 'Online' : 'Offline'}
				</span>
			</div>

			${
				!isOnline
					? `
				<div class="bg-amber-900/30 border border-amber-600/50 rounded p-3 text-amber-200 text-sm mb-3">
					⚠️ Zigbee coordinator offline
				</div>
			`
					: ''
			}

			<!-- Pairing Mode -->
			<div class="flex items-center justify-between p-3 bg-slate-800 rounded">
				<div>
					<div class="text-sm font-medium">Pairing Mode</div>
					<div class="text-xs text-slate-400">Allow new devices to join</div>
				</div>
				<button
					hx-post="/new/zigbee/pairing"
					hx-vals='{"duration": 60}'
					hx-swap="none"
					${!isOnline ? 'disabled' : ''}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded transition"
				>
					Enable (60s)
				</button>
			</div>

			<!-- Devices List -->
			<div class="border-t border-slate-800 pt-3 mt-3">
				<div class="text-sm font-medium mb-2">Devices (${devices.length})</div>
				${
					devices.length === 0
						? `<div class="text-slate-400 text-sm">No devices paired</div>`
						: `
					<div class="space-y-2">
						${devices
							.map(
								(dev: any) => `
							<div class="flex items-center justify-between p-2 bg-slate-800 rounded">
								<div>
									<div class="text-sm">${dev.name || dev.id}</div>
									<div class="text-xs text-slate-400">${dev.type || 'Unknown'}</div>
								</div>
								<div class="flex gap-2">
									${
										dev.type === 'light'
											? `
										<button
											hx-post="/new/zigbee/devices/${dev.id}/toggle"
											hx-swap="none"
											class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
										>
											${dev.state === 'on' ? '💡 On' : '⚪ Off'}
										</button>
									`
											: ''
									}
									<button
										hx-delete="/new/zigbee/devices/${dev.id}"
										hx-confirm="Remove ${dev.name || dev.id}?"
										hx-swap="none"
										class="text-xs px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded"
									>
										Remove
									</button>
								</div>
							</div>
						`
							)
							.join('')}
					</div>
				`
				}
			</div>

			<!-- Automation Rules -->
			<div class="border-t border-slate-800 pt-3 mt-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Automation Rules</span>
					<button
						${!isOnline ? 'disabled' : ''}
						class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded"
						onclick="window.showToast('Rule creation coming soon', 'info')"
					>
						+ Create
					</button>
				</div>
				${
					rules.length === 0
						? `<div class="text-slate-400 text-sm">No automation rules</div>`
						: `
					<div class="space-y-2">
						${rules
							.map(
								(rule: any) => `
							<div class="flex items-center justify-between p-2 bg-slate-800 rounded">
								<div>
									<div class="text-sm">${rule.name}</div>
									<div class="text-xs text-slate-400">${rule.description || ''}</div>
								</div>
								<div class="flex gap-2">
									<button
										hx-post="/new/zigbee/rules/${rule.id}/toggle"
										hx-swap="none"
										class="text-xs px-2 py-1 ${rule.enabled ? 'bg-green-600' : 'bg-slate-700'} hover:bg-slate-600 rounded"
									>
										${rule.enabled ? '✓ Enabled' : '✗ Disabled'}
									</button>
									<button
										hx-post="/new/zigbee/rules/${rule.id}/test"
										hx-swap="none"
										class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
									>
										Test
									</button>
								</div>
							</div>
						`
							)
							.join('')}
					</div>
				`
				}
			</div>
		`;

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' },
		});
	} catch (error) {
		return new Response(
			`<div class="text-red-400">Error loading zigbee controls: ${error}</div>`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	}
};
