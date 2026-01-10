<script lang="ts">
	import Navigation from '$lib/components/Navigation.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import TextInput from '$lib/components/TextInput.svelte';
	import { confirm } from '$lib/stores/confirmationStore';
	import { onMount } from 'svelte';

	interface Tag {
		id: number;
		name: string;
		color: string | null;
	}

	let tags = $state<Tag[]>([]);
	let loading = $state(true);
	let addTagModalOpen = $state(false);
	let editTagModalOpen = $state(false);
	let viewTagModalOpen = $state(false);
	let selectedTag = $state<Tag | null>(null);

	let newTag = $state({
		name: '',
		color: '#3B82F6'
	});

	let editTag = $state({
		id: 0,
		name: '',
		color: '#3B82F6'
	});

	const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];

	onMount(async () => {
		try {
			await fetchTags();
		} catch (error) {
			console.error('Error loading tags:', error);
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

	async function fetchTags() {
		try {
			const response = await fetch('/api/tags?limit=1000&sort=name', {
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

	async function handleAddTag() {
		try {
			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					name: newTag.name,
					color: newTag.color
				})
			});

			if (response.ok) {
				addTagModalOpen = false;
				await fetchTags();
				newTag = {
					name: '',
					color: '#3B82F6'
				};
			} else {
				const error = await response.json();
				alert(error.error?.message || 'Failed to create tag');
			}
		} catch (error) {
			console.error('Failed to create tag:', error);
			alert('Failed to create tag');
		}
	}

	function handleEditTag(tag: Tag) {
		selectedTag = tag;
		editTag = {
			id: tag.id,
			name: tag.name,
			color: tag.color || '#3B82F6'
		};
		editTagModalOpen = true;
	}

	async function handleUpdateTag() {
		if (!selectedTag) return;

		try {
			const response = await fetch(`/api/tags/${selectedTag.id}`, {
				method: 'PATCH',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					name: editTag.name,
					color: editTag.color
				})
			});

			if (response.ok) {
				editTagModalOpen = false;
				await fetchTags();
			} else {
				const error = await response.json();
				alert(error.error?.message || 'Failed to update tag');
			}
		} catch (error) {
			console.error('Failed to update tag:', error);
			alert('Failed to update tag');
		}
	}

	async function handleDeleteTag(id: number) {
		const confirmed = await confirm(
			'Are you sure you want to delete this tag? This action cannot be undone.',
			{
				title: 'Delete Tag',
				confirmText: 'Delete',
				cancelText: 'Cancel',
				variant: 'danger'
			}
		);

		if (!confirmed) {
			return;
		}

		try {
			const response = await fetch(`/api/tags/${id}`, {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (!response.ok) {
				const error = await response.json();
				alert(error.error?.message || 'Failed to delete tag');
				return;
			}

			tags = tags.filter(t => t.id !== id);
			editTagModalOpen = false;
			viewTagModalOpen = false;
			selectedTag = null;
		} catch (error) {
			console.error('Failed to delete tag:', error);
			alert('Failed to delete tag');
		}
	}
</script>

<svelte:head>
	<title>Tags - Accounting App</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<Navigation />

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Tags</h1>
				<p class="mt-1 text-sm text-gray-600">Tag and organize your transactions</p>
			</div>
			<Button onclick={() => addTagModalOpen = true}>
				<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add Tag
			</Button>
		</div>

		<Card title="All Tags" subtitle="Flexible tagging system">
			{#if loading}
				<div class="text-center py-12">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					<p class="mt-2 text-sm text-gray-600">Loading tags...</p>
				</div>
			{:else if tags.length === 0}
				<div class="text-center py-12">
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No tags</h3>
					<p class="mt-1 text-sm text-gray-500">Get started by creating your first tag.</p>
					<div class="mt-6">
						<Button onclick={() => addTagModalOpen = true}>
							Add Tag
						</Button>
					</div>
				</div>
			{:else}
				<!-- Mobile Card View -->
				<div class="space-y-3 md:hidden">
					{#each tags as tag}
						<div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2 flex-1 min-w-0">
									{#if tag.color}
										<div class="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0" style="background-color: {tag.color}"></div>
									{/if}
									<span class="text-sm font-semibold text-gray-900 truncate">{tag.name}</span>
								</div>
								<button
									onclick={() => handleEditTag(tag)}
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
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each tags as tag}
								<tr class="hover:bg-gray-50 transition-colors">
									<td class="px-6 py-4 whitespace-nowrap">
										<div class="flex items-center gap-2">
											{#if tag.color}
												<div class="w-4 h-4 rounded-full border border-gray-300" style="background-color: {tag.color}"></div>
											{/if}
											<span class="text-sm font-medium text-gray-900">{tag.name}</span>
										</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										{#if tag.color}
											<div class="flex items-center gap-2">
												<div class="w-6 h-6 rounded-full border border-gray-300" style="background-color: {tag.color}"></div>
												<span class="text-sm text-gray-600">{tag.color}</span>
											</div>
										{:else}
											<span class="text-sm text-gray-600">-</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
										<div class="flex justify-end gap-3">
											<button
												onclick={() => handleEditTag(tag)}
												class="text-gray-600 hover:text-gray-900 transition-colors"
												title="Edit tag"
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

<Modal bind:open={addTagModalOpen} title="Add Tag">
	<div class="space-y-4">
		<TextInput
			label="Tag Name"
			type="text"
			placeholder="e.g., Business Trip"
			bind:value={newTag.name}
			required
		/>

		<div>
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Color
			</label>
			<div class="flex gap-2 flex-wrap">
				{#each colors as color}
					<button
						type="button"
						onclick={() => newTag.color = color}
						class="w-10 h-10 rounded-full border-2 transition-all {newTag.color === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:scale-105'}"
						style="background-color: {color}"
					></button>
				{/each}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" onclick={() => addTagModalOpen = false}>
			Cancel
		</Button>
		<Button onclick={handleAddTag}>
			Create Tag
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={editTagModalOpen} title="Edit Tag">
	<div class="space-y-4">
		<TextInput
			label="Tag Name"
			type="text"
			placeholder="e.g., Business Trip"
			bind:value={editTag.name}
			required
		/>

		<div>
			<label class="block text-sm font-medium text-gray-700 mb-2">
				Color
			</label>
			<div class="flex gap-2 flex-wrap">
				{#each colors as color}
					<button
						type="button"
						onclick={() => editTag.color = color}
						class="w-10 h-10 rounded-full border-2 transition-all {editTag.color === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:scale-105'}"
						style="background-color: {color}"
					></button>
				{/each}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="flex justify-between items-center w-full">
			<Button
				variant="outline"
				onclick={() => handleDeleteTag(editTag.id)}
				class="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
			>
				<i class="fas fa-trash mr-2"></i>
				Delete
			</Button>
			<div class="flex gap-3">
				<Button variant="outline" onclick={() => editTagModalOpen = false}>
					Cancel
				</Button>
				<Button onclick={handleUpdateTag}>
					Update Tag
				</Button>
			</div>
		</div>
	{/snippet}
</Modal>

<Modal bind:open={viewTagModalOpen} title="Tag Details">
	{#if selectedTag}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Tag Name</label>
					<p class="text-sm text-gray-900">{selectedTag.name}</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
					<div class="flex items-center gap-2">
						<div class="w-6 h-6 rounded-full border border-gray-300" style="background-color: {selectedTag.color || '#3B82F6'}"></div>
						<span class="text-sm text-gray-900">{selectedTag.color || '-'}</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="outline" onclick={() => viewTagModalOpen = false}>
			Close
		</Button>
	{/snippet}
</Modal>
