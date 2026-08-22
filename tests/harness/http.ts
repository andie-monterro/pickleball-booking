// The HTTP seam: tests call route handlers the way a real client would —
// a real Request goes in, a real Response comes out. Tests must assert only
// on the Response (status/body) and on later reads through the same seam.

type RouteHandler = (request: Request) => Response | Promise<Response>;

const BASE_URL = "http://test.local";

export function httpGet(
  route: { GET: RouteHandler },
  path: string,
  headers?: HeadersInit,
): Promise<Response> {
  return Promise.resolve(
    route.GET(new Request(new URL(path, BASE_URL), { headers })),
  );
}

function httpJson(
  handler: RouteHandler,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  headers?: HeadersInit,
): Promise<Response> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");
  const request = new Request(new URL(path, BASE_URL), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return Promise.resolve(handler(request));
}

export function httpPost(
  route: { POST: RouteHandler },
  path: string,
  body?: unknown,
  headers?: HeadersInit,
): Promise<Response> {
  return httpJson(route.POST, "POST", path, body, headers);
}

export function httpPut(
  route: { PUT: RouteHandler },
  path: string,
  body?: unknown,
  headers?: HeadersInit,
): Promise<Response> {
  return httpJson(route.PUT, "PUT", path, body, headers);
}

export function httpPatch(
  route: { PATCH: RouteHandler },
  path: string,
  body?: unknown,
  headers?: HeadersInit,
): Promise<Response> {
  return httpJson(route.PATCH, "PATCH", path, body, headers);
}

export function httpDelete(
  route: { DELETE: RouteHandler },
  path: string,
  body?: unknown,
  headers?: HeadersInit,
): Promise<Response> {
  return httpJson(route.DELETE, "DELETE", path, body, headers);
}
