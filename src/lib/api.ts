import { allowedRead } from "./core.mjs";
export async function readApi(path: string, token: string) {
  if (!allowedRead("GET", path))
    throw Error(
      "This endpoint is not available through the read-only connection.",
    );
  const response = await fetch("/agent-api" + path, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Alchemy-Protocol-Version": "3.1",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(
      response.status === 401 || response.status === 403
        ? "Access denied. Check the access token and tenant permissions."
        : `Backend returned ${response.status}. Check the server and proxy target.`,
    );
  return response.json();
}
