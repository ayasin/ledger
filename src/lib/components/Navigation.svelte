<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let mobileMenuOpen = $state(false);

	interface NavItem {
		name: string;
		href: string;
		icon: string;
	}

	const navigation: NavItem[] = [
		{ name: 'Dashboard', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
		{ name: 'Accounts', href: '/accounts', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
		{ name: 'Categories', href: '/categories', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
		{ name: 'Tags', href: '/tags', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14' },
		{ name: 'Reports', href: '/reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
	];

	function isActive(href: string): boolean {
		return $page.url.pathname === href;
	}

	function handleLogout() {
		localStorage.removeItem('auth_token');
		goto('/login');
	}
</script>

<nav class="bg-white border-b border-gray-200">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between h-16">
			<div class="flex">
				<div class="flex-shrink-0 flex items-center">
					<h1 class="text-xl font-bold text-gray-900">Spending Ledger</h1>
				</div>
				<div class="hidden sm:ml-8 sm:flex sm:space-x-4">
					{#each navigation as item}
						<a
							href={item.href}
							class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors {isActive(item.href)
								? 'text-blue-600 bg-blue-50'
								: 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}"
						>
							<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
							</svg>
							{item.name}
						</a>
					{/each}
				</div>
			</div>
			<div class="hidden sm:ml-6 sm:flex sm:items-center">
				<button
					onclick={handleLogout}
					class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
					title="Logout"
				>
					<svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
					</svg>
					Logout
				</button>
			</div>
			<div class="flex items-center sm:hidden">
				<button
					onclick={() => mobileMenuOpen = !mobileMenuOpen}
					class="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
				>
					<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						{#if mobileMenuOpen}
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
						{/if}
					</svg>
				</button>
			</div>
		</div>
	</div>

	{#if mobileMenuOpen}
		<div class="sm:hidden border-t border-gray-200">
			<div class="px-2 pt-2 pb-3 space-y-1">
				{#each navigation as item}
					<a
						href={item.href}
						class="flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors {isActive(item.href)
							? 'text-blue-600 bg-blue-50'
							: 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'}"
						onclick={() => mobileMenuOpen = false}
					>
						<svg class="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
						</svg>
						{item.name}
					</a>
				{/each}
				<button
					onclick={handleLogout}
					class="w-full flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
				>
					<svg class="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
					</svg>
					Logout
				</button>
			</div>
		</div>
	{/if}
</nav>
