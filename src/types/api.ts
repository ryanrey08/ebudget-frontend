/** Shape of every paginated list returned by the API. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/** Normalised error used by the UI regardless of where the request failed. */
export interface ApiError {
  status: number | "FETCH_ERROR" | "PARSING_ERROR" | "TIMEOUT_ERROR" | "CUSTOM_ERROR";
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface MessageResponse {
  message: string;
}
