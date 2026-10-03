/**
 * Turn an unknown thrown value into a message that is safe to show a user.
 *
 * Most call sites used `catch (err: any) { setError(err?.message || "Lỗi") }`.
 * That forces every catch clause to opt out of type safety just to read one
 * string, and silently renders "Lỗi" when the thrown thing is not an Error.
 * This helper accepts `unknown` and handles the shapes JS actually throws:
 * Error, PocketBase ClientResponseError ({ response.message }), plain objects,
 * strings, and everything else.
 */
export function errorMessage(err: unknown, fallback = "Có lỗi xảy ra"): string {
  if (err == null) return fallback;

  if (typeof err === "string") return err.trim() || fallback;

  if (err instanceof Error && err.message) return err.message;

  if (typeof err === "object") {
    const obj = err as {
      message?: unknown;
      response?: { message?: unknown };
      data?: { message?: unknown };
    };

    // PocketBase puts its human-readable text in response.message.
    const fromResponse = obj.response?.message;
    if (typeof fromResponse === "string" && fromResponse.trim()) return fromResponse;

    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;

    const fromData = obj.data?.message;
    if (typeof fromData === "string" && fromData.trim()) return fromData;
  }

  return fallback;
}
