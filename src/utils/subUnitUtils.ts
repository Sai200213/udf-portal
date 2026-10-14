import { Site, SubUnit } from '../../types';

/**
 * Sub-Unit Lookup Utilities
 * Used for billing, compliance, and bulk imports to resolve
 * sub-unit names or unit codes to their parent sites.
 */

// Resolve sub-unit name to parent site
export const findSiteBySubUnitName = (sites: Site[], subUnitName: string): Site | null => {
    const normalized = String(subUnitName || '').toLowerCase().trim();
    for (const site of sites) {
        if (site.subUnits?.some(u => u.name.toLowerCase().trim() === normalized)) {
            return site;
        }
    }
    return null;
};

// Resolve unit code to parent site
export const findSiteByUnitCode = (sites: Site[], unitCode: string): Site | null => {
    const normalized = String(unitCode || '').toLowerCase().trim();
    for (const site of sites) {
        if (site.subUnits?.some(u => u.code?.toLowerCase().trim() === normalized)) {
            return site;
        }
    }
    return null;
};

// Find sub-unit by name or code
export const findSubUnit = (sites: Site[], identifier: string): { site: Site, subUnit: SubUnit } | null => {
    const normalized = String(identifier || '').toLowerCase().trim();
    for (const site of sites) {
        for (const subUnit of site.subUnits || []) {
            if (subUnit.name.toLowerCase().trim() === normalized ||
                subUnit.code?.toLowerCase().trim() === normalized) {
                return { site, subUnit };
            }
        }
    }
    return null;
};

// Get full lookup map: subUnitName/code -> { site, subUnit }
export const buildSubUnitLookupMap = (sites: Site[]): Map<string, { site: Site, subUnit: SubUnit }> => {
    const map = new Map<string, { site: Site, subUnit: SubUnit }>();
    for (const site of sites) {
        for (const subUnit of site.subUnits || []) {
            // Add by name
            map.set(subUnit.name.toLowerCase().trim(), { site, subUnit });
            // Add by code if exists
            if (subUnit.code) {
                map.set(subUnit.code.toLowerCase().trim(), { site, subUnit });
            }
        }
    }
    return map;
};

// Bulk resolve: given array of names/codes, return resolved sites
export interface BulkResolveResult {
    input: string;
    site: Site | null;
    subUnit: SubUnit | null;
    resolved: boolean;
}

export const bulkResolveSubUnits = (
    sites: Site[],
    identifiers: string[]
): BulkResolveResult[] => {
    const lookup = buildSubUnitLookupMap(sites);
    return identifiers.map(input => {
        const found = lookup.get(String(input || '').toLowerCase().trim());
        return {
            input: String(input || ''),
            site: found?.site || null,
            subUnit: found?.subUnit || null,
            resolved: !!found
        };
    });
};

// Get all sub-units as flat array with parent site info
export interface FlatSubUnit extends SubUnit {
    parentSiteId: string;
    parentSiteName: string;
}

// Comprehensive location resolver: translates any name/code into site info
export const resolveLocation = (sites: Site[], input: string): { site: Site | null, subUnit: SubUnit | null } => {
    const normalized = String(input || '').toLowerCase().trim();

    // 1. Check Sub-Units and Unit Codes first (they are more specific)
    const subUnitFound = findSubUnit(sites, normalized);
    if (subUnitFound) return subUnitFound;

    // 2. Fallback to Main Site Name
    const siteFound = sites.find(s => s.name.toLowerCase().trim() === normalized);
    if (siteFound) return { site: siteFound, subUnit: null };

    return { site: null, subUnit: null };
};

export const getAllSubUnitsFlat = (sites: Site[]): FlatSubUnit[] => {
    const result: FlatSubUnit[] = [];
    for (const site of sites) {
        for (const subUnit of site.subUnits || []) {
            result.push({
                ...subUnit,
                parentSiteId: site.id,
                parentSiteName: site.name
            });
        }
    }
    return result;
};

// Validate bulk import data - check if all sub-units/codes exist
export const validateBulkImportLocations = (
    sites: Site[],
    locations: string[]
): { valid: string[], invalid: string[] } => {
    const lookup = buildSubUnitLookupMap(sites);
    const siteNames = new Set(sites.map(s => s.name.toLowerCase().trim()));

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const loc of locations) {
        const normalized = String(loc || '').toLowerCase().trim();
        // Check if it's a main site name OR a sub-unit name/code
        if (siteNames.has(normalized) || lookup.has(normalized)) {
            valid.push(loc);
        } else {
            invalid.push(loc);
        }
    }

    return { valid, invalid };
};

