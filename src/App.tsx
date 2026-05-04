import React, { Suspense, useState, useRef, useMemo } from 'react';
import { Canvas, useLoader, useThree, useFrame } from '@react-three/fiber';
import { TextureLoader, Mesh } from 'three';
import { OrbitControls, Environment, PerspectiveCamera, ContactShadows, useCursor, useGLTF, Float } from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { motion, AnimatePresence } from 'motion/react';
import { useDrag } from '@use-gesture/react';
import { INGREDIENTS } from './constants';
import { IngredientType, IngredientData } from './types';
import { LucideUndo2, LucideShare2, LucideSparkles, LucideRefreshCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types & Registry ---

interface ModelSettings {
  url?: string;
  collider: 'cuboid' | 'ball' | 'hull' | 'trimesh';
  args?: any[]; // For cuboid/ball specifics
  scale?: [number, number, number];
}

/**
 * PRODUCTION ASSET REGISTRY
 * -------------------------
 * To swap placeholders for production assets:
 * 1. Place .glb files in /public/models/ (e.g. /public/models/bread_white_papercut.glb)
 * 2. Ensure names match the 'url' paths below.
 * 3. Adjust 'collider' type if the asset is complex (use 'hull' for organic shapes).
 */
const MODEL_CONFIG: Record<IngredientType, ModelSettings> = {
  bread: { 
    url: '/models/bread_white_papercut.glb', 
    collider: 'cuboid', 
    args: [2.2, 0.4, 2.2] 
  },
  lettuce: { 
    url: '/models/lettuce_papercut.glb', 
    collider: 'hull' 
  },
  tomato: { 
    url: '/models/tomato_slice_papercut.glb', 
    collider: 'cuboid', 
    args: [1.4, 0.2, 1.4] 
  },
  cheese: { 
    url: '/models/cheese_slice_papercut.glb', 
    collider: 'cuboid', 
    args: [2.0, 0.05, 2.0] 
  },
  bacon: { 
    url: '/models/bacon_strip_papercut.glb', 
    collider: 'cuboid', 
    args: [2.2, 0.15, 1.0] 
  },
  mayo: { 
    url: '/models/mayo_dollop_papercut.glb', 
    collider: 'cuboid', 
    args: [2.0, 0.1, 2.0] 
  },
};

interface IngredientPieceProps {
  id: string;
  type: IngredientType;
  initialPosition: [number, number, number];
  isFixed?: boolean;
  stackHeight?: number;
}

const PlaceholderMesh = ({ type }: { type: IngredientType }) => {
  const config = MODEL_CONFIG[type];
  
  // Attempt to load GLB. If public folder is empty, this handles the error 
  // gracefully within the Suspense boundary.
  let gltf: any = null;
  try {
    // Only attempt if url is defined
    if (config.url) {
      gltf = useGLTF(config.url);
    }
  } catch (e) {
    // Graceful fallback for missing assets
    gltf = null;
  }

  const getColor = () => {
    switch (type) {
      case 'bread': return '#f3e5ab';
      case 'lettuce': return '#4caf50';
      case 'tomato': return '#f44336';
      case 'cheese': return '#ffeb3b';
      case 'bacon': return '#8d6e63';
      case 'mayo': return '#f5f5f5';
      default: return '#cccccc';
    }
  };

  const material = <meshStandardMaterial color={getColor()} roughness={0.8} />;

  // PRODUCTION ASSET RENDER
  if (gltf && gltf.scene) {
    return <primitive object={gltf.scene.clone()} scale={config.scale || [1, 1, 1]} />;
  }

  // PROCEDURAL FALLBACKS
  switch (type) {
    case 'bread':
      return (
        <mesh receiveShadow castShadow>
          <boxGeometry args={[2.2, 0.4, 2.2]} />
          {material}
        </mesh>
      );
    case 'lettuce':
      return (
        <mesh receiveShadow castShadow>
          <boxGeometry args={[2.4, 0.1, 2.4]} />
          {material}
        </mesh>
      );
    case 'tomato':
      return (
        <group>
          <mesh position={[-0.5, 0, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[0.7, 0.7, 0.2, 32]} />
            {material}
          </mesh>
          <mesh position={[0.5, 0.05, 0.1]} receiveShadow castShadow>
            <cylinderGeometry args={[0.7, 0.7, 0.2, 32]} />
            {material}
          </mesh>
        </group>
      );
    case 'cheese':
      return (
        <mesh receiveShadow castShadow>
          <boxGeometry args={[2.0, 0.05, 2.0]} />
          {material}
        </mesh>
      );
    case 'bacon':
      return (
        <group>
          <mesh position={[0, 0, -0.4]} receiveShadow castShadow>
            <boxGeometry args={[2.2, 0.15, 0.5]} />
            {material}
          </mesh>
          <mesh position={[0, 0.05, 0.4]} receiveShadow castShadow>
            <boxGeometry args={[2.2, 0.15, 0.5]} />
            {material}
          </mesh>
        </group>
      );
    case 'mayo':
      return (
        <group>
          {/* Main splat - this one provides the collision */}
          <mesh receiveShadow castShadow scale={[2.4, 0.2, 2.2]}>
            <sphereGeometry args={[0.5, 16, 12]} />
            <meshStandardMaterial color={getColor()} roughness={0.3} metalness={0.1} />
          </mesh>
          {/* Smaller dollops are purely visual to avoid jittery collisions */}
          <mesh position={[0.6, -0.05, 0.4]} scale={[0.8, 0.15, 0.8]} castShadow>
            <sphereGeometry args={[0.4, 12, 12]} />
            <meshStandardMaterial color={getColor()} roughness={0.3} />
          </mesh>
          <mesh position={[-0.7, -0.02, -0.5]} scale={[0.9, 0.15, 0.9]} castShadow>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshStandardMaterial color={getColor()} roughness={0.3} />
          </mesh>
          <mesh position={[0.3, 0.02, -0.8]} scale={[0.7, 0.12, 0.7]} castShadow>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshStandardMaterial color={getColor()} roughness={0.3} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh receiveShadow castShadow>
          <boxGeometry args={[1, 1, 1]} />
          {material}
        </mesh>
      );
  }
};

const IngredientPiece: React.FC<IngredientPieceProps & { 
  onSnap?: (id: string, pos: [number, number, number]) => void;
  onDragChange?: (dragging: boolean) => void;
}> = ({ id, type, initialPosition, isFixed = false, stackHeight = 0, onSnap, onDragChange }) => {
  const rbRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { size, viewport } = useThree();
  const aspect = size.width / viewport.width;
  const config = MODEL_CONFIG[type];
  
  useCursor(hovered);

  // Calculate a safe lift height: base (bread) is around 0.4, each layer is ~0.15-0.2
  // We want to float about 10% higher than current stack
  const targetLiftHeight = useMemo(() => {
    const baseHeight = 0.4;
    const layerThickness = 0.2;
    const currentStackTop = baseHeight + (stackHeight * layerThickness);
    return Math.max(1.5, currentStackTop * 1.1);
  }, [stackHeight]);

  const bind = useDrag(({ offset: [x, y], down, last, event }) => {
    if (isFixed || !rbRef.current) return;
    
    // Prevent dragging multiple items at once by stopping propagation
    const e = event as any;
    if (e.stopPropagation) e.stopPropagation();
    
    const targetX = x / aspect;
    const targetZ = y / aspect;
    
    if (down) {
      if (!isDragging) {
        setIsDragging(true);
        if (onDragChange) onDragChange(true);
      }
      
      rbRef.current.setNextKinematicTranslation({ 
        x: targetX, 
        y: targetLiftHeight, 
        z: targetZ 
      });
      rbRef.current.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
    }

    if (last) {
      setIsDragging(false);
      if (onDragChange) onDragChange(false);
      const distToCenter = Math.sqrt(targetX * targetX + targetZ * targetZ);
      if (distToCenter < 1.8) {
        // Magnetic snap: move exactly to center before releasing
        rbRef.current.setNextKinematicTranslation({ x: 0, y: targetLiftHeight, z: 0 });
        if (onSnap) onSnap(id, [0, targetLiftHeight, 0]);
      }
    }
  });

  const physicsProps = useMemo(() => {
    switch (type) {
      case 'cheese': return { restitution: 0, friction: 2.0, mass: 0.5 };
      case 'lettuce': return { restitution: 0.1, friction: 1.5, mass: 0.6 };
      case 'tomato': return { restitution: 0.05, friction: 1.0, mass: 1.0 };
      case 'bacon': return { restitution: 0.1, friction: 0.8, mass: 0.8 };
      case 'mayo': return { restitution: 0, friction: 3.0, mass: 0.2 };
      default: return { restitution: 0.2, friction: 0.7, mass: 1.5 };
    }
  }, [type]);

  return (
    <RigidBody
      ref={rbRef}
      colliders={config.collider}
      position={initialPosition}
      sensor={isDragging} // Pass-through when dragging
      type={isFixed ? 'fixed' : (isDragging ? 'kinematicPosition' : 'dynamic')}
      {...physicsProps}
      angularDamping={0.9}
      linearDamping={0.9}
    >
      <group 
        onPointerOver={() => setHovered(true)} 
        onPointerOut={() => setHovered(false)}
        {...(bind as any)()}
        scale={isDragging ? 1.05 : 1}
      >
        <PlaceholderMesh type={type} />
        {isDragging && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}>
            <ringGeometry args={[1.2, 1.3, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
        )}
      </group>
    </RigidBody>
  );
};

// --- UI Components ---

const SidebarItem = ({ 
  type, 
  title, 
  onClick,
  className 
}: { 
  type: IngredientType, 
  title: string, 
  onClick: () => void,
  className: string 
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, x: 10 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`pointer-events-auto cursor-pointer flex items-center gap-4 p-4 bg-white/70 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl group transition-all hover:bg-white/90 ${className}`}
    >
      <div className="w-16 h-16 flex items-center justify-center p-2 rounded-xl bg-neutral-50/50">
        <img 
          src={INGREDIENTS[type].asset} 
          alt={title} 
          className="w-full h-full object-contain drop-shadow-md group-hover:rotate-6 transition-transform" 
        />
      </div>
      <div className="flex flex-col">
        <span className="font-marker text-neutral-800 text-lg">{title}</span>
        <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Add to Stack</span>
      </div>
    </motion.div>
  );
};

const Table = () => (
  <RigidBody type="fixed" colliders="cuboid" position={[0, -0.2, 0]}>
    <mesh receiveShadow>
      <boxGeometry args={[20, 0.4, 20]} />
      <meshStandardMaterial color="#ffffff" roughness={1} />
    </mesh>
  </RigidBody>
);

const Plate = ({ active }: { active: boolean }) => {
  return (
    <group visible={active}>
      <RigidBody type="fixed" colliders="hull" position={[0, -0.05, 0]}>
        {/* Plate Base/Well */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[1.6, 1.4, 0.08, 64]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            roughness={0.05} 
            metalness={0.05} 
            clearcoat={1.0} 
            clearcoatRoughness={0.05}
            reflectivity={0.8}
          />
        </mesh>
        {/* Plate Rim/Slope */}
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <cylinderGeometry args={[2.2, 1.6, 0.12, 64, 1, true]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            roughness={0.05} 
            metalness={0.05} 
            clearcoat={1.0} 
            side={2}
          />
        </mesh>
        {/* Outer Edge Lip */}
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <torusGeometry args={[2.18, 0.03, 16, 64]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            roughness={0.05} 
            metalness={0.05}
            clearcoat={1.0}
          />
        </mesh>
      </RigidBody>
    </group>
  );
};

const Toothpick = ({ active, stackHeight, onComplete }: { active: boolean, stackHeight: number, onComplete?: () => void }) => {
  const totalHeight = 0.6 + (stackHeight * 0.25);
  const [yOffset, setYOffset] = useState(10);
  const completedRef = useRef(false);
  
  useFrame((state, delta) => {
    if (active && yOffset > 0) {
      const nextY = Math.max(0, yOffset - delta * 20);
      setYOffset(nextY);
      if (nextY === 0 && !completedRef.current) {
        completedRef.current = true;
        if (onComplete) onComplete();
      }
    } else if (!active && yOffset < 10) {
      setYOffset(10);
      completedRef.current = false;
    }
  });
  
  if (!active || yOffset >= 10) return null;

  return (
    <group position={[0, yOffset, 0]}>
      {/* Wood Stick */}
      <mesh position={[0, totalHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, totalHeight, 8]} />
        <meshStandardMaterial color="#d2b48c" roughness={1} />
      </mesh>
      
      {/* Olive */}
      <group position={[0, totalHeight - 0.1, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color="#808000" roughness={0.6} />
        </mesh>
        {/* Pimento */}
        <mesh position={[0, 0.18, 0]} castShadow>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#f44336" />
        </mesh>
      </group>
    </group>
  );
};

export default function App() {
  const [layers, setLayers] = useState<IngredientData[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isServing, setIsServing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isDraggingAny, setIsDraggingAny] = useState(false);

  const spawnIngredient = (type: IngredientType) => {
    if (isServing || isFinished) return;
    const newLayer: IngredientData = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      position: [
        (Math.random() - 0.5) * 0.5,
        5.0 + (layers.length * 0.3), 
        (Math.random() - 0.5) * 0.5
      ],
      rotation: Math.random() * Math.PI * 0.1,
      scale: 1,
      opacity: 1
    };
    setLayers(prev => [...prev, newLayer]);
  };

  const handleSnap = (id: string, snapPos: [number, number, number]) => {
    console.log(`Snapped ${id} to center`);
  };

  const serve = () => {
    setIsServing(true);
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.8 },
      colors: ['#ffffff', '#808000', '#f44336']
    });
  };

  const handleToothpickComplete = () => {
    setIsLocked(true);
    setTimeout(() => setIsFinished(true), 500);
  };

  const reset = () => {
    setLayers([]);
    setIsFinished(false);
    setIsServing(false);
    setIsLocked(false);
  };

  return (
    <div className="relative w-full h-screen bg-neutral-100 font-sans overflow-hidden">
      
      {/* Sidebar Layer: Fixed Stations */}
      <div className="absolute inset-y-0 left-0 flex flex-col justify-center gap-4 p-8 pointer-events-none z-20">
        <SidebarItem type="lettuce" title="Lettuce" onClick={() => spawnIngredient('lettuce')} className="" />
        <SidebarItem type="tomato" title="Tomato" onClick={() => spawnIngredient('tomato')} className="" />
        <SidebarItem type="cheese" title="Cheese" onClick={() => spawnIngredient('cheese')} className="" />
      </div>

      <div className="absolute inset-y-0 right-0 flex flex-col justify-center gap-4 p-8 pointer-events-none z-20">
        <SidebarItem type="bacon" title="Bacon" onClick={() => spawnIngredient('bacon')} className="" />
        <SidebarItem type="mayo" title="Mayo" onClick={() => spawnIngredient('mayo')} className="" />
        <SidebarItem type="bread" title="Top Bun" onClick={() => spawnIngredient('bread')} className="" />
      </div>

      {/* --- UI Layer: Controls --- */}
      <div className="absolute inset-0 pointer-events-none z-30">
        
        {/* Title & Brand */}
        <div className="absolute top-12 left-12 max-w-xs pointer-events-auto">
          <h1 className="font-marker text-5xl text-neutral-800 mb-2 drop-shadow-sm">Garden Sandwich</h1>
          <p className="text-neutral-400 text-sm tracking-widest uppercase font-bold">Cutting Board View</p>
        </div>

        {/* Central Controls */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 pointer-events-auto">
          {layers.length > 0 && !isFinished && (
            <motion.button 
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={reset}
              className="flex items-center gap-2 px-6 py-3 bg-white rounded-full border border-neutral-100 shadow-sm text-red-300 font-marker hover:text-red-500 hover:border-red-100 transition-all"
            >
              <LucideRefreshCcw size={18} />
              Clear All
            </motion.button>
          )}

          {layers.length >= 1 && !isFinished && !isServing && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={serve}
              className="flex items-center gap-3 px-10 py-5 bg-neutral-900 text-white rounded-full font-marker text-xl shadow-xl"
            >
              Serve Sandwich
            </motion.button>
          )}

          {isFinished && (
            <motion.button 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={reset}
              className="px-10 py-5 bg-white border-2 border-neutral-900 text-neutral-900 rounded-full font-marker text-xl flex items-center gap-3 shadow-lg"
            >
              <LucideRefreshCcw size={24} />
              Make Another
            </motion.button>
          )}
        </div>
      </div>

      {/* --- 3D Scene Layer --- */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 8, 8], fov: 35 }}>
          <OrbitControls 
            enabled={!isDraggingAny}
            enablePan={false} 
            enableZoom={true}
            maxPolarAngle={Math.PI / 2.5} 
            minPolarAngle={Math.PI / 8}
            autoRotate={isFinished}
            autoRotateSpeed={2}
          />
          
          <ambientLight intensity={1.5} />
          <pointLight position={[5, 10, 5]} intensity={2} castShadow />
          <spotLight position={[-5, 8, 5]} intensity={1} angle={0.3} castShadow />

          <Physics gravity={[0, -9.81, 0]}>
            <Suspense fallback={null}>
              <IngredientPiece 
                id="base-bread" 
                type="bread" 
                initialPosition={[0, 0.25, 0]} 
                isFixed={true} 
              />
              
              {layers.map((layer) => (
                <IngredientPiece 
                  key={layer.id}
                  id={layer.id}
                  type={layer.type}
                  initialPosition={layer.position as [number, number, number]}
                  onSnap={handleSnap}
                  onDragChange={setIsDraggingAny}
                  stackHeight={layers.length}
                  isFixed={isLocked}
                />
              ))}

              <Plate active={isServing || isFinished} />
              <Toothpick 
                active={isServing || isFinished} 
                stackHeight={layers.length} 
                onComplete={handleToothpickComplete}
              />
              <Table />
              
              <ContactShadows 
                position={[0, 0.02, 0]} 
                opacity={0.3} 
                scale={15} 
                blur={2.5} 
              />
            </Suspense>
          </Physics>

          <Environment preset="studio" />
        </Canvas>
      </div>

      {/* --- Completion Message --- */}
      <AnimatePresence>
        {isFinished && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center pb-32 pointer-events-none"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center p-8 bg-white/20 backdrop-blur-xl rounded-3xl border border-white/30 shadow-2xl"
            >
              <h2 className="font-marker text-6xl text-neutral-900 mb-2 font-bold drop-shadow-md">Chef d'œuvre!</h2>
              <p className="font-marker text-lg text-neutral-600 italic tracking-wide">
                Your garden stack is perfectly seasoned.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.02)_100%)]" />
    </div>
  );
}


