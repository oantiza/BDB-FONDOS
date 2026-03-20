import logging
logger = logging.getLogger(__name__)
from firebase_functions import scheduler_fn, options
from firebase_admin import firestore


@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="every monday 09:00",
    timezone="Europe/Madrid",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1,
)
def scheduleWeeklyResearch(event: scheduler_fn.ScheduledEvent) -> None:
    logger.info(f"⏰ Ejecutando Deep Research Semanal Automático: {event.schedule_time}")
    from services.research import generate_weekly_strategy_report

    db = firestore.client()

    result = generate_weekly_strategy_report(db)

    if result.get("success"):
        logger.info("✅ Informe Semanal Consolidado generado correctamente.")
    else:
        logger.info(f"❌ Error generando informe semanal: {result.get('error')}")


@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="0 6 * * 1-5",  # Lunes a Viernes a las 06:00 AM
    timezone="Europe/Madrid",
    timeout_sec=1200,  # 20 Minutos (Margen de seguridad)
    memory=options.MemoryOption.GB_1,  # 1GB RAM (Vital para Pandas/Métricas)
)
def runMasterDailyRoutine(event: scheduler_fn.ScheduledEvent) -> None:
    logger.info(f"🚀 [MASTER] Iniciando Rutina Diaria: {event.schedule_time}")

    from services.nav_fetcher import run_daily_fetch
    from services.analytics import update_daily_metrics, build_global_price_cache

    db = firestore.client()

    logger.info("⬇️ [PASO 1/2] Iniciando Descarga de NAVs...")
    try:
        fetch_result = run_daily_fetch()
        logger.info(f"✅ Descarga completada: {fetch_result}")
    except Exception as e:
        logger.info(f"❌ ERROR CRÍTICO en Descarga: {e}")
        logger.info("⛔ Abortando cálculo de métricas para evitar datos corruptos.")
        return

    logger.info("🧮 [PASO 2/3] Recalculando Métricas (Sharpe, Volatilidad, etc)...")
    try:
        update_daily_metrics(db)
        logger.info("✅ Métricas actualizadas correctamente.")
    except Exception as e:
        logger.info(f"❌ ERROR en cálculo de Métricas: {e}")

    logger.info("📦 [PASO 3/3] Reconstruyendo Caché Global en Cloud Storage...")
    try:
        build_global_price_cache(db)
    except Exception as e:
        logger.info(f"❌ ERROR al construir Caché Global: {e}")

    logger.info("🏁 [MASTER] Rutina Diaria finalizada.")


@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="0 2 * * *",  # Todos los días a las 02:00 AM
    timezone="Europe/Madrid",
    timeout_sec=1200,  # 20 Minutos
    memory=options.MemoryOption.GB_1,  # 1GB RAM
)
def runDailyDataValidation(event: scheduler_fn.ScheduledEvent) -> None:
    logger.info(f"🚀 [PIPELINE] Iniciando Validación y Limpieza Diaria de NAVs: {event.schedule_time}")

    from services.data_pipeline import run_nav_validation_pipeline

    db = firestore.client()

    try:
        result = run_nav_validation_pipeline(db, dry_run=False)
        logger.info(f"✅ Pipeline completado con éxito: {result}")
    except Exception as e:
        logger.info(f"❌ ERROR CRÍTICO en Pipeline de Datos: {e}")
