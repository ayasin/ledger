<script lang="ts" generics="T extends Record<string, any>">
	interface Props {
		label?: string;
		placeholder?: string;
		value?: T | T[] | null;
		options: T[];
		displayField?: keyof T;
		valueField?: keyof T;
		required?: boolean;
		disabled?: boolean;
		error?: string;
		maxResults?: number;
		creatable?: boolean;
		onCreate?: (name: string) => Promise<T> | T;
		multiple?: boolean;
	}

	let {
		label,
		placeholder = 'Search...',
		value = $bindable(null),
		options = [],
		displayField = 'name' as keyof T,
		valueField = 'id' as keyof T,
		required = false,
		disabled = false,
		error,
		maxResults = 50,
		creatable = false,
		onCreate,
		multiple = false
	}: Props = $props();

	let searchQuery = $state('');
	let isOpen = $state(false);
	let highlightedIndex = $state(0);
	let inputElement: HTMLInputElement;
	let dropdownElement: HTMLDivElement;
	let isCreating = $state(false);

	// Generate unique ID for accessibility
	const inputId = `typeahead-${Math.random().toString(36).substr(2, 9)}`;

	// Filter options based on search query
	let filteredOptions = $derived.by(() => {
		if (!searchQuery.trim()) {
			return options.slice(0, maxResults);
		}
		const query = searchQuery.toLowerCase();
		return options
			.filter((option) => {
				const displayValue = String(option[displayField]);
				return displayValue.toLowerCase().includes(query);
			})
			.slice(0, maxResults);
	});

	// Check if we should show "Create new" option
	let showCreateOption = $derived.by(() => {
		if (!creatable || !searchQuery.trim() || isCreating) return false;
		const query = searchQuery.toLowerCase();
		const exactMatch = options.some((option) => {
			const displayValue = String(option[displayField]);
			return displayValue.toLowerCase() === query;
		});
		return !exactMatch;
	});

	// Update search query when value changes externally
	$effect(() => {
		if (!multiple && value && !Array.isArray(value)) {
			searchQuery = String(value[displayField]);
		} else if (!isOpen) {
			searchQuery = '';
		}
	});

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		isOpen = true;
		highlightedIndex = 0;
	}

	function handleFocus() {
		isOpen = true;
		highlightedIndex = 0;
	}

	function handleBlur(event: FocusEvent) {
		// Delay to allow click events on dropdown items
		setTimeout(() => {
			if (!dropdownElement?.contains(event.relatedTarget as Node)) {
				isOpen = false;
				// Reset to selected value if exists (single mode), otherwise clear
				if (!multiple && value && !Array.isArray(value)) {
					searchQuery = String(value[displayField]);
				} else {
					searchQuery = '';
				}
			}
		}, 200);
	}

	function selectOption(option: T) {
		if (multiple) {
			const currentArray = Array.isArray(value) ? value : [];
			// Check if already selected
			const isSelected = currentArray.some(item => item[valueField] === option[valueField]);
			if (!isSelected) {
				value = [...currentArray, option] as T[];
			}
			searchQuery = '';
			inputElement?.focus();
		} else {
			value = option;
			searchQuery = String(option[displayField]);
			isOpen = false;
			inputElement?.blur();
		}
	}

	function removeOption(option: T) {
		if (multiple && Array.isArray(value)) {
			value = value.filter(item => item[valueField] !== option[valueField]) as T[];
		}
	}

	async function createNewOption() {
		if (!onCreate || !searchQuery.trim() || isCreating) return;

		isCreating = true;
		try {
			const newOption = await onCreate(searchQuery.trim());
			if (multiple) {
				const currentArray = Array.isArray(value) ? value : [];
				value = [...currentArray, newOption] as T[];
				searchQuery = '';
				inputElement?.focus();
			} else {
				value = newOption;
				searchQuery = String(newOption[displayField]);
				isOpen = false;
				inputElement?.blur();
			}
		} catch (error) {
			console.error('Failed to create new option:', error);
		} finally {
			isCreating = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			isOpen = true;
			event.preventDefault();
			return;
		}

		if (!isOpen) return;

		const maxIndex = filteredOptions.length - 1 + (showCreateOption ? 1 : 0);

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, maxIndex);
				scrollToHighlighted();
				break;
			case 'ArrowUp':
				event.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				scrollToHighlighted();
				break;
			case 'Enter':
				event.preventDefault();
				if (showCreateOption && highlightedIndex === filteredOptions.length) {
					createNewOption();
				} else if (filteredOptions[highlightedIndex]) {
					selectOption(filteredOptions[highlightedIndex]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				isOpen = false;
				if (!multiple && value && !Array.isArray(value)) {
					searchQuery = String(value[displayField]);
				} else {
					searchQuery = '';
				}
				inputElement?.blur();
				break;
			case 'Tab':
				isOpen = false;
				if (!multiple && value && !Array.isArray(value)) {
					searchQuery = String(value[displayField]);
				} else {
					searchQuery = '';
				}
				break;
		}
	}

	function scrollToHighlighted() {
		setTimeout(() => {
			const highlighted = dropdownElement?.querySelector('[data-highlighted="true"]');
			highlighted?.scrollIntoView({ block: 'nearest' });
		}, 0);
	}

	function clearSelection(event: Event) {
		event.stopPropagation();
		if (multiple) {
			value = [] as T[];
		} else {
			value = null;
		}
		searchQuery = '';
		isOpen = false;
		inputElement?.focus();
	}
</script>

<div class="flex flex-col gap-2 w-full relative">
	{#if label}
		<label for={inputId} class="text-sm font-medium text-gray-700">
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</label>
	{/if}

	<!-- Selected items chips (for multiple mode) -->
	{#if multiple && Array.isArray(value) && value.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each value as item}
				<span class="inline-flex items-center px-2 py-1 rounded text-sm bg-blue-100 text-blue-800 border border-blue-200">
					{String(item[displayField])}
					<button
						type="button"
						onclick={() => removeOption(item)}
						class="ml-1 hover:text-blue-900"
						tabindex="-1"
						aria-label="Remove {String(item[displayField])}"
					>
						<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</span>
			{/each}
		</div>
	{/if}

	<div class="relative">
		<input
			bind:this={inputElement}
			id={inputId}
			type="text"
			{placeholder}
			{required}
			{disabled}
			bind:value={searchQuery}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			autocomplete="off"
			class="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-md text-base transition-all bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed {error
				? 'border-red-500 focus:border-red-500 focus:ring-red-100'
				: ''}"
		/>

		{#if !disabled && ((multiple && Array.isArray(value) && value.length > 0) || (!multiple && value))}
			<button
				type="button"
				onclick={clearSelection}
				class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
				tabindex="-1"
				aria-label="Clear selection"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{:else if !disabled}
			<div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
				</svg>
			</div>
		{/if}
	</div>

	{#if isOpen && !disabled}
		<div
			bind:this={dropdownElement}
			class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50"
		>
			{#if filteredOptions.length === 0 && !showCreateOption}
				<div class="px-3.5 py-2.5 text-sm text-gray-500">No results found</div>
			{:else}
				{#each filteredOptions as option, index}
					<button
						type="button"
						class="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors {highlightedIndex === index ? 'bg-blue-50' : ''}"
						data-highlighted={highlightedIndex === index}
						onclick={() => selectOption(option)}
						onmouseenter={() => (highlightedIndex = index)}
					>
						<div class="text-sm text-gray-900">
							{String(option[displayField])}
						</div>
					</button>
				{/each}

				{#if showCreateOption}
					<button
						type="button"
						class="w-full text-left px-3.5 py-2.5 border-t border-gray-200 hover:bg-green-50 focus:bg-green-50 focus:outline-none transition-colors {highlightedIndex === filteredOptions.length ? 'bg-green-50' : ''}"
						data-highlighted={highlightedIndex === filteredOptions.length}
						onclick={createNewOption}
						onmouseenter={() => (highlightedIndex = filteredOptions.length)}
						disabled={isCreating}
					>
						<div class="flex items-center gap-2 text-sm">
							{#if isCreating}
								<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
								<span class="text-gray-600">Creating...</span>
							{:else}
								<svg class="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
								</svg>
								<span class="text-green-600 font-medium">Create "{searchQuery}"</span>
							{/if}
						</div>
					</button>
				{/if}
			{/if}
		</div>
	{/if}

	{#if error}
		<span class="text-sm text-red-500">{error}</span>
	{/if}
</div>
