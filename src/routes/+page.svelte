<script lang="ts">
	import Navigation from '$lib/components/Navigation.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import TextInput from '$lib/components/TextInput.svelte';
	import Typeahead from '$lib/components/Typeahead.svelte';
	import { confirm } from '$lib/stores/confirmationStore';
	import { onMount } from 'svelte';
	import { parseQuery, buildQueryString } from '$lib/utils/queryParser';

	interface Transaction {
		id: number;
		transaction_date: Date;
		account_id: number;
		counterparty?: string | null;
		total_cents: number;
		// Multi-currency support - transaction level
		receipt_currency?: string | null;
		receipt_total_cents?: number | null;
		exchange_rate_thousandths?: number | null;
		reference: string | null;
		memo: string | null;
		status: string;
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

	interface Account {
		id: number;
		code: string;
		name: string;
		type: string;
		currency: string;
		displayName?: string;
	}

	interface Category {
		id: number;
		name: string;
		type: string | null;
		parent_id: number | null;
	}

	interface Attachment {
		id: number;
		transaction_id: number;
		filename: string;
		file_path: string;
		file_size: number;
		mime_type: string;
		description: string | null;
	}

	let transactions = $state<Transaction[]>([]);
	let accounts = $state<Account[]>([]);
	let categories = $state<Category[]>([]);
	let tags = $state<Tag[]>([]);
	let loading = $state(true);
	let addTransactionModalOpen = $state(false);
	let viewTransactionModalOpen = $state(false);
	let editTransactionModalOpen = $state(false);
	let selectedTransaction = $state<Transaction | null>(null);
	let selectedTransactionAttachments = $state<Attachment[]>([]);
	let filterQuery = $state('');
	let uploadingFiles = $state<File[]>([]);

	// Pagination state
	let currentPage = $state(1);
	let itemsPerPage = $state(50);
	let totalItems = $state(0);
	let totalPages = $state(0);

	// Form state for new transaction
	let newTransaction = $state({
		transaction_date: new Date().toISOString().split('T')[0],
		account: null as Account | null,
		counterparty: '',
		total: 0,
		receiptCurrency: '',
		receiptTotal: 0,
		reference: '',
		memo: '',
		lines: [
			{
				category: null as Category | null,
				description: '',
				amount: 0
			}
		],
		tags: [] as Tag[]
	});

	// Form state for editing transaction
	let editTransaction = $state({
		id: 0,
		transaction_date: '',
		account: null as Account | null,
		counterparty: '',
		total: 0,
		receiptCurrency: '',
		receiptTotal: 0,
		reference: '',
		memo: '',
		lines: [] as Array<{
			category: Category | null;
			description: string;
			amount: number;
		}>,
		tags: [] as Tag[]
	});

	onMount(async () => {
		console.log('Dashboard onMount called');
		try {
			await Promise.all([fetchTransactions(), fetchAccounts(), fetchCategories(), fetchTags()]);
		} catch (error) {
			console.error('Error loading data:', error);
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

	async function fetchTransactions() {
		try {
			// Parse the filter query
			const parsed = parseQuery(filterQuery);
			const queryString = buildQueryString(parsed);

			// Build URL with filters and pagination
			const url = `/api/transactions?page=${currentPage}&limit=${itemsPerPage}&sort=transaction_date&order=desc${queryString ? '&' + queryString : ''}`;

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
			}
		} catch (error) {
			console.error('Failed to fetch transactions:', error);
		}
	}

	// Debounced filter effect (resets to page 1)
	let filterTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (!loading) {
			// Track filterQuery to make this reactive
			const currentQuery = filterQuery;

			// Clear previous timeout
			if (filterTimeout) {
				clearTimeout(filterTimeout);
			}

			// Debounce the filter query
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

	async function fetchAccounts() {
		try {
			const response = await fetch('/api/accounts?status=active&limit=1000', {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				console.error('Failed to fetch accounts:', response.status, response.statusText);
				return;
			}

			const data = await response.json();
			if (data.data) {
				accounts = data.data.map((account: Account) => ({
					...account,
					displayName: `${account.code} - ${account.name}`
				}));
			}
		} catch (error) {
			console.error('Failed to fetch accounts:', error);
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
				categories = data.data;
			}
		} catch (error) {
			console.error('Failed to fetch categories:', error);
		}
	}

	async function createCategory(name: string): Promise<Category> {
		const response = await fetch('/api/categories', {
			method: 'POST',
			headers: getAuthHeaders(),
			body: JSON.stringify({
				name,
				status: 'active'
			})
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error?.message || 'Failed to create category');
		}

		const result = await response.json();
		const newCategory = result.data;

		// Add to local categories array
		categories = [...categories, newCategory];

		return newCategory;
	}

	async function fetchTags() {
		try {
			const response = await fetch('/api/tags?limit=1000', {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				console.error('Failed to fetch tags:', response.status, response.statusText);
				return;
			}

			const data = await response.json();
			if (data.data) {
				tags = data.data;
			}
		} catch (error) {
			console.error('Failed to fetch tags:', error);
		}
	}

	async function createTag(name: string): Promise<Tag> {
		const response = await fetch('/api/tags', {
			method: 'POST',
			headers: getAuthHeaders(),
			body: JSON.stringify({
				name,
				color: null
			})
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error?.message || 'Failed to create tag');
		}

		const result = await response.json();
		const newTag = result.data;

		// Add to local tags array
		tags = [...tags, newTag];

		return newTag;
	}

	function formatCurrency(cents: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(cents / 100);
	}

	function getAccountCurrency(accountId: number): string {
		const account = accounts.find(a => a.id === accountId);
		return account?.currency || 'USD';
	}

	function formatExchangeRate(rateThousandths: number): string {
		return (rateThousandths / 1000).toFixed(3);
	}

	function calculateExchangeRate(amountCents: number, originalAmountCents: number): number {
		// Exchange rate = original currency amount / account currency amount
		// Example: 500 MXN / 27.50 USD = 18.18 MXN per USD
		// Returns in thousandths for storage
		if (amountCents === 0) return 0;
		return Math.round((originalAmountCents / amountCents) * 1000);
	}

	// UTC date helper functions
	function dateToUTCString(date: Date | string): string {
		// Convert a Date object or ISO string to YYYY-MM-DD format in UTC
		const d = typeof date === 'string' ? new Date(date) : date;
		const year = d.getUTCFullYear();
		const month = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function utcStringToDate(dateString: string): Date {
		// Parse YYYY-MM-DD string as UTC midnight
		const [year, month, day] = dateString.split('-').map(Number);
		return new Date(Date.UTC(year, month - 1, day));
	}

	function formatDate(date: Date | string): string {
		// Always format dates in UTC timezone
		const d = typeof date === 'string' ? new Date(date) : date;
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		}).format(d);
	}

	function addTransactionLine() {
		newTransaction.lines.push({
			category: null,
			description: '',
			amount: (newTransaction.receiptTotal ? newTransaction.receiptTotal : newTransaction.total) - newTransaction.lines.reduce((acc, next) => acc + next.amount, 0)
		});
	}

	function removeTransactionLine(index: number) {
		if (newTransaction.lines.length > 1) {
			newTransaction.lines = newTransaction.lines.filter((_, i) => i !== index);
		}
	}

	function addEditTransactionLine() {
		editTransaction.lines.push({
			category: null,
			description: '',
			amount: 0
		});
	}

	function removeEditTransactionLine(index: number) {
		if (editTransaction.lines.length > 1) {
			editTransaction.lines = editTransaction.lines.filter((_, i) => i !== index);
		}
	}

	async function handleAddTransaction(closeModal = true) {
		try {
			// Validate required fields before submitting
			if (!newTransaction.account?.id) {
				alert('Please select an account');
				return;
			}

			// Calculate exchange rate at transaction level
			const hasMultiCurrency = newTransaction.receiptCurrency && newTransaction.receiptCurrency.trim() && newTransaction.receiptTotal > 0;
			const exchangeRate = hasMultiCurrency ? calculateExchangeRate(
				Math.round(newTransaction.total * 100),
				Math.round(newTransaction.receiptTotal * 100)
			) : null;

			const response = await fetch('/api/transactions', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					transaction_date: utcStringToDate(newTransaction.transaction_date),
					account_id: newTransaction.account.id,
					counterparty: newTransaction.counterparty || null,
					total_cents: Math.round(newTransaction.total * 100),
					// Multi-currency support - transaction level
					receipt_currency: hasMultiCurrency ? newTransaction.receiptCurrency : null,
					receipt_total_cents: hasMultiCurrency ? Math.round(newTransaction.receiptTotal * 100) : null,
					exchange_rate_thousandths: exchangeRate,
					reference: newTransaction.reference || null,
					memo: newTransaction.memo || null,
					status: 'posted',
					lines: newTransaction.lines.map(line => ({
						category_id: line.category?.id || null,
						description: line.description || null,
						amount_cents: Math.round(line.amount * 100)
					}))
				})
			});

			if (response.ok) {
				const result = await response.json();
				const createdTransaction = result.data;

				// Upload attachments if any
				if (uploadingFiles.length > 0) {
					await uploadAttachments(createdTransaction.id);
				}

				// Save tags if any
				if (newTransaction.tags.length > 0) {
					await fetch(`/api/transactions/${createdTransaction.id}/tags`, {
						method: 'PUT',
						headers: getAuthHeaders(),
						body: JSON.stringify({
							tag_ids: newTransaction.tags.map(t => t.id)
						})
					});
				}

				if (closeModal) {
					addTransactionModalOpen = false;
				}
				await fetchTransactions();
				// Reset form
				newTransaction = {
					transaction_date: new Date().toISOString().split('T')[0],
					account: null,
					counterparty: '',
					total: 0,
					receiptCurrency: '',
					receiptTotal: 0,
					reference: '',
					memo: '',
					lines: [
						{
							category: null,
							description: '',
							amount: 0
						}
					],
					tags: []
				};
				uploadingFiles = [];
			} else {
				const error = await response.json();
				alert(error.error?.message || 'Failed to create transaction');
			}
		} catch (error) {
			console.error('Failed to create transaction:', error);
			alert('Failed to create transaction');
		}
	}

	async function handleDeleteTransaction(id: number) {
		const confirmed = await confirm(
			'Are you sure you want to delete this transaction? This action cannot be undone.',
			{
				title: 'Delete Transaction',
				confirmText: 'Delete',
				cancelText: 'Cancel',
				variant: 'danger'
			}
		);

		if (!confirmed) {
			return;
		}

		try {
			const response = await fetch(`/api/transactions/${id}`, {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to delete transaction');
				return;
			}

			// Remove from local array
			transactions = transactions.filter(t => t.id !== id);
			editTransactionModalOpen = false;
			viewTransactionModalOpen = false;
			selectedTransaction = null;
		} catch (error) {
			console.error('Failed to delete transaction:', error);
			alert('Failed to delete transaction');
		}
	}

	async function handleViewTransaction(id: number) {
		try {
			const response = await fetch(`/api/transactions/${id}`, {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to fetch transaction');
				return;
			}

			const result = await response.json();
			selectedTransaction = result.data;
			await fetchAttachments(id);
			viewTransactionModalOpen = true;
		} catch (error) {
			console.error('Failed to fetch transaction:', error);
			alert('Failed to fetch transaction');
		}
	}

	async function handleEditTransaction(id: number) {
		try {
			const response = await fetch(`/api/transactions/${id}`, {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to fetch transaction');
				return;
			}

			const result = await response.json();
			const transaction = result.data;

			// Convert transaction data to edit form format
			// Use transaction-level currency fields
			const receiptCurrency = transaction.receipt_currency || '';
			const receiptTotal = transaction.receipt_total_cents ? transaction.receipt_total_cents / 100 : 0;

			editTransaction = {
				id: transaction.id,
				transaction_date: dateToUTCString(transaction.transaction_date),
				account: accounts.find(a => a.id === transaction.account_id) || null,
				counterparty: transaction.counterparty || '',
				total: transaction.total_cents / 100,
				receiptCurrency: receiptCurrency,
				receiptTotal: receiptTotal,
				reference: transaction.reference || '',
				memo: transaction.memo || '',
				lines: transaction.lines.map((line: any) => ({
					category: line.category_id ? categories.find(c => c.id === line.category_id) || null : null,
					description: line.description || '',
					amount: line.amount_cents / 100
				})),
				tags: transaction.tags || []
			};

			// Clear any previously selected files
			uploadingFiles = [];

			// Fetch attachments for editing
			await fetchAttachments(id);

			editTransactionModalOpen = true;
		} catch (error) {
			console.error('Failed to fetch transaction:', error);
			alert('Failed to fetch transaction');
		}
	}

	async function handleUpdateTransaction() {
		try {
			// Validate required fields before submitting
			if (!editTransaction.account?.id) {
				alert('Please select an account');
				return;
			}

			// Calculate exchange rate at transaction level
			const hasMultiCurrency = editTransaction.receiptCurrency && editTransaction.receiptCurrency.trim() && editTransaction.receiptTotal > 0;
			const exchangeRate = hasMultiCurrency ? calculateExchangeRate(
				Math.round(editTransaction.total * 100),
				Math.round(editTransaction.receiptTotal * 100)
			) : null;

			const payload: any = {
				transaction_date: utcStringToDate(editTransaction.transaction_date),
				account_id: editTransaction.account.id,
				total_cents: Math.round(editTransaction.total * 100),
				// Multi-currency support - transaction level
				receipt_currency: hasMultiCurrency ? editTransaction.receiptCurrency : null,
				receipt_total_cents: hasMultiCurrency ? Math.round(editTransaction.receiptTotal * 100) : null,
				exchange_rate_thousandths: exchangeRate,
				lines: editTransaction.lines.map(line => {
					const lineData: any = {
						amount_cents: Math.round(line.amount * 100)
					};

					// Only include optional fields if they have values
					if (line.category?.id) {
						lineData.category_id = line.category.id;
					}
					if (line.description) {
						lineData.description = line.description;
					}

					return lineData;
				})
			};

			// Only include optional transaction fields if they have values
			if (editTransaction.counterparty) {
				payload.counterparty = editTransaction.counterparty;
			}
			if (editTransaction.reference) {
				payload.reference = editTransaction.reference;
			}
			if (editTransaction.memo) {
				payload.memo = editTransaction.memo;
			}

			console.log('Update transaction payload:', payload);

			const response = await fetch(`/api/transactions/${editTransaction.id}`, {
				method: 'PATCH',
				headers: getAuthHeaders(),
				body: JSON.stringify(payload)
			});

			console.log('Update transaction response status:', response.status);

			if (response.ok) {
				console.log('Transaction updated successfully, checking for attachments to upload...');
				console.log('uploadingFiles.length:', uploadingFiles.length);

				// Upload any new attachments
				if (uploadingFiles.length > 0) {
					console.log('Starting attachment upload...');
					await uploadAttachments(editTransaction.id);
				}

				// Update tags
				await fetch(`/api/transactions/${editTransaction.id}/tags`, {
					method: 'PUT',
					headers: getAuthHeaders(),
					body: JSON.stringify({
						tag_ids: editTransaction.tags.map(t => t.id)
					})
				});

				editTransactionModalOpen = false;
				await fetchTransactions();
			} else {
				const error = await response.json();
				console.error('Update transaction error:', error);
				const errorMessage = error.error?.details
					? `Validation failed: ${JSON.stringify(error.error.details)}`
					: error.error?.message || 'Failed to update transaction';
				alert(errorMessage);
			}
		} catch (error) {
			console.error('Failed to update transaction:', error);
			alert('Failed to update transaction');
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			uploadingFiles = [...uploadingFiles, ...Array.from(input.files)];
			input.value = ''; // Reset input
		}
	}

	function removeUploadingFile(index: number) {
		uploadingFiles = uploadingFiles.filter((_, i) => i !== index);
	}

	async function uploadAttachments(transactionId: number) {
		console.log('Uploading attachments for transaction:', transactionId);
		console.log('Files to upload:', uploadingFiles);

		for (const file of uploadingFiles) {
			try {
				const formData = new FormData();
				formData.append('file', file);
				formData.append('transaction_id', transactionId.toString());

				const token = localStorage.getItem('auth_token');
				const headers: HeadersInit = {};
				if (token) {
					headers['Authorization'] = `Bearer ${token}`;
				}

				console.log('Uploading file:', file.name, 'to transaction:', transactionId);

				const response = await fetch('/api/attachments', {
					method: 'POST',
					headers,
					body: formData
				});

				console.log('Upload response status:', response.status);

				if (!response.ok) {
					const error = await response.json();
					console.error('Failed to upload file:', file.name, error);
					alert(`Failed to upload ${file.name}: ${error.error?.message || 'Unknown error'}`);
				}
			} catch (error) {
				console.error('Failed to upload file:', file.name, error);
				alert(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
		uploadingFiles = [];
	}

	async function fetchAttachments(transactionId: number) {
		try {
			const response = await fetch(`/api/transactions/${transactionId}/attachments`, {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				console.error('Failed to fetch attachments');
				return;
			}

			const data = await response.json();
			selectedTransactionAttachments = data.data || [];
		} catch (error) {
			console.error('Failed to fetch attachments:', error);
		}
	}

	async function viewAttachment(attachmentId: number, filename: string) {
		try {
			const response = await fetch(`/api/attachments/${attachmentId}`, {
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to load attachment');
				return;
			}

			// Create blob from response
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);

			// Open in new tab
			const link = document.createElement('a');
			link.href = url;
			link.target = '_blank';
			link.download = filename;
			link.click();

			// Clean up the URL after a short delay
			setTimeout(() => URL.revokeObjectURL(url), 100);
		} catch (error) {
			console.error('Failed to view attachment:', error);
			alert('Failed to load attachment');
		}
	}

	async function deleteAttachment(attachmentId: number) {
		const confirmed = await confirm(
			'Are you sure you want to delete this attachment?',
			{
				title: 'Delete Attachment',
				confirmText: 'Delete',
				cancelText: 'Cancel',
				variant: 'danger'
			}
		);

		if (!confirmed) {
			return;
		}

		try {
			const response = await fetch(`/api/attachments/${attachmentId}`, {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to delete attachment');
				return;
			}

			// Refresh attachments list
			if (selectedTransaction) {
				await fetchAttachments(selectedTransaction.id);
			}
		} catch (error) {
			console.error('Failed to delete attachment:', error);
			alert('Failed to delete attachment');
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}
</script>

<svelte:head>
	<title>Dashboard - Spending Ledger App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Navigation />

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
				<p class="mt-1 text-sm text-gray-600">Manage your transactions</p>
			</div>
			<Button onclick={() => {
				uploadingFiles = [];
				addTransactionModalOpen = true;
			}}>
				<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add Transaction
			</Button>
		</div>

		<Card>
			<div class="flex flex-col gap-4 mb-6">
				<div>
					<h2 class="text-lg font-medium text-gray-900">Recent Transactions</h2>
					<p class="mt-1 text-sm text-gray-500">Your latest accounting entries</p>
				</div>
				<div class="w-full">
					<TextInput
						label=""
						type="text"
						placeholder='category:groceries and counterparty:amazon'
						bind:value={filterQuery}
					/>
					<p class="mt-1 text-xs text-gray-500 wrap-break-word">
						Filter by <code class="bg-gray-100 px-1 py-0.5 rounded">category:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">tag:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">account:</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">counterparty:</code>. Supports <code class="bg-gray-100 px-1 py-0.5 rounded">and</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">or</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">()</code>, <code class="bg-gray-100 px-1 py-0.5 rounded">:-</code> (empty)
					</p>
				</div>
			</div>

			{#if loading}
				<div class="text-center py-12">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					<p class="mt-2 text-sm text-gray-600">Loading transactions...</p>
				</div>
			{:else if transactions.length === 0}
				<div class="text-center py-12">
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No transactions</h3>
					<p class="mt-1 text-sm text-gray-500">Get started by creating a new transaction.</p>
					<div class="mt-6">
						<Button onclick={() => {
							uploadingFiles = [];
							addTransactionModalOpen = true;
						}}>
							Add Transaction
						</Button>
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					{#each transactions as transaction}
						<div
							class="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow p-4 cursor-pointer overflow-hidden"
							onclick={() => handleEditTransaction(transaction.id)}
							role="button"
							tabindex="0"
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewTransaction(transaction.id); }}
						>
							<!-- First line: Date, Account, Counterparty, Total -->
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
								<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 flex-1 min-w-0">
									<div class="text-sm font-medium text-gray-900 sm:min-w-25">
										{formatDate(transaction.transaction_date)}
									</div>
									<div class="text-sm text-gray-600 truncate">
										{accounts.find(a => a.id === transaction.account_id)?.name || `Account #${transaction.account_id}`}
									</div>
									{#if transaction.counterparty}
										<div class="text-sm text-gray-600 truncate">
											<span class="text-gray-400 hidden sm:inline">→</span>
											<span class="sm:hidden text-gray-400">To: </span>
											{transaction.counterparty}
										</div>
									{/if}
								</div>
								<div class="text-left sm:text-right">
									<div class="text-sm font-semibold text-gray-900">
										{formatCurrency(transaction.total_cents, getAccountCurrency(transaction.account_id))}
									</div>
									{#if transaction.receipt_currency && transaction.receipt_total_cents && transaction.exchange_rate_thousandths}
										<div class="text-xs text-gray-500 mt-0.5">
											{formatCurrency(transaction.receipt_total_cents, transaction.receipt_currency)} @ {formatExchangeRate(transaction.exchange_rate_thousandths)} {transaction.receipt_currency} per {getAccountCurrency(transaction.account_id)}
										</div>
									{/if}
								</div>
							</div>

							<!-- Second line: Categories, Tags, Actions -->
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div class="flex items-start sm:items-center gap-3 flex-1 min-w-0">
									{#if transaction.lines && transaction.lines.length > 0}
										<div class="flex flex-wrap gap-1">
											{#each [...new Set(transaction.lines.map(l => l.category_id).filter(Boolean))] as categoryId}
												{@const category = categories.find(c => c.id === categoryId)}
												{#if category}
													<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
														{category.name}
													</span>
												{/if}
											{/each}
										</div>
									{/if}
									<!-- Tags -->
									{#if transaction.tags && transaction.tags.length > 0}
										<div class="flex flex-wrap gap-1">
											{#each transaction.tags as tag}
												<span
													class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
													style="background-color: {tag.color ? tag.color + '20' : '#E0E7FF'}; color: {tag.color || '#4F46E5'}; border: 1px solid {tag.color || '#C7D2FE'}"
												>
													<i class="fas fa-tag mr-1" style="font-size: 0.65rem;"></i>
													{tag.name}
												</span>
											{/each}
										</div>
									{/if}
								</div>
								<div class="flex justify-end gap-3">
									<button
										onclick={(e) => { e.stopPropagation(); handleViewTransaction(transaction.id); }}
										class="text-gray-600 hover:text-gray-900 transition-colors"
										title="View transaction"
									>
										<i class="fas fa-eye"></i>
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination Controls -->
				{#if !loading && transactions.length > 0}
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
			{/if}
		</Card>
	</main>
</div>

<Modal bind:open={addTransactionModalOpen} title="Add Transaction">
	<div class="space-y-4">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<TextInput
				label="Date"
				type="date"
				bind:value={newTransaction.transaction_date}
				required
			/>
			<TextInput
				label="Reference"
				type="text"
				placeholder="e.g., INV-001"
				bind:value={newTransaction.reference}
			/>
		</div>

		<Typeahead
			label="Account"
			placeholder="Search accounts..."
			bind:value={newTransaction.account}
			options={accounts}
			displayField="displayName"
			valueField="id"
			required={true}
		/>

		<div class="border border-blue-200 bg-blue-50 rounded-lg p-4">
			<div class="text-sm font-medium text-blue-900 mb-3">Transaction Total</div>
			<div class="grid grid-cols-3 gap-4">
				<TextInput
					label="Receipt Currency"
					type="text"
					placeholder={newTransaction.account ? getAccountCurrency(newTransaction.account.id) : 'USD, EUR, MXN...'}
					bind:value={newTransaction.receiptCurrency}
				/>
				<TextInput
					label="Receipt Total"
					type="number"
					step="any"
					placeholder="0.00 (negative for refunds)"
					bind:value={newTransaction.receiptTotal}
				/>
				<TextInput
					label="Charged ({newTransaction.account ? getAccountCurrency(newTransaction.account.id) : 'acct'})"
					type="number"
					step="any"
					placeholder="0.00 (negative for refunds)"
					bind:value={newTransaction.total}
					required
				/>
			</div>
			{#if newTransaction.receiptCurrency && newTransaction.receiptCurrency.trim()}
				{@const lineSum = newTransaction.lines.reduce((sum, line) => sum + (line.amount || 0), 0)}
				{@const accountCurrency = newTransaction.account ? getAccountCurrency(newTransaction.account.id) : 'USD'}
				{@const isDifferentCurrency = newTransaction.receiptCurrency.trim().toUpperCase() !== accountCurrency.toUpperCase()}
				{#if isDifferentCurrency}
					{#if newTransaction.receiptTotal > 0 && newTransaction.total > 0}
						<div class="mt-3 text-sm text-blue-800">
							<span class="font-medium">Exchange Rate:</span> {(newTransaction.receiptTotal / newTransaction.total).toFixed(6)} {newTransaction.receiptCurrency} per {accountCurrency}
						</div>
					{/if}
					{#if lineSum !== newTransaction.receiptTotal}
						<div class="mt-2 text-sm text-amber-700">
							<span class="font-medium">Line items sum to {lineSum.toFixed(2)} {newTransaction.receiptCurrency}</span> (should equal receipt total)
						</div>
					{/if}
				{:else if newTransaction.total > 0}
					{#if lineSum !== newTransaction.total}
						<div class="mt-3 text-sm text-amber-700">
							<span class="font-medium">Line items sum to {lineSum.toFixed(2)}</span> (should equal {newTransaction.total.toFixed(2)})
						</div>
					{/if}
				{/if}
			{/if}
		</div>

		<TextInput
			label="Counterparty"
			type="text"
			placeholder="e.g., Coffee Shop"
			bind:value={newTransaction.counterparty}
		/>

		<TextInput
			label="Memo"
			type="text"
			placeholder="Description of the transaction"
			bind:value={newTransaction.memo}
		/>

		<Typeahead
			label="Tags"
			placeholder="Search or create tags..."
			bind:value={newTransaction.tags}
			options={tags}
			displayField="name"
			valueField="id"
			creatable={true}
			onCreate={createTag}
			multiple={true}
		/>

		<div class="border-t border-gray-200 pt-4">
			<div class="flex items-center justify-between mb-4">
				<h4 class="text-sm font-medium text-gray-900">Transaction Lines</h4>
				<Button size="small" variant="outline" onclick={addTransactionLine}>
					<svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					Add Line
				</Button>
			</div>

			<div class="space-y-4">
				{#each newTransaction.lines as line, index}
					<div class="p-4 bg-gray-50 rounded-lg space-y-3">
						<div class="flex items-start justify-between">
							<span class="text-sm font-medium text-gray-700">Line {index + 1}</span>
							{#if newTransaction.lines.length > 1}
								<button
									onclick={() => removeTransactionLine(index)}
									class="text-red-600 hover:text-red-800 text-sm"
								>
									Remove
								</button>
							{/if}
						</div>

						<div class="space-y-3">
							<Typeahead
								label="Category"
								placeholder="Search or create category..."
								bind:value={line.category}
								options={categories}
								displayField="name"
								valueField="id"
								creatable={true}
								onCreate={createCategory}
							/>

							<TextInput
								label="Description"
								type="text"
								placeholder="Line description"
								bind:value={line.description}
							/>

							<TextInput
								label="Amount ({newTransaction.receiptCurrency || (newTransaction.account ? getAccountCurrency(newTransaction.account.id) : 'Receipt Currency')})"
								type="number"
								step="any"
								placeholder="0.00 (negative for discounts)"
								bind:value={line.amount}
								required
							/>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Attachments Section -->
		<div class="border-t border-gray-200 pt-4">
			<h4 class="text-sm font-medium text-gray-900 mb-3">Attachments</h4>
			<div class="space-y-2">
				<input
					type="file"
					multiple
					accept="image/*,.pdf"
					onchange={handleFileSelect}
					class="block w-full text-sm text-gray-500
						file:mr-4 file:py-2 file:px-4
						file:rounded file:border-0
						file:text-sm file:font-semibold
						file:bg-blue-50 file:text-blue-700
						hover:file:bg-blue-100
						cursor-pointer"
				/>
				{#if uploadingFiles.length > 0}
					<div class="mt-2 space-y-1">
						{#each uploadingFiles as file, index}
							<div class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
								<div class="flex items-center gap-2">
									<i class="fas fa-file text-gray-400"></i>
									<span class="text-gray-700">{file.name}</span>
									<span class="text-gray-500">({formatFileSize(file.size)})</span>
								</div>
								<button
									onclick={() => removeUploadingFile(index)}
									class="text-red-600 hover:text-red-800"
									aria-label="Remove file"
								>
									<i class="fas fa-times"></i>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" onclick={() => {
			addTransactionModalOpen = false;
			uploadingFiles = [];
		}}>
			Cancel
		</Button>
		<Button variant="outline" onclick={() => handleAddTransaction(false)}>
			Create and Add Another
		</Button>
		<Button onclick={() => handleAddTransaction(true)}>
			Create Transaction
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={viewTransactionModalOpen} title="View Transaction">
	{#if selectedTransaction}
		<div class="space-y-4">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Date</div>
					<p class="text-sm text-gray-900">{formatDate(selectedTransaction.transaction_date)}</p>
				</div>
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Reference</div>
					<p class="text-sm text-gray-900">{selectedTransaction.reference || '-'}</p>
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Account</div>
					<p class="text-sm text-gray-900">
						{accounts.find(a => a.id === selectedTransaction?.account_id)?.displayName || `Account #${selectedTransaction?.account_id}`}
					</p>
				</div>
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Total</div>
					<p class="text-sm text-gray-900">{formatCurrency(selectedTransaction.total_cents)}</p>
					{#if selectedTransaction.receipt_currency && selectedTransaction.receipt_total_cents && selectedTransaction.exchange_rate_thousandths}
						<p class="text-xs text-gray-600 mt-1">
							{formatCurrency(selectedTransaction.receipt_total_cents, selectedTransaction.receipt_currency)} @ {formatExchangeRate(selectedTransaction.exchange_rate_thousandths)} {selectedTransaction.receipt_currency} per {getAccountCurrency(selectedTransaction.account_id)}
						</p>
					{/if}
				</div>
			</div>

			<div>
				<div class="block text-sm font-medium text-gray-700 mb-1">Counterparty</div>
				<p class="text-sm text-gray-900">{selectedTransaction.counterparty || '-'}</p>
			</div>

			<div>
				<div class="block text-sm font-medium text-gray-700 mb-1">Memo</div>
				<p class="text-sm text-gray-900">{selectedTransaction.memo || '-'}</p>
			</div>

			<div class="border-t border-gray-200 pt-4">
				<h4 class="text-sm font-medium text-gray-900 mb-4">Transaction Lines</h4>
				<div class="space-y-3">
					{#if selectedTransaction.lines && selectedTransaction.lines.length > 0}
						{#each selectedTransaction.lines as line, index}
							<div class="p-4 bg-gray-50 rounded-lg">
								<div class="text-sm font-medium text-gray-700 mb-2">Line {index + 1}</div>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
									<div>
										<span class="font-medium text-gray-600">Category:</span>
										<span class="ml-2 text-gray-900">
											{line.category_id ? categories.find(c => c.id === line.category_id)?.name || `Category #${line.category_id}` : '-'}
										</span>
									</div>
									<div>
										<span class="font-medium text-gray-600">Amount:</span>
										<span class="ml-2 text-gray-900">
											{#if selectedTransaction.receipt_currency}
												{formatCurrency(line.amount_cents, selectedTransaction.receipt_currency)}
											{:else}
												{formatCurrency(line.amount_cents)}
											{/if}
										</span>
									</div>
									<div class="md:col-span-2">
										<span class="font-medium text-gray-600">Description:</span>
										<span class="ml-2 text-gray-900">{line.description || '-'}</span>
									</div>
								</div>
							</div>
						{/each}
					{:else}
						<p class="text-sm text-gray-500">No transaction lines found.</p>
					{/if}
				</div>
			</div>

			<!-- Attachments Section -->
			<div class="border-t border-gray-200 pt-4">
				<h4 class="text-sm font-medium text-gray-900 mb-4">Attachments</h4>
				{#if selectedTransactionAttachments.length > 0}
					<div class="space-y-2">
						{#each selectedTransactionAttachments as attachment}
							<div class="flex items-center justify-between p-3 bg-gray-50 rounded">
								<button
									onclick={() => viewAttachment(attachment.id, attachment.filename)}
									class="flex items-center gap-2 text-blue-600 hover:text-blue-800"
								>
									<i class="fas fa-file"></i>
									<span>{attachment.filename}</span>
									<span class="text-gray-500 text-sm">({formatFileSize(attachment.file_size)})</span>
								</button>
								<button
									onclick={() => deleteAttachment(attachment.id)}
									class="text-red-600 hover:text-red-800"
									title="Delete attachment"
								>
									<i class="fas fa-trash"></i>
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-gray-500">No attachments.</p>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="outline" onclick={() => viewTransactionModalOpen = false}>
			Close
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={editTransactionModalOpen} title="Edit Transaction">
	<div class="space-y-4">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<TextInput
				label="Date"
				type="date"
				bind:value={editTransaction.transaction_date}
				required
			/>
			<TextInput
				label="Reference"
				type="text"
				placeholder="e.g., INV-001"
				bind:value={editTransaction.reference}
			/>
		</div>

		<Typeahead
			label="Account"
			placeholder="Search accounts..."
			bind:value={editTransaction.account}
			options={accounts}
			displayField="displayName"
			valueField="id"
			required={true}
		/>

		<div class="border border-blue-200 bg-blue-50 rounded-lg p-4">
			<div class="text-sm font-medium text-blue-900 mb-3">Transaction Total</div>
			<div class="grid grid-cols-3 gap-4">
				<TextInput
					label="Receipt Currency"
					type="text"
					placeholder={editTransaction.account ? getAccountCurrency(editTransaction.account.id) : 'USD, EUR, MXN...'}
					bind:value={editTransaction.receiptCurrency}
				/>
				<TextInput
					label="Receipt Total"
					type="number"
					step="any"
					placeholder="0.00 (negative for refunds)"
					bind:value={editTransaction.receiptTotal}
				/>
				<TextInput
					label="Charged ({editTransaction.account ? getAccountCurrency(editTransaction.account.id) : 'Account Currency'})"
					type="number"
					step="any"
					placeholder="0.00 (negative for refunds)"
					bind:value={editTransaction.total}
					required
				/>
			</div>
			{#if editTransaction.receiptCurrency && editTransaction.receiptCurrency.trim()}
				{@const lineSum = editTransaction.lines.reduce((sum, line) => sum + (line.amount || 0), 0)}
				{@const accountCurrency = editTransaction.account ? getAccountCurrency(editTransaction.account.id) : 'USD'}
				{@const isDifferentCurrency = editTransaction.receiptCurrency.trim().toUpperCase() !== accountCurrency.toUpperCase()}
				{#if isDifferentCurrency}
					{#if editTransaction.receiptTotal > 0 && editTransaction.total > 0}
						<div class="mt-3 text-sm text-blue-800">
							<span class="font-medium">Exchange Rate:</span> {(editTransaction.receiptTotal / editTransaction.total).toFixed(6)} {editTransaction.receiptCurrency} per {accountCurrency}
						</div>
					{/if}
					{#if lineSum !== editTransaction.receiptTotal}
						<div class="mt-2 text-sm text-amber-700">
							<span class="font-medium">Line items sum to {lineSum.toFixed(2)} {editTransaction.receiptCurrency}</span> (should equal receipt total)
						</div>
					{/if}
				{:else if editTransaction.total > 0}
					{#if lineSum !== editTransaction.total}
						<div class="mt-3 text-sm text-amber-700">
							<span class="font-medium">Line items sum to {lineSum.toFixed(2)}</span> (should equal {editTransaction.total.toFixed(2)})
						</div>
					{/if}
				{/if}
			{/if}
		</div>

		<TextInput
			label="Counterparty"
			type="text"
			placeholder="e.g., Coffee Shop"
			bind:value={editTransaction.counterparty}
		/>

		<TextInput
			label="Memo"
			type="text"
			placeholder="Description of the transaction"
			bind:value={editTransaction.memo}
		/>

		<Typeahead
			label="Tags"
			placeholder="Search or create tags..."
			bind:value={editTransaction.tags}
			options={tags}
			displayField="name"
			valueField="id"
			creatable={true}
			onCreate={createTag}
			multiple={true}
		/>

		<div class="border-t border-gray-200 pt-4">
			<div class="flex items-center justify-between mb-4">
				<h4 class="text-sm font-medium text-gray-900">Transaction Lines</h4>
				<Button size="small" variant="outline" onclick={addEditTransactionLine}>
					<svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					Add Line
				</Button>
			</div>

			<div class="space-y-4">
				{#each editTransaction.lines as line, index}
					<div class="p-4 bg-gray-50 rounded-lg space-y-3">
						<div class="flex items-start justify-between">
							<span class="text-sm font-medium text-gray-700">Line {index + 1}</span>
							{#if editTransaction.lines.length > 1}
								<button
									onclick={() => removeEditTransactionLine(index)}
									class="text-red-600 hover:text-red-800 text-sm"
								>
									Remove
								</button>
							{/if}
						</div>

						<div class="space-y-3">
							<Typeahead
								label="Category"
								placeholder="Search or create category..."
								bind:value={line.category}
								options={categories}
								displayField="name"
								valueField="id"
								creatable={true}
								onCreate={createCategory}
							/>

							<TextInput
								label="Description"
								type="text"
								placeholder="Line description"
								bind:value={line.description}
							/>

							<TextInput
								label="Amount ({editTransaction.receiptCurrency || (editTransaction.account ? getAccountCurrency(editTransaction.account.id) : 'Receipt Currency')})"
								type="number"
								step="any"
								placeholder="0.00 (negative for discounts)"
								bind:value={line.amount}
								required
							/>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Attachments Section -->
		<div class="border-t border-gray-200 pt-4">
			<h4 class="text-sm font-medium text-gray-900 mb-3">Attachments</h4>

			<!-- Existing Attachments -->
			{#if selectedTransactionAttachments.length > 0}
				<div class="space-y-2 mb-4">
					<p class="text-xs text-gray-600 mb-2">Existing attachments:</p>
					{#each selectedTransactionAttachments as attachment}
						<div class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
							<button
								onclick={() => viewAttachment(attachment.id, attachment.filename)}
								class="flex items-center gap-2 text-blue-600 hover:text-blue-800"
							>
								<i class="fas fa-file text-gray-400"></i>
								<span>{attachment.filename}</span>
								<span class="text-gray-500 text-xs">({formatFileSize(attachment.file_size)})</span>
							</button>
							<button
								onclick={() => deleteAttachment(attachment.id)}
								class="text-red-600 hover:text-red-800"
								title="Delete attachment"
							>
								<i class="fas fa-trash"></i>
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add New Attachments -->
			<div class="space-y-2">
				<p class="text-xs text-gray-600 mb-2">Add new attachments:</p>
				<input
					type="file"
					multiple
					accept="image/*,.pdf"
					onchange={handleFileSelect}
					class="block w-full text-sm text-gray-500
						file:mr-4 file:py-2 file:px-4
						file:rounded file:border-0
						file:text-sm file:font-semibold
						file:bg-blue-50 file:text-blue-700
						hover:file:bg-blue-100
						cursor-pointer"
				/>
				{#if uploadingFiles.length > 0}
					<div class="mt-2 space-y-1">
						{#each uploadingFiles as file, index}
							<div class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
								<div class="flex items-center gap-2">
									<i class="fas fa-file text-gray-400"></i>
									<span class="text-gray-700">{file.name}</span>
									<span class="text-gray-500">({formatFileSize(file.size)})</span>
								</div>
								<button
									onclick={() => removeUploadingFile(index)}
									class="text-red-600 hover:text-red-800"
									aria-label="Remove file"
								>
									<i class="fas fa-times"></i>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="flex justify-between items-center w-full">
			<Button
				variant="outline"
				onclick={() => handleDeleteTransaction(editTransaction.id)}
				class="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
			>
				<i class="fas fa-trash mr-2"></i>
				Delete
			</Button>
			<div class="flex gap-3">
				<Button variant="outline" onclick={() => {
					editTransactionModalOpen = false;
					uploadingFiles = [];
				}}>
					Cancel
				</Button>
				<Button onclick={handleUpdateTransaction}>
					Update Transaction
				</Button>
			</div>
		</div>
	{/snippet}
</Modal>
