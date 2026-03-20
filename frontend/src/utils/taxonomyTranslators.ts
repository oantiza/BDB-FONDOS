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
        case 'MONEY_MARKET': return 'Monetario';
        case 'COMMODITIES': return 'Materias Primas';
        case 'ALTERNATIVES': return 'Alternativos';
        case 'UNKNOWN': return 'Desconocido';
        default: return type;
    }
};

/**
 * Traduce los subtipos de activos canónicos (classification_v2.asset_subtype) a etiquetas amigables en español.
 */
export const translateAssetSubtype = (subtype?: string): string => {
    if (!subtype) return '';
    const s = subtype.toUpperCase();
    switch (s) {
        case 'GOVERNMENT': return 'Gobierno';
        case 'CORPORATE': return 'Corporativo';
        case 'HIGH_YIELD': return 'High Yield';
        case 'EMERGING': return 'Emergentes';
        case 'SECTOR_EQUITY': return 'Sectorial';
        case 'LARGE_CAP': return 'Grandes Compañías';
        case 'MID_CAP': return 'Medianas Compañías';
        case 'SMALL_CAP': return 'Pequeñas Compañías';
        case 'GROWTH': return 'Crecimiento';
        case 'VALUE': return 'Valor';
        case 'BLEND': return 'Mixto';
        case 'FLEXIBLE': return 'Flexible';
        case 'CAUTIOUS': return 'Defensivo';
        case 'MODERATE': return 'Moderado';
        case 'AGGRESSIVE': return 'Agresivo';
        case 'ABSOLUTE_RETURN': return 'Retorno Absoluto';
        case 'PRECIOUS_METALS': return 'Metales Preciosos';
        case 'AGRICULTURE': return 'Agricultura';
        case 'ENERGY': return 'Energía';
        case 'UNKNOWN': return '';
        default:
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
