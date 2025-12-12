// IDS Parser - Parse IDS (Information Delivery Specification) XML files
// Based on buildingSMART IDS standard

export interface IDSSimpleValue {
  type: 'simple';
  value: string;
}

export interface IDSRestriction {
  type: 'restriction';
  base: string;
  pattern?: string;
  enumeration?: string[];
  minLength?: number;
  maxLength?: number;
  minInclusive?: number;
  maxInclusive?: number;
}

export type IDSValue = IDSSimpleValue | IDSRestriction;

export interface IDSFacet {
  type: 'entity' | 'classification' | 'attribute' | 'property' | 'material' | 'partOf';
}

export interface IDSEntityFacet extends IDSFacet {
  type: 'entity';
  name: IDSValue;
  predefinedType?: IDSValue;
}

export interface IDSClassificationFacet extends IDSFacet {
  type: 'classification';
  system?: IDSValue;
  value?: IDSValue;
}

export interface IDSAttributeFacet extends IDSFacet {
  type: 'attribute';
  name: IDSValue;
  value?: IDSValue;
}

export interface IDSPropertyFacet extends IDSFacet {
  type: 'property';
  propertySet: IDSValue;
  baseName: IDSValue;
  value?: IDSValue;
  dataType?: string;
}

export interface IDSMaterialFacet extends IDSFacet {
  type: 'material';
  value?: IDSValue;
}

export interface IDSPartOfFacet extends IDSFacet {
  type: 'partOf';
  entity: IDSValue;
  relation?: string;
}

export type IDSAnyFacet = IDSEntityFacet | IDSClassificationFacet | IDSAttributeFacet | IDSPropertyFacet | IDSMaterialFacet | IDSPartOfFacet;

export interface IDSRequirement {
  facet: IDSAnyFacet;
  minOccurs: number; // 0 = optional, 1 = required
  maxOccurs: number | 'unbounded';
  instructions?: string;
}

export interface IDSSpecification {
  name: string;
  description?: string;
  instructions?: string;
  ifcVersion?: string[];
  applicability: IDSAnyFacet[];
  requirements: IDSRequirement[];
}

export interface IDSFile {
  title: string;
  version?: string;
  author?: string;
  date?: string;
  purpose?: string;
  specifications: IDSSpecification[];
}

// Parse IDS XML string
export function parseIDS(xmlString: string): IDSFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  const idsElement = doc.querySelector('ids');
  if (!idsElement) {
    throw new Error('Invalid IDS: No <ids> root element found');
  }

  // Parse info section
  const info = idsElement.querySelector('info');
  const title = info?.querySelector('title')?.textContent || 'Untitled IDS';
  const version = info?.querySelector('version')?.textContent || undefined;
  const author = info?.querySelector('author')?.textContent || undefined;
  const date = info?.querySelector('date')?.textContent || undefined;
  const purpose = info?.querySelector('purpose')?.textContent || undefined;

  // Parse specifications
  const specifications: IDSSpecification[] = [];
  const specElements = idsElement.querySelectorAll('specifications > specification');
  
  specElements.forEach((specEl) => {
    const spec = parseSpecification(specEl);
    if (spec) {
      specifications.push(spec);
    }
  });

  return {
    title,
    version,
    author,
    date,
    purpose,
    specifications
  };
}

function parseSpecification(specEl: Element): IDSSpecification | null {
  const name = specEl.getAttribute('name') || 'Unnamed Specification';
  const description = specEl.getAttribute('description') || undefined;
  const instructions = specEl.getAttribute('instructions') || undefined;
  
  // Parse ifcVersion
  const ifcVersionAttr = specEl.getAttribute('ifcVersion');
  const ifcVersion = ifcVersionAttr ? ifcVersionAttr.split(' ') : undefined;

  // Parse applicability
  const applicabilityEl = specEl.querySelector('applicability');
  const applicability: IDSAnyFacet[] = [];
  if (applicabilityEl) {
    applicability.push(...parseFacets(applicabilityEl));
  }

  // Parse requirements
  const requirementsEl = specEl.querySelector('requirements');
  const requirements: IDSRequirement[] = [];
  if (requirementsEl) {
    requirements.push(...parseRequirements(requirementsEl));
  }

  // Skip specs without applicability
  if (applicability.length === 0) {
    return null;
  }

  return {
    name,
    description,
    instructions,
    ifcVersion,
    applicability,
    requirements
  };
}

function parseFacets(container: Element): IDSAnyFacet[] {
  const facets: IDSAnyFacet[] = [];

  // Entity facet
  container.querySelectorAll(':scope > entity').forEach((el) => {
    const facet = parseEntityFacet(el);
    if (facet) facets.push(facet);
  });

  // Classification facet
  container.querySelectorAll(':scope > classification').forEach((el) => {
    const facet = parseClassificationFacet(el);
    if (facet) facets.push(facet);
  });

  // Attribute facet
  container.querySelectorAll(':scope > attribute').forEach((el) => {
    const facet = parseAttributeFacet(el);
    if (facet) facets.push(facet);
  });

  // Property facet
  container.querySelectorAll(':scope > property').forEach((el) => {
    const facet = parsePropertyFacet(el);
    if (facet) facets.push(facet);
  });

  // Material facet
  container.querySelectorAll(':scope > material').forEach((el) => {
    const facet = parseMaterialFacet(el);
    if (facet) facets.push(facet);
  });

  // PartOf facet
  container.querySelectorAll(':scope > partOf').forEach((el) => {
    const facet = parsePartOfFacet(el);
    if (facet) facets.push(facet);
  });

  return facets;
}

function parseRequirements(container: Element): IDSRequirement[] {
  const requirements: IDSRequirement[] = [];
  
  const parseReq = (el: Element, facet: IDSAnyFacet | null) => {
    if (!facet) return;
    
    const minOccurs = el.getAttribute('minOccurs');
    const maxOccurs = el.getAttribute('maxOccurs');
    const instructions = el.getAttribute('instructions') || undefined;

    requirements.push({
      facet,
      minOccurs: minOccurs ? parseInt(minOccurs, 10) : 1,
      maxOccurs: maxOccurs === 'unbounded' ? 'unbounded' : (maxOccurs ? parseInt(maxOccurs, 10) : 'unbounded'),
      instructions
    });
  };

  container.querySelectorAll(':scope > entity').forEach((el) => parseReq(el, parseEntityFacet(el)));
  container.querySelectorAll(':scope > classification').forEach((el) => parseReq(el, parseClassificationFacet(el)));
  container.querySelectorAll(':scope > attribute').forEach((el) => parseReq(el, parseAttributeFacet(el)));
  container.querySelectorAll(':scope > property').forEach((el) => parseReq(el, parsePropertyFacet(el)));
  container.querySelectorAll(':scope > material').forEach((el) => parseReq(el, parseMaterialFacet(el)));
  container.querySelectorAll(':scope > partOf').forEach((el) => parseReq(el, parsePartOfFacet(el)));

  return requirements;
}

function parseEntityFacet(el: Element): IDSEntityFacet | null {
  const nameEl = el.querySelector(':scope > name');
  if (!nameEl) return null;

  const name = parseValue(nameEl);
  if (!name) return null;

  const predefinedTypeEl = el.querySelector(':scope > predefinedType');
  const predefinedType = predefinedTypeEl ? parseValue(predefinedTypeEl) : undefined;

  return {
    type: 'entity',
    name,
    predefinedType
  };
}

function parseClassificationFacet(el: Element): IDSClassificationFacet | null {
  const systemEl = el.querySelector(':scope > system');
  const valueEl = el.querySelector(':scope > value');

  return {
    type: 'classification',
    system: systemEl ? parseValue(systemEl) : undefined,
    value: valueEl ? parseValue(valueEl) : undefined
  };
}

function parseAttributeFacet(el: Element): IDSAttributeFacet | null {
  const nameEl = el.querySelector(':scope > name');
  if (!nameEl) return null;

  const name = parseValue(nameEl);
  if (!name) return null;

  const valueEl = el.querySelector(':scope > value');

  return {
    type: 'attribute',
    name,
    value: valueEl ? parseValue(valueEl) : undefined
  };
}

function parsePropertyFacet(el: Element): IDSPropertyFacet | null {
  const propertySetEl = el.querySelector(':scope > propertySet');
  const baseNameEl = el.querySelector(':scope > baseName');
  
  if (!propertySetEl || !baseNameEl) return null;

  const propertySet = parseValue(propertySetEl);
  const baseName = parseValue(baseNameEl);
  
  if (!propertySet || !baseName) return null;

  const valueEl = el.querySelector(':scope > value');
  const dataType = el.getAttribute('dataType') || undefined;

  return {
    type: 'property',
    propertySet,
    baseName,
    value: valueEl ? parseValue(valueEl) : undefined,
    dataType
  };
}

function parseMaterialFacet(el: Element): IDSMaterialFacet | null {
  const valueEl = el.querySelector(':scope > value');

  return {
    type: 'material',
    value: valueEl ? parseValue(valueEl) : undefined
  };
}

function parsePartOfFacet(el: Element): IDSPartOfFacet | null {
  const entityEl = el.querySelector(':scope > entity');
  if (!entityEl) return null;

  // PartOf entity is a nested element with name
  const nameEl = entityEl.querySelector(':scope > name');
  if (!nameEl) return null;

  const entity = parseValue(nameEl);
  if (!entity) return null;

  const relation = el.getAttribute('relation') || undefined;

  return {
    type: 'partOf',
    entity,
    relation
  };
}

function parseValue(el: Element): IDSValue | undefined {
  // Check for simpleValue
  const simpleValue = el.querySelector(':scope > simpleValue');
  if (simpleValue) {
    return {
      type: 'simple',
      value: simpleValue.textContent || ''
    };
  }

  // Check for restriction
  const restriction = el.querySelector(':scope > restriction');
  if (restriction) {
    const base = restriction.getAttribute('base') || 'xs:string';
    const result: IDSRestriction = { type: 'restriction', base };

    const pattern = restriction.querySelector(':scope > pattern');
    if (pattern) {
      result.pattern = pattern.getAttribute('value') || undefined;
    }

    const enumerations = restriction.querySelectorAll(':scope > enumeration');
    if (enumerations.length > 0) {
      result.enumeration = Array.from(enumerations).map(e => e.getAttribute('value') || '');
    }

    const minLength = restriction.querySelector(':scope > minLength');
    if (minLength) {
      result.minLength = parseInt(minLength.getAttribute('value') || '0', 10);
    }

    const maxLength = restriction.querySelector(':scope > maxLength');
    if (maxLength) {
      result.maxLength = parseInt(maxLength.getAttribute('value') || '0', 10);
    }

    const minInclusive = restriction.querySelector(':scope > minInclusive');
    if (minInclusive) {
      result.minInclusive = parseFloat(minInclusive.getAttribute('value') || '0');
    }

    const maxInclusive = restriction.querySelector(':scope > maxInclusive');
    if (maxInclusive) {
      result.maxInclusive = parseFloat(maxInclusive.getAttribute('value') || '0');
    }

    return result;
  }

  // Plain text content (for simple cases)
  const text = el.textContent?.trim();
  if (text) {
    return { type: 'simple', value: text };
  }

  return undefined;
}

// Helper to get human-readable value description
export function getValueDescription(value: IDSValue | undefined): string {
  if (!value) return 'any';
  
  if (value.type === 'simple') {
    return value.value;
  }
  
  if (value.enumeration) {
    return value.enumeration.join(' | ');
  }
  
  if (value.pattern) {
    return `pattern: ${value.pattern}`;
  }
  
  const parts: string[] = [];
  if (value.minLength !== undefined) parts.push(`min length: ${value.minLength}`);
  if (value.maxLength !== undefined) parts.push(`max length: ${value.maxLength}`);
  if (value.minInclusive !== undefined) parts.push(`>= ${value.minInclusive}`);
  if (value.maxInclusive !== undefined) parts.push(`<= ${value.maxInclusive}`);
  
  return parts.length > 0 ? parts.join(', ') : 'restricted';
}
