<script lang="ts">
	import Navigation from '$lib/components/Navigation.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import TextInput from '$lib/components/TextInput.svelte';
	import { onMount } from 'svelte';
	import { parseQuery, buildQueryString } from '$lib/utils/queryParser';

	interface Transaction {
		id: number;
		transaction_date: Date;
		account_id: number;
		counterparty?: string | null;
		total_cents: number;
		receipt_currency?: string | null;
		receipt_total_cents?: number | null;
		exchange_rate_thousandths?: number | null;
		reference: string | null;
		memo: string | null;
		status: string;
		lines?: TransactionLine[];
		tags?: Tag[];
		account?: Account;
	}

	interface TransactionLine {
		id: number;
		transaction_id: number;
		category_id?: number | null;
		category?: Category;
		description: string | null;
		amount_cents: number;
	}

	interface Tag {
		id: number;
		name: string;
		color: string | null;
	}

	interface Account {
		id: number;
		code: string;
		name: string;
		type: string;
		currency: string;
	}

	interface Category {
		id: number;
		name: string;
		type: string | null;
		parent_id: number | null;
	}

	let transactions = $state<Transaction[]>([]);
	let categories = $state<{ [key: number] : Category }>({})
	let loading = $state(true);
	let exporting = $state(false);
	let filterQuery = $state('');

	// Pagination state
	let currentPage = $state(1);
	let itemsPerPage = $state(50);
	let totalItems = $state(0);
	let totalPages = $state(0);
	let filteredSum = $state<number | null>(null);

	onMount(async () => {
		try {
			await fetchTransactions();
			await fetchCategories();
		} catch (error) {
			console.error('Error loading transactions:', error);
		} finally {
			loading = false;
		}
	});

	// Debounced filter effect (resets to page 1)
	let filterTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (!loading) {
			const currentQuery = filterQuery;

			if (filterTimeout) {
				clearTimeout(filterTimeout);
			}

			filterTimeout = setTimeout(() => {
				currentPage = 1; // Reset to first page on filter change
				fetchTransactions();
				filterTimeout = null; // Clear the timeout reference after fetching
			}, 500);
		}

		return () => {
			if (filterTimeout) {
				clearTimeout(filterTimeout);
			}
		};
	});

	// Pagination effect (refetch when page or items per page changes)
	$effect(() => {
		if (!loading) {
			// Track pagination changes
			const page = currentPage;
			const limit = itemsPerPage;

			// Skip if this is triggered by the filter effect
			if (filterTimeout) return;

			fetchTransactions();
		}
	});

	function getAuthHeaders(): HeadersInit {
		const token = localStorage.getItem('auth_token');
		return {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		};
	}

	async function fetchTransactions() {
		try {
			const parsed = parseQuery(filterQuery);
			const queryString = buildQueryString(parsed);
			const url = `/api/transactions?page=${currentPage}&limit=${itemsPerPage}&sort=transaction_date&order=desc&line_level_filter=true${queryString ? '&' + queryString : ''}`;

			const response = await fetch(url, {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				console.error('Failed to fetch transactions:', response.status, response.statusText);
				return;
			}

			const data = await response.json();
			if (data.data) {
				transactions = data.data;
			}
			if (data.meta) {
				totalItems = data.meta.total;
				totalPages = data.meta.pages;
				filteredSum = data.meta.sum ?? null;
			}
		} catch (error) {
			console.error('Failed to fetch transactions:', error);
		}
	}

	async function fetchCategories() {
		try {
			const response = await fetch('/api/categories?status=active&limit=1000', {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				console.error('Failed to fetch categories:', response.status, response.statusText);
				return;
			}

			const data = await response.json();
			if (data.data) {
				categories = data.data.reduce((acc: { [key: number]: Category }, next: Category) => { acc[next.id] = next; return acc;}, {} as { [key: number] : Category});
			}
		} catch (error) {
			console.error('Failed to fetch categories:', error);
		}
	}

	function formatCurrency(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	async function exportToCSV() {
		exporting = true;
		try {
			// Fetch ALL transactions without pagination
			const parsed = parseQuery(filterQuery);
			const queryString = buildQueryString(parsed);
			const url = `/api/transactions?limit=999999&sort=transaction_date&order=desc&line_level_filter=true${queryString ? '&' + queryString : ''}`;

			const response = await fetch(url, {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				alert('Failed to fetch transactions for export');
				return;
			}

			const data = await response.json();
			const allTransactions: Transaction[] = data.data || [];

			// Generate CSV content
			const csvRows: string[] = [];

			// CSV Headers
			csvRows.push([
				'Date',
				'Transaction',
				'Account Name',
				'Counterparty',
				'Total',
				'Currency',
				'Exchange Rate',
				'Category',
				'Line Description',
				'Line Amount',
				'Line Currency'
			].map(escapeCSV).join(','));

			// CSV Data
			allTransactions.forEach(transaction => {
				const account = transaction.account;
				const accountName = account?.name || '';
				const date = formatDate(transaction.transaction_date);
				const currency = account?.currency || 'USD';
				const exchangeRate = transaction.exchange_rate_thousandths ? (transaction.exchange_rate_thousandths / 1000).toFixed(3) : '';

				if (transaction.lines && transaction.lines.length > 0) {
					// One row per transaction line with proportional amounts in account currency
					transaction.lines.forEach(line => {
						const lineTotal = (transaction.receipt_currency === transaction.account?.currency || !transaction.receipt_currency || !transaction.receipt_total_cents) ? formatCurrency(line.amount_cents) : formatCurrency(transaction.total_cents * (line.amount_cents/transaction.receipt_total_cents));

						csvRows.push([
							date,
							transaction.id,
							accountName,
							transaction.counterparty || '',
							lineTotal,
							currency,
							exchangeRate,
							getCategoryName(line.category_id),
							line.description || '',
							formatCurrency(line.amount_cents),
							transaction.receipt_currency ? transaction.receipt_currency : currency,
						].map(escapeCSV).join(','));
					});
				} else {
					// Single row for transaction without lines
					const total = formatCurrency(transaction.total_cents);
					const receiptTotal = transaction.receipt_total_cents ? formatCurrency(transaction.receipt_total_cents) : '';
					console.log(transaction)
					csvRows.push([
						date,
						transaction.id,
						accountName,
						transaction.counterparty || '',
						total,
						currency,
						exchangeRate,
						getCategoryName(transaction.lines![0].category_id),
						transaction.lines![0].description || '',
						total,
						transaction.receipt_currency ? transaction.receipt_currency : currency,
					].map(escapeCSV).join(','));
				}
			});

			// Create and download CSV file
			const csvContent = csvRows.join('\n');
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const url2 = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url2;
			link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
			link.click();
			URL.revokeObjectURL(url2);
		} catch (error) {
			console.error('Failed to export CSV:', error);
			alert('Failed to export CSV');
		} finally {
			exporting = false;
		}
	}

	$inspect(categories)
	function getCategoryName(id: number | null | undefined) {
		if (id === undefined || id === null) {
			return 'uncategorized';
		}
		return categories[id]?.name || 'unknown';
	}

	function escapeCSV(value: string | number): string {
		if (value === null || value === undefined) return '';
		const stringValue = String(value);
		// Escape quotes and wrap in quotes if contains comma, quote, or newline
		if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
			return `"${stringValue.replace(/"/g, '""')}"`;
		}
		return stringValue;
	}
</script>

<svelte:head>
	<title>Reports - Accounting App</title>
</svelte:head>

<Navigation />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">Reports</h1>
		<p class="mt-2 text-gray-600">Filter and export transaction data</p>
	</div>

	<Card>
		{#snippet children()}
			<div class="space-y-4">
				<!-- Filter Section -->
				<div class="flex flex-col sm:flex-row gap-3 sm:items-end">
					<div class="flex-1">
						<TextInput
							bind:value={filterQuery}
							placeholder="category:groceries and counterparty:amazon"
							label="Filter Query"
						/>
						<p class="mt-1 text-xs text-gray-500 break-words">
							Filter by <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">category:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">tag:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">account:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">counterparty:</code>. Supports <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">and</code>, <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">or</code>, <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">()</code>, <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">:-</code> (empty)
						</p>
					</div>
					<Button
						variant="primary"
						onclick={exportToCSV}
						disabled={exporting || loading}
						class="w-full sm:w-auto"
					>
						{#if exporting}
							<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Exporting...
						{:else}
							<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Export CSV
						{/if}
					</Button>
				</div>

				<!-- Results Summary -->
				<div class="text-sm text-gray-600">
					{#if loading}
						Loading...
					{:else}
						<span>{totalItems} transaction{totalItems !== 1 ? 's' : ''} found</span>
						{#if filteredSum !== null}
							<span class="ml-4 font-medium">Total: ${formatCurrency(filteredSum)}</span>
						{/if}
					{/if}
				</div>

				<!-- Transactions -->
				{#if loading}
					<div class="flex justify-center py-12">
						<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					</div>
				{:else if transactions.length === 0}
					<div class="text-center py-12">
						<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						<p class="mt-2 text-gray-500">No transactions found</p>
					</div>
				{:else}
					<!-- Mobile Card View -->
					<div class="space-y-3 md:hidden">
						{#each transactions as transaction}
							<div class="bg-white border border-gray-200 rounded-lg p-4">
								<!-- Date -->
								<div class="mb-3">
									<div class="text-sm font-medium text-gray-900">
										{formatDate(transaction.transaction_date)}
									</div>
								</div>

								<!-- Account -->
								{#if transaction.account}
									<div class="mb-2">
										<div class="text-xs text-gray-500">Account</div>
										<div class="text-sm font-medium text-gray-900">{transaction.account.code}</div>
										<div class="text-xs text-gray-600">{transaction.account.name}</div>
									</div>
								{/if}

								<!-- Counterparty -->
								{#if transaction.counterparty}
									<div class="mb-2">
										<div class="text-xs text-gray-500">Counterparty</div>
										<div class="text-sm text-gray-900">{transaction.counterparty}</div>
									</div>
								{/if}

								<!-- Amount -->
								<div class="mb-2">
									<div class="text-xs text-gray-500">Amount</div>
									<div class="text-sm font-semibold text-gray-900">
										${formatCurrency(transaction.total_cents)}
										{#if transaction.receipt_currency && transaction.receipt_total_cents}
											<span class="text-xs text-gray-500 font-normal ml-1">
												({formatCurrency(transaction.receipt_total_cents)} {transaction.receipt_currency})
											</span>
										{/if}
									</div>
								</div>

								<!-- Categories/Lines -->
								{#if transaction.lines && transaction.lines.length > 0}
									<div class="mb-2">
										<div class="text-xs text-gray-500 mb-1">Categories</div>
										<div class="space-y-1">
											{#each transaction.lines as line}
												<div class="text-xs text-gray-700">
													{getCategoryName(line.category_id)}: ${formatCurrency(line.amount_cents)}
												</div>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Tags -->
								{#if transaction.tags && transaction.tags.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each transaction.tags as tag}
											<span
												class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
												style="background-color: {tag.color || '#3B82F6'}"
											>
												{tag.name}
											</span>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Desktop Table View -->
					<div class="hidden md:block overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Counterparty</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categories</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each transactions as transaction}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
											{formatDate(transaction.transaction_date)}
										</td>
										<td class="px-4 py-3 text-sm text-gray-900">
											{#if transaction.account}
												<div class="font-medium">{transaction.account.code}</div>
												<div class="text-gray-500 text-xs">{transaction.account.name}</div>
											{:else}
												-
											{/if}
										</td>
										<td class="px-4 py-3 text-sm text-gray-900">
											{transaction.counterparty || '-'}
										</td>
										<td class="px-4 py-3 text-sm text-gray-900">
											{#if transaction.lines && transaction.lines.length > 0}
											{console.log(transaction.lines)}
												<div class="space-y-1">
													{#each transaction.lines as line}
														<div class="text-xs">
															{getCategoryName(line.category_id)}: ${formatCurrency(line.amount_cents)}
														</div>
													{/each}
												</div>
											{:else}
												-
											{/if}
										</td>
										<td class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap font-medium">
											${formatCurrency(transaction.total_cents)}
											{#if transaction.receipt_currency && transaction.receipt_total_cents}
												<div class="text-xs text-gray-500">
													{formatCurrency(transaction.receipt_total_cents)} {transaction.receipt_currency}
												</div>
											{/if}
										</td>
										<td class="px-4 py-3 text-sm">
											{#if transaction.tags && transaction.tags.length > 0}
												<div class="flex flex-wrap gap-1">
													{#each transaction.tags as tag}
														<span
															class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
															style="background-color: {tag.color || '#3B82F6'}"
														>
															{tag.name}
														</span>
													{/each}
												</div>
											{:else}
												-
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination Controls -->
					<div class="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
						<div class="flex items-center gap-2">
							<label for="items-per-page" class="text-sm text-gray-700">Items per page:</label>
							<select
								id="items-per-page"
								class="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								bind:value={itemsPerPage}
								onchange={() => currentPage = 1}
							>
								<option value={50}>50</option>
								<option value={100}>100</option>
								<option value={200}>200</option>
								<option value={300}>300</option>
								<option value={400}>400</option>
								<option value={500}>500</option>
							</select>
						</div>

						<div class="flex items-center gap-2 text-sm text-gray-700">
							<span>
								Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
							</span>
						</div>

						<div class="flex items-center gap-2">
							<button
								class="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={currentPage === 1}
								onclick={() => currentPage = 1}
							>
								First
							</button>
							<button
								class="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={currentPage === 1}
								onclick={() => currentPage--}
							>
								Previous
							</button>
							<span class="px-3 py-1.5 text-sm text-gray-700">
								Page {currentPage} of {totalPages}
							</span>
							<button
								class="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={currentPage === totalPages}
								onclick={() => currentPage++}
							>
								Next
							</button>
							<button
								class="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={currentPage === totalPages}
								onclick={() => currentPage = totalPages}
							>
								Last
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/snippet}
	</Card>
</div>

<style>
	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
