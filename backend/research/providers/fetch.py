"""Safe fetching of user-supplied public URLs (competitor pages, links the founder adds).

SSRF defences:
- only http(s) on ports 80/443, no credentials in URLs;
- the host is resolved once, every address must be globally routable (no private, loopback,
  link-local, CGNAT/cloud-metadata, reserved, multicast or IPv4-mapped forms of those);
- the connection is then made to that exact checked IP (Host header and TLS SNI/certificate
  check still use the real hostname), so a second DNS answer can't redirect it (DNS rebinding);
- every redirect hop is checked the same way, and robots.txt is honoured for every host;
- no proxies from the environment, uncompressed bodies only, 2 MB cap, 20 s overall deadline.
"""

from __future__ import annotations

import ipaddress
import socket
import time
import urllib.robotparser
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

USER_AGENT = "ValidMeBot/0.1 (+market research for founders; respects robots.txt)"
MAX_BYTES = 2_000_000
TIMEOUT = httpx.Timeout(10.0, connect=5.0)
DEADLINE_SECONDS = 20.0
MAX_REDIRECTS = 3
ALLOWED_PORTS = {None, 80, 443}


class FetchError(Exception):
    pass


class BlockedURL(FetchError):
    """Not fetched on purpose (non-public host, bad scheme, robots.txt)."""


def _is_public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if addr.version == 6 and addr.ipv4_mapped is not None:
        return addr.ipv4_mapped.is_global
    # is_global excludes private, loopback, link-local, CGNAT (100.64/10, incl. cloud metadata
    # such as 100.100.100.200), reserved, documentation and other special-purpose ranges.
    return addr.is_global and not addr.is_multicast


def check_url(url: str) -> str:
    """Validate `url` and return the public IP to connect to. Raises BlockedURL otherwise."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise BlockedURL("only http and https URLs are fetched")
    if not parts.hostname:
        raise BlockedURL("URL has no host")
    if parts.username or parts.password:
        raise BlockedURL("URLs with credentials are not fetched")
    try:
        port = parts.port
    except ValueError as exc:
        raise BlockedURL("invalid port") from exc
    if port not in ALLOWED_PORTS:
        raise BlockedURL("only standard ports (80, 443) are fetched")
    try:
        infos = socket.getaddrinfo(parts.hostname, port or (443 if parts.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise FetchError(f"could not resolve {parts.hostname}") from exc
    ips = [info[4][0] for info in infos]
    if not ips or not all(_is_public_ip(ip) for ip in ips):
        raise BlockedURL(f"{parts.hostname} does not resolve to a public address")
    return ips[0]


@dataclass
class FetchedPage:
    url: str  # final URL after redirects
    status: int  # 304 = not modified since the validators we sent (text is empty)
    text: str
    etag: str = ""
    last_modified: str = ""


class _Fetcher:
    def __init__(self, client: httpx.Client) -> None:
        self.client = client
        self.deadline = time.monotonic() + DEADLINE_SECONDS
        self.robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}

    def _time_left(self) -> None:
        if time.monotonic() > self.deadline:
            raise FetchError("took too long")

    def _request(self, url: str, extra_headers: dict | None = None) -> httpx.Response:
        """Open a streaming GET to the checked IP for `url` (Host + SNI keep the real hostname)."""
        ip = check_url(url)
        parts = urlsplit(url)
        host_for_url = f"[{ip}]" if ":" in ip else ip
        netloc = f"{host_for_url}:{parts.port}" if parts.port else host_for_url
        pinned = urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))
        request = self.client.build_request(
            "GET",
            pinned,
            headers={"Host": parts.netloc, **(extra_headers or {})},
            extensions={"sni_hostname": parts.hostname} if parts.scheme == "https" else {},
        )
        response = self.client.send(request, stream=True)
        # Defence in depth: confirm the socket really went to a public address.
        stream = response.extensions.get("network_stream")
        server = stream.get_extra_info("server_addr") if stream is not None else None
        if server and not _is_public_ip(server[0]):
            response.close()
            raise BlockedURL("connected address is not public")
        return response

    def _read(self, response: httpx.Response) -> str:
        encoding = response.headers.get("content-encoding", "identity").lower()
        if encoding not in ("", "identity"):
            raise FetchError(f"compressed response ({encoding}) not accepted")
        declared = response.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > MAX_BYTES:
            raise FetchError("page too large")
        body = bytearray()
        # Network responses stream; responses built in memory are already read.
        chunks = [response.content] if response.is_stream_consumed else response.iter_raw()
        for chunk in chunks:
            self._time_left()
            body.extend(chunk)
            if len(body) > MAX_BYTES:
                raise FetchError("page too large")
        return body.decode(response.encoding or "utf-8", "replace")

    def get(self, url: str, *, check_robots: bool = True, conditional: dict | None = None) -> FetchedPage:
        """`conditional` = {"etag": ..., "last_modified": ...} from a previous fetch: a 304 skips the body."""
        current = url
        cond = {}
        if conditional and conditional.get("etag"):
            cond["If-None-Match"] = conditional["etag"][:200]
        if conditional and conditional.get("last_modified"):
            cond["If-Modified-Since"] = conditional["last_modified"][:100]
        for _hop in range(MAX_REDIRECTS + 1):
            self._time_left()
            if check_robots and not self.allowed_by_robots(current):
                raise BlockedURL("disallowed by robots.txt")
            # Validators only apply to the URL they came from, not to a redirect target.
            response = self._request(current, cond if current == url else None)
            try:
                if response.status_code == 304:
                    return FetchedPage(
                        url=current,
                        status=304,
                        text="",
                        etag=conditional.get("etag", "") if conditional else "",
                        last_modified=conditional.get("last_modified", "") if conditional else "",
                    )
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise FetchError("redirect without location")
                    current = urljoin(current, location)
                    continue
                if response.status_code >= 400:
                    raise FetchError(f"HTTP {response.status_code}")
                content_type = response.headers.get("content-type", "")
                if "html" not in content_type and "text/plain" not in content_type:
                    raise FetchError(f"unsupported content type {content_type or 'unknown'}")
                return FetchedPage(
                    url=current,
                    status=response.status_code,
                    text=self._read(response),
                    etag=response.headers.get("etag", "")[:200],
                    last_modified=response.headers.get("last-modified", "")[:100],
                )
            finally:
                response.close()
        raise FetchError("too many redirects")

    def allowed_by_robots(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self.robots:
            parser = urllib.robotparser.RobotFileParser()
            try:
                response = self._request(f"{origin}/robots.txt")
            except BlockedURL:
                raise
            except (FetchError, httpx.HTTPError):
                self.robots[origin] = None  # unreachable robots.txt: no restrictions
            else:
                try:
                    if response.status_code in (401, 403) or response.status_code >= 500:
                        # Access-restricted or server error: RFC 9309 says treat as disallowed.
                        parser.disallow_all = True
                    elif response.status_code < 400 and not response.is_redirect:
                        parser.parse(self._read(response).splitlines())
                    else:
                        parser.allow_all = True
                finally:
                    response.close()
                self.robots[origin] = parser
        parser = self.robots[origin]
        return True if parser is None else parser.can_fetch(USER_AGENT, url)


def fetch_public_page(url: str, conditional: dict | None = None) -> FetchedPage:
    """Fetch one public HTML page, or raise FetchError/BlockedURL. See _Fetcher.get for `conditional`."""
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.9", "Accept-Encoding": "identity"}
    try:
        with httpx.Client(timeout=TIMEOUT, headers=headers, follow_redirects=False, trust_env=False) as client:
            return _Fetcher(client).get(url, conditional=conditional)
    except httpx.HTTPError as exc:
        raise FetchError(str(exc)[:200]) from exc


class _TextExtractor(HTMLParser):
    """Pulls the title, meta description and visible text, skipping scripts, styles and navigation."""

    SKIP = {"script", "style", "noscript", "svg", "nav", "footer", "header", "form", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description = ""
        self._chunks: list[str] = []
        self._skip_depth = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            a = {k.lower(): (v or "") for k, v in attrs}
            if a.get("name", "").lower() in ("description", "og:description") or a.get("property", "").lower() == "og:description":
                self.description = self.description or a.get("content", "")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip_depth and data.strip():
            self._chunks.append(data.strip())

    @property
    def text(self) -> str:
        return " ".join(" ".join(self._chunks).split())

    @property
    def blocks(self) -> list[str]:
        """Visible text as separate blocks (one per text node), whitespace-normalized; for change diffs."""
        return [b for b in (" ".join(c.split()) for c in self._chunks) if len(b) > 2]


def extract_text(html: str) -> tuple[str, str, str]:
    """Return (title, description, visible text) from an HTML page."""
    parser = _TextExtractor()
    parser.feed(html)
    return " ".join(parser.title.split()), " ".join(parser.description.split()), parser.text


def extract_blocks(html: str) -> list[str]:
    """Visible text blocks of a page (scripts, styles and navigation skipped), for change detection."""
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return parser.blocks
