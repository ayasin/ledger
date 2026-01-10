<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	interface Props {
		open?: boolean;
		accountId?: number;
		accountName?: string;
		onclose?: () => void;
		onimport?: (data: ImportData) => void;
	}

	interface Category {
		id: number;
		name: string;
	}

	interface Tag {
		id: number;
		name: string;
	}

	export interface ImportData {
		accountId: number;
		columnMapping: Record<string, string>;
		rows: string[][];
		hasHeader: boolean;
	}

	let {
		open = $bindable(false),
		accountId,
		accountName,
		onclose,
		onimport
	}: Props = $props();

	let file: File | null = $state(null);
	let csvData: string[][] = $state([]);
	let headers: string[] = $state([]);
	let hasHeader = $state(true);
	let previewRows: string[][] = $state([]);
	let step = $state<'upload' | 'mapping'>('upload');
	let importing = $state(false);

	// Column mapping: CSV column index -> field name
	let columnMapping = $state<Record<string, string>>({});

	const availableFields = [
		{ value: '', label: '-- Skip Column --' },
		{ value: 'date', label: 'Transaction Date (Required)' },
		{ value: 'counterparty', label: 'Counterparty' },
		{ value: 'amount', label: 'Amount (Required)' },
		{ value: 'receipt_currency', label: 'Receipt Currency' },
		{ value: 'receipt_amount', label: 'Receipt Amount' },
		{ value: 'exchange_rate', label: 'Exchange Rate' },
		{ value: 'reference', label: 'Reference' },
		{ value: 'memo', label: 'Memo' },
		{ value: 'category', label: 'Category Name' },
		{ value: 'description', label: 'Line Description' },
		{ value: 'tags', label: 'Tags (comma-separated)' }
	];

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			file = target.files[0];
			parseCSV(file);
		}
	}

	async function parseCSV(file: File) {
		const text = await file.text();
		const lines = text.split('\n').filter(line => line.trim());

		const parsed = lines.map(line => {
			// Simple CSV parsing (handles quoted values)
			const values: string[] = [];
			let current = '';
			let inQuotes = false;

			for (let i = 0; i < line.length; i++) {
				const char = line[i];

				if (char === '"') {
					if (inQuotes && line[i + 1] === '"') {
						current += '"';
						i++;
					} else {
						inQuotes = !inQuotes;
					}
				} else if (char === ',' && !inQuotes) {
					values.push(current.trim());
					current = '';
				} else {
					current += char;
				}
			}
			values.push(current.trim());

			return values;
		});

		csvData = parsed;

		if (parsed.length > 0) {
			if (hasHeader) {
				headers = parsed[0];
				previewRows = parsed.slice(1, 6); // Show first 5 data rows
			} else {
				headers = parsed[0].map((_, i) => `Column ${i + 1}`);
				previewRows = parsed.slice(0, 5);
			}

			// Auto-detect common column names
			autoMapColumns();
			step = 'mapping';
		}
	}

	function autoMapColumns() {
		headers.forEach((header, index) => {
			const lower = header.toLowerCase();

			if (lower.includes('date')) {
				columnMapping[index.toString()] = 'date';
			} else if (lower.includes('amount') || lower.includes('total')) {
				if (!Object.values(columnMapping).includes('amount')) {
					columnMapping[index.toString()] = 'amount';
				}
			} else if (lower.includes('description') || lower.includes('memo')) {
				if (!Object.values(columnMapping).includes('description')) {
					columnMapping[index.toString()] = 'description';
				} else {
					columnMapping[index.toString()] = 'memo';
				}
			} else if (lower.includes('counterparty') || lower.includes('vendor') || lower.includes('merchant')) {
				columnMapping[index.toString()] = 'counterparty';
			} else if (lower.includes('category')) {
				columnMapping[index.toString()] = 'category';
			} else if (lower.includes('reference') || lower.includes('ref')) {
				columnMapping[index.toString()] = 'reference';
			} else if (lower.includes('tag')) {
				columnMapping[index.toString()] = 'tags';
			}
		});
	}

	function handleImport() {
		if (!accountId) return;

		// Validate required fields are mapped
		const mappedFields = Object.values(columnMapping);
		if (!mappedFields.includes('date')) {
			alert('Please map the Date column');
			return;
		}
		if (!mappedFields.includes('amount')) {
			alert('Please map the Amount column');
			return;
		}

		const dataRows = hasHeader ? csvData.slice(1) : csvData;

		onimport?.({
			accountId,
			columnMapping,
			rows: dataRows,
			hasHeader
		});
	}

	function reset() {
		file = null;
		csvData = [];
		headers = [];
		previewRows = [];
		step = 'upload';
		columnMapping = {};
		hasHeader = true;
	}

	function handleClose() {
		reset();
		onclose?.();
	}
</script>

<Modal bind:open={open} title="Import Transactions from CSV" onclose={handleClose}>
	{#snippet children()}
		{#if step === 'upload'}
			<div class="space-y-4">
				<div>
					<p class="text-sm text-gray-600 mb-4">
						Import transactions for <strong>{accountName}</strong> from a CSV file.
						Each row will create one transaction with one line item.
					</p>
				</div>

				<div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
					<input
						type="file"
						accept=".csv"
						onchange={handleFileSelect}
						class="hidden"
						id="csv-upload"
					/>
					<label for="csv-upload" class="cursor-pointer">
						<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
						</svg>
						<p class="mt-2 text-sm text-gray-600">
							<span class="font-medium text-blue-600 hover:text-blue-500">Click to upload</span>
							or drag and drop
						</p>
						<p class="text-xs text-gray-500 mt-1">CSV files only</p>
					</label>
				</div>

				<div class="flex items-center">
					<input
						type="checkbox"
						id="has-header"
						bind:checked={hasHeader}
						class="h-4 w-4 text-blue-600 border-gray-300 rounded"
					/>
					<label for="has-header" class="ml-2 text-sm text-gray-700">
						First row contains column headers
					</label>
				</div>
			</div>
		{:else if step === 'mapping'}
			<div class="space-y-4">
				<div>
					<h3 class="text-sm font-medium text-gray-900 mb-2">Map CSV Columns to Fields</h3>
					<p class="text-xs text-gray-500">
						Select which field each column should map to. Date and Amount are required.
					</p>
				</div>

				<!-- Column Mapping -->
				<div class="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50 sticky top-0">
							<tr>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CSV Column</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Map To</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sample Data</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each headers as header, index}
								<tr>
									<td class="px-4 py-2 text-sm font-medium text-gray-900">
										{header}
									</td>
									<td class="px-4 py-2">
										<select
											bind:value={columnMapping[index.toString()]}
											class="block w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											{#each availableFields as field}
												<option value={field.value}>{field.label}</option>
											{/each}
										</select>
									</td>
									<td class="px-4 py-2 text-sm text-gray-600 truncate max-w-xs">
										{previewRows[0]?.[index] || '-'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Preview -->
				<div>
					<h3 class="text-sm font-medium text-gray-900 mb-2">Preview (First 5 Rows)</h3>
					<div class="overflow-x-auto border border-gray-200 rounded-lg">
						<table class="min-w-full divide-y divide-gray-200 text-xs">
							<thead class="bg-gray-50">
								<tr>
									{#each headers as header}
										<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">
											{header}
										</th>
									{/each}
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each previewRows as row}
									<tr>
										{#each row as cell}
											<td class="px-3 py-2 text-gray-600 whitespace-nowrap">{cell}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}
	{/snippet}

	{#snippet footer()}
		{#if step === 'mapping'}
			<Button variant="outline" onclick={() => step = 'upload'}>
				Back
			</Button>
		{/if}
		<Button variant="outline" onclick={handleClose}>
			Cancel
		</Button>
		{#if step === 'mapping'}
			<Button variant="primary" onclick={handleImport} disabled={importing}>
				{importing ? 'Importing...' : 'Import Transactions'}
			</Button>
		{/if}
	{/snippet}
</Modal>
