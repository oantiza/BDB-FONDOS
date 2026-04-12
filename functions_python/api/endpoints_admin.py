import logging

logger = logging.getLogger(__name__)
import json
import os
import datetime
from firebase_functions import https_fn, options
from firebase_admin import firestore

from services.admin import restore_historico_logic
from services.data_fetcher import DataFetcher
from services.daily_service import refresh_daily_logic

cors_config = options.CorsOptions(
    cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"]
)


def get_cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "3600",
    }


@https_fn.on_request(
    region="europe-west1",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1,
    cors=cors_config,
)
def force_weekly_research(req: https_fn.Request) -> https_fn.Response:
    """Endpoint manual para forzar la generación del reporte en pruebas"""
    # Note: on_request does not have request.auth automatically populated like on_call.
    # Since this seems to be a manual testing endpoint, we'll leave it as is for now or
    # require a secret key in the header if it were to be fully secured in a later phase.
    logger.info("🔥 Forzando Deep Research Semanal Manualmente")
    from services.research import generate_weekly_strategy_report

    db = firestore.client()

    try:
        result = generate_weekly_strategy_report(db)
        if result.get("success"):
            return https_fn.Response(
                json.dumps(
                    {"success": True, "message": "Nuevo informe generado con éxito."}
                ),
                status=200,
                headers=get_cors_headers(),
            )
        else:
            return https_fn.Response(
                json.dumps({"success": False, "error": result.get("error")}),
                status=500,
                headers=get_cors_headers(),
            )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"success": False, "error": str(e)}),
            status=500,
            headers=get_cors_headers(),
        )


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=540
)
def generate_analysis_report(request: https_fn.CallableRequest):
    """Trigger manual para Deep Research Consolidado (Weekly Strategy Report)"""
    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    from services.research import generate_weekly_strategy_report

    db = firestore.client()
    return generate_weekly_strategy_report(db)


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540
)
def restore_historico(request: https_fn.CallableRequest):
    if not request.auth or request.auth.token.get("email") != "oantiza@gmail.com":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Requiere privilegios de administrador",
        )

    db = firestore.client()
    return restore_historico_logic(db)


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config
)
def insertMonthlyReport(request: https_fn.CallableRequest):
    if not request.auth or request.auth.token.get("email") != "oantiza@gmail.com":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Requiere privilegios de administrador",
        )

    db = firestore.client()
    doc_ref = db.collection("analysis_results").add(request.data)
    return {"success": True, "doc_id": doc_ref[1].id}


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config
)
def getRiskRate(request: https_fn.CallableRequest):
    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    db = firestore.client()
    fetcher = DataFetcher(db)
    return {"rate": fetcher.get_dynamic_risk_free_rate()}


@https_fn.on_call(
    region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config
)
def updateFundHistory(request: https_fn.CallableRequest):
    """
    Trigger manual update of fund history from EODHD.
    Params: { isin, mode='merge'|'overwrite', from_date='YYYY-MM-DD', to_date='YYYY-MM-DD' }
    """
    from services.nav_fetcher import update_single_fund_history

    db = firestore.client()

    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Requiere autenticación",
        )

    user_email = request.auth.token.get("email", "")
    if user_email != "oantiza@gmail.com":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message=f"Forbidden: User {user_email} is not authorized.",
        )

    data = request.data or {}

    isin = data.get("isin")
    if not isin:
        return {"success": False, "error": "Missing ISIN"}

    mode = data.get("mode", "merge")
    from_date = data.get("from_date")
    to_date = data.get("to_date")

    return update_single_fund_history(db, isin, mode, from_date, to_date)


@https_fn.on_request(
    region="europe-west1", timeout_sec=540, memory=options.MemoryOption.GB_1
)
def refresh_daily_metrics(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP Endpoint: Daily Refresh Job (Protected).
    Triggered by Cloud Scheduler.
    """
    token = req.headers.get("X-Refresh-Token")
    expected_token = os.environ.get("REFRESH_TOKEN")

    if not expected_token or token != expected_token:
        return https_fn.Response("Unauthorized", status=403)

    start_time = datetime.datetime.utcnow().timestamp()
    db = firestore.client()

    try:
        result = refresh_daily_logic(db, start_time)
        return https_fn.Response(
            json.dumps(result, default=str), status=200, mimetype="application/json"
        )
    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)
