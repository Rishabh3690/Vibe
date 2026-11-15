from http.server import BaseHTTPRequestHandler
import base64
import json
import os
import sys

# Ensure lib/python is importable on Vercel Python serverless runtime
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_LIB_DIR = os.path.join(ROOT_DIR, "lib", "python")
if PYTHON_LIB_DIR not in sys.path:
    sys.path.insert(0, PYTHON_LIB_DIR)

from analyze_audio import analyze_wav_bytes  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            payload = json.loads(raw.decode("utf-8"))
            b64 = payload.get("audioSnippetBase64", "")
            if not isinstance(b64, str) or not b64:
                self._send_json(400, {"error": "Missing audioSnippetBase64"})
                return
            wav_bytes = base64.b64decode(b64)
            result = analyze_wav_bytes(wav_bytes)
            self._send_json(200, {"pythonAnalysis": result})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def _send_json(self, status: int, body: dict):
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)
