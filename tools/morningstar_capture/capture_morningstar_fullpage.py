"""
Local Morningstar full-page PNG capture tool for BDB-FONDOS.

Security boundaries:
- No Firestore access.
- No database writes.
- No credential input in code.
- No cookie/token/localStorage export.
- Navigation and screenshots only through the rendered browser.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

from playwright.sync_api import BrowserContext, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


PROJECT_DIR = Path(r"C:\Users\oanti\Documents\BDB-FONDOS")
DEFAULT_BATCH_CSV = PROJECT_DIR / "tools" / "morningstar_capture" / "morningstar_batch_10_urls.csv"
DEFAULT_PROFILE_DIR = PROJECT_DIR / ".local_browser_profiles" / "morningstar_capture"
DEFAULT_OUTPUT_DIR = PROJECT_DIR / "artifacts" / "morningstar_captures"
DEFAULT_MANIFEST = DEFAULT_OUTPUT_DIR / "BDB_MORNINGSTAR_CHROME_FULLPAGE_CAPTURE_MANIFEST.json"

TAB_DEFS = [
    ("01_RESUMEN", "Resumen"),
    ("02_GRAFICO", "Gráfico"),
    ("03_ANALISIS", "Análisis"),
    ("04_RIESGO", "Riesgo"),
    ("05_CARTERA", "Cartera"),
    ("06_MATRIZ_PERSONAS", "Matriz y Personas"),
    ("07_DOCUMENTOS", "Documentos"),
]
TAB_BY_CODE = {code: name for code, name in TAB_DEFS}
TAB_BY_NAME = {name.lower(): (code, name) for code, name in TAB_DEFS}


@dataclass
class FundRow:
    isin: str
    morningstar_id: str
    fund_name: str
    morningstar_url: str


def slug(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "UNKNOWN"


def read_batch(path: Path, limit: int | None = None) -> list[FundRow]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        required = {"isin", "morningstar_id", "fund_name", "morningstar_url"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")
        rows = [
            FundRow(
                isin=(row.get("isin") or "").strip(),
                morningstar_id=(row.get("morningstar_id") or "").strip(),
                fund_name=(row.get("fund_name") or "").strip(),
                morningstar_url=(row.get("morningstar_url") or "").strip(),
            )
            for row in reader
            if (row.get("isin") or "").strip() and (row.get("morningstar_url") or "").strip()
        ]
    return rows[:limit] if limit else rows


def parse_tabs(raw_tabs: str | None) -> list[tuple[str, str]]:
    if not raw_tabs:
        return TAB_DEFS
    wanted = []
    for raw in raw_tabs.split(","):
        item = raw.strip()
        if not item:
            continue
        upper = item.upper()
        lower = item.lower()
        if upper in TAB_BY_CODE:
            wanted.append((upper, TAB_BY_CODE[upper]))
            continue
        if lower in TAB_BY_NAME:
            wanted.append(TAB_BY_NAME[lower])
            continue
        raise ValueError(f"Unknown tab '{item}'. Use one of: {', '.join(name for _, name in TAB_DEFS)}")
    return wanted


def wait_for_manual_login(page: Page, enabled: bool) -> None:
    if not enabled:
        return
    print("\nSi Morningstar pide login o consentimiento, hazlo manualmente en la ventana abierta.")
    print("Inicia sesión manualmente en esta ventana y pulsa Enter en la terminal para continuar.")
    try:
        input()
    except EOFError:
        print("No hay terminal interactiva para Enter; continúo sin pausa manual.")


def apply_visual_zoom(page: Page, zoom: float) -> None:
    page.evaluate(
        """zoom => {
            document.documentElement.style.zoom = zoom;
            document.body.style.zoom = zoom;
        }""",
        str(zoom),
    )


def settle_page(page: Page, wait_ms: int) -> None:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=30_000)
    except PlaywrightTimeoutError:
        pass
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except PlaywrightTimeoutError:
        pass
    page.wait_for_timeout(wait_ms)


def confirm_isin(page: Page, isin: str) -> tuple[bool, str]:
    try:
        body_text = page.locator("body").inner_text(timeout=10_000)
    except PlaywrightTimeoutError:
        return False, "Body text not readable before timeout."
    normalized = re.sub(r"\s+", "", body_text.upper())
    return isin.upper() in normalized, "ISIN found in rendered page." if isin.upper() in normalized else "ISIN not found in rendered page text."


def click_cookie_buttons(page: Page) -> None:
    labels = [
        "Soy un Inversor Individual",
        "Aceptar todo",
        "Acepto",
        "Aceptar",
        "Individual Investor",
        "Allow all",
        "Accept all",
        "I agree",
    ]
    for label in labels:
        try:
            locator = page.get_by_role("button", name=re.compile(label, re.IGNORECASE)).first
            if locator.count() > 0 and locator.is_visible(timeout=1_000):
                locator.click(timeout=2_000)
                page.wait_for_timeout(1_000)
                return
        except Exception:
            continue


def navigate_to_tab(page: Page, tab_name: str, base_url: str, wait_ms: int) -> str:
    if tab_name == "Resumen":
        page.goto(base_url, wait_until="domcontentloaded", timeout=60_000)
        settle_page(page, wait_ms)
        return "Base URL loaded for Resumen."

    strategies = [
        lambda: page.get_by_role("link", name=re.compile(rf"^{re.escape(tab_name)}$", re.IGNORECASE)).first,
        lambda: page.get_by_role("tab", name=re.compile(rf"^{re.escape(tab_name)}$", re.IGNORECASE)).first,
        lambda: page.get_by_text(re.compile(rf"^{re.escape(tab_name)}$", re.IGNORECASE)).first,
        lambda: page.locator(f"a:has-text('{tab_name}')").first,
        lambda: page.locator(f"button:has-text('{tab_name}')").first,
    ]

    last_error = ""
    for make_locator in strategies:
        try:
            locator = make_locator()
            if locator.count() == 0:
                continue
            locator.scroll_into_view_if_needed(timeout=5_000)
            locator.click(timeout=10_000)
            settle_page(page, wait_ms)
            return f"Clicked visible tab text: {tab_name}."
        except Exception as exc:
            last_error = str(exc).splitlines()[0][:220]

    # Fallback: some Morningstar pages use predictable URL fragments/routes after click rendering changes.
    # This keeps navigation in the rendered browser and avoids internal APIs.
    fallback_suffix = {
        "Gráfico": "grafico",
        "Análisis": "analisis",
        "Riesgo": "riesgo",
        "Cartera": "cartera",
        "Matriz y Personas": "matriz-y-personas",
        "Documentos": "documentos",
    }.get(tab_name)
    if fallback_suffix:
        fallback_url = re.sub(r"/cotizacion/?$", f"/{fallback_suffix}", base_url)
        page.goto(fallback_url, wait_until="domcontentloaded", timeout=60_000)
        settle_page(page, wait_ms)
        return f"Fallback rendered navigation to URL path '{fallback_suffix}' after click failed: {last_error}"

    raise RuntimeError(last_error or f"Could not navigate to tab {tab_name}")


def capture_tab(
    page: Page,
    fund: FundRow,
    tab_code: str,
    tab_name: str,
    folder: Path,
    wait_ms: int,
    zoom: float,
) -> dict:
    file_path = folder / f"{fund.isin}_{fund.morningstar_id}_{tab_code}.png"
    try:
        notes = navigate_to_tab(page, tab_name, fund.morningstar_url, wait_ms)
        click_cookie_buttons(page)
        apply_visual_zoom(page, zoom)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1_000)
        page.screenshot(path=str(file_path), full_page=True, type="png")
        return {
            "tab_name": tab_name,
            "file_path": str(file_path),
            "status": "OK",
            "notes": notes,
        }
    except Exception as exc:
        return {
            "tab_name": tab_name,
            "file_path": str(file_path),
            "status": "TAB_CAPTURE_FAILED",
            "notes": str(exc).splitlines()[0][:500],
        }


def build_manifest(args: argparse.Namespace) -> dict:
    return {
        "batch_name": args.batch_name,
        "capture_date": datetime.now().isoformat(timespec="seconds"),
        "method": "PLAYWRIGHT_LOCAL_CHROME_FULLPAGE_PNG",
        "browser_profile_path": str(args.profile_dir),
        "credentials_used": False,
        "credentials_stored": False,
        "cookies_exported": False,
        "firestore_writes": 0,
        "funds": [],
    }


def run_capture(args: argparse.Namespace) -> dict:
    funds = read_batch(args.batch_csv, args.limit)
    tabs = parse_tabs(args.tabs)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.profile_dir.mkdir(parents=True, exist_ok=True)

    manifest = build_manifest(args)

    try:
        playwright_ctx = sync_playwright().start()
        launch_kwargs = {
            "user_data_dir": str(args.profile_dir),
            "headless": False,
            "viewport": {"width": args.viewport_width, "height": args.viewport_height},
            "device_scale_factor": args.device_scale_factor,
            "locale": "es-ES",
            "args": [
                "--start-maximized",
                "--disable-blink-features=AutomationControlled",
            ],
        }
        if args.browser_channel:
            launch_kwargs["channel"] = args.browser_channel
        context: BrowserContext = playwright_ctx.chromium.launch_persistent_context(**launch_kwargs)
    except Exception as exc:
        note = f"Browser launch failed before navigation: {str(exc).splitlines()[0][:500]}"
        manifest["browser_launch_status"] = "FAILED"
        manifest["browser_launch_notes"] = note
        for fund in funds:
            folder = args.output_dir / f"{fund.isin}_{fund.morningstar_id}"
            folder.mkdir(parents=True, exist_ok=True)
            manifest["funds"].append(
                {
                    "isin": fund.isin,
                    "morningstar_id": fund.morningstar_id,
                    "fund_name": fund.fund_name,
                    "url": fund.morningstar_url,
                    "folder": str(folder),
                    "isin_confirmed_in_page": False,
                    "isin_confirmation_notes": "Not checked because browser launch failed.",
                    "tabs": [
                        {
                            "tab_name": tab_name,
                            "file_path": str(folder / f"{fund.isin}_{fund.morningstar_id}_{tab_code}.png"),
                            "status": "TAB_CAPTURE_FAILED",
                            "notes": note,
                        }
                        for tab_code, tab_name in tabs
                    ],
                }
            )
        args.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        args.manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return manifest

    try:
        page = context.pages[0] if context.pages else context.new_page()

        first = True
        for fund in funds:
            folder = args.output_dir / f"{fund.isin}_{fund.morningstar_id}"
            folder.mkdir(parents=True, exist_ok=True)

            print(f"\nAbriendo {fund.isin} - {fund.fund_name}")
            page.goto(fund.morningstar_url, wait_until="domcontentloaded", timeout=60_000)
            settle_page(page, args.wait_ms)
            click_cookie_buttons(page)

            if first:
                wait_for_manual_login(page, args.manual_login)
                first = False
                settle_page(page, args.wait_ms)

            isin_ok, isin_note = confirm_isin(page, fund.isin)
            print(f"Confirmación ISIN {fund.isin}: {'OK' if isin_ok else 'NO CONFIRMADO'} - {isin_note}")

            fund_entry = {
                "isin": fund.isin,
                "morningstar_id": fund.morningstar_id,
                "fund_name": fund.fund_name,
                "url": fund.morningstar_url,
                "folder": str(folder),
                "isin_confirmed_in_page": isin_ok,
                "isin_confirmation_notes": isin_note,
                "tabs": [],
            }

            if args.strict_isin and not isin_ok:
                fund_entry["tabs"].append(
                    {
                        "tab_name": "ALL",
                        "file_path": "",
                        "status": "ISIN_NOT_CONFIRMED",
                        "notes": isin_note,
                    }
                )
                manifest["funds"].append(fund_entry)
                continue

            for tab_code, tab_name in tabs:
                print(f"Capturando {tab_name}...")
                result = capture_tab(page, fund, tab_code, tab_name, folder, args.wait_ms, args.zoom)
                print(f"  {result['status']}: {result['file_path']}")
                fund_entry["tabs"].append(result)

            manifest["funds"].append(fund_entry)

    finally:
        context.close()
        playwright_ctx.stop()

    args.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture Morningstar rendered full-page PNG screenshots.")
    parser.add_argument("--batch-csv", type=Path, default=DEFAULT_BATCH_CSV)
    parser.add_argument("--batch-name", default="morningstar_batch_10_urls")
    parser.add_argument("--profile-dir", type=Path, default=DEFAULT_PROFILE_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--manifest-path", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--tabs", help="Comma-separated tab names or codes. Example: Resumen,Riesgo,Cartera")
    parser.add_argument("--limit", type=int, help="Limit number of funds from CSV.")
    parser.add_argument("--viewport-width", type=int, default=1920)
    parser.add_argument("--viewport-height", type=int, default=1200)
    parser.add_argument("--device-scale-factor", type=float, default=2)
    parser.add_argument("--zoom", type=float, default=1.5)
    parser.add_argument("--wait-ms", type=int, default=4_000)
    parser.add_argument("--browser-channel", help="Optional Playwright channel, for example: chrome")
    parser.add_argument("--manual-login", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--strict-isin", action="store_true", help="Skip captures when ISIN is not found in page text.")
    return parser.parse_args(list(argv))


def main(argv: Iterable[str]) -> int:
    args = parse_args(argv)
    manifest = run_capture(args)
    ok = sum(1 for fund in manifest["funds"] for tab in fund["tabs"] if tab["status"] == "OK")
    failed = sum(1 for fund in manifest["funds"] for tab in fund["tabs"] if tab["status"] != "OK")
    print(f"\nManifest: {args.manifest_path}")
    print(f"Capturas OK: {ok}")
    print(f"Capturas con fallo: {failed}")
    print("Firestore writes: 0")
    return 0 if ok > 0 else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
