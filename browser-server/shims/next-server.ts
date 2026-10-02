// The parts of next/server the API routes use, for the in-browser server.
export class NextRequest extends Request {
  readonly nextUrl: URL;
  constructor(input: string | URL, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(this.url);
    // Request drops "forbidden" headers (host, origin); keep the full set the worker built, like a server sees them
    if (init?.headers instanceof Headers) Object.defineProperty(this, 'headers', { value: init.headers });
  }
}

export class NextResponse<T = unknown> extends Response {
  declare readonly __body?: T;
  static json<B>(body: B, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    return new NextResponse<B>(JSON.stringify(body), { ...init, headers });
  }
  static redirect(url: string | URL, status = 307) {
    return new NextResponse(null, { status, headers: { location: String(url) } });
  }
  static next() {
    return new NextResponse(null);
  }
}
