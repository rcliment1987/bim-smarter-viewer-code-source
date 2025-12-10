import { useRef, useState } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

interface ThreeViewerProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface BuildingMeshProps {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  id: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function BuildingMesh({ position, scale, color, id, selectedId, onSelect }: BuildingMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedId === id;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSelected ? null : id);
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial
        color={isSelected ? "#ea580c" : hovered ? "#60a5fa" : color}
        emissive={isSelected ? "#7c2d12" : "#000000"}
        emissiveIntensity={isSelected ? 0.3 : 0}
      />
    </mesh>
  );
}

function Scene({ selectedId, onSelect }: ThreeViewerProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />

      {/* Grid */}
      <Grid
        args={[50, 50]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#94a3b8"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#cbd5e1"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Building elements */}
      {/* Mur Extérieur - 1F4a */}
      <BuildingMesh
        position={[0, 2, -5]}
        scale={[10, 4, 0.5]}
        color="#94a3b8"
        id="1F4a"
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {/* Dalle - 2D8x */}
      <BuildingMesh
        position={[0, 0, 0]}
        scale={[12, 0.5, 12]}
        color="#475569"
        id="2D8x"
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {/* Fenêtre - 9H2k */}
      <mesh position={[2, 2, -5]} scale={[2, 1.5, 0.6]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial
          color={selectedId === "9H2k" ? "#ea580c" : "#60a5fa"}
          transparent
          opacity={selectedId === "9H2k" ? 1 : 0.6}
          emissive={selectedId === "9H2k" ? "#7c2d12" : "#000000"}
          emissiveIntensity={selectedId === "9H2k" ? 0.3 : 0}
        />
      </mesh>
      {/* Make window clickable */}
      <mesh
        position={[2, 2, -5]}
        scale={[2, 1.5, 0.6]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selectedId === "9H2k" ? null : "9H2k");
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Poteau - 4J5m */}
      <BuildingMesh
        position={[5, 2, 5]}
        scale={[0.5, 4, 0.5]}
        color="#94a3b8"
        id="4J5m"
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {/* Camera Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
}

export function ThreeViewer({ selectedId, onSelect }: ThreeViewerProps) {
  return (
    <div className="w-full h-full cursor-crosshair">
      <Canvas
        camera={{ position: [15, 15, 15], fov: 45 }}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={["#f1f5f9"]} />
        <Scene selectedId={selectedId} onSelect={onSelect} />
      </Canvas>
    </div>
  );
}
