"""Create local .env from existing credential files (gitignored output)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"

DEFAULTS = {
    "PIPEDRIVE_DOMAIN": "wwwmescoil",
    "SPREADSHEET_ID": "15l3jW3NrqP8HAIqPZpi6OXrx0hWn_3OpAncgiiVA1QI",
    "PERSIK_AUTH_USER": "mes",
    "PERSIK_AUTH_PASSWORD": "persik2026",
}


def read_if_exists(path: Path) -> str:
    if path.exists():
        return path.read_text(encoding="utf-8").replace("\n", "\\n")
    return ""


def main():
    lines = ["# Auto-generated local env — DO NOT COMMIT", ""]
    for key, value in DEFAULTS.items():
        lines.append(f"{key}={value}")

    gemini = input("GEMINI_API_KEY (Enter to skip): ").strip()
    if gemini:
        lines.append(f"GEMINI_API_KEY={gemini}")

    pipedrive = input("PIPEDRIVE_TOKEN (Enter to skip): ").strip()
    if pipedrive:
        lines.append(f"PIPEDRIVE_TOKEN={pipedrive}")

    token = read_if_exists(ROOT / "credentials" / "token.json")
    if token:
        lines.append(f'GOOGLE_TOKEN_JSON="{token}"')

    client = read_if_exists(ROOT / "credentials" / "client_secret.json")
    if client:
        lines.append(f'GOOGLE_CLIENT_SECRET_JSON="{client}"')

    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {ENV_PATH}")


if __name__ == "__main__":
    main()
