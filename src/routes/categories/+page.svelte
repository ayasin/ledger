<script lang="ts">
	import Navigation from '$lib/components/Navigation.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import TextInput from '$lib/components/TextInput.svelte';
	import { confirm } from '$lib/stores/confirmationStore';
	import { onMount } from 'svelte';

	interface Category {
		id: number;
		name: string;
		description: string | null;
		type: string | null;
		parent_id: number | null;
		color: string | null;
		budget_amount_cents: number | null;
		status: string;
	}

	let categories = $state<Category[]>([]);
	let loading = $state(true);
	let addCategoryModalOpen = $state(false);
	let editCategoryModalOpen = $state(false);
	let viewCategoryModalOpen = $state(false);
	let selectedCategory = $state<Category | null>(null);

	let newCategory = $state({
		name: '',
		description: '',
		type: '',
		color: '#3B82F6'
	});

	let editCategory = $state({
		id: 0,
		name: '',
		description: '',
		type: '',
		color: '#3B82F6'
	});

	const categoryTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
	const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

	onMount(async () => {
		try {
			await fetchCategories();
		} catch (error) {
			console.error('Error loading categories:', error);
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

	async function fetchCategories() {
		try {
			const response = await fetch('/api/categories?limit=1000&sort=name', {
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

	async function handleAddCategory() {
		try {
			const response = await fetch('/api/categories', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					name: newCategory.name,
					description: newCategory.description || null,
					type: newCategory.type || null,
					color: newCategory.color,
					status: 'active'
				})
			});

			if (response.ok) {
				addCategoryModalOpen = false;
				await fetchCategories();
				newCategory = {
					name: '',
					description: '',
					type: '',
					color: '#3B82F6'
				};
			} else {
				const error = await response.json();
				alert(error.error?.message || 'Failed to create category');
			}
		} catch (error) {
			console.error('Failed to create category:', error);
			alert('Failed to create category');
		}
	}

	function handleViewCategory(category: Category) {
		selectedCategory = category;
		viewCategoryModalOpen = true;
	}

	function handleEditCategory(category: Category) {
		selectedCategory = category;
		editCategory = {
			id: category.id,
			name: category.name,
			description: category.description || '',
			type: category.type || '',
			color: category.color || '#3B82F6'
		};
		editCategoryModalOpen = true;
	}

	async function handleUpdateCategory() {
		if (!selectedCategory) return;

		try {
			const payload: any = {
				name: editCategory.name,
				color: editCategory.color,
				status: selectedCategory.status
			};

			// Only include optional fields if they have values
			if (editCategory.description) {
				payload.description = editCategory.description;
			}
			if (editCategory.type) {
				payload.type = editCategory.type;
			}

			const response = await fetch(`/api/categories/${selectedCategory.id}`, {
				method: 'PATCH',
				headers: getAuthHeaders(),
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				editCategoryModalOpen = false;
				await fetchCategories();
			} else {
				const error = await response.json();
				console.error('Update category error:', error);
				const errorMessage = error.error?.details
					? `Validation failed: ${JSON.stringify(error.error.details)}`
					: error.error?.message || 'Failed to update category';
				alert(errorMessage);
			}
		} catch (error) {
			console.error('Failed to update category:', error);
			alert('Failed to update category');
		}
	}

	async function handleDeleteCategory(id: number) {
		const confirmed = await confirm(
			'Are you sure you want to delete this category? This action cannot be undone.',
			{
				title: 'Delete Category',
				confirmText: 'Delete',
				cancelText: 'Cancel',
				variant: 'danger'
			}
		);

		if (!confirmed) {
			return;
		}

		try {
			const response = await fetch(`/api/categories/${id}`, {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to delete category');
				return;
			}

			categories = categories.filter(c => c.id !== id);
			editCategoryModalOpen = false;
			selectedCategory = null;
		} catch (error) {
			console.error('Failed to delete category:', error);
			alert('Failed to delete category');
		}
	}
</script>

<svelte:head>
	<title>Categories - Accounting App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Navigation />

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Categories</h1>
				<p class="mt-1 text-sm text-gray-600">Organize your transactions</p>
			</div>
			<Button onclick={() => addCategoryModalOpen = true}>
				<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add Category
			</Button>
		</div>

		<Card title="All Categories" subtitle="Categorize your transactions">
			{#if loading}
				<div class="text-center py-12">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					<p class="mt-2 text-sm text-gray-600">Loading categories...</p>
				</div>
			{:else if categories.length === 0}
				<div class="text-center py-12">
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No categories</h3>
					<p class="mt-1 text-sm text-gray-500">Get started by creating your first category.</p>
					<div class="mt-6">
						<Button onclick={() => addCategoryModalOpen = true}>
							Add Category
						</Button>
					</div>
				</div>
			{:else}
				<!-- Mobile Card View -->
				<div class="space-y-3 md:hidden">
					{#each categories as category}
						<div
							class="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
							onclick={() => handleViewCategory(category)}
							role="button"
							tabindex="0"
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewCategory(category); }}
						>
							<div class="flex items-start justify-between mb-2">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										{#if category.color}
											<div class="w-4 h-4 rounded-full border border-gray-300 shrink-0" style="background-color: {category.color}"></div>
										{/if}
										<span class="text-sm font-semibold text-gray-900 truncate">{category.name}</span>
									</div>
									{#if category.type}
										<div class="text-xs text-gray-500 mb-1">Type: {category.type}</div>
									{/if}
									{#if category.description}
										<div class="text-xs text-gray-600 truncate">{category.description}</div>
									{/if}
								</div>
								<button
									onclick={(e) => { e.stopPropagation(); handleEditCategory(category); }}
									class="text-gray-600 hover:text-gray-900 p-2 ml-2"
									title="Edit"
								>
									<i class="fas fa-edit"></i>
								</button>
							</div>
						</div>
					{/each}
				</div>

				<!-- Desktop Table View -->
				<div class="hidden md:block overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each categories as category}
								<tr
									class="hover:bg-gray-50 transition-colors cursor-pointer"
									onclick={() => handleViewCategory(category)}
									role="button"
									tabindex="0"
									onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewCategory(category); }}
								>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{category.name}
									</td>
									<td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
										{category.description || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
										{category.type || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										{#if category.color}
											<div class="flex items-center gap-2">
												<div class="w-6 h-6 rounded-full border border-gray-300" style="background-color: {category.color}"></div>
												<span class="text-sm text-gray-600">{category.color}</span>
											</div>
										{:else}
											<span class="text-sm text-gray-600">-</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
										<div class="flex justify-end gap-3">
											<button
												onclick={(e) => { e.stopPropagation(); handleEditCategory(category); }}
												class="text-gray-600 hover:text-gray-900 transition-colors"
												title="Edit category"
											>
												<i class="fas fa-edit"></i>
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

<Modal bind:open={addCategoryModalOpen} title="Add Category">
	<div class="space-y-4">
		<TextInput
			label="Category Name"
			type="text"
			placeholder="e.g., Office Supplies"
			bind:value={newCategory.name}
			required
		/>

		<TextInput
			label="Description"
			type="text"
			placeholder="Optional description"
			bind:value={newCategory.description}
		/>

		<div>
			<label for="new-category-type" class="block text-sm font-medium text-gray-700 mb-2">
				Type
			</label>
			<select
				id="new-category-type"
				bind:value={newCategory.type}
				class="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
			>
				<option value="">Select a type (optional)</option>
				{#each categoryTypes as type}
					<option value={type}>{type}</option>
				{/each}
			</select>
		</div>

		<div>
			<div class="block text-sm font-medium text-gray-700 mb-2">
				Color
			</div>
			<div class="flex gap-2 flex-wrap">
				{#each colors as color}
					<button
						type="button"
						onclick={() => newCategory.color = color}
						class="w-10 h-10 rounded-full border-2 transition-all {newCategory.color === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:scale-105'}"
						style="background-color: {color}"
						aria-label="Select color {color}"
					></button>
				{/each}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" onclick={() => addCategoryModalOpen = false}>
			Cancel
		</Button>
		<Button onclick={handleAddCategory}>
			Create Category
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={editCategoryModalOpen} title="Edit Category">
	<div class="space-y-4">
		<TextInput
			label="Category Name"
			type="text"
			placeholder="e.g., Office Supplies"
			bind:value={editCategory.name}
			required
		/>

		<TextInput
			label="Description"
			type="text"
			placeholder="Optional description"
			bind:value={editCategory.description}
		/>

		<div>
			<label for="edit-category-type" class="block text-sm font-medium text-gray-700 mb-2">
				Type
			</label>
			<select
				id="edit-category-type"
				bind:value={editCategory.type}
				class="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
			>
				<option value="">Select a type (optional)</option>
				{#each categoryTypes as type}
					<option value={type}>{type}</option>
				{/each}
			</select>
		</div>

		<div>
			<div class="block text-sm font-medium text-gray-700 mb-2">
				Color
			</div>
			<div class="flex gap-2 flex-wrap">
				{#each colors as color}
					<button
						type="button"
						onclick={() => editCategory.color = color}
						class="w-10 h-10 rounded-full border-2 transition-all {editCategory.color === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:scale-105'}"
						style="background-color: {color}"
						aria-label="Select color {color}"
					></button>
				{/each}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="flex justify-between items-center w-full">
			<Button
				variant="outline"
				onclick={() => handleDeleteCategory(editCategory.id)}
				class="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
			>
				<i class="fas fa-trash mr-2"></i>
				Delete
			</Button>
			<div class="flex gap-3">
				<Button variant="outline" onclick={() => editCategoryModalOpen = false}>
					Cancel
				</Button>
				<Button onclick={handleUpdateCategory}>
					Update Category
				</Button>
			</div>
		</div>
	{/snippet}
</Modal>

<Modal bind:open={viewCategoryModalOpen} title="Category Details">
	{#if selectedCategory}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Category Name</div>
					<p class="text-sm text-gray-900">{selectedCategory.name}</p>
				</div>
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Color</div>
					<div class="flex items-center gap-2">
						<div class="w-6 h-6 rounded-full border border-gray-300" style="background-color: {selectedCategory.color || '#3B82F6'}"></div>
						<span class="text-sm text-gray-900">{selectedCategory.color || '-'}</span>
					</div>
				</div>
			</div>

			<div>
				<div class="block text-sm font-medium text-gray-700 mb-1">Description</div>
				<p class="text-sm text-gray-900">{selectedCategory.description || '-'}</p>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Type</div>
					<p class="text-sm text-gray-900">{selectedCategory.type || '-'}</p>
				</div>
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Status</div>
					<p class="text-sm text-gray-900">{selectedCategory.status}</p>
				</div>
			</div>

			{#if selectedCategory.budget_amount_cents}
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Budget</div>
					<p class="text-sm text-gray-900">${(selectedCategory.budget_amount_cents / 100).toFixed(2)}</p>
				</div>
			{/if}

			{#if selectedCategory.parent_id}
				<div>
					<div class="block text-sm font-medium text-gray-700 mb-1">Parent Category ID</div>
					<p class="text-sm text-gray-900">{selectedCategory.parent_id}</p>
				</div>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="outline" onclick={() => viewCategoryModalOpen = false}>
			Close
		</Button>
	{/snippet}
</Modal>
