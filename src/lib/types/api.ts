export interface ApiResponse<T> {
	data: T;
	error?: never;
}

export interface ApiError {
	error: {
		message: string;
		code?: string;
		details?: unknown;
	};
	data?: never;
}

export interface PaginationMeta {
	total: number;
	page: number;
	limit: number;
	pages: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	meta: PaginationMeta;
}

export interface ListOptions {
	page?: number;
	limit?: number;
	sort?: string;
	order?: 'asc' | 'desc';
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
