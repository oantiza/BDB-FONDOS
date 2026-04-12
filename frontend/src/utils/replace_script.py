import sys

filename = 'c:/Users/oanti/Documents/BDB-FONDOS/frontend/src/utils/rulesEngine.ts'
with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_func = """// NOTE: Endpoint oficial para hidratar configuración desde Backend (FASE 1)
export async function syncBusinessRulesFromBackend(functionsInstance: any) {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const getRules = httpsCallable(functionsInstance, 'get_business_rules');
    const response = await getRules();
    const data = response.data as any;

    if (!data || data.api_version !== "business_rules_v1" || !data.risk_profiles) {
      console.warn("⚠️ [RulesEngine] Payload de reglas de negocio inválido, usando RISK_PROFILES local");
      return;
    }

    const { risk_profiles, config_source } = data;
    Object.keys(risk_profiles).forEach(riskStr => {
      const riskLevel = Number(riskStr);
      if (RISK_PROFILES[riskLevel]) {
        const backendProfile = risk_profiles[riskStr];
        if (backendProfile.buckets) {
          // Ya viene en formato { RV: {min, max}, RF: {min, max }... } desde el backend
          RISK_PROFILES[riskLevel].buckets = backendProfile.buckets;
        }
      }
    });

    console.log(`🛡️ [RulesEngine] Perfiles de riesgo hidratados desde backend (${config_source}).`);
  } catch (error) {
    console.error("⚠️ [RulesEngine] Error consultando business rules al backend:", error);
    // Fallback silencioso para no romper la UX
  }
}
"""

# Find bounds of syncRiskProfilesFromDB
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if line.startswith('// NOTE: Esta es la función crítica') or line.startswith('export function syncRiskProfilesFromDB'):
        if start_idx == -1:
            start_idx = i
            
    if start_idx != -1 and line.startswith('}'):
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    del lines[start_idx:end_idx+1]
    lines.insert(start_idx, new_func)
    with open(filename, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Replaced successfully")
else:
    print("Function not found")
