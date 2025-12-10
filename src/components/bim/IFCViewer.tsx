import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IFCLoader } from "web-ifc-three";
import { IFCWALLSTANDARDCASE, IFCSLAB, IFCWINDOW, IFCCOLUMN } from "web-ifc";

interface IFCViewerProps {
  ifcFileUrl: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNotification?: (msg: string) => void;
}

// Mock data for fallback display
const MOCK_ELEMENTS = [
  { id: "1F4a", position: [0, 2, -5], scale: [10, 4, 0.5], color: 0x94a3b8 },
  { id: "2D8x", position: [0, 0, 0], scale: [12, 0.5, 12], color: 0x475569 },
  { id: "9H2k", position: [2, 2, -5], scale: [2, 1.5, 0.6], color: 0x60a5fa },
  { id: "4J5m", position: [5, 2, 5], scale: [0.5, 4, 0.5], color: 0x94a3b8 },
];

export function IFCViewer({ ifcFileUrl, selectedId, onSelect, onNotification }: IFCViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const ifcLoaderRef = useRef<IFCLoader | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mockGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [isLoading, setIsLoading] = useState(false);
  const [loaderReady, setLoaderReady] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    sceneRef.current = scene;

    // Grid
    const gridHelper = new THREE.GridHelper(50, 50, 0x94a3b8, 0xcbd5e1);
    scene.add(gridHelper);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(20, 20, 20);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Setup IFC Loader asynchronously
    const initLoader = async () => {
      try {
        const ifcLoader = new IFCLoader();
        // Set WASM path with trailing slash
        await ifcLoader.ifcManager.setWasmPath("https://unpkg.com/web-ifc@0.0.46/");
        ifcLoaderRef.current = ifcLoader;
        setLoaderReady(true);
        console.log("IFC Loader WASM initialized");
      } catch (error) {
        console.error("Failed to initialize IFC Loader:", error);
        onNotification?.("Erreur: Impossible d'initialiser le chargeur IFC");
      }
    };
    initLoader();

    // Add mock data initially
    addMockData(scene);

    // Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      controls.dispose();
    };
  }, [onNotification]);

  // Add mock elements to scene
  const addMockData = (scene: THREE.Scene) => {
    const group = new THREE.Group();
    group.userData.isMock = true;

    MOCK_ELEMENTS.forEach((el) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshLambertMaterial({ 
        color: el.color,
        transparent: el.id === "9H2k",
        opacity: el.id === "9H2k" ? 0.6 : 1
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(el.position[0], el.position[1], el.position[2]);
      mesh.scale.set(el.scale[0], el.scale[1], el.scale[2]);
      mesh.userData = { id: el.id, isMock: true, originalColor: el.color };
      group.add(mesh);
    });

    scene.add(group);
    mockGroupRef.current = group;
  };

  // Handle double-click for selection
  const handleDoubleClick = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    // Determine what to raycast against
    const objectsToTest: THREE.Object3D[] = [];
    if (modelRef.current) {
      objectsToTest.push(modelRef.current);
    }
    if (mockGroupRef.current) {
      mockGroupRef.current.children.forEach(child => objectsToTest.push(child));
    }

    const intersects = raycasterRef.current.intersectObjects(objectsToTest, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      
      // Check if it's a real IFC model
      if (modelRef.current && ifcLoaderRef.current) {
        try {
          const faceIndex = hit.faceIndex;
          const geometry = (hit.object as THREE.Mesh).geometry;
          if (faceIndex !== undefined && geometry) {
            const expressId = ifcLoaderRef.current.ifcManager.getExpressId(geometry, faceIndex);
            if (expressId !== undefined) {
              onSelect(String(expressId));
              onNotification?.(`Élément IFC sélectionné : Express ID ${expressId}`);
              return;
            }
          }
        } catch (e) {
          // Fall through to mock handling
        }
      }

      // Mock element handling
      let obj = hit.object as THREE.Object3D;
      while (obj && !obj.userData?.id) {
        obj = obj.parent as THREE.Object3D;
      }
      if (obj?.userData?.id) {
        onSelect(obj.userData.id);
      }
    } else {
      onSelect(null);
    }
  }, [onSelect, onNotification]);

  // Attach double-click listener
  useEffect(() => {
    const element = mountRef.current;
    if (!element) return;
    
    element.addEventListener("dblclick", handleDoubleClick);
    return () => element.removeEventListener("dblclick", handleDoubleClick);
  }, [handleDoubleClick]);

  // Load IFC file when URL changes and loader is ready
  useEffect(() => {
    if (!ifcFileUrl || !loaderReady || !ifcLoaderRef.current || !sceneRef.current) return;

    const scene = sceneRef.current;
    const ifcLoader = ifcLoaderRef.current;

    setIsLoading(true);
    onNotification?.("Chargement et parsing de l'IFC en cours...");

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

    ifcLoader.load(
      ifcFileUrl,
      (ifcModel) => {
        modelRef.current = ifcModel;
        scene.add(ifcModel);
        setIsLoading(false);
        onNotification?.("Fichier IFC chargé avec succès !");
        
        // Center camera on model
        const box = new THREE.Box3().setFromObject(ifcModel);
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
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          onNotification?.(`Chargement: ${percent}%`);
        }
      },
      (error) => {
        console.error("IFC Load Error:", error);
        setIsLoading(false);
        onNotification?.("Erreur lors du chargement de l'IFC.");
        // Re-add mock data on error
        addMockData(scene);
      }
    );
  }, [ifcFileUrl, loaderReady, onNotification]);

  // Update selection highlighting
  useEffect(() => {
    if (!mockGroupRef.current) return;

    mockGroupRef.current.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshLambertMaterial;
      const isSelected = mesh.userData.id === selectedId;
      
      if (isSelected) {
        material.color.setHex(0xea580c);
        material.emissive = new THREE.Color(0x7c2d12);
        material.emissiveIntensity = 0.3;
      } else {
        material.color.setHex(mesh.userData.originalColor);
        material.emissive = new THREE.Color(0x000000);
        material.emissiveIntensity = 0;
      }
    });
  }, [selectedId]);

  return (
    <div ref={mountRef} className="w-full h-full cursor-crosshair relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <div className="flex flex-col items-center gap-3 bg-card p-6 rounded-lg shadow-xl">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Chargement IFC...</span>
          </div>
        </div>
      )}
    </div>
  );
}
