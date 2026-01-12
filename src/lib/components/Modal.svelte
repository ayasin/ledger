<script lang="ts">
	interface Props {
		open?: boolean;
		title?: string;
		onclose?: () => void;
		children?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}

	let {
		open = $bindable(false),
		title,
		onclose,
		children,
		footer
	}: Props = $props();

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	function close() {
		open = false;
		onclose?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			close();
		}
	}

	function handleBackdropKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		role="presentation"
	>
		<div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slideUp" role="dialog" aria-modal="true">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				{#if title}
					<h2 class="text-xl font-semibold text-gray-900">{title}</h2>
				{/if}
				<button
					onclick={close}
					class="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-500 hover:text-gray-900"
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="px-6 py-4 overflow-y-auto flex-1">
				{#if children}
					{@render children()}
				{/if}
			</div>
			{#if footer}
				<div class="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.animate-fadeIn {
		animation: fadeIn 0.2s ease-out;
	}

	.animate-slideUp {
		animation: slideUp 0.2s ease-out;
	}

	@media (max-width: 640px) {
		.animate-slideUp {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}
	}
</style>
