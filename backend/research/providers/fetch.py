"""Safe fetching of user-supplied public URLs (competitor pages, links the founder adds).

Defends against SSRF: only http(s) on standard ports, every host (including each redirect hop)
must resolve exclusively to public IP addresses, bounded size and time, and robots.txt is honoured.
"""

from __future__ import annotations

import ipaddress
import socket
import urllib.robotparser
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx

USER_AGENT = "ValidMeBot/0.1 (+market research for founders; respects robots.txt)"
MAX_BYTES = 2_000_000
TIMEOUT = httpx.Timeout(10.0, connect=5.0)
MAX_REDIRECTS = 3
ALLOWED_PORTS = {None, 80, 443}


class FetchError(Exception):
    pass


class BlockedURL(FetchError):
    """Not fetched on purpose (non-public host, bad scheme, robots.txt)."""


def _is_public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
        or (addr.version == 6 and addr.ipv4_mapped is not None and not _is_public_ip(str(addr.ipv4_mapped)))
    )


def check_url(url: str) -> None:
    """Raise BlockedURL unless `url` is http(s) on a standard port and its host resolves only to public IPs."""
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
    ips = {info[4][0] for info in infos}
    if not ips or not all(_is_public_ip(ip) for ip in ips):
        raise BlockedURL(f"{parts.hostname} does not resolve to a public address")


@dataclass
class FetchedPage:
    url: str  # final URL after redirects
    status: int
    text: str


def _get(client: httpx.Client, url: str) -> FetchedPage:
    current = url
    for _hop in range(MAX_REDIRECTS + 1):
        check_url(current)
        with client.stream("GET", current) as resp:
            # DNS rebinding defence: check the address we actually connected to, not just the
            # earlier lookup, before reading anything from the response.
            stream = resp.extensions.get("network_stream")
            server = stream.get_extra_info("server_addr") if stream is not None else None
            if server and not _is_public_ip(server[0]):
                raise BlockedURL("connected address is not public")
            if resp.is_redirect:
                location = resp.headers.get("location")
                if not location:
                    raise FetchError("redirect without location")
                current = urljoin(current, location)
                continue
            content_type = resp.headers.get("content-type", "")
            if resp.status_code >= 400:
                raise FetchError(f"HTTP {resp.status_code}")
            if "html" not in content_type and "text/plain" not in content_type:
                raise FetchError(f"unsupported content type {content_type or 'unknown'}")
            body = bytearray()
            for chunk in resp.iter_bytes():
                body.extend(chunk)
                if len(body) > MAX_BYTES:
                    raise FetchError("page too large")
            return FetchedPage(url=current, status=resp.status_code, text=body.decode(resp.encoding or "utf-8", "replace"))
    raise FetchError("too many redirects")


def _robots_allows(client: httpx.Client, url: str) -> bool:
    parts = urlsplit(url)
    robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
    parser = urllib.robotparser.RobotFileParser()
    try:
        page = _get(client, robots_url)
        parser.parse(page.text.splitlines())
    except BlockedURL:
        raise
    except FetchError:
        return True  # no robots.txt (or unreadable) means no restrictions
    return parser.can_fetch(USER_AGENT, url)


def fetch_public_page(url: str) -> FetchedPage:
    """Fetch one public HTML page, or raise FetchError/BlockedURL. Never follows redirects to private hosts."""
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.9"}
    with httpx.Client(timeout=TIMEOUT, headers=headers, follow_redirects=False) as client:
        if not _robots_allows(client, url):
            raise BlockedURL("disallowed by robots.txt")
        return _get(client, url)


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


def extract_text(html: str) -> tuple[str, str, str]:
    """Return (title, description, visible text) from an HTML page."""
    parser = _TextExtractor()
    parser.feed(html)
    return " ".join(parser.title.split()), " ".join(parser.description.split()), parser.text
