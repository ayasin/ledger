<script lang="ts">
	import Navigation from '$lib/components/Navigation.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import TextInput from '$lib/components/TextInput.svelte';
	import CsvImportModal, { type ImportData } from '$lib/components/CsvImportModal.svelte';
	import { confirm } from '$lib/stores/confirmationStore';
	import { onMount } from 'svelte';

	interface Account {
		id: number;
		code: string;
		name: string;
		type: string;
		description: string | null;
		status: string;
		currency: string;
	}

	let accounts = $state<Account[]>([]);
	let loading = $state(true);
	let addAccountModalOpen = $state(false);
	let editAccountModalOpen = $state(false);
	let viewAccountModalOpen = $state(false);
	let importModalOpen = $state(false);
	let selectedAccount = $state<Account | null>(null);

	let newAccount = $state({
		code: '',
		name: '',
		type: 'asset',
		description: '',
		currency: 'USD'
	});

	let editAccount = $state({
		id: 0,
		code: '',
		name: '',
		type: 'asset',
		description: '',
		currency: 'USD'
	});

	const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];

	onMount(async () => {
		try {
			await fetchAccounts();
		} catch (error) {
			console.error('Error loading accounts:', error);
		} finally {
			loading = false;
		}
	});

	function getAuthHeaders(): HeadersInit {
		const token = localStorage.getItem('auth_token');
		return {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		};
	}

	async function fetchAccounts() {
		try {
			const response = await fetch('/api/accounts?limit=1000&sort=code', {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				console.error('Failed to fetch accounts:', response.status, response.statusText);
				return;
			}

			const data = await response.json();
			if (data.data) {
				accounts = data.data;
			}
		} catch (error) {
			console.error('Failed to fetch accounts:', error);
		}
	}

	async function handleAddAccount() {
		try {
			const response = await fetch('/api/accounts', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					code: newAccount.code,
					name: newAccount.name,
					type: newAccount.type,
					description: newAccount.description || null,
					currency: newAccount.currency,
					status: 'active'
				})
			});

			if (response.ok) {
				addAccountModalOpen = false;
				await fetchAccounts();
				newAccount = {
					code: '',
					name: '',
					type: 'asset',
					description: '',
					currency: 'USD'
				};
			} else {
				const error = await response.json();
				alert(error.error?.message || 'Failed to create account');
			}
		} catch (error) {
			console.error('Failed to create account:', error);
			alert('Failed to create account');
		}
	}

	function handleViewAccount(account: Account) {
		selectedAccount = account;
		viewAccountModalOpen = true;
	}

	function handleEditAccount(account: Account) {
		selectedAccount = account;
		editAccount = {
			id: account.id,
			code: account.code,
			name: account.name,
			type: account.type,
			description: account.description || '',
			currency: account.currency
		};
		editAccountModalOpen = true;
	}

	async function handleUpdateAccount() {
		if (!selectedAccount) return;

		try {
			const payload: any = {
				code: editAccount.code,
				name: editAccount.name,
				type: editAccount.type,
				currency: editAccount.currency
			};

			// Only include description if it has a value
			if (editAccount.description) {
				payload.description = editAccount.description;
			}

			const response = await fetch(`/api/accounts/${selectedAccount.id}`, {
				method: 'PATCH',
				headers: getAuthHeaders(),
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				editAccountModalOpen = false;
				await fetchAccounts();
			} else {
				const error = await response.json();
				console.error('Update account error:', error);
				const errorMessage = error.error?.details
					? `Validation failed: ${JSON.stringify(error.error.details)}`
					: error.error?.message || 'Failed to update account';
				alert(errorMessage);
			}
		} catch (error) {
			console.error('Failed to update account:', error);
			alert('Failed to update account');
		}
	}

	async function handleDeleteAccount(id: number) {
		const confirmed = await confirm(
			'Are you sure you want to delete this account? This action cannot be undone.',
			{
				title: 'Delete Account',
				confirmText: 'Delete',
				cancelText: 'Cancel',
				variant: 'danger'
			}
		);

		if (!confirmed) {
			return;
		}

		try {
			const response = await fetch(`/api/accounts/${id}`, {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to delete account');
				return;
			}

			accounts = accounts.filter(a => a.id !== id);
			editAccountModalOpen = false;
			viewAccountModalOpen = false;
			selectedAccount = null;
		} catch (error) {
			console.error('Failed to delete account:', error);
			alert('Failed to delete account');
		}
	}

	function handleImportClick(account: Account) {
		selectedAccount = account;
		importModalOpen = true;
	}

	async function handleImport(data: ImportData) {
		try {
			const response = await fetch('/api/transactions/import', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify(data)
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to import transactions');
				return;
			}

			const result = await response.json();
			const { success, failed, errors } = result.data;

			let message = `Import completed!\nSuccessful: ${success}\nFailed: ${failed}`;
			if (errors.length > 0) {
				message += '\n\nErrors:\n' + errors.slice(0, 10).join('\n');
				if (errors.length > 10) {
					message += `\n... and ${errors.length - 10} more`;
				}
			}

			alert(message);
			importModalOpen = false;
		} catch (error) {
			console.error('Failed to import transactions:', error);
			alert('Failed to import transactions');
		}
	}

	function getTypeColor(type: string): string {
		switch (type) {
			case 'asset':
				return 'bg-blue-100 text-blue-800';
			case 'liability':
				return 'bg-red-100 text-red-800';
			case 'equity':
				return 'bg-purple-100 text-purple-800';
			case 'revenue':
				return 'bg-green-100 text-green-800';
			case 'expense':
				return 'bg-orange-100 text-orange-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<svelte:head>
	<title>Accounts - Accounting App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Navigation />

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Chart of Accounts</h1>
				<p class="mt-1 text-sm text-gray-600">Manage your accounting accounts</p>
			</div>
			<Button onclick={() => addAccountModalOpen = true}>
				<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add Account
			</Button>
		</div>

		<Card title="All Accounts" subtitle="Your chart of accounts">
			{#if loading}
				<div class="text-center py-12">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					<p class="mt-2 text-sm text-gray-600">Loading accounts...</p>
				</div>
			{:else if accounts.length === 0}
				<div class="text-center py-12">
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No accounts</h3>
					<p class="mt-1 text-sm text-gray-500">Get started by creating your first account.</p>
					<div class="mt-6">
						<Button onclick={() => addAccountModalOpen = true}>
							Add Account
						</Button>
					</div>
				</div>
			{:else}
				<!-- Mobile Card View -->
				<div class="space-y-3 md:hidden">
					{#each accounts as account}
						<div
							class="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
							onclick={() => handleViewAccount(account)}
							role="button"
							tabindex="0"
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewAccount(account); }}
						>
							<div class="flex items-start justify-between mb-3">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-sm font-semibold text-gray-900">{account.code}</span>
										<span class="px-2 py-0.5 text-xs font-semibold rounded-full {getTypeColor(account.type)}">
											{account.type}
										</span>
									</div>
									<div class="text-sm text-gray-900 font-medium mb-1">{account.name}</div>
									<div class="text-xs text-gray-500">{account.currency}</div>
								</div>
								<div class="flex gap-2 ml-2">
									<button
										onclick={(e) => { e.stopPropagation(); handleImportClick(account); }}
										class="text-blue-600 hover:text-blue-900 p-2"
										title="Import CSV"
									>
										<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
										</svg>
									</button>
									<button
										onclick={(e) => { e.stopPropagation(); handleEditAccount(account); }}
										class="text-gray-600 hover:text-gray-900 p-2"
										title="Edit"
									>
										<i class="fas fa-edit"></i>
									</button>
								</div>
							</div>
							{#if account.description}
								<div class="text-xs text-gray-600 truncate">{account.description}</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Desktop Table View -->
				<div class="hidden md:block overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each accounts as account}
								<tr
									class="hover:bg-gray-50 transition-colors cursor-pointer"
									onclick={() => handleViewAccount(account)}
									role="button"
									tabindex="0"
									onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewAccount(account); }}
								>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{account.code}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{account.name}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getTypeColor(account.type)}">
											{account.type}
										</span>
									</td>
									<td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
										{account.description || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
										{account.currency}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
										<div class="flex justify-end gap-3">
											<button
												onclick={(e) => { e.stopPropagation(); handleImportClick(account); }}
												class="text-blue-600 hover:text-blue-900 transition-colors"
												title="Import CSV"
											>
												<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
												</svg>
											</button>
											<button
												onclick={(e) => { e.stopPropagation(); handleEditAccount(account); }}
												class="text-gray-600 hover:text-gray-900 transition-colors"
												title="Edit account"
											>
												<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
												</svg>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>
	</main>
</div>

<Modal bind:open={addAccountModalOpen} title="Add Account">
	<div class="space-y-4">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<TextInput
				label="Account Code"
				type="text"
				placeholder="e.g., 1000"
				bind:value={newAccount.code}
				required
			/>
			<div>
				<label for="new-account-type" class="block text-sm font-medium text-gray-700 mb-2">
					Account Type <span class="text-red-500">*</span>
				</label>
				<select
					id="new-account-type"
					bind:value={newAccount.type}
					class="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
					required
				>
					{#each accountTypes as type}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</div>
		</div>

		<TextInput
			label="Account Name"
			type="text"
			placeholder="e.g., Cash in Bank"
			bind:value={newAccount.name}
			required
		/>

		<TextInput
			label="Description"
			type="text"
			placeholder="Optional description"
			bind:value={newAccount.description}
		/>

		<TextInput
			label="Currency"
			type="text"
			placeholder="USD"
			bind:value={newAccount.currency}
			required
		/>
	</div>

	{#snippet footer()}
		<Button variant="outline" onclick={() => addAccountModalOpen = false}>
			Cancel
		</Button>
		<Button onclick={handleAddAccount}>
			Create Account
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={editAccountModalOpen} title="Edit Account">
	<div class="space-y-4">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<TextInput
				label="Account Code"
				type="text"
				placeholder="e.g., 1000"
				bind:value={editAccount.code}
				required
			/>
			<div>
				<label for="edit-account-type" class="block text-sm font-medium text-gray-700 mb-2">
					Account Type <span class="text-red-500">*</span>
				</label>
				<select
					id="edit-account-type"
					bind:value={editAccount.type}
					class="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
					required
				>
					{#each accountTypes as type}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</div>
		</div>

		<TextInput
			label="Account Name"
			type="text"
			placeholder="e.g., Cash in Bank"
			bind:value={editAccount.name}
			required
		/>

		<TextInput
			label="Description"
			type="text"
			placeholder="Optional description"
			bind:value={editAccount.description}
		/>

		<TextInput
			label="Currency"
			type="text"
			placeholder="USD"
			bind:value={editAccount.currency}
			required
		/>
	</div>

	{#snippet footer()}
		<div class="flex justify-between items-center w-full">
			<Button
				variant="outline"
				onclick={() => handleDeleteAccount(editAccount.id)}
				class="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
			>
				<i class="fas fa-trash mr-2"></i>
				Delete
			</Button>
			<div class="flex gap-3">
				<Button variant="outline" onclick={() => editAccountModalOpen = false}>
					Cancel
				</Button>
				<Button onclick={handleUpdateAccount}>
					Update Account
				</Button>
			</div>
		</div>
	{/snippet}
</Modal>

<Modal bind:open={viewAccountModalOpen} title="Account Details">
	{#if selectedAccount}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Account Code</div>
					<p class="text-sm text-gray-900">{selectedAccount.code}</p>
				</div>
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Account Type</div>
					<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getTypeColor(selectedAccount.type)}">
						{selectedAccount.type}
					</span>
				</div>
			</div>

			<div>
				<div class="block text-sm font-medium text-gray-700 mb-1">Account Name</div>
				<p class="text-sm text-gray-900">{selectedAccount.name}</p>
			</div>

			<div>
				<div class="block text-sm font-medium text-gray-700 mb-1">Description</div>
				<p class="text-sm text-gray-900">{selectedAccount.description || '-'}</p>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Currency</div>
					<p class="text-sm text-gray-900">{selectedAccount.currency}</p>
				</div>
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Status</div>
					<p class="text-sm text-gray-900">{selectedAccount.status}</p>
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="outline" onclick={() => viewAccountModalOpen = false}>
			Close
		</Button>
	{/snippet}
</Modal>

<CsvImportModal
	bind:open={importModalOpen}
	accountId={selectedAccount?.id}
	accountName={selectedAccount?.name}
	onimport={handleImport}
/>
