<script lang="ts">
	import '../app.css';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { confirmationStore } from '$lib/stores/confirmationStore';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let { children } = $props();

	const confirmation = $derived($confirmationStore);

	onMount(() => {
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				console.error('Service worker registration failed:', err);
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
</svelte:head>

{@render children()}

<ConfirmationDialog
	bind:open={confirmation.open}
	title={confirmation.title}
	message={confirmation.message || ''}
	confirmText={confirmation.confirmText}
	cancelText={confirmation.cancelText}
	variant={confirmation.variant}
	onconfirm={confirmationStore.handleConfirm}
	oncancel={confirmationStore.handleCancel}
/>
