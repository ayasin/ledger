import { writable } from 'svelte/store';

export interface ConfirmationOptions {
	title?: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmationState extends ConfirmationOptions {
	open: boolean;
	resolve?: (value: boolean) => void;
}

function createConfirmationStore() {
	const { subscribe, set, update } = writable<ConfirmationState>({
		open: false,
		message: ''
	});

	return {
		subscribe,
		confirm: (options: ConfirmationOptions): Promise<boolean> => {
			return new Promise((resolve) => {
				set({
					...options,
					open: true,
					resolve
				});
			});
		},
		handleConfirm: () => {
			update((state) => {
				state.resolve?.(true);
				return { ...state, open: false };
			});
		},
		handleCancel: () => {
			update((state) => {
				state.resolve?.(false);
				return { ...state, open: false };
			});
		}
	};
}

export const confirmationStore = createConfirmationStore();

export async function confirm(
	message: string,
	options: Omit<ConfirmationOptions, 'message'> = {}
): Promise<boolean> {
	return confirmationStore.confirm({ message, ...options });
}
