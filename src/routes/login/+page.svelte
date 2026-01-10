<script lang="ts">
	import TextInput from '$lib/components/TextInput.svelte';
	import Button from '$lib/components/Button.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let emailError = $state('');
	let passwordError = $state('');
	let isLoading = $state(false);
	let generalError = $state('');

	onMount(() => {
		// Redirect to dashboard if already logged in
		const token = localStorage.getItem('auth_token');
		if (token) {
			goto('/');
		}
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();

		emailError = '';
		passwordError = '';
		generalError = '';

		if (!email) {
			emailError = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			emailError = 'Please enter a valid email';
		}

		if (!password) {
			passwordError = 'Password is required';
		} else if (password.length < 8) {
			passwordError = 'Password must be at least 8 characters';
		}

		if (emailError || passwordError) {
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (!response.ok) {
				generalError = data.error?.message || 'Login failed';
				return;
			}

			// Store token in localStorage
			if (data.data?.token) {
				localStorage.setItem('auth_token', data.data.token);
			}

			// Redirect to dashboard
			goto('/');
		} catch (error) {
			console.error('Login error:', error);
			generalError = 'An error occurred. Please try again.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - Accounting App</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 p-4">
	<div class="bg-white rounded-lg shadow-xl p-10 w-full max-w-md">
		<h1 class="text-3xl font-bold text-gray-900 text-center mb-2">Login</h1>
		<p class="text-sm text-gray-600 text-center mb-8">Sign in to your accounting dashboard</p>

		{#if generalError}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
				<p class="text-sm text-red-600">{generalError}</p>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="flex flex-col gap-6">
			<TextInput
				label="Email"
				type="email"
				placeholder="Enter your email"
				bind:value={email}
				error={emailError}
				disabled={isLoading}
				required
			/>

			<TextInput
				label="Password"
				type="password"
				placeholder="Enter your password"
				bind:value={password}
				error={passwordError}
				disabled={isLoading}
				required
			/>

			<div class="mt-2">
				<Button type="submit" size="large" disabled={isLoading}>
					{#if isLoading}
						<div class="flex items-center justify-center gap-2">
							<div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
							<span>Signing in...</span>
						</div>
					{:else}
						<span class="w-full">Sign In</span>
					{/if}
				</Button>
			</div>
		</form>

		<div class="mt-6 text-center">
			<a href="/forgot-password" class="text-sm text-blue-600 hover:underline">
				Forgot password?
			</a>
		</div>
	</div>
</div>
