<script lang="ts">
	interface Props {
		title?: string;
		subtitle?: string;
		padding?: boolean;
		children?: import('svelte').Snippet;
		headerAction?: import('svelte').Snippet;
	}

	let {
		title,
		subtitle,
		padding = true,
		children,
		headerAction
	}: Props = $props();
</script>

<div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
	{#if title || headerAction}
		<div class="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
			<div class="flex-1 min-w-0">
				{#if title}
					<h3 class="text-lg font-semibold text-gray-900">{title}</h3>
				{/if}
				{#if subtitle}
					<p class="mt-1 text-sm text-gray-600">{subtitle}</p>
				{/if}
			</div>
			{#if headerAction}
				<div class="ml-4 flex-shrink-0">
					{@render headerAction()}
				</div>
			{/if}
		</div>
	{/if}
	<div class="{padding ? 'p-4 sm:p-6' : ''}">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
