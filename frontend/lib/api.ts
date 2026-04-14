import Constants from "expo-constants";
import { Platform } from "react-native";

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

export type ApiBaseUrlCandidate = {
  baseUrl: string;
  label: string;
  source: "env" | "expo-host" | "android-emulator" | "localhost";
};

export type ApiProbeResult = {
  candidate: ApiBaseUrlCandidate;
  checkedUrl: string;
  reachable: boolean;
  ok: boolean;
  status: number | null;
  message: string;
};

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const configuredApiPort = process.env.EXPO_PUBLIC_API_PORT?.trim() || "8000";

function normalizeBaseUrl(url: string) {
  const trimmedUrl = url.trim().replace(/\/+$/, "");
  return trimmedUrl.endsWith("/api") ? trimmedUrl : `${trimmedUrl}/api`;
}

function extractHostFromUri(value?: string | null) {
  if (!value) {
    return null;
  }

  const withoutProtocol = value.replace(/^[a-z]+:\/\//i, "");
  const authority = withoutProtocol.split(/[/?#]/)[0];

  if (!authority) {
    return null;
  }

  if (authority.startsWith("[")) {
    const closingBracketIndex = authority.indexOf("]");
    return closingBracketIndex > 0 ? authority.slice(1, closingBracketIndex) : null;
  }

  return authority.split(":")[0] || null;
}

function buildLocalApiBaseUrl(host: string) {
  return normalizeBaseUrl(`http://${host}:${configuredApiPort}`);
}

function resolveApiBaseUrlCandidates(): ApiBaseUrlCandidate[] {
  const candidates: ApiBaseUrlCandidate[] = [];

  if (configuredApiBaseUrl) {
    candidates.push({
      baseUrl: normalizeBaseUrl(configuredApiBaseUrl),
      label: "Configured via EXPO_PUBLIC_API_BASE_URL",
      source: "env",
    });
  }

  const expoHost =
    extractHostFromUri(Constants.expoConfig?.hostUri) ||
    extractHostFromUri(Constants.platform?.hostUri) ||
    extractHostFromUri(Constants.linkingUri) ||
    extractHostFromUri(Constants.experienceUrl);

  if (expoHost && expoHost !== "localhost" && expoHost !== "127.0.0.1") {
    candidates.push({
      baseUrl: buildLocalApiBaseUrl(expoHost),
      label: "Derived from the Expo dev server host",
      source: "expo-host",
    });
  }

  if (Platform.OS === "android") {
    candidates.push({
      baseUrl: buildLocalApiBaseUrl("10.0.2.2"),
      label: "Android emulator loopback",
      source: "android-emulator",
    });
  }

  candidates.push({
    baseUrl: buildLocalApiBaseUrl("127.0.0.1"),
    label: "Localhost on this device",
    source: "localhost",
  });

  return candidates.filter(
    (candidate, index, allCandidates) =>
      allCandidates.findIndex((otherCandidate) => otherCandidate.baseUrl === candidate.baseUrl) === index
  );
}

export const API_BASE_URL_CANDIDATES = resolveApiBaseUrlCandidates();

export const API_BASE_URL =
  API_BASE_URL_CANDIDATES[0]?.baseUrl ?? buildLocalApiBaseUrl("127.0.0.1");

export const API_BASE_URL_SOURCE =
  API_BASE_URL_CANDIDATES[0]?.label ?? "Localhost fallback";

function isNetworkFailure(error: unknown) {
  return (
    error instanceof TypeError &&
    ["Network request failed", "Failed to fetch", "Load failed", "fetch failed"].includes(error.message)
  );
}

function buildNetworkErrorMessage(requestUrl: string, attemptedUrls: string[]) {
  return `Unable to reach the API. Tried: ${attemptedUrls.join(", ")}. Check EXPO_PUBLIC_API_BASE_URL and make sure the backend server or tunnel is running. Original request: ${requestUrl}`;
}

export function toApiNetworkError(error: unknown, requestUrl: string, attemptedUrls: string[] = [requestUrl]) {
  if (isNetworkFailure(error)) {
    return new Error(buildNetworkErrorMessage(requestUrl, attemptedUrls));
  }

  return error;
}

function buildCandidateRequestUrls(input: string) {
  const matchedCandidate = API_BASE_URL_CANDIDATES.find((candidate) => input.startsWith(candidate.baseUrl));

  if (!matchedCandidate) {
    return [input];
  }

  const pathSuffix = input.slice(matchedCandidate.baseUrl.length);

  return API_BASE_URL_CANDIDATES.map((candidate) => `${candidate.baseUrl}${pathSuffix}`).filter(
    (requestUrl, index, allUrls) => allUrls.indexOf(requestUrl) === index
  );
}

export async function apiFetch(input: string, init?: RequestInit) {
  const requestUrls = buildCandidateRequestUrls(input);
  let lastError: unknown = null;

  for (const requestUrl of requestUrls) {
    try {
      return await fetch(requestUrl, init);
    } catch (error) {
      if (!isNetworkFailure(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  if (lastError) {
    throw toApiNetworkError(lastError, input, requestUrls);
  }

  throw new Error(`Unable to prepare an API request for ${input}`);
}

export async function probeApiBaseUrl(candidate: ApiBaseUrlCandidate): Promise<ApiProbeResult> {
  const checkedUrl = `${candidate.baseUrl}/posts?page=1`;

  try {
    const response = await fetch(checkedUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    return {
      candidate,
      checkedUrl,
      reachable: true,
      ok: response.ok,
      status: response.status,
      message: response.ok
        ? `Reachable with status ${response.status}`
        : `Server responded with status ${response.status}`,
    };
  } catch (error) {
    const networkError = toApiNetworkError(error, checkedUrl, [checkedUrl]);

    return {
      candidate,
      checkedUrl,
      reachable: false,
      ok: false,
      status: null,
      message: networkError instanceof Error ? networkError.message : "Unknown network error",
    };
  }
}

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
