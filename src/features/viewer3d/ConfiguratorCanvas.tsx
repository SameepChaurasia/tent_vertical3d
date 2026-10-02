import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  PerspectiveCamera,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { CanopyModel } from './CanopyModel';
import { ViewerHotspots } from './ViewerHotspots';
import { ViewerDimensions } from './ViewerDimensions';
import { useConfiguratorStore, selectProductDefinition, selectCurrentSizeId } from '../configurator/configurator.store';
import { ViewerErrorBoundary } from './ViewerErrorBoundary';
import { ViewerLoadingSkeleton } from './ViewerLoadingSkeleton';

export interface ViewerHandle {
  captureSnapshots: (
    angles: Array<{ name: string; azimuth: number; polar: number; distance: number }>,
  ) => Promise<Array<{ name: string; dataUrl: string }>>;
}

interface ConfiguratorCanvasProps {
  className?: string;
}

const CameraPresets = {
  front: [0, 1.3, 4.2],
  isometric: [3.2, 2.4, 3.2],
  side: [4.2, 1.3, 0],
  back: [0, 1.3, -4.2],
  top: [0.01, 5.0, 0.05],
} as const;

export type CameraPresetName = keyof typeof CameraPresets;

type EnvironmentType = 'city' | 'studio' | 'sunset';

interface ViewerSceneProps {
  preset: CameraPresetName;
  isAutoRotating: boolean;
  environmentPreset: EnvironmentType;
  showHotspots: boolean;
  showDimensions: boolean;
  isNightMode: boolean;
}

function ViewerScene({
  preset,
  isAutoRotating,
  environmentPreset,
  showHotspots,
  showDimensions,
  isNightMode,
}: ViewerSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const coords = CameraPresets[preset];
    if (!coords || !controlsRef.current) return;
    camera.position.set(coords[0], coords[1], coords[2]);
    controlsRef.current.target.set(0, 0.85, 0);
    controlsRef.current.update();
    invalidate();
  }, [preset, camera, invalidate]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[3.2, 2.4, 3.2]}
        fov={45}
        near={0.1}
        far={100}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={1.8}
        maxDistance={8}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0.85, 0]}
        autoRotate={isAutoRotating}
        autoRotateSpeed={2.5}
      />

      {/* Dynamic Lighting: Studio vs Night Mode */}
      <ambientLight intensity={isNightMode ? 0.12 : 0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={isNightMode ? 0.2 : 1.3}
        color={isNightMode ? '#7D9BB8' : '#FFFFFF'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={isNightMode ? 0.1 : 0.4}
        color={isNightMode ? '#5C7A9E' : '#FFFFFF'}
      />

      {/* Interior Warm LED Chandelier Fixture in Night Mode */}
      {isNightMode && (
        <group position={[0, 1.72, 0]}>
          <pointLight
            color="#FFDF99"
            intensity={4.5}
            distance={5.5}
            decay={2}
            castShadow
          />
          {/* Glowing LED fixture mesh */}
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color="#FFF1C2" />
          </mesh>
        </group>
      )}

      <Environment
        preset={isNightMode ? 'sunset' : environmentPreset}
        background={false}
        environmentIntensity={isNightMode ? 0.15 : 1}
      />

      <Suspense fallback={null}>
        <CanopyModel />
        <ViewerHotspots visible={showHotspots} />
        <ViewerDimensions visible={showDimensions} />
      </Suspense>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={isNightMode ? 0.6 : 0.4}
        scale={8}
        blur={2.2}
        far={4}
      />

      {/* Ground plane for context */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial
          color={isNightMode ? '#14141e' : '#e8e8e8'}
          roughness={0.9}
        />
      </mesh>
    </>
  );
}

const ConfiguratorCanvasInner = forwardRef<ViewerHandle, ConfiguratorCanvasProps>(
  function ConfiguratorCanvasInner({ className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const productDef = useConfiguratorStore(selectProductDefinition);
    const sizeId = useConfiguratorStore(selectCurrentSizeId);

    const [activePreset, setActivePreset] = useState<CameraPresetName>('isometric');
    const [isAutoRotating, setIsAutoRotating] = useState(false);
    const [envPreset, setEnvPreset] = useState<EnvironmentType>('city');
    const [showHotspots, setShowHotspots] = useState(false);
    const [showDimensions, setShowDimensions] = useState(false);
    const [isNightMode, setIsNightMode] = useState(false);

    useImperativeHandle(ref, () => ({
      captureSnapshots: async (angles) => {
        const results: Array<{ name: string; dataUrl: string }> = [];
        const canvas = canvasRef.current;
        if (!canvas) return results;

        for (const angle of angles) {
          const dataUrl = canvas.toDataURL('image/png');
          results.push({ name: angle.name, dataUrl });
        }
        return results;
      },
    }));

    const handleDownloadSnapshot = () => {
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `canopy-tent-3d-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    const modelUrl = productDef && sizeId
      ? productDef.models[sizeId]?.url
      : null;

    if (!productDef || !modelUrl) {
      return <ViewerLoadingSkeleton />;
    }

    return (
      <div
        ref={containerRef}
        className={`viewer-3d-container relative w-full h-full ${isNightMode ? 'viewer-night-mode' : ''} ${className ?? ''}`}
      >
        {/* Floating Camera & Viewer Toolbar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-slate-950/85 backdrop-blur-md border border-white/15 rounded-full shadow-2xl z-10" role="toolbar" aria-label="3D Viewer Controls">
          {/* Camera Angles */}
          <div className="flex items-center gap-1">
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activePreset === 'front'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActivePreset('front')}
              title="Front View"
            >
              Front
            </button>
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activePreset === 'isometric'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActivePreset('isometric')}
              title="Isometric 3D View"
            >
              3D Iso
            </button>
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activePreset === 'side'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActivePreset('side')}
              title="Side View"
            >
              Side
            </button>
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activePreset === 'back'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActivePreset('back')}
              title="Back View"
            >
              Back
            </button>
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                activePreset === 'top'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActivePreset('top')}
              title="Top View"
            >
              Top
            </button>
          </div>

          <div className="w-[1px] h-4 bg-white/20 mx-1" />

          {/* Interactive Feature Toggles */}
          <div className="flex items-center gap-1">
            <button
              className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                showHotspots
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setShowHotspots((prev) => !prev)}
              title="Toggle Feature Hotspots"
            >
              <span>📍</span> Hotspots
            </button>
            <button
              className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                showDimensions
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setShowDimensions((prev) => !prev)}
              title="Toggle 3D Dimensions"
            >
              <span>📏</span> Measure
            </button>
            <button
              className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                isNightMode
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setIsNightMode((prev) => !prev)}
              title="Toggle Night Mode with Interior LED Illumination"
            >
              <span>💡</span> LED Night
            </button>
          </div>

          <div className="w-[1px] h-4 bg-white/20 mx-1" />

          {/* Turntable Auto-rotate */}
          <button
            className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
              isAutoRotating
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            onClick={() => setIsAutoRotating((prev) => !prev)}
            title="Toggle 360° Turntable Rotation"
          >
            <span style={{ display: 'inline-block', transform: isAutoRotating ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>
              ↻
            </span>
            360°
          </button>

          <div className="w-[1px] h-4 bg-white/20 mx-1" />

          {/* Lighting Mode Selector */}
          <select
            className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 border border-white/15 text-slate-200 outline-none cursor-pointer hover:bg-white/15"
            value={envPreset}
            onChange={(e) => setEnvPreset(e.target.value as EnvironmentType)}
            title="Environment Lighting"
            aria-label="Select environment lighting"
            disabled={isNightMode}
          >
            <option value="city" className="bg-slate-900 text-white">🏙️ Daylight</option>
            <option value="studio" className="bg-slate-900 text-white">💡 Studio</option>
            <option value="sunset" className="bg-slate-900 text-white">🌅 Sunset</option>
          </select>
        </div>

        {/* Floating Snapshot Button */}
        <button
          className="absolute bottom-4 right-4 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-950/85 backdrop-blur-md border border-white/15 rounded-full shadow-xl hover:bg-amber-500 hover:text-slate-950 hover:-translate-y-0.5 transition-all z-10 cursor-pointer"
          onClick={handleDownloadSnapshot}
          title="Download High-Res 3D Snapshot"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Snapshot
        </button>

        <Canvas
          ref={canvasRef}
          frameloop={isAutoRotating ? 'always' : 'demand'}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
            preserveDrawingBuffer: true,
          }}
          shadows
          style={{ width: '100%', height: '100%' }}
        >
          <ViewerScene
            preset={activePreset}
            isAutoRotating={isAutoRotating}
            environmentPreset={envPreset}
            showHotspots={showHotspots}
            showDimensions={showDimensions}
            isNightMode={isNightMode}
          />
        </Canvas>
      </div>
    );
  },
);

export const ConfiguratorCanvas = forwardRef<ViewerHandle, ConfiguratorCanvasProps>(
  function ConfiguratorCanvas(props, ref) {
    return (
      <ViewerErrorBoundary>
        <ConfiguratorCanvasInner ref={ref} {...props} />
      </ViewerErrorBoundary>
    );
  },
);
