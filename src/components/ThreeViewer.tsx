import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setIfcApiForAudit } from '../App';

// IFC Property types
export interface IFCProperty {
  name: string;
  value: string | number | boolean | null;
}

export interface IFCPropertySet {
  name: string;
  properties: IFCProperty[];
}

export interface SelectedElementInfo {
  expressID: number;
  type: string;
  name: string;
  propertySets: IFCPropertySet[];
}

interface ThreeViewerProps {
  ifcFileUrl: string | null;
  onSelect: (info: SelectedElementInfo | null) => void;
  setNotification: (msg: string) => void;
}

// Highlight color - VERT FLUO
const HIGHLIGHT_COLOR = 0x39ff14;

// IFC Type codes for property-related entities
const IFCRELDEFINESBYPROPERTIES = 4186316022;
const IFCPROPERTYSET = 1451395588;
const IFCELEMENTQUANTITY = 1883228015;
const IFCPROPERTYSINGLEVALUE = 3650150729;
const IFCPROPERTYLISTVALUE = 2752243245;
const IFCPROPERTYENUMERATEDVALUE = 4166981789;
const IFCQUANTITYLENGTH = 931644368;
const IFCQUANTITYAREA = 2044713172;
const IFCQUANTITYVOLUME = 3377609919;
const IFCQUANTITYCOUNT = 2093928680;
const IFCQUANTITYWEIGHT = 825690147;

export const ThreeViewer: React.FC<ThreeViewerProps> = ({ ifcFileUrl, onSelect, setNotification }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mockGroupRef = useRef<THREE.Group | null>(null);
  const ifcApiRef = useRef<any>(null);
  const modelIDRef = useRef<number | null>(null);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const originalMaterialRef = useRef<THREE.Material | null>(null);
  const propertyRelsRef = useRef<Map<number, number[]>>(new Map());
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Chargement...");
  const [error, setError] = useState<string | null>(null);

  const onSelectRef = useRef(onSelect);
  const setNotificationRef = useRef(setNotification);
  useEffect(() => {
    onSelectRef.current = onSelect;
    setNotificationRef.current = setNotification;
  }, [onSelect, setNotification]);

  // Helper to safely get a value from IFC
  const getIfcValue = (obj: any): string | number | boolean | null => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'object') {
      if (obj.value !== undefined) return obj.value;
      if (obj.Value !== undefined) return obj.Value;
      return null;
    }
    return obj;
  };

  // Extract property value based on type
  const extractPropertyValue = useCallback((ifcApi: any, modelID: number, propRef: any): IFCProperty | null => {
    try {
      const propID = typeof propRef === 'object' ? propRef.value : propRef;
      if (!propID) return null;
      
      const propLine = ifcApi.GetLine(modelID, propID);
      if (!propLine) return null;
      
      const propName = getIfcValue(propLine.Name) || 'Unknown';
      let propValue: string | number | boolean | null = null;

      // IfcPropertySingleValue
      if (propLine.NominalValue !== undefined) {
        propValue = getIfcValue(propLine.NominalValue);
      }
      // IfcPropertyListValue
      else if (propLine.ListValues !== undefined && Array.isArray(propLine.ListValues)) {
        const values = propLine.ListValues.map((v: any) => getIfcValue(v)).filter((v: any) => v !== null);
        propValue = values.join(', ');
      }
      // IfcPropertyEnumeratedValue
      else if (propLine.EnumerationValues !== undefined && Array.isArray(propLine.EnumerationValues)) {
        const values = propLine.EnumerationValues.map((v: any) => getIfcValue(v)).filter((v: any) => v !== null);
        propValue = values.join(', ');
      }

      if (propName && propValue !== null) {
        return { name: String(propName), value: propValue };
      }
      return null;
    } catch (e) {
      return null;
    }
  }, []);

  // Extract quantity value
  const extractQuantityValue = useCallback((ifcApi: any, modelID: number, qtyRef: any): IFCProperty | null => {
    try {
      const qtyID = typeof qtyRef === 'object' ? qtyRef.value : qtyRef;
      if (!qtyID) return null;
      
      const qtyLine = ifcApi.GetLine(modelID, qtyID);
      if (!qtyLine) return null;
      
      const qtyName = getIfcValue(qtyLine.Name) || 'Unknown';
      let qtyValue: string | null = null;

      if (qtyLine.LengthValue !== undefined) {
        const val = getIfcValue(qtyLine.LengthValue);
        qtyValue = val !== null ? `${Number(val).toFixed(3)} m` : null;
      } else if (qtyLine.AreaValue !== undefined) {
        const val = getIfcValue(qtyLine.AreaValue);
        qtyValue = val !== null ? `${Number(val).toFixed(3)} m²` : null;
      } else if (qtyLine.VolumeValue !== undefined) {
        const val = getIfcValue(qtyLine.VolumeValue);
        qtyValue = val !== null ? `${Number(val).toFixed(3)} m³` : null;
      } else if (qtyLine.CountValue !== undefined) {
        qtyValue = String(getIfcValue(qtyLine.CountValue));
      } else if (qtyLine.WeightValue !== undefined) {
        const val = getIfcValue(qtyLine.WeightValue);
        qtyValue = val !== null ? `${Number(val).toFixed(3)} kg` : null;
      }

      if (qtyName && qtyValue !== null) {
        return { name: String(qtyName), value: qtyValue };
      }
      return null;
    } catch (e) {
      return null;
    }
  }, []);

  // Get all PropertySets for an element
  const getElementProperties = useCallback(async (expressID: number): Promise<SelectedElementInfo | null> => {
    const ifcApi = ifcApiRef.current;
    const modelID = modelIDRef.current;
    
    if (!ifcApi || modelID === null) return null;

    try {
      const element = ifcApi.GetLine(modelID, expressID);
      if (!element) {
        return {
          expressID,
          type: 'Unknown',
          name: 'Element',
          propertySets: [{ name: 'Informations', properties: [{ name: 'Express ID', value: expressID }] }]
        };
      }

      const elementType = ifcApi.GetNameFromTypeCode(element.type) || 'Unknown';
      let elementName = getIfcValue(element.Name) || getIfcValue(element.LongName) || 'Sans nom';

      const propertySets: IFCPropertySet[] = [];

      // 1. Basic Properties
      const basicProps: IFCProperty[] = [
        { name: 'Express ID', value: expressID },
        { name: 'Type IFC', value: elementType },
      ];
      
      const globalId = getIfcValue(element.GlobalId);
      if (globalId) basicProps.push({ name: 'GlobalId', value: globalId });
      
      const description = getIfcValue(element.Description);
      if (description) basicProps.push({ name: 'Description', value: description });
      
      const objectType = getIfcValue(element.ObjectType);
      if (objectType) basicProps.push({ name: 'ObjectType', value: objectType });
      
      const tag = getIfcValue(element.Tag);
      if (tag) basicProps.push({ name: 'Tag', value: tag });

      propertySets.push({ name: 'Informations générales', properties: basicProps });

      // 2. Get PropertySets via cached relations
      const relIDs = propertyRelsRef.current.get(expressID) || [];
      
      for (const relID of relIDs) {
        try {
          const rel = ifcApi.GetLine(modelID, relID);
          if (!rel || !rel.RelatingPropertyDefinition) continue;

          const propDefRef = rel.RelatingPropertyDefinition;
          const propDefID = typeof propDefRef === 'object' ? propDefRef.value : propDefRef;
          if (!propDefID) continue;

          const propDef = ifcApi.GetLine(modelID, propDefID);
          if (!propDef) continue;

          const psetName = getIfcValue(propDef.Name) || 'PropertySet';
          const properties: IFCProperty[] = [];

          // IfcPropertySet - HasProperties
          if (propDef.HasProperties && Array.isArray(propDef.HasProperties)) {
            for (const propRef of propDef.HasProperties) {
              const prop = extractPropertyValue(ifcApi, modelID, propRef);
              if (prop) properties.push(prop);
            }
          }
          // IfcElementQuantity - Quantities
          else if (propDef.Quantities && Array.isArray(propDef.Quantities)) {
            for (const qtyRef of propDef.Quantities) {
              const qty = extractQuantityValue(ifcApi, modelID, qtyRef);
              if (qty) properties.push(qty);
            }
          }

          if (properties.length > 0) {
            propertySets.push({ name: String(psetName), properties });
          }
        } catch (e) {
          // Skip invalid relations
        }
      }

      // 3. Try to get Type properties (from IfcTypeObject)
      try {
        if (element.IsTypedBy && Array.isArray(element.IsTypedBy)) {
          for (const typeRef of element.IsTypedBy) {
            const typeRelID = typeof typeRef === 'object' ? typeRef.value : typeRef;
            const typeRel = ifcApi.GetLine(modelID, typeRelID);
            if (typeRel?.RelatingType) {
              const typeID = typeof typeRel.RelatingType === 'object' ? typeRel.RelatingType.value : typeRel.RelatingType;
              const typeObj = ifcApi.GetLine(modelID, typeID);
              
              if (typeObj?.HasPropertySets && Array.isArray(typeObj.HasPropertySets)) {
                for (const psetRef of typeObj.HasPropertySets) {
                  const psetID = typeof psetRef === 'object' ? psetRef.value : psetRef;
                  const pset = ifcApi.GetLine(modelID, psetID);
                  if (!pset) continue;

                  const psetName = getIfcValue(pset.Name) || 'Type Properties';
                  const properties: IFCProperty[] = [];

                  if (pset.HasProperties && Array.isArray(pset.HasProperties)) {
                    for (const propRef of pset.HasProperties) {
                      const prop = extractPropertyValue(ifcApi, modelID, propRef);
                      if (prop) properties.push(prop);
                    }
                  }

                  if (properties.length > 0) {
                    propertySets.push({ name: `[Type] ${psetName}`, properties });
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Type properties not available
      }

      // 4. Try to get Material associations
      try {
        if (element.HasAssociations && Array.isArray(element.HasAssociations)) {
          const matProps: IFCProperty[] = [];
          
          for (const assocRef of element.HasAssociations) {
            const assocID = typeof assocRef === 'object' ? assocRef.value : assocRef;
            const assoc = ifcApi.GetLine(modelID, assocID);
            
            if (assoc?.RelatingMaterial) {
              const matID = typeof assoc.RelatingMaterial === 'object' ? assoc.RelatingMaterial.value : assoc.RelatingMaterial;
              const material = ifcApi.GetLine(modelID, matID);
              
              if (material) {
                const matName = getIfcValue(material.Name);
                if (matName) {
                  matProps.push({ name: 'Matériau', value: matName });
                }
                
                // For layered materials
                if (material.MaterialLayers && Array.isArray(material.MaterialLayers)) {
                  for (let i = 0; i < material.MaterialLayers.length; i++) {
                    const layerRef = material.MaterialLayers[i];
                    const layerID = typeof layerRef === 'object' ? layerRef.value : layerRef;
                    const layer = ifcApi.GetLine(modelID, layerID);
                    if (layer) {
                      const thickness = getIfcValue(layer.LayerThickness);
                      if (layer.Material) {
                        const layerMatID = typeof layer.Material === 'object' ? layer.Material.value : layer.Material;
                        const layerMat = ifcApi.GetLine(modelID, layerMatID);
                        const layerMatName = getIfcValue(layerMat?.Name);
                        if (layerMatName) {
                          matProps.push({ 
                            name: `Couche ${i + 1}`, 
                            value: thickness ? `${layerMatName} (${Number(thickness).toFixed(3)} m)` : layerMatName 
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          if (matProps.length > 0) {
            propertySets.push({ name: 'Matériaux', properties: matProps });
          }
        }
      } catch (e) {
        // Materials not available
      }

      return {
        expressID,
        type: elementType,
        name: String(elementName),
        propertySets
      };
    } catch (e) {
      console.error('Error getting properties:', e);
      return {
        expressID,
        type: 'Unknown',
        name: 'Element',
        propertySets: [{ name: 'Informations', properties: [{ name: 'Express ID', value: expressID }] }]
      };
    }
  }, [extractPropertyValue, extractQuantityValue]);

  // Highlight mesh
  const highlightMesh = useCallback((mesh: THREE.Mesh | null) => {
    if (selectedMeshRef.current && originalMaterialRef.current) {
      selectedMeshRef.current.material = originalMaterialRef.current;
    }

    selectedMeshRef.current = null;
    originalMaterialRef.current = null;

    if (mesh && mesh.material) {
      originalMaterialRef.current = mesh.material as THREE.Material;
      selectedMeshRef.current = mesh;
      
      const highlightMaterial = new THREE.MeshLambertMaterial({
        color: HIGHLIGHT_COLOR,
        emissive: HIGHLIGHT_COLOR,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      
      mesh.material = highlightMaterial;
    }
  }, []);

  // Add mock data
  const addMockData = useCallback((scene: THREE.Scene) => {
    try {
      const group = new THREE.Group();
      group.userData.isMock = true;
      const mat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      const box = new THREE.BoxGeometry(1, 1, 1);
      const m1 = new THREE.Mesh(box, mat); 
      m1.position.set(0, 2, -5); 
      m1.scale.set(10, 4, 0.5); 
      m1.userData = { id: "MOCK1", isMock: true };
      const m2 = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x475569 })); 
      m2.position.set(0, 0, 0); 
      m2.scale.set(12, 0.5, 12); 
      m2.userData = { id: "MOCK2", isMock: true };
      group.add(m1, m2);
      scene.add(group);
      mockGroupRef.current = group;
      return group;
    } catch (e) {
      return null;
    }
  }, []);

  // Setup scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    try {
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f5f9);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(20, 20, 20);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const existingCanvas = mountRef.current.querySelector('canvas');
      if (existingCanvas) existingCanvas.remove();
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controlsRef.current = controls;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(10, 20, 10);
      scene.add(dirLight);

      const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
      scene.add(gridHelper);

      addMockData(scene);

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onMouseClick = async (event: MouseEvent) => {
        try {
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          
          const objectsToTest: THREE.Object3D[] = [];
          if (modelRef.current) objectsToTest.push(modelRef.current);
          if (mockGroupRef.current) mockGroupRef.current.children.forEach(child => objectsToTest.push(child));

          const intersects = raycaster.intersectObjects(objectsToTest, true);

          if (intersects.length > 0) {
            const hit = intersects[0];
            const mesh = hit.object as THREE.Mesh;
            highlightMesh(mesh);
            
            if (mesh.userData?.expressID !== undefined) {
              const expressID = mesh.userData.expressID;
              setNotificationRef.current(`Chargement des propriétés...`);
              const elementInfo = await getElementProperties(expressID);
              onSelectRef.current(elementInfo);
              if (elementInfo) {
                const propCount = elementInfo.propertySets.reduce((acc, ps) => acc + ps.properties.length, 0);
                setNotificationRef.current(`${elementInfo.type} sélectionné - ${propCount} propriétés`);
              }
            } else if (mesh.userData?.id) {
              setNotificationRef.current(`Élément sélectionné : ${mesh.userData.id}`);
              onSelectRef.current({
                expressID: 0,
                type: 'Mock Object',
                name: mesh.userData.id,
                propertySets: [{
                  name: 'Informations',
                  properties: [
                    { name: 'ID', value: mesh.userData.id },
                    { name: 'Type', value: 'Objet de démonstration' }
                  ]
                }]
              });
            }
          } else {
            highlightMesh(null);
            onSelectRef.current(null);
          }
        } catch (e) {
          console.error('Click error:', e);
        }
      };
      
      renderer.domElement.addEventListener('click', onMouseClick);

      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (mountRef.current) {
          camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('click', onMouseClick);
        cancelAnimationFrame(animationId);
        renderer.dispose();
        controls.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    } catch (e) {
      console.error('Scene setup error:', e);
      setError(`Erreur d'initialisation: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [addMockData, highlightMesh, getElementProperties]);

  // Load IFC
  useEffect(() => {
    if (!ifcFileUrl || !sceneRef.current) return;

    const scene = sceneRef.current;

    const loadIFC = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingMessage("Téléchargement du fichier IFC...");
      setNotificationRef.current("Chargement du fichier IFC...");

      highlightMesh(null);
      onSelectRef.current(null);
      propertyRelsRef.current.clear();

      if (mockGroupRef.current) {
        scene.remove(mockGroupRef.current);
        mockGroupRef.current = null;
      }

      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current = null;
      }

      if (ifcApiRef.current && modelIDRef.current !== null) {
        try { ifcApiRef.current.CloseModel(modelIDRef.current); } catch (e) {}
      }

      try {
        setLoadingMessage("Chargement du moteur IFC...");
        const WebIFC = await import('web-ifc');
        
        const ifcApi = new WebIFC.IfcAPI();
        ifcApi.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.46/", true);
        
        setLoadingMessage("Initialisation du moteur...");
        await ifcApi.Init();
        ifcApiRef.current = ifcApi;
        
        setLoadingMessage("Téléchargement du fichier...");
        const response = await fetch(ifcFileUrl);
        if (!response.ok) throw new Error(`Échec du téléchargement: ${response.status}`);
        
        setLoadingMessage("Lecture du fichier...");
        const data = await response.arrayBuffer();
        const uint8Array = new Uint8Array(data);
        
        setLoadingMessage("Parsing du fichier IFC...");
        const modelID = ifcApi.OpenModel(uint8Array);
        modelIDRef.current = modelID;
        
        // Index all IfcRelDefinesByProperties for faster property lookup
        setLoadingMessage("Indexation des propriétés...");
        try {
          const relDefines = ifcApi.GetLineIDsWithType(modelID, IFCRELDEFINESBYPROPERTIES);
          for (let i = 0; i < relDefines.size(); i++) {
            const relID = relDefines.get(i);
            try {
              const rel = ifcApi.GetLine(modelID, relID);
              if (rel?.RelatedObjects && Array.isArray(rel.RelatedObjects)) {
                for (const objRef of rel.RelatedObjects) {
                  const objID = typeof objRef === 'object' ? objRef.value : objRef;
                  if (objID) {
                    const existing = propertyRelsRef.current.get(objID) || [];
                    existing.push(relID);
                    propertyRelsRef.current.set(objID, existing);
                  }
                }
              }
            } catch (e) {}
          }
        } catch (e) {
          console.warn('Could not index properties:', e);
        }
        
        const ifcGroup = new THREE.Group();
        ifcGroup.name = "IFCModel";
        
        setLoadingMessage("Génération de la géométrie 3D...");
        const flatMeshes = ifcApi.LoadAllGeometry(modelID);
        let meshCount = 0;
        
        for (let i = 0; i < flatMeshes.size(); i++) {
          const flatMesh = flatMeshes.get(i);
          const placedGeometries = flatMesh.geometries;
          
          for (let j = 0; j < placedGeometries.size(); j++) {
            const placedGeometry = placedGeometries.get(j);
            const geometry = ifcApi.GetGeometry(modelID, placedGeometry.geometryExpressID);
            
            const verts = ifcApi.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
            const indices = ifcApi.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
            
            if (verts.length === 0 || indices.length === 0) continue;
            
            const bufferGeometry = new THREE.BufferGeometry();
            const posFloats = new Float32Array(verts.length / 2);
            const normFloats = new Float32Array(verts.length / 2);
            
            for (let k = 0; k < verts.length; k += 6) {
              posFloats[k / 2] = verts[k];
              posFloats[k / 2 + 1] = verts[k + 1];
              posFloats[k / 2 + 2] = verts[k + 2];
              normFloats[k / 2] = verts[k + 3];
              normFloats[k / 2 + 1] = verts[k + 4];
              normFloats[k / 2 + 2] = verts[k + 5];
            }
            
            bufferGeometry.setAttribute("position", new THREE.BufferAttribute(posFloats, 3));
            bufferGeometry.setAttribute("normal", new THREE.BufferAttribute(normFloats, 3));
            bufferGeometry.setIndex(Array.from(indices));
            
            const color = placedGeometry.color;
            const material = new THREE.MeshLambertMaterial({
              color: new THREE.Color(color.x, color.y, color.z),
              transparent: color.w < 1,
              opacity: color.w,
              side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(bufferGeometry, material);
            const matrix = new THREE.Matrix4();
            matrix.fromArray(placedGeometry.flatTransformation);
            mesh.applyMatrix4(matrix);
            
            mesh.userData.expressID = flatMesh.expressID;
            ifcGroup.add(mesh);
            meshCount++;
          }
        }
        
        scene.add(ifcGroup);
        modelRef.current = ifcGroup;
        
        // Make IFC API available for audit
        setIfcApiForAudit(ifcApi, modelID);
        
        setIsLoading(false);
        const psetCount = propertyRelsRef.current.size;
        setNotificationRef.current(`Modèle chargé ! ${meshCount} objets, ${psetCount} éléments avec propriétés`);
        
        const box = new THREE.Box3().setFromObject(ifcGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (cameraRef.current && controlsRef.current) {
          cameraRef.current.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      } catch (err) {
        console.error('IFC Load Error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(`Erreur de chargement IFC: ${errorMsg}`);
        setIsLoading(false);
        setNotificationRef.current(`Erreur: ${errorMsg}`);
        addMockData(scene);
      }
    };

    loadIFC();
  }, [ifcFileUrl, addMockData, highlightMesh]);

  return (
    <div ref={mountRef} className="w-full h-full cursor-crosshair relative outline-none bg-slate-200">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <div className="bg-slate-800 px-6 py-4 rounded-lg border border-slate-600">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-white text-sm">{loadingMessage}</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg z-20">
          <p className="font-bold">Erreur</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="mt-2 bg-white text-red-600 px-3 py-1 rounded text-sm">Fermer</button>
        </div>
      )}
    </div>
  );
};
