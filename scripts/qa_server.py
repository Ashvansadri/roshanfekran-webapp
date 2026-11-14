"""Local QA only: serve the preserved academy shell at / for legacy tests.
Production '/' always serves the new standalone cinematic index.html.
The real landing remains testable at /index.html.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
from urllib.parse import urlsplit

class AcademyQAHandler(SimpleHTTPRequestHandler):
    def _route(self):
        if urlsplit(self.path).path == "/":
            self.path = "/academy.html"
    def do_GET(self):
        self._route()
        super().do_GET()
    def do_HEAD(self):
        self._route()
        super().do_HEAD()

if __name__ == "__main__":
    site = Path(__file__).resolve().parents[1] / "site"
    server = ThreadingHTTPServer(("127.0.0.1", 4173), partial(AcademyQAHandler, directory=str(site)))
    server.serve_forever()
