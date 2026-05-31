"""Persik web server — for cloud deployment (Render/Railway/VPS)."""
import base64
import os
from pathlib import Path

import bottle

from persik_app import install_log_redirect, script_dir, start_auto_run_worker, web_dir
import persik_app


def bootstrap_credentials():
    cred_dir = Path(script_dir) / "credentials"
    cred_dir.mkdir(parents=True, exist_ok=True)
    data_dir = Path(script_dir) / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    token_json = os.getenv("GOOGLE_TOKEN_JSON", "").strip()
    if token_json:
        (cred_dir / "token.json").write_text(token_json, encoding="utf-8")

    client_secret = os.getenv("GOOGLE_CLIENT_SECRET_JSON", "").strip()
    if client_secret:
        (cred_dir / "client_secret.json").write_text(client_secret, encoding="utf-8")

    service_account = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if service_account:
        (cred_dir / "service_account.json").write_text(service_account, encoding="utf-8")
        root_sa = Path(script_dir) / "credentials.json"
        if not root_sa.exists():
            root_sa.write_text(service_account, encoding="utf-8")


def setup_basic_auth():
    user = os.getenv("PERSIK_AUTH_USER", "").strip()
    password = os.getenv("PERSIK_AUTH_PASSWORD", "").strip()
    if not user or not password:
        return

    @bottle.hook("before_request")
    def require_basic_auth():
        auth_header = bottle.request.headers.get("Authorization", "")
        if not auth_header.startswith("Basic "):
            bottle.response.status = 401
            bottle.response.set_header("WWW-Authenticate", 'Basic realm="Persik"')
            return "Authentication required"

        try:
            decoded = base64.b64decode(auth_header.split(" ", 1)[1]).decode("utf-8")
            req_user, req_pass = decoded.split(":", 1)
        except Exception:
            bottle.response.status = 401
            bottle.response.set_header("WWW-Authenticate", 'Basic realm="Persik"')
            return "Authentication required"

        if req_user != user or req_pass != password:
            bottle.response.status = 401
            bottle.response.set_header("WWW-Authenticate", 'Basic realm="Persik"')
            return "Invalid credentials"


def main():
    os.environ.setdefault("PERSIK_SERVER", "1")
    os.environ.setdefault("AUTO_PRINT_INVOICES", "false")

    bootstrap_credentials()
    install_log_redirect()
    start_auto_run_worker()
    setup_basic_auth()

    port = int(os.getenv("PORT", "8080"))
    host = os.getenv("HOST", "0.0.0.0")

    print(f"🐾 Persik server starting on http://{host}:{port}")
    persik_app.eel.start(
        "index.html",
        host=host,
        port=port,
        mode=None,
        block=True,
    )


if __name__ == "__main__":
    main()
