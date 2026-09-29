import axios from "axios";

interface ApiErrorBody {
  error?: unknown;
  errors?: { msg?: unknown }[];
}

// Turns an axios failure into something a resident can act on. The backend
// sends { error } for most failures and { errors: [{ msg }] } for validation.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "The server took too long to respond. It may be waking up, so please try again in a moment.";
    }

    if (!error.response) {
      return "Could not reach the server. Check your internet connection and try again.";
    }

    const body = error.response.data as ApiErrorBody | undefined;

    if (typeof body?.error === "string") {
      return body.error;
    }

    const errors = body?.errors;
    if (Array.isArray(errors)) {
      const messages = errors
        .map((item) => item.msg)
        .filter((msg): msg is string => typeof msg === "string");

      if (messages.length > 0) {
        return messages.join("\n");
      }
    }

    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

