// IDS Audit Engine - Validates IFC model against IDS specifications
import { 
  IDSFile, 
  IDSSpecification, 
  IDSRequirement, 
  IDSAnyFacet, 
  IDSValue,
  IDSEntityFacet,
  IDSPropertyFacet,
  IDSAttributeFacet,
  IDSClassificationFacet,
  IDSMaterialFacet,
  getValueDescription
} from './IDSParser';

export interface AuditResult {
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_APPLICABLE';
  elementId: number;
  elementName: string;
  elementType: string;
  specificationName: string;
  requirementDescription: string;
  message: string;
  details?: string;
}

export interface AuditSummary {
  totalElements: number;
  testedElements: number;
  totalRequirements: number;
  pass: number;
  fail: number;
  warning: number;
  notApplicable: number;
  score: number; // Percentage of pass/(pass+fail)
  results: AuditResult[];
}

// IFC Type codes
const IFC_TYPES: { [key: string]: number } = {
  'IFCWALL': 3512223829,
  'IFCWALLSTANDARDCASE': 3512223829,
  'IFCSLAB': 1529196076,
  'IFCBEAM': 753842376,
  'IFCCOLUMN': 843113511,
  'IFCDOOR': 395920057,
  'IFCWINDOW': 3304561284,
  'IFCROOF': 2016517767,
  'IFCSTAIR': 331165859,
  'IFCRAILING': 2262370178,
  'IFCFURNISHINGELEMENT': 263784265,
  'IFCBUILDINGELEMENTPROXY': 1095909175,
  'IFCSPACE': 3856911033,
  'IFCSITE': 4097777520,
  'IFCBUILDING': 4031249490,
  'IFCBUILDINGSTOREY': 3124254112,
  'IFCPROJECT': 103090709,
  'IFCCOVERING': 1973544240,
  'IFCPLATE': 3171933400,
  'IFCMEMBER': 1073191201,
  'IFCCURTAINWALL': 844405976,
  'IFCFOOTING': 900683007,
  'IFCPILE': 1687234759,
  'IFCRAMP': 3024970846,
  'IFCSHADINGDEVICE': 1329646415,
  'IFCCHIMNEY': 3296154744,
  'IFCFLOWSEGMENT': 987401354,
  'IFCFLOWTERMINAL': 2058353004,
  'IFCFLOWCONTROLLER': 2058353004,
  'IFCFLOWFITTING': 4278956645,
  'IFCDISTRIBUTIONELEMENT': 1945004755,
  'IFCOPENINGELEMENT': 3588315303,
};

export class IDSAuditEngine {
  private ifcApi: any;
  private modelID: number;
  private elementCache: Map<number, any> = new Map();
  private propertyCache: Map<number, Map<string, Map<string, any>>> = new Map();
  private typeNameCache: Map<number, string> = new Map();

  constructor(ifcApi: any, modelID: number) {
    this.ifcApi = ifcApi;
    this.modelID = modelID;
  }

  // Main audit function
  async runAudit(idsFile: IDSFile, onProgress?: (message: string, percent: number) => void): Promise<AuditSummary> {
    const results: AuditResult[] = [];
    let testedElements = new Set<number>();
    let totalRequirements = 0;

    const specs = idsFile.specifications;
    
    for (let specIndex = 0; specIndex < specs.length; specIndex++) {
      const spec = specs[specIndex];
      const progress = ((specIndex + 1) / specs.length) * 100;
      onProgress?.(`Vérification: ${spec.name}`, progress);

      // Find applicable elements
      const applicableElements = await this.findApplicableElements(spec.applicability);
      
      for (const elementId of applicableElements) {
        testedElements.add(elementId);
        
        // Check each requirement
        for (const req of spec.requirements) {
          totalRequirements++;
          const result = await this.checkRequirement(elementId, req, spec.name);
          results.push(result);
        }
      }
    }

    // Calculate summary
    const pass = results.filter(r => r.status === 'PASS').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    const warning = results.filter(r => r.status === 'WARNING').length;
    const notApplicable = results.filter(r => r.status === 'NOT_APPLICABLE').length;
    
    const score = pass + fail > 0 ? Math.round((pass / (pass + fail)) * 100) : 100;

    return {
      totalElements: await this.getTotalElementCount(),
      testedElements: testedElements.size,
      totalRequirements,
      pass,
      fail,
      warning,
      notApplicable,
      score,
      results
    };
  }

  private async getTotalElementCount(): Promise<number> {
    let count = 0;
    for (const typeName of Object.keys(IFC_TYPES)) {
      try {
        const typeCode = IFC_TYPES[typeName];
        const ids = this.ifcApi.GetLineIDsWithType(this.modelID, typeCode);
        count += ids.size();
      } catch (e) {}
    }
    return count;
  }

  private async findApplicableElements(applicability: IDSAnyFacet[]): Promise<number[]> {
    let elementIds: Set<number> | null = null;

    for (const facet of applicability) {
      const matchingIds = await this.findMatchingElements(facet);
      
      if (elementIds === null) {
        elementIds = new Set(matchingIds);
      } else {
        // Intersection
        elementIds = new Set([...elementIds].filter(id => matchingIds.includes(id)));
      }
    }

    return elementIds ? Array.from(elementIds) : [];
  }

  private async findMatchingElements(facet: IDSAnyFacet): Promise<number[]> {
    switch (facet.type) {
      case 'entity':
        return this.findByEntity(facet as IDSEntityFacet);
      case 'classification':
        return this.findByClassification(facet as IDSClassificationFacet);
      case 'attribute':
        return this.findByAttribute(facet as IDSAttributeFacet);
      case 'property':
        return this.findByProperty(facet as IDSPropertyFacet);
      case 'material':
        return this.findByMaterial(facet as IDSMaterialFacet);
      default:
        return [];
    }
  }

  private async findByEntity(facet: IDSEntityFacet): Promise<number[]> {
    const entityName = this.getSimpleValue(facet.name)?.toUpperCase();
    if (!entityName) return [];

    const results: number[] = [];
    
    // Handle wildcards and patterns
    const matchingTypes = this.findMatchingTypes(entityName, facet.name);
    
    for (const typeCode of matchingTypes) {
      try {
        const ids = this.ifcApi.GetLineIDsWithType(this.modelID, typeCode);
        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i);
          
          // Check predefinedType if specified
          if (facet.predefinedType) {
            const element = this.getElement(id);
            const predefinedType = this.getValue(element?.PredefinedType);
            if (!this.matchesValue(predefinedType, facet.predefinedType)) {
              continue;
            }
          }
          
          results.push(id);
        }
      } catch (e) {}
    }

    return results;
  }

  private findMatchingTypes(entityName: string, value: IDSValue): number[] {
    const codes: number[] = [];
    
    if (value.type === 'simple') {
      // Direct match
      const key = entityName.startsWith('IFC') ? entityName : `IFC${entityName}`;
      if (IFC_TYPES[key]) {
        codes.push(IFC_TYPES[key]);
      }
      // Also check without IFC prefix
      const keyNoPrefix = entityName.replace(/^IFC/, '');
      for (const [name, code] of Object.entries(IFC_TYPES)) {
        if (name.includes(keyNoPrefix)) {
          codes.push(code);
        }
      }
    } else if (value.type === 'restriction') {
      // Pattern or enumeration matching
      if (value.enumeration) {
        for (const enumVal of value.enumeration) {
          const key = enumVal.toUpperCase();
          const fullKey = key.startsWith('IFC') ? key : `IFC${key}`;
          if (IFC_TYPES[fullKey]) {
            codes.push(IFC_TYPES[fullKey]);
          }
        }
      } else if (value.pattern) {
        const regex = new RegExp(value.pattern, 'i');
        for (const [name, code] of Object.entries(IFC_TYPES)) {
          if (regex.test(name)) {
            codes.push(code);
          }
        }
      }
    }

    return [...new Set(codes)];
  }

  private async findByClassification(facet: IDSClassificationFacet): Promise<number[]> {
    // This requires traversing IfcRelAssociatesClassification
    const results: number[] = [];
    
    try {
      const IFCRELASSOCIATESCLASSIFICATION = 919958153;
      const relIds = this.ifcApi.GetLineIDsWithType(this.modelID, IFCRELASSOCIATESCLASSIFICATION);
      
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        const rel = this.getElement(relId);
        if (!rel) continue;

        // Check classification reference
        const classRef = rel.RelatingClassification;
        if (!classRef) continue;
        
        const classRefId = typeof classRef === 'object' ? classRef.value : classRef;
        const classification = this.getElement(classRefId);
        if (!classification) continue;

        // Check system
        if (facet.system) {
          // Get the classification system
          let systemName: string | null = null;
          if (classification.ReferencedSource) {
            const sourceId = typeof classification.ReferencedSource === 'object' ? 
              classification.ReferencedSource.value : classification.ReferencedSource;
            const source = this.getElement(sourceId);
            systemName = this.getValue(source?.Name);
          }
          if (!this.matchesValue(systemName, facet.system)) continue;
        }

        // Check value
        if (facet.value) {
          const classValue = this.getValue(classification.Identification) || 
                            this.getValue(classification.ItemReference) ||
                            this.getValue(classification.Name);
          if (!this.matchesValue(classValue, facet.value)) continue;
        }

        // Get related objects
        if (rel.RelatedObjects && Array.isArray(rel.RelatedObjects)) {
          for (const objRef of rel.RelatedObjects) {
            const objId = typeof objRef === 'object' ? objRef.value : objRef;
            if (objId) results.push(objId);
          }
        }
      }
    } catch (e) {
      console.warn('Classification search error:', e);
    }

    return results;
  }

  private async findByAttribute(facet: IDSAttributeFacet): Promise<number[]> {
    // This is expensive - need to check all elements
    const results: number[] = [];
    const attrName = this.getSimpleValue(facet.name);
    if (!attrName) return [];

    for (const typeCode of Object.values(IFC_TYPES)) {
      try {
        const ids = this.ifcApi.GetLineIDsWithType(this.modelID, typeCode);
        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i);
          const element = this.getElement(id);
          if (!element) continue;

          const attrValue = this.getValue(element[attrName]);
          if (attrValue !== null && attrValue !== undefined) {
            if (!facet.value || this.matchesValue(attrValue, facet.value)) {
              results.push(id);
            }
          }
        }
      } catch (e) {}
    }

    return results;
  }

  private async findByProperty(facet: IDSPropertyFacet): Promise<number[]> {
    const results: number[] = [];
    const psetName = this.getSimpleValue(facet.propertySet);
    const propName = this.getSimpleValue(facet.baseName);
    if (!psetName || !propName) return [];

    // Check all elements
    for (const typeCode of Object.values(IFC_TYPES)) {
      try {
        const ids = this.ifcApi.GetLineIDsWithType(this.modelID, typeCode);
        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i);
          const propValue = await this.getPropertyValue(id, psetName, propName);
          if (propValue !== null && propValue !== undefined) {
            if (!facet.value || this.matchesValue(propValue, facet.value)) {
              results.push(id);
            }
          }
        }
      } catch (e) {}
    }

    return results;
  }

  private async findByMaterial(facet: IDSMaterialFacet): Promise<number[]> {
    const results: number[] = [];
    
    try {
      const IFCRELASSOCIATESMATERIAL = 2655215786;
      const relIds = this.ifcApi.GetLineIDsWithType(this.modelID, IFCRELASSOCIATESMATERIAL);
      
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        const rel = this.getElement(relId);
        if (!rel || !rel.RelatingMaterial) continue;

        const matId = typeof rel.RelatingMaterial === 'object' ? 
          rel.RelatingMaterial.value : rel.RelatingMaterial;
        const material = this.getElement(matId);
        
        const matName = this.getValue(material?.Name);
        
        if (facet.value) {
          if (!this.matchesValue(matName, facet.value)) continue;
        }

        if (rel.RelatedObjects && Array.isArray(rel.RelatedObjects)) {
          for (const objRef of rel.RelatedObjects) {
            const objId = typeof objRef === 'object' ? objRef.value : objRef;
            if (objId) results.push(objId);
          }
        }
      }
    } catch (e) {}

    return results;
  }

  private async checkRequirement(elementId: number, req: IDSRequirement, specName: string): Promise<AuditResult> {
    const element = this.getElement(elementId);
    const elementType = this.getTypeName(elementId);
    const elementName = this.getValue(element?.Name) || `Element #${elementId}`;

    const reqDescription = this.getRequirementDescription(req);
    
    try {
      const checkResult = await this.checkFacet(elementId, req.facet, req.minOccurs);
      
      return {
        status: checkResult.status,
        elementId,
        elementName,
        elementType,
        specificationName: specName,
        requirementDescription: reqDescription,
        message: checkResult.message,
        details: checkResult.details
      };
    } catch (e) {
      return {
        status: 'WARNING',
        elementId,
        elementName,
        elementType,
        specificationName: specName,
        requirementDescription: reqDescription,
        message: `Erreur lors de la vérification: ${e}`,
      };
    }
  }

  private async checkFacet(elementId: number, facet: IDSAnyFacet, minOccurs: number): Promise<{status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_APPLICABLE', message: string, details?: string}> {
    switch (facet.type) {
      case 'property':
        return this.checkPropertyFacet(elementId, facet as IDSPropertyFacet, minOccurs);
      case 'attribute':
        return this.checkAttributeFacet(elementId, facet as IDSAttributeFacet, minOccurs);
      case 'classification':
        return this.checkClassificationFacet(elementId, facet as IDSClassificationFacet, minOccurs);
      case 'material':
        return this.checkMaterialFacet(elementId, facet as IDSMaterialFacet, minOccurs);
      default:
        return { status: 'NOT_APPLICABLE', message: 'Type de vérification non supporté' };
    }
  }

  private async checkPropertyFacet(elementId: number, facet: IDSPropertyFacet, minOccurs: number): Promise<{status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: string}> {
    const psetName = this.getSimpleValue(facet.propertySet) || '';
    const propName = this.getSimpleValue(facet.baseName) || '';
    
    const propValue = await this.getPropertyValue(elementId, psetName, propName);
    
    if (propValue === null || propValue === undefined) {
      if (minOccurs === 0) {
        return { status: 'PASS', message: `Propriété optionnelle "${propName}" absente (autorisé)` };
      }
      return { 
        status: 'FAIL', 
        message: `Propriété "${propName}" manquante dans "${psetName}"` 
      };
    }

    if (facet.value) {
      if (this.matchesValue(propValue, facet.value)) {
        return { 
          status: 'PASS', 
          message: `Propriété "${propName}" = "${propValue}" ✓`,
          details: `Valeur attendue: ${getValueDescription(facet.value)}`
        };
      } else {
        return { 
          status: 'FAIL', 
          message: `Propriété "${propName}" = "${propValue}" (non conforme)`,
          details: `Valeur attendue: ${getValueDescription(facet.value)}`
        };
      }
    }

    return { 
      status: 'PASS', 
      message: `Propriété "${propName}" présente = "${propValue}"` 
    };
  }

  private async checkAttributeFacet(elementId: number, facet: IDSAttributeFacet, minOccurs: number): Promise<{status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: string}> {
    const attrName = this.getSimpleValue(facet.name) || '';
    const element = this.getElement(elementId);
    const attrValue = this.getValue(element?.[attrName]);
    
    if (attrValue === null || attrValue === undefined) {
      if (minOccurs === 0) {
        return { status: 'PASS', message: `Attribut optionnel "${attrName}" absent (autorisé)` };
      }
      return { status: 'FAIL', message: `Attribut "${attrName}" manquant` };
    }

    if (facet.value) {
      if (this.matchesValue(attrValue, facet.value)) {
        return { 
          status: 'PASS', 
          message: `Attribut "${attrName}" = "${attrValue}" ✓` 
        };
      } else {
        return { 
          status: 'FAIL', 
          message: `Attribut "${attrName}" = "${attrValue}" (non conforme)`,
          details: `Valeur attendue: ${getValueDescription(facet.value)}`
        };
      }
    }

    return { status: 'PASS', message: `Attribut "${attrName}" présent` };
  }

  private async checkClassificationFacet(elementId: number, facet: IDSClassificationFacet, minOccurs: number): Promise<{status: 'PASS' | 'FAIL' | 'WARNING', message: string}> {
    const classifications = await this.getClassifications(elementId);
    
    if (classifications.length === 0) {
      if (minOccurs === 0) {
        return { status: 'PASS', message: 'Classification optionnelle absente (autorisé)' };
      }
      return { status: 'FAIL', message: 'Aucune classification trouvée' };
    }

    for (const cls of classifications) {
      let matches = true;

      if (facet.system && !this.matchesValue(cls.system, facet.system)) {
        matches = false;
      }
      if (facet.value && !this.matchesValue(cls.value, facet.value)) {
        matches = false;
      }

      if (matches) {
        return { 
          status: 'PASS', 
          message: `Classification "${cls.system}: ${cls.value}" ✓` 
        };
      }
    }

    return { 
      status: 'FAIL', 
      message: `Classification non conforme. Trouvé: ${classifications.map(c => `${c.system}:${c.value}`).join(', ')}` 
    };
  }

  private async checkMaterialFacet(elementId: number, facet: IDSMaterialFacet, minOccurs: number): Promise<{status: 'PASS' | 'FAIL' | 'WARNING', message: string}> {
    const materials = await this.getMaterials(elementId);
    
    if (materials.length === 0) {
      if (minOccurs === 0) {
        return { status: 'PASS', message: 'Matériau optionnel absent (autorisé)' };
      }
      return { status: 'FAIL', message: 'Aucun matériau assigné' };
    }

    if (facet.value) {
      for (const mat of materials) {
        if (this.matchesValue(mat, facet.value)) {
          return { status: 'PASS', message: `Matériau "${mat}" ✓` };
        }
      }
      return { 
        status: 'FAIL', 
        message: `Matériau non conforme. Trouvé: ${materials.join(', ')}` 
      };
    }

    return { status: 'PASS', message: `Matériau présent: ${materials.join(', ')}` };
  }

  // Helper methods
  private getElement(id: number): any {
    if (this.elementCache.has(id)) {
      return this.elementCache.get(id);
    }
    try {
      const element = this.ifcApi.GetLine(this.modelID, id);
      this.elementCache.set(id, element);
      return element;
    } catch (e) {
      return null;
    }
  }

  private getTypeName(id: number): string {
    if (this.typeNameCache.has(id)) {
      return this.typeNameCache.get(id)!;
    }
    try {
      const element = this.getElement(id);
      const typeName = this.ifcApi.GetNameFromTypeCode(element?.type) || 'Unknown';
      this.typeNameCache.set(id, typeName);
      return typeName;
    } catch (e) {
      return 'Unknown';
    }
  }

  private getValue(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'object' && obj.value !== undefined) return obj.value;
    return obj;
  }

  private getSimpleValue(value: IDSValue | undefined): string | null {
    if (!value) return null;
    if (value.type === 'simple') return value.value;
    if (value.type === 'restriction' && value.enumeration?.length === 1) {
      return value.enumeration[0];
    }
    return null;
  }

  private matchesValue(actual: any, expected: IDSValue): boolean {
    if (actual === null || actual === undefined) return false;
    
    const actualStr = String(actual);

    if (expected.type === 'simple') {
      return actualStr.toLowerCase() === expected.value.toLowerCase();
    }

    if (expected.type === 'restriction') {
      if (expected.enumeration) {
        return expected.enumeration.some(e => actualStr.toLowerCase() === e.toLowerCase());
      }
      if (expected.pattern) {
        try {
          const regex = new RegExp(expected.pattern);
          return regex.test(actualStr);
        } catch (e) {
          return false;
        }
      }
      if (expected.minLength !== undefined && actualStr.length < expected.minLength) return false;
      if (expected.maxLength !== undefined && actualStr.length > expected.maxLength) return false;
      
      const numVal = parseFloat(actualStr);
      if (!isNaN(numVal)) {
        if (expected.minInclusive !== undefined && numVal < expected.minInclusive) return false;
        if (expected.maxInclusive !== undefined && numVal > expected.maxInclusive) return false;
      }
      
      return true;
    }

    return false;
  }

  private async getPropertyValue(elementId: number, psetName: string, propName: string): Promise<any> {
    // Check cache first
    const cached = this.propertyCache.get(elementId);
    if (cached?.has(psetName)) {
      return cached.get(psetName)?.get(propName) ?? null;
    }

    try {
      // Get through IfcRelDefinesByProperties
      const IFCRELDEFINESBYPROPERTIES = 4186316022;
      const relIds = this.ifcApi.GetLineIDsWithType(this.modelID, IFCRELDEFINESBYPROPERTIES);
      
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        const rel = this.getElement(relId);
        if (!rel?.RelatedObjects) continue;

        // Check if this relation applies to our element
        const relatedIds = rel.RelatedObjects.map((r: any) => typeof r === 'object' ? r.value : r);
        if (!relatedIds.includes(elementId)) continue;

        // Get property definition
        const propDefRef = rel.RelatingPropertyDefinition;
        const propDefId = typeof propDefRef === 'object' ? propDefRef.value : propDefRef;
        const propDef = this.getElement(propDefId);
        if (!propDef) continue;

        const currentPsetName = this.getValue(propDef.Name);
        
        // Check if this is the property set we're looking for (case insensitive, pattern match)
        const psetMatches = psetName.includes('*') ? 
          new RegExp(psetName.replace(/\*/g, '.*'), 'i').test(currentPsetName) :
          currentPsetName?.toLowerCase() === psetName.toLowerCase();
        
        if (!psetMatches) continue;

        // Look for the property
        if (propDef.HasProperties && Array.isArray(propDef.HasProperties)) {
          for (const propRef of propDef.HasProperties) {
            const propId = typeof propRef === 'object' ? propRef.value : propRef;
            const prop = this.getElement(propId);
            if (!prop) continue;

            const currentPropName = this.getValue(prop.Name);
            
            const propMatches = propName.includes('*') ?
              new RegExp(propName.replace(/\*/g, '.*'), 'i').test(currentPropName) :
              currentPropName?.toLowerCase() === propName.toLowerCase();
            
            if (propMatches) {
              return this.getValue(prop.NominalValue) ?? this.getValue(prop.Value);
            }
          }
        }

        // Check quantities
        if (propDef.Quantities && Array.isArray(propDef.Quantities)) {
          for (const qtyRef of propDef.Quantities) {
            const qtyId = typeof qtyRef === 'object' ? qtyRef.value : qtyRef;
            const qty = this.getElement(qtyId);
            if (!qty) continue;

            const currentQtyName = this.getValue(qty.Name);
            if (currentQtyName?.toLowerCase() === propName.toLowerCase()) {
              return this.getValue(qty.LengthValue) ?? 
                     this.getValue(qty.AreaValue) ?? 
                     this.getValue(qty.VolumeValue) ??
                     this.getValue(qty.CountValue) ??
                     this.getValue(qty.WeightValue);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Property lookup error:', e);
    }

    return null;
  }

  private async getClassifications(elementId: number): Promise<{system: string, value: string}[]> {
    const results: {system: string, value: string}[] = [];
    
    try {
      const IFCRELASSOCIATESCLASSIFICATION = 919958153;
      const relIds = this.ifcApi.GetLineIDsWithType(this.modelID, IFCRELASSOCIATESCLASSIFICATION);
      
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        const rel = this.getElement(relId);
        if (!rel?.RelatedObjects) continue;

        const relatedIds = rel.RelatedObjects.map((r: any) => typeof r === 'object' ? r.value : r);
        if (!relatedIds.includes(elementId)) continue;

        const classRefId = typeof rel.RelatingClassification === 'object' ? 
          rel.RelatingClassification.value : rel.RelatingClassification;
        const classification = this.getElement(classRefId);
        if (!classification) continue;

        let systemName = '';
        if (classification.ReferencedSource) {
          const sourceId = typeof classification.ReferencedSource === 'object' ? 
            classification.ReferencedSource.value : classification.ReferencedSource;
          const source = this.getElement(sourceId);
          systemName = this.getValue(source?.Name) || '';
        }

        const classValue = this.getValue(classification.Identification) || 
                          this.getValue(classification.ItemReference) ||
                          this.getValue(classification.Name) || '';

        results.push({ system: systemName, value: classValue });
      }
    } catch (e) {}

    return results;
  }

  private async getMaterials(elementId: number): Promise<string[]> {
    const results: string[] = [];
    
    try {
      const IFCRELASSOCIATESMATERIAL = 2655215786;
      const relIds = this.ifcApi.GetLineIDsWithType(this.modelID, IFCRELASSOCIATESMATERIAL);
      
      for (let i = 0; i < relIds.size(); i++) {
        const relId = relIds.get(i);
        const rel = this.getElement(relId);
        if (!rel?.RelatedObjects) continue;

        const relatedIds = rel.RelatedObjects.map((r: any) => typeof r === 'object' ? r.value : r);
        if (!relatedIds.includes(elementId)) continue;

        const matId = typeof rel.RelatingMaterial === 'object' ? 
          rel.RelatingMaterial.value : rel.RelatingMaterial;
        const material = this.getElement(matId);
        
        const matName = this.getValue(material?.Name);
        if (matName) results.push(matName);
      }
    } catch (e) {}

    return results;
  }

  private getRequirementDescription(req: IDSRequirement): string {
    const facet = req.facet;
    const optional = req.minOccurs === 0 ? ' (optionnel)' : '';

    switch (facet.type) {
      case 'property': {
        const pf = facet as IDSPropertyFacet;
        const pset = this.getSimpleValue(pf.propertySet) || '*';
        const prop = this.getSimpleValue(pf.baseName) || '*';
        const val = pf.value ? ` = ${getValueDescription(pf.value)}` : '';
        return `Propriété: ${pset}.${prop}${val}${optional}`;
      }
      case 'attribute': {
        const af = facet as IDSAttributeFacet;
        const attr = this.getSimpleValue(af.name) || '*';
        const val = af.value ? ` = ${getValueDescription(af.value)}` : '';
        return `Attribut: ${attr}${val}${optional}`;
      }
      case 'classification': {
        const cf = facet as IDSClassificationFacet;
        const sys = cf.system ? this.getSimpleValue(cf.system) : '*';
        const val = cf.value ? this.getSimpleValue(cf.value) : '*';
        return `Classification: ${sys}:${val}${optional}`;
      }
      case 'material': {
        const mf = facet as IDSMaterialFacet;
        const val = mf.value ? getValueDescription(mf.value) : 'présent';
        return `Matériau: ${val}${optional}`;
      }
      default:
        return `Requirement: ${facet.type}${optional}`;
    }
  }
}
