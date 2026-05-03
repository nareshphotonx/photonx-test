export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  requestId: string | null;
  timestamp: string;
  path: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  errorCode: string;
  details?: unknown;
  requestId: string | null;
  timestamp: string;
  path: string;
}
