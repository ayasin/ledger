<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import TextInput from './TextInput.svelte';
	import Typeahead from './Typeahead.svelte';
	import { parseQuery, buildQueryString } from '$lib/utils/queryParser';

	interface Transaction {
		id: number;
		transaction_date: Date;
		account_id: number;
		counterparty?: string | null;
		total_cents: number;
		lines?: TransactionLine[];
		tags?: Tag[];
	}

	interface TransactionLine {
		id: number;
		transaction_id: number;
		category_id?: number | null;
		description: string | null;
		amount_cents: number;
	}

	interface Tag {
		id: number;
		name: string;
		color: string | null;
	}

	interface Category {
		id: number;
		name: string;
		type: string | null;
		parent_id: number | null;
	}

	interface Props {
		open?: boolean;
		categories: Category[];
		tags: Tag[];
		getAuthHeaders: () => HeadersInit;
		onComplete?: () => void;
		createCategory?: (name: string) => Promise<Category>;
		createTag?: (name: string) => Promise<Tag>;
	}

	let {
		open = $bindable(false),
		categories,
		tags,
		getAuthHeaders,
		onComplete,
		createCategory,
		createTag
	}: Props = $props();

	let filterQuery = $state('');
	let selectedCategory = $state<Category | null>(null);
	let selectedTags = $state<Tag[]>([]);
	let matchingTransactions = $state<Transaction[]>([]);
	let eligibleTransactions = $state<Transaction[]>([]);
	let loading = $state(false);
	let applying = $state(false);
	let appliedCount = $state(0);
	let errorMessage = $state('');

	// Debounced filter effect
	let filterTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (open) {
			const currentQuery = filterQuery;

			if (filterTimeout) {
				clearTimeout(filterTimeout);
			}

			filterTimeout = setTimeout(() => {
				fetchMatchingTransactions();
				filterTimeout = null;
			}, 500);
		}

		return () => {
			if (filterTimeout) {
				clearTimeout(filterTimeout);
			}
		};
	});

	// Reset state when modal opens
	$effect(() => {
		if (open) {
			filterQuery = '';
			selectedCategory = null;
			selectedTags = [];
			matchingTransactions = [];
			eligibleTransactions = [];
			appliedCount = 0;
			errorMessage = '';
		}
	});

	async function fetchMatchingTransactions() {
		if (!filterQuery.trim()) {
			matchingTransactions = [];
			eligibleTransactions = [];
			return;
		}

		loading = true;
		errorMessage = '';

		try {
			const parsed = parseQuery(filterQuery);
			const queryString = buildQueryString(parsed);

			// Fetch with high limit to get all matching transactions
			const url = `/api/transactions?limit=10000&sort=transaction_date&order=desc${queryString ? '&' + queryString : ''}`;

			const response = await fetch(url, {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				console.error('Failed to fetch transactions:', response.status, response.statusText);
				return;
			}

			const data = await response.json();
			if (data.data) {
				matchingTransactions = data.data;
				// Filter to only transactions with exactly 1 line and no category set
				eligibleTransactions = matchingTransactions.filter((t: Transaction) => {
					if (!t.lines || t.lines.length !== 1) return false;
					const line = t.lines[0];
					return !line.category_id;
				});
			}
		} catch (error) {
			console.error('Failed to fetch transactions:', error);
			errorMessage = 'Failed to fetch transactions';
		} finally {
			loading = false;
		}
	}

	async function handleApply() {
		if (eligibleTransactions.length === 0) {
			errorMessage = 'No eligible transactions to update';
			return;
		}

		if (!selectedCategory && selectedTags.length === 0) {
			errorMessage = 'Please select a category or tags to apply';
			return;
		}

		applying = true;
		appliedCount = 0;
		errorMessage = '';

		try {
			for (const transaction of eligibleTransactions) {
				try {
					// Update category on the transaction line if a category is selected
					if (selectedCategory && transaction.lines && transaction.lines.length === 1) {
						const line = transaction.lines[0];
						const payload = {
							lines: [{
								amount_cents: line.amount_cents,
								category_id: selectedCategory.id,
								description: line.description || null
							}]
						};

						const response = await fetch(`/api/transactions/${transaction.id}`, {
							method: 'PATCH',
							headers: getAuthHeaders(),
							body: JSON.stringify(payload)
						});

						if (!response.ok) {
							console.error(`Failed to update transaction ${transaction.id}:`, await response.text());
							continue;
						}
					}

					// Update tags if any are selected
					if (selectedTags.length > 0) {
						// Merge existing tags with new tags (avoid duplicates)
						const existingTagIds = transaction.tags?.map(t => t.id) || [];
						const newTagIds = selectedTags.map(t => t.id);
						const allTagIds = [...new Set([...existingTagIds, ...newTagIds])];

						const tagResponse = await fetch(`/api/transactions/${transaction.id}/tags`, {
							method: 'PUT',
							headers: getAuthHeaders(),
							body: JSON.stringify({ tag_ids: allTagIds })
						});

						if (!tagResponse.ok) {
							console.error(`Failed to update tags for transaction ${transaction.id}:`, await tagResponse.text());
							continue;
						}
					}

					appliedCount++;
				} catch (err) {
					console.error(`Error updating transaction ${transaction.id}:`, err);
				}
			}

			// After applying, refresh the list to show updated counts
			await fetchMatchingTransactions();

			if (appliedCount > 0) {
				onComplete?.();
			}
		} catch (error) {
			console.error('Failed to apply batch edit:', error);
			errorMessage = 'Failed to apply batch edit';
		} finally {
			applying = false;
		}
	}

	function handleClose() {
		open = false;
	}
</script>

<Modal bind:open title="Batch Edit Transactions">
	<div class="space-y-6">
		<!-- Filter Section -->
		<div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
			<h3 class="text-sm font-medium text-gray-900 mb-3">Filter Transactions</h3>
			<TextInput
				label=""
				type="text"
				placeholder='category:- and counterparty:amazon'
				bind:value={filterQuery}
			/>
			<p class="mt-2 text-xs text-gray-500">
				Filter by <code class="bg-gray-100 px-1 py-0.5 rounded">category:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">tag:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">account:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">counterparty:</code>. Use <code class="bg-gray-100 px-1 py-0.5 rounded">:-</code> for empty values.
			</p>

			<!-- Results Summary -->
			<div class="mt-4 p-3 bg-white rounded border border-gray-200">
				{#if loading}
					<div class="flex items-center gap-2 text-sm text-gray-600">
						<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
						Searching...
					</div>
				{:else if filterQuery.trim()}
					<div class="text-sm">
						<div class="text-gray-600">
							<span class="font-medium">{matchingTransactions.length}</span> transactions match filter
						</div>
						<div class="text-gray-900 mt-1">
							<span class="font-semibold text-blue-600">{eligibleTransactions.length}</span> eligible for batch edit
							<span class="text-gray-500 text-xs">(single line, no category)</span>
						</div>
					</div>
				{:else}
					<div class="text-sm text-gray-500">
						Enter a filter to find transactions
					</div>
				{/if}
			</div>
		</div>

		<!-- Apply Section -->
		<div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
			<h3 class="text-sm font-medium text-blue-900 mb-3">Apply to Eligible Transactions</h3>

			<div class="space-y-4">
				<Typeahead
					label="Category"
					placeholder="Select category to apply..."
					bind:value={selectedCategory}
					options={categories}
					displayField="name"
					valueField="id"
					creatable={!!createCategory}
					onCreate={createCategory}
				/>

				<Typeahead
					label="Tags"
					placeholder="Select tags to apply..."
					bind:value={selectedTags}
					options={tags}
					displayField="name"
					valueField="id"
					multiple={true}
					creatable={!!createTag}
					onCreate={createTag}
				/>
			</div>

			{#if appliedCount > 0}
				<div class="mt-4 p-3 bg-green-100 border border-green-200 rounded text-sm text-green-800">
					Successfully updated {appliedCount} transaction{appliedCount !== 1 ? 's' : ''}
				</div>
			{/if}

			{#if errorMessage}
				<div class="mt-4 p-3 bg-red-100 border border-red-200 rounded text-sm text-red-800">
					{errorMessage}
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" onclick={handleClose}>
			Close
		</Button>
		<Button
			onclick={handleApply}
			disabled={applying || eligibleTransactions.length === 0 || (!selectedCategory && selectedTags.length === 0)}
		>
			{#if applying}
				<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
				Applying...
			{:else}
				Apply to {eligibleTransactions.length} Transaction{eligibleTransactions.length !== 1 ? 's' : ''}
			{/if}
		</Button>
	{/snippet}
</Modal>
