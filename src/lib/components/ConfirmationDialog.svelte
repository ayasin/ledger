<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	interface Props {
		open?: boolean;
		title?: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'danger' | 'warning' | 'info';
		onconfirm?: () => void;
		oncancel?: () => void;
	}

	let {
		open = $bindable(false),
		title = 'Confirm',
		message,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'danger',
		onconfirm,
		oncancel
	}: Props = $props();

	function handleConfirm() {
		open = false;
		onconfirm?.();
	}

	function handleCancel() {
		open = false;
		oncancel?.();
	}

	const iconColors = {
		danger: 'text-red-600 bg-red-100',
		warning: 'text-yellow-600 bg-yellow-100',
		info: 'text-blue-600 bg-blue-100'
	};

	const buttonVariants = {
		danger: 'danger' as const,
		warning: 'primary' as const,
		info: 'primary' as const
	};
</script>

<Modal bind:open={open} {title} onclose={handleCancel}>
	{#snippet children()}
		<div class="flex gap-4">
			<div class="flex-shrink-0">
				<div class="w-12 h-12 rounded-full flex items-center justify-center {iconColors[variant]}">
					{#if variant === 'danger'}
						<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					{:else if variant === 'warning'}
						<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					{:else}
						<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					{/if}
				</div>
			</div>
			<div class="flex-1">
				<p class="text-gray-700 leading-relaxed">{message}</p>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<Button variant="outline" onclick={handleCancel}>
			{cancelText}
		</Button>
		<Button variant={buttonVariants[variant]} onclick={handleConfirm}>
			{confirmText}
		</Button>
	{/snippet}
</Modal>
