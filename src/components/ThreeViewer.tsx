import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface ThreeViewerProps {
  ifcFileUrl: string | null;
  onSelect: (id: any) => void;
  setNotification: (msg: string) => void;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({ ifcFileUrl, onSelect, setNotification }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mockGroupRef = useRef<THREE.Group | null>(null);
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
      // Clear any existing canvas without using innerHTML (causes React conflicts)
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

      const onMouseClick = (event: MouseEvent) => {
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
            if (hit.object.userData?.expressID !== undefined) {
              onSelectRef.current(String(hit.object.userData.expressID));
              setNotificationRef.current(`Élément IFC sélectionné : ID ${hit.object.userData.expressID}`);
            } else if (hit.object.userData?.id) {
              onSelectRef.current(hit.object.userData.id);
              setNotificationRef.current(`Élément sélectionné : ${hit.object.userData.id}`);
            }
          } else {
            onSelectRef.current(null);
          }
        } catch (e) {
          console.error('Click error:', e);
        }
      };
      renderer.domElement.addEventListener('dblclick', onMouseClick);

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
        renderer.domElement.removeEventListener('dblclick', onMouseClick);
        cancelAnimationFrame(animationId);
        renderer.dispose();
        controls.dispose();
        // Safely remove canvas
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    } catch (e) {
      console.error('Scene setup error:', e);
      setError(`Erreur d'initialisation: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [addMockData]); // Removed onSelect and setNotification - using refs instead

  // LOAD IFC FILE EFFECT - Using dynamic import for web-ifc
  useEffect(() => {
    if (!ifcFileUrl || !sceneRef.current) return;

    const scene = sceneRef.current;

    const loadIFC = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingMessage("Téléchargement du fichier IFC...");
      setNotificationRef.current("Chargement du fichier IFC...");

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

      try {
        // Dynamic import of web-ifc
        setLoadingMessage("Chargement du moteur IFC...");
        const WebIFC = await import('web-ifc');
        
        const ifcApi = new WebIFC.IfcAPI();
        ifcApi.SetWasmPath("https://cdn.jsdelivr.net/npm/web-ifc@0.0.46/", true);
        
        setLoadingMessage("Initialisation du moteur...");
        await ifcApi.Init();
        
        // Fetch the IFC file
        setLoadingMessage("Téléchargement du fichier...");
        const response = await fetch(ifcFileUrl);
        if (!response.ok) throw new Error(`Échec du téléchargement: ${response.status}`);
        
        setLoadingMessage("Lecture du fichier...");
        const data = await response.arrayBuffer();
        const uint8Array = new Uint8Array(data);
        
        setLoadingMessage("Parsing du fichier IFC...");
        
        // Load into web-ifc
        const modelID = ifcApi.OpenModel(uint8Array);
        
        // Create a group to hold all meshes
        const ifcGroup = new THREE.Group();
        ifcGroup.name = "IFCModel";
        
        setLoadingMessage("Génération de la géométrie 3D...");
        
        // Get all geometry
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
            
            // Create position and normal attributes (every 6 floats: x,y,z, nx,ny,nz)
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
            
            // Get color from placed geometry
            const color = placedGeometry.color;
            const material = new THREE.MeshLambertMaterial({
              color: new THREE.Color(color.x, color.y, color.z),
              transparent: color.w < 1,
              opacity: color.w,
              side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(bufferGeometry, material);
            
            // Apply transformation matrix
            const matrix = new THREE.Matrix4();
            matrix.fromArray(placedGeometry.flatTransformation);
            mesh.applyMatrix4(matrix);
            
            mesh.userData.expressID = flatMesh.expressID;
            ifcGroup.add(mesh);
            meshCount++;
          }
        }
        
        ifcApi.CloseModel(modelID);
        
        scene.add(ifcGroup);
        modelRef.current = ifcGroup;
        
        setIsLoading(false);
        setNotificationRef.current(`Modèle IFC chargé ! (${meshCount} objets)`);
        
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
        // Re-add mock data on error
        addMockData(scene);
      }
    };

    loadIFC();
  }, [ifcFileUrl, addMockData]); // Removed setNotification - using ref instead

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
