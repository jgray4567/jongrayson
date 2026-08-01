#!/usr/bin/env python3
"""Local dev server for the Intel Layer globe.

Serves the site tree from disk and proxies every *.php request through to the
live host, so all the real feeds (OpenSky, USGS, NWS, CelesTrak, NASA FIRMS)
work locally without a PHP runtime installed.

    python3 intel/demos/intel-globe-v2/dev-server.py
    open http://127.0.0.1:8747/intel/demos/intel-globe-v2/
"""
import http.server, socketserver, urllib.request, urllib.error, os, sys

import pathlib
# Repo root — three levels up from intel/demos/intel-globe-v2/
ROOT = str(pathlib.Path(__file__).resolve().parents[3])
UPSTREAM = "https://www.jongrayson.com"
PORT = 8747


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        if ".php" in self.path:
            url = UPSTREAM + self.path
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "intel-dev/1.0"})
                with urllib.request.urlopen(req, timeout=25) as r:
                    body = r.read()
                    self.send_response(200)
                    self.send_header("Content-Type", r.headers.get("Content-Type", "application/json"))
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(body)
            except Exception as e:
                sys.stderr.write("PROXY FAIL %s -> %s\n" % (self.path, e))
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"upstream unavailable"}')
            return
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
    print("serving %s on http://127.0.0.1:%d" % (ROOT, PORT))
    httpd.serve_forever()
