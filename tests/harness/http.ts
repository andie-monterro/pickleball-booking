// The HTTP seam: tests call route handlers the way a real client would —
// a real Request goes in, a real Response comes out. Tests must assert only
// on the Response (status/body) and on later reads through the same seam.

type RouteHandler = (request: Request) => Response | Promise<Response>;

const BASE_URL = "http://test.local";

export function httpGet(
  route: { GET: RouteHandler },
  path: string,
): Promise<Response> {
  return Promise.resolve(route.GET(new Request(new URL(path, BASE_URL))));
}

export function httpPost(
  route: { POST: RouteHandler },
  path: string,
  body?: unknown,
): Promise<Response> {
  const request = new Request(new URL(path, BASE_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return Promise.resolve(route.POST(request));
}
