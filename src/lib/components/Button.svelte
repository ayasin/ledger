<script lang="ts">
	interface Props {
		variant?: 'primary' | 'secondary' | 'outline' | 'danger';
		size?: 'small' | 'medium' | 'large';
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (event: MouseEvent) => void;
		children?: import('svelte').Snippet;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'medium',
		disabled = false,
		type = 'button',
		onclick,
		children,
		class: className = ''
	}: Props = $props();

	const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

	const sizeClasses = {
		small: 'px-3 py-1.5 text-sm',
		medium: 'px-4 py-2.5 text-base',
		large: 'px-6 py-3 text-lg'
	};

	const variantClasses = {
		primary: 'bg-blue-600 text-white border-transparent hover:bg-blue-700 active:bg-blue-800',
		secondary: 'bg-gray-600 text-white border-transparent hover:bg-gray-700 active:bg-gray-800',
		outline: 'bg-transparent border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100',
		danger: 'bg-red-500 text-white border-transparent hover:bg-red-600 active:bg-red-700'
	};
</script>

<button
	{type}
	{disabled}
	onclick={onclick}
	class="{baseClasses} {sizeClasses[size]} {variantClasses[variant]}"
>
	{#if children}
		{@render children()}
	{/if}
</button>
