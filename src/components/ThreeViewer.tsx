import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { IFCWALLSTANDARDCASE, IFCSLAB, IFCWINDOW, IFCDOOR, IFCCOLUMN } from 'web-ifc';

interface ThreeViewerProps {
  ifcFileUrl: string | null;
  onSelect: (id: any) => void;
  setNotification: (msg: string) => void;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({ ifcFileUrl, onSelect, setNotification }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const ifcLoaderRef = useRef<IFCLoader | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
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
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // GRID
    const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
    scene.add(gridHelper);

    // IFC LOADER SETUP - Initialize async
    const initIFCLoader = async () => {
      try {
        const ifcLoader = new IFCLoader();
        await ifcLoader.ifcManager.setWasmPath('https://unpkg.com/web-ifc@0.0.46/');
        ifcLoaderRef.current = ifcLoader;
        console.log('IFC Loader initialized successfully');
      } catch (error) {
        console.error('Failed to initialize IFC Loader:', error);
      }
    };
    initIFCLoader();

    // RAYCASTER
    const raycaster = new THREE.Raycaster();
    (raycaster as any).firstHitOnly = true;
    const mouse = new THREE.Vector2();

    const onMouseClick = async (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      
      const objects = modelRef.current ? [modelRef.current] : scene.children.filter(c => c.userData.isMock);
      const intersects = raycaster.intersectObjects(objects, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        if (modelRef.current && hit.faceIndex !== undefined && (hit.object as THREE.Mesh).geometry && ifcLoaderRef.current) {
          const mesh = hit.object as THREE.Mesh;
          const id = ifcLoaderRef.current.ifcManager.getExpressId(mesh.geometry as THREE.BufferGeometry, hit.faceIndex);
          onSelect(id);
          setNotification(`Élément IFC sélectionné : ID ${id}`);
        } else {
          onSelect(hit.object.userData.id);
        }
      } else {
        onSelect(null);
      }
    };
    renderer.domElement.addEventListener('dblclick', onMouseClick);

    // ANIMATION
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // MOCK DATA (Fallback) - affiché uniquement si pas de fichier IFC
    const addMockData = () => {
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
    };
    
    if (!ifcFileUrl) {
      addMockData();
    }

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
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // LOAD IFC FILE EFFECT
  useEffect(() => {
    const loadIFC = async () => {
      if (!ifcFileUrl || !sceneRef.current) return;
      
      // Attendre que le loader soit initialisé
      let attempts = 0;
      while (!ifcLoaderRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!ifcLoaderRef.current) {
        setNotification("Erreur: IFC Loader non initialisé");
        return;
      }

      setIsLoading(true);
      setNotification("Chargement du fichier IFC...");
      
      const scene = sceneRef.current;
      
      // Supprimer les anciens objets
      const toRemove: THREE.Object3D[] = [];
      scene.traverse(c => { 
        if (c.userData.isMock || c === modelRef.current) toRemove.push(c); 
      });
      toRemove.forEach(c => scene.remove(c));

      try {
        ifcLoaderRef.current.load(
          ifcFileUrl,
          (ifcModel) => {
            modelRef.current = ifcModel;
            scene.add(ifcModel);
            
            // Centrer la caméra sur le modèle
            const box = new THREE.Box3().setFromObject(ifcModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            if (cameraRef.current) {
              cameraRef.current.position.set(
                center.x + maxDim,
                center.y + maxDim,
                center.z + maxDim
              );
              cameraRef.current.lookAt(center);
            }
            
            setIsLoading(false);
            setNotification("Modèle IFC chargé avec succès !");
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setNotification(`Chargement: ${percent}%`);
            }
          },
          (error) => {
            console.error('IFC Load Error:', error);
            setIsLoading(false);
            setNotification("Erreur lors du chargement IFC");
          }
        );
      } catch (error) {
        console.error('IFC Load Exception:', error);
        setIsLoading(false);
        setNotification("Erreur lors du chargement IFC");
      }
    };

    loadIFC();
  }, [ifcFileUrl, setNotification]);

  return (
    <div ref={mountRef} className="w-full h-full cursor-crosshair relative outline-none">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <div className="bg-slate-800 px-6 py-4 rounded-lg border border-slate-600">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-white text-sm">Chargement du modèle...</p>
          </div>
        </div>
      )}
    </div>
  );
};
