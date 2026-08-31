import unittest
from unittest.mock import patch

import httpx

import scraper


def _resp(status=200, text="", content=b"", headers=None):
    """A stand-in httpx.Response. A `request` is always attached so
    raise_for_status() raises HTTPStatusError (not RuntimeError) on 4xx/5xx."""
    req = httpx.Request("GET", "http://t/dce")
    if content:
        return httpx.Response(status, headers=headers or {}, content=content, request=req)
    return httpx.Response(status, headers=headers or {}, text=text, request=req)


class _FakeClient:
    """Returns queued responses for successive .get / .post calls; raises a
    queued exception instead if the queued item is an Exception."""
    def __init__(self, gets, posts):
        self._gets = list(gets)
        self._posts = list(posts)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def _next(self, q):
        item = q.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    async def get(self, *a, **k):
        return await self._next(self._gets)

    async def post(self, *a, **k):
        return await self._next(self._posts)


def _patch_client(gets, posts):
    fake = _FakeClient(gets, posts)
    return patch.object(scraper.httpx, "AsyncClient", lambda *a, **k: fake)


FORM_HTML = '<input id="PRADO_PAGESTATE" value="x"/>'


class DownloadDceClassifierTest(unittest.IsolatedAsyncioTestCase):
    async def test_http_429_is_flagged(self):
        with _patch_client([_resp(status=429)], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "http_429"))

    async def test_http_503_is_flagged(self):
        with _patch_client([_resp(status=503)], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "http_503"))

    async def test_connection_error_is_flagged(self):
        with _patch_client([httpx.ConnectError("boom")], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "conn_error"))

    async def test_404_is_local_failure(self):
        with _patch_client([_resp(status=404)], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("failed", None))

    async def test_missing_pagestate_is_local_failure(self):
        with _patch_client([_resp(text="<html>no form</html>")], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("failed", None))

    async def test_captcha_page_is_flagged(self):
        # GET form -> POST form -> POST download returns an HTML captcha page (200).
        gets = [_resp(text=FORM_HTML)]
        posts = [_resp(text=FORM_HTML),
                 _resp(text="<html>Captcha: trop de requêtes</html>",
                       headers={"content-type": "text/html"})]
        with _patch_client(gets, posts):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "captcha"))

    async def test_zip_is_ok(self):
        gets = [_resp(text=FORM_HTML)]
        posts = [_resp(text=FORM_HTML),
                 _resp(content=b"PK\x03\x04zipbytes",
                       headers={"content-type": "application/zip",
                                "content-disposition": 'attachment; filename="DCE.zip"'})]
        with _patch_client(gets, posts):
            status, payload = await scraper.download_dce("http://t/dce")
            self.assertEqual(status, "ok")
            self.assertEqual(payload, (b"PK\x03\x04zipbytes", "DCE.zip"))


if __name__ == "__main__":
    unittest.main()
