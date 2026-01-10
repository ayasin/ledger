<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { confirmationStore } from '$lib/stores/confirmationStore';

	let { children } = $props();

	const confirmation = $derived($confirmationStore);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
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
