import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Chargement...");
  const [error, setError] = useState<string | null>(null);

  // Store callbacks in refs to avoid re-triggering effects
  const onSelectRef = useRef(onSelect);
  const setNotificationRef = useRef(setNotification);
  useEffect(() => {
    onSelectRef.current = onSelect;
    setNotificationRef.current = setNotification;
  }, [onSelect, setNotification]);

  // Function to get IFC properties for an element
  const getElementProperties = useCallback(async (expressID: number): Promise<SelectedElementInfo | null> => {
    const ifcApi = ifcApiRef.current;
    const modelID = modelIDRef.current;
    
    if (!ifcApi || modelID === null) return null;

    try {
      // Get the element line (basic info)
      const element = ifcApi.GetLine(modelID, expressID);
      const elementType = ifcApi.GetNameFromTypeCode(element.type) || 'Unknown';
      
      // Get element name
      let elementName = 'Sans nom';
      if (element.Name?.value) {
        elementName = element.Name.value;
      } else if (element.LongName?.value) {
        elementName = element.LongName.value;
      }

      const propertySets: IFCPropertySet[] = [];

      // Basic properties
      const basicProps: IFCProperty[] = [
        { name: 'Express ID', value: expressID },
        { name: 'Type IFC', value: elementType },
        { name: 'GlobalId', value: element.GlobalId?.value || 'N/A' },
      ];
      
      if (element.Description?.value) {
        basicProps.push({ name: 'Description', value: element.Description.value });
      }
      if (element.ObjectType?.value) {
        basicProps.push({ name: 'Object Type', value: element.ObjectType.value });
      }
      if (element.Tag?.value) {
        basicProps.push({ name: 'Tag', value: element.Tag.value });
      }

      propertySets.push({ name: 'Informations générales', properties: basicProps });

      // Try to get property sets (IsDefinedBy relationship)
      try {
        const propSets = ifcApi.GetPropertySets(modelID, expressID);
        
        if (propSets && propSets.length > 0) {
          for (const psetInfo of propSets) {
            const psetLine = ifcApi.GetLine(modelID, psetInfo.expressID);
            const psetName = psetLine?.Name?.value || 'PropertySet';
            const properties: IFCProperty[] = [];

            if (psetLine?.HasProperties) {
              for (const propRef of psetLine.HasProperties) {
                try {
                  const propLine = ifcApi.GetLine(modelID, propRef.value);
                  const propName = propLine?.Name?.value || 'Property';
                  let propValue: string | number | boolean | null = null;

                  if (propLine?.NominalValue?.value !== undefined) {
                    propValue = propLine.NominalValue.value;
                  } else if (propLine?.Value?.value !== undefined) {
                    propValue = propLine.Value.value;
                  }

                  properties.push({ name: propName, value: propValue });
                } catch (e) {
                  // Skip invalid properties
                }
              }
            }

            if (properties.length > 0) {
              propertySets.push({ name: psetName, properties });
            }
          }
        }
      } catch (e) {
        // PropertySets not available, continue with basic info
      }

      // Try to get quantities
      try {
        const quantities = ifcApi.GetQuantitySets(modelID, expressID);
        
        if (quantities && quantities.length > 0) {
          for (const qsetInfo of quantities) {
            const qsetLine = ifcApi.GetLine(modelID, qsetInfo.expressID);
            const qsetName = qsetLine?.Name?.value || 'Quantities';
            const properties: IFCProperty[] = [];

            if (qsetLine?.Quantities) {
              for (const qRef of qsetLine.Quantities) {
                try {
                  const qLine = ifcApi.GetLine(modelID, qRef.value);
                  const qName = qLine?.Name?.value || 'Quantity';
                  let qValue: string | number | null = null;

                  // Different quantity types
                  if (qLine?.LengthValue?.value !== undefined) {
                    qValue = `${qLine.LengthValue.value.toFixed(3)} m`;
                  } else if (qLine?.AreaValue?.value !== undefined) {
                    qValue = `${qLine.AreaValue.value.toFixed(3)} m²`;
                  } else if (qLine?.VolumeValue?.value !== undefined) {
                    qValue = `${qLine.VolumeValue.value.toFixed(3)} m³`;
                  } else if (qLine?.CountValue?.value !== undefined) {
                    qValue = qLine.CountValue.value;
                  } else if (qLine?.WeightValue?.value !== undefined) {
                    qValue = `${qLine.WeightValue.value.toFixed(3)} kg`;
                  }

                  if (qValue !== null) {
                    properties.push({ name: qName, value: qValue });
                  }
                } catch (e) {
                  // Skip invalid quantities
                }
              }
            }

            if (properties.length > 0) {
              propertySets.push({ name: qsetName, properties });
            }
          }
        }
      } catch (e) {
        // QuantitySets not available
      }

      // Try to get material info
      try {
        const materials = ifcApi.GetMaterialsProperties(modelID, expressID);
        if (materials && materials.length > 0) {
          const matProps: IFCProperty[] = [];
          for (const mat of materials) {
            if (mat.Name?.value) {
              matProps.push({ name: 'Matériau', value: mat.Name.value });
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
        name: elementName,
        propertySets
      };
    } catch (e) {
      console.error('Error getting properties:', e);
      return {
        expressID,
        type: 'Unknown',
        name: 'Element',
        propertySets: [{ 
          name: 'Informations générales', 
          properties: [{ name: 'Express ID', value: expressID }] 
        }]
      };
    }
  }, []);

  // Function to highlight/unhighlight mesh
  const highlightMesh = useCallback((mesh: THREE.Mesh | null) => {
    // Restore previous selection
    if (selectedMeshRef.current && originalMaterialRef.current) {
      selectedMeshRef.current.material = originalMaterialRef.current;
    }

    // Clear refs
    selectedMeshRef.current = null;
    originalMaterialRef.current = null;

    // Highlight new selection
    if (mesh && mesh.material) {
      originalMaterialRef.current = mesh.material as THREE.Material;
      selectedMeshRef.current = mesh;
      
      // Create highlight material
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

  // Add mock data function
  const addMockData = useCallback((scene: THREE.Scene) => {
    try {
      const group = new THREE.Group();
      group.userData.isMock = true;
      const mat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      const box = new THREE.BoxGeometry(1, 1, 1);
      const m1 = new THREE.Mesh(box, mat); 
      m1.position.set(0, 2, -5); 
      m1.scale.set(10, 4, 0.5); 
      m1.userData = { id: "MOCK1", isMock: true, originalColor: 0x94a3b8 };
      const m2 = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x475569 })); 
      m2.position.set(0, 0, 0); 
      m2.scale.set(12, 0.5, 12); 
      m2.userData = { id: "MOCK2", isMock: true, originalColor: 0x475569 };
      group.add(m1, m2);
      scene.add(group);
      mockGroupRef.current = group;
      return group;
    } catch (e) {
      console.error('Mock data error:', e);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    
    try {
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      // SCENE
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f5f9);
      sceneRef.current = scene;

      // CAMERA
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(20, 20, 20);
      cameraRef.current = camera;

      // RENDERER
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const existingCanvas = mountRef.current.querySelector('canvas');
      if (existingCanvas) {
        existingCanvas.remove();
      }
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // CONTROLS
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controlsRef.current = controls;

      // LIGHTS
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(10, 20, 10);
      scene.add(dirLight);

      // GRID
      const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
      scene.add(gridHelper);

      // Add mock data if no IFC file
      addMockData(scene);

      // RAYCASTER for selection
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onMouseClick = async (event: MouseEvent) => {
        try {
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          
          const objectsToTest: THREE.Object3D[] = [];
          if (modelRef.current) {
            objectsToTest.push(modelRef.current);
          }
          if (mockGroupRef.current) {
            mockGroupRef.current.children.forEach(child => objectsToTest.push(child));
          }

          const intersects = raycaster.intersectObjects(objectsToTest, true);

          if (intersects.length > 0) {
            const hit = intersects[0];
            const mesh = hit.object as THREE.Mesh;
            
            // Highlight the mesh
            highlightMesh(mesh);
            
            if (mesh.userData?.expressID !== undefined) {
              const expressID = mesh.userData.expressID;
              setNotificationRef.current(`Élément sélectionné : ID ${expressID}`);
              
              // Get IFC properties
              const elementInfo = await getElementProperties(expressID);
              onSelectRef.current(elementInfo);
            } else if (mesh.userData?.id) {
              // Mock object
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
            // Deselect
            highlightMesh(null);
            onSelectRef.current(null);
          }
        } catch (e) {
          console.error('Click error:', e);
        }
      };
      
      // Use single click instead of double click for better UX
      renderer.domElement.addEventListener('click', onMouseClick);

      // ANIMATION
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

  // LOAD IFC FILE EFFECT
  useEffect(() => {
    if (!ifcFileUrl || !sceneRef.current) return;

    const scene = sceneRef.current;

    const loadIFC = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingMessage("Téléchargement du fichier IFC...");
      setNotificationRef.current("Chargement du fichier IFC...");

      // Clear selection
      highlightMesh(null);
      onSelectRef.current(null);

      // Remove mock data
      if (mockGroupRef.current) {
        scene.remove(mockGroupRef.current);
        mockGroupRef.current = null;
      }

      // Remove previous model
      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current = null;
      }

      // Close previous model if exists
      if (ifcApiRef.current && modelIDRef.current !== null) {
        try {
          ifcApiRef.current.CloseModel(modelIDRef.current);
        } catch (e) {
          // Ignore
        }
      }

      try {
        setLoadingMessage("Chargement du moteur IFC...");
        const WebIFC = await import('web-ifc');
        
        const ifcApi = new WebIFC.IfcAPI();
        ifcApi.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.46/", true);
        
        setLoadingMessage("Initialisation du moteur...");
        await ifcApi.Init();
        
        // Store API reference for property queries
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
        
        // DON'T close the model - we need it for property queries!
        // ifcApi.CloseModel(modelID);
        
        scene.add(ifcGroup);
        modelRef.current = ifcGroup;
        
        setIsLoading(false);
        setNotificationRef.current(`Modèle IFC chargé ! (${meshCount} objets) - Cliquez sur un élément pour voir ses propriétés`);
        
        // Center camera on model
        const box = new THREE.Box3().setFromObject(ifcGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (cameraRef.current && controlsRef.current) {
          cameraRef.current.position.set(
            center.x + maxDim,
            center.y + maxDim,
            center.z + maxDim
          );
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
          <button 
            onClick={() => setError(null)} 
            className="mt-2 bg-white text-red-600 px-3 py-1 rounded text-sm"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};
