from firebase_functions import scheduler_fn, options
from firebase_admin import firestore

@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="every monday 09:00",
    timezone="Europe/Madrid",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1
)
def scheduleWeeklyResearch(event: scheduler_fn.ScheduledEvent) -> None:
    print(f"⏰ Ejecutando Deep Research Semanal Automático: {event.schedule_time}")
    from services.research import generate_weekly_strategy_report
    db = firestore.client()
    
    result = generate_weekly_strategy_report(db)
    
    if result.get('success'):
        print("✅ Informe Semanal Consolidado generado correctamente.")
    else:
        print(f"❌ Error generando informe semanal: {result.get('error')}")

@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="0 6 * * 1-5",       # Lunes a Viernes a las 06:00 AM
    timezone="Europe/Madrid",
    timeout_sec=1200,             # 20 Minutos (Margen de seguridad)
    memory=options.MemoryOption.GB_1 # 1GB RAM (Vital para Pandas/Métricas)
)
def runMasterDailyRoutine(event: scheduler_fn.ScheduledEvent) -> None:
    print(f"🚀 [MASTER] Iniciando Rutina Diaria: {event.schedule_time}")
    
    from services.nav_fetcher import run_daily_fetch
    from services.analytics import update_daily_metrics, build_global_price_cache
    
    db = firestore.client()
    
    print("⬇️ [PASO 1/2] Iniciando Descarga de NAVs...")
    try:
        fetch_result = run_daily_fetch()
        print(f"✅ Descarga completada: {fetch_result}")
    except Exception as e:
        print(f"❌ ERROR CRÍTICO en Descarga: {e}")
        print("⛔ Abortando cálculo de métricas para evitar datos corruptos.")
        return

    print("🧮 [PASO 2/3] Recalculando Métricas (Sharpe, Volatilidad, etc)...")
    try:
        update_daily_metrics(db) 
        print(f"✅ Métricas actualizadas correctamente.")
    except Exception as e:
        print(f"❌ ERROR en cálculo de Métricas: {e}")

    print("📦 [PASO 3/3] Reconstruyendo Caché Global en Cloud Storage...")
    try:
        build_global_price_cache(db)
    except Exception as e:
        print(f"❌ ERROR al construir Caché Global: {e}")

    print("🏁 [MASTER] Rutina Diaria finalizada.")
