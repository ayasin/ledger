<script lang="ts">
	interface Props {
		label?: string;
		type?: string;
		placeholder?: string;
		value?: string | number;
		required?: boolean;
		disabled?: boolean;
		error?: string;
	}

	let {
		label,
		type = 'text',
		placeholder,
		value = $bindable(''),
		required = false,
		disabled = false,
		error
	}: Props = $props();
</script>

<div class="flex flex-col gap-2 w-full">
	{#if label}
		<label class="text-sm font-medium text-gray-700" for={`${placeholder}-input`}>
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</label>
	{/if}
	<input
		id={`${placeholder}-input`}
		{type}
		{placeholder}
		{required}
		{disabled}
		bind:value
		class="px-3.5 py-2.5 border border-gray-300 rounded-md text-sm transition-all bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed {error ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}"
	/>
	{#if error}
		<span class="text-sm text-red-500">{error}</span>
	{/if}
</div>
