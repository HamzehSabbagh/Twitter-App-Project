export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL =
  configuredApiBaseUrl && configuredApiBaseUrl.length > 0
    ? configuredApiBaseUrl
    : "http://127.0.0.1:8000/api";

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data?.message ||
      data?.errors?.[Object.keys(data.errors)[0]]?.[0] ||
      `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}
