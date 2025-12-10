import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

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

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // IFC LOADER SETUP (HYBRID)
    const ifcLoader = new IFCLoader();
    // Force le chargement du WASM depuis un CDN fiable pour éviter les problèmes de build local
    ifcLoader.ifcManager.setWasmPath('https://unpkg.com/web-ifc@0.0.46/');
    ifcLoaderRef.current = ifcLoader;

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
        if (modelRef.current && hit.faceIndex !== undefined && (hit.object as THREE.Mesh).geometry) {
          const mesh = hit.object as THREE.Mesh;
          const id = ifcLoader.ifcManager.getExpressId(mesh.geometry as THREE.BufferGeometry, hit.faceIndex);
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

    // MOCK DATA (Fallback)
    if (!ifcFileUrl) {
      const group = new THREE.Group();
      group.userData.isMock = true;
      const mat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      const box = new THREE.BoxGeometry(1, 1, 1);
      const m1 = new THREE.Mesh(box, mat); m1.position.set(0, 2, -5); m1.scale.set(10, 4, 0.5); m1.userData={id:"MOCK1", isMock:true};
      const m2 = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x475569 })); m2.position.set(0, 0, 0); m2.scale.set(12, 0.5, 12); m2.userData={id:"MOCK2", isMock:true};
      group.add(m1, m2);
      scene.add(group);
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
    if (ifcFileUrl && ifcLoaderRef.current && sceneRef.current) {
      setNotification("Chargement IFC en cours... (WASM via CDN)");
      const scene = sceneRef.current;
      
      const toRemove: THREE.Object3D[] = [];
      scene.traverse(c => { if (c.userData.isMock || c === modelRef.current) toRemove.push(c); });
      toRemove.forEach(c => scene.remove(c));

      ifcLoaderRef.current.load(ifcFileUrl, 
        (ifcModel) => {
          modelRef.current = ifcModel;
          scene.add(ifcModel);
          setNotification("Modèle chargé avec succès !");
        },
        (progress) => console.log('Loading', progress),
        (err) => { console.error(err); setNotification("Erreur de chargement IFC"); }
      );
    }
  }, [ifcFileUrl, setNotification]);

  return <div ref={mountRef} className="w-full h-full cursor-crosshair relative outline-none" />;
};
