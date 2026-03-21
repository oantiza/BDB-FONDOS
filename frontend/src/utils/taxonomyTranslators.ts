/**
 * Traduce los tipos de activos canónicos (classification_v2.asset_type) a etiquetas amigables en español.
 */
export const translateAssetType = (type?: string): string => {
    if (!type) return 'Desconocido';
    const t = type.toUpperCase();
    switch (t) {
        case 'EQUITY': return 'Renta Variable';
        case 'FIXED_INCOME': return 'Renta Fija';
        case 'MIXED': return 'Mixto';
        case 'MONETARY':
        case 'MONEY_MARKET': return 'Monetario';
        case 'COMMODITIES': return 'Materias Primas';
        case 'ALTERNATIVE':
        case 'ALTERNATIVES': return 'Alternativos';
        case 'REAL_ESTATE': return 'Inmobiliario';
        case 'OTHER': return 'Otros';
        case 'UNKNOWN': return 'Desconocido';
        default: return type;
    }
};

export const translateAssetSubtype = (subtype?: string): string => {
    if (!subtype) return '';
    const s = subtype.toUpperCase().replace(/ /g, '_');
    switch (s) {
        case 'GOVERNMENT':
        case 'GOVERNMENT_BOND': return 'Deuda Pública';
        case 'CORPORATE':
        case 'CORPORATE_BOND': return 'Deuda Corporativa';
        case 'HIGH_YIELD':
        case 'HIGH_YIELD_BOND': return 'High Yield';
        case 'EMERGING':
        case 'EMERGING_MARKETS_BOND': return 'Deuda Emergente';
        case 'EMERGING_MARKETS_EQUITY': return 'Renta Variable Emergente';
        case 'CONVERTIBLE_BOND': return 'Bonos Convertibles';
        case 'INFLATION_LINKED_BOND': return 'Bonos Ligados a la Inflación';
        case 'GLOBAL_EQUITY': return 'Renta Variable Global';
        case 'US_EQUITY': return 'Renta Variable EE.UU.';
        case 'EUROPE_EQUITY': return 'Renta Variable Europea';
        case 'EUROZONE_EQUITY': return 'Renta Variable Zona Euro';
        case 'JAPAN_EQUITY': return 'Renta Variable Japón';
        case 'ASIA_PACIFIC_EQUITY': return 'Renta Variable Asia-Pacífico';
        case 'GLOBAL_SMALL_CAP_EQUITY': return 'RV Global Small Cap';
        case 'GLOBAL_INCOME_EQUITY': return 'RV Global de Rentas';
        case 'SECTOR_EQUITY': return 'Renta Variable Sectorial';
        case 'SECTOR_EQUITY_TECH': return 'Tecnología';
        case 'SECTOR_EQUITY_HEALTHCARE': return 'Salud';
        case 'SECTOR_EQUITY_FINANCIALS': return 'Financiero';
        case 'SECTOR_EQUITY_INDUSTRIALS': return 'Industrial';
        case 'SECTOR_EQUITY_CONSUMER_CYCLICAL': return 'Consumo Cíclico';
        case 'SECTOR_EQUITY_CONSUMER_DEFENSIVE': return 'Consumo Defensivo';
        case 'SECTOR_EQUITY_REAL_ESTATE': return 'Inmobiliario';
        case 'SECTOR_EQUITY_UTILITIES': return 'Servicios Públicos';
        case 'SECTOR_EQUITY_ENERGY': return 'Energía';
        case 'SECTOR_EQUITY_BASIC_MATERIALS': return 'Materiales Básicos';
        case 'SECTOR_EQUITY_COMMUNICATION': return 'Comunicaciones';
        case 'THEMATIC_EQUITY': return 'Renta Variable Temática';
        case 'LARGE_CAP': return 'Grandes Compañías';
        case 'MID_CAP': return 'Medianas Compañías';
        case 'SMALL_CAP': return 'Pequeñas Compañías';
        case 'GROWTH': return 'Crecimiento';
        case 'VALUE': return 'Valor';
        case 'BLEND': return 'Mixto';
        case 'FLEXIBLE':
        case 'FLEXIBLE_ALLOCATION': return 'Flexible';
        case 'CAUTIOUS':
        case 'CONSERVATIVE_ALLOCATION': return 'Mixto Defensivo';
        case 'MODERATE':
        case 'MODERATE_ALLOCATION': return 'Mixto Moderado';
        case 'AGGRESSIVE':
        case 'AGGRESSIVE_ALLOCATION': return 'Mixto Agresivo';
        case 'MULTI_ASSET_INCOME': return 'Mixto de Rentas';
        case 'TARGET_DATE': return 'Fecha Objetivo';
        case 'ABSOLUTE_RETURN': return 'Retorno Absoluto';
        case 'PRECIOUS_METALS': return 'Metales Preciosos';
        case 'AGRICULTURE': return 'Agricultura';
        case 'ENERGY': return 'Energía';
        case 'COMMODITIES_BROAD': return 'Materias Primas Generales';
        case 'UNKNOWN': return '';
        default:
            // Fallback: si empieza por SECTOR_EQUITY_ quitamos el prefijo
            if (s.startsWith('SECTOR_EQUITY_')) {
                return 'RV Sectorial: ' + s.replace('SECTOR_EQUITY_', '').split('_')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            }
            // Intentar formatear de MAYUSCULAS_CON_GUION a Capitalizado
            return s.split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
    }
};

/**
 * Función helper para formatear de forma combinada el Tipo y Subtipo.
 */
export const getFormattedTaxonomy = (asset: any): string => {
    const type = asset?.classification_v2?.asset_type;
    const subtype = asset?.classification_v2?.asset_subtype;

    const translatedType = translateAssetType(type);
    const translatedSubtype = translateAssetSubtype(subtype);

    if (translatedSubtype && translatedSubtype.toLowerCase() !== 'unknown') {
        return `${translatedType} - ${translatedSubtype}`;
    }
    return translatedType;
};
