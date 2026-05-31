"""Write gitignored .env from local credential files (non-interactive)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"

DEFAULTS = {
    "PERSIK_SERVER": "1",
    "AUTO_PRINT_INVOICES": "false",
    "PIPEDRIVE_DOMAIN": "wwwmescoil",
    "SPREADSHEET_ID": "15l3jW3NrqP8HAIqPZpi6OXrx0hWn_3OpAncgiiVA1QI",
    "PERSIK_AUTH_USER": "mes",
    "PERSIK_AUTH_PASSWORD": "persik2026",
    "PORT": "8080",
    "HOST": "0.0.0.0",
}


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def load_secrets_local() -> dict:
    path = ROOT / "secrets.local.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def main() -> None:
    secrets = load_secrets_local()
    lines = ["# Auto-generated — DO NOT COMMIT", ""]

    for key, value in DEFAULTS.items():
        lines.append(f"{key}={value}")

    for key in ("GEMINI_API_KEY", "PIPEDRIVE_TOKEN"):
        value = secrets.get(key, "").strip()
        if value:
            lines.append(f"{key}={value}")

    token = read_text(ROOT / "credentials" / "token.json")
    if token:
        escaped = token.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'GOOGLE_TOKEN_JSON="{escaped}"')

    client = read_text(ROOT / "credentials" / "client_secret.json")
    if client:
        escaped = client.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'GOOGLE_CLIENT_SECRET_JSON="{escaped}"')

    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {ENV_PATH}")


if __name__ == "__main__":
    main()
