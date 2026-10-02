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
}

function ViewerScene({ preset, isAutoRotating, environmentPreset }: ViewerSceneProps) {
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

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.4}
      />

      <Environment preset={environmentPreset} background={false} />

      <Suspense fallback={null}>
        <CanopyModel />
      </Suspense>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
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
        <meshStandardMaterial color="#e8e8e8" roughness={0.9} />
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
      <div ref={containerRef} className={`viewer-3d-container ${className ?? ''}`}>
        {/* Floating Camera & Viewer Toolbar */}
        <div className="viewer-floating-toolbar" role="toolbar" aria-label="3D Viewer Controls">
          <div className="viewer-toolbar-group">
            <button
              className={`viewer-tool-button ${activePreset === 'front' ? 'viewer-tool-button-active' : ''}`}
              onClick={() => setActivePreset('front')}
              title="Front View"
            >
              Front
            </button>
            <button
              className={`viewer-tool-button ${activePreset === 'isometric' ? 'viewer-tool-button-active' : ''}`}
              onClick={() => setActivePreset('isometric')}
              title="Isometric 3D View"
            >
              3D Iso
            </button>
            <button
              className={`viewer-tool-button ${activePreset === 'side' ? 'viewer-tool-button-active' : ''}`}
              onClick={() => setActivePreset('side')}
              title="Side View"
            >
              Side
            </button>
            <button
              className={`viewer-tool-button ${activePreset === 'back' ? 'viewer-tool-button-active' : ''}`}
              onClick={() => setActivePreset('back')}
              title="Back View"
            >
              Back
            </button>
            <button
              className={`viewer-tool-button ${activePreset === 'top' ? 'viewer-tool-button-active' : ''}`}
              onClick={() => setActivePreset('top')}
              title="Top View"
            >
              Top
            </button>
          </div>

          <div className="viewer-tool-separator" />

          {/* Turntable Auto-rotate */}
          <button
            className={`viewer-tool-button ${isAutoRotating ? 'viewer-tool-button-active' : ''}`}
            onClick={() => setIsAutoRotating((prev) => !prev)}
            title="Toggle 360° Turntable Rotation"
          >
            <span style={{ display: 'inline-block', transform: isAutoRotating ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>
              ↻
            </span>
            360°
          </button>

          <div className="viewer-tool-separator" />

          {/* Lighting Mode Selector */}
          <select
            className="viewer-tool-select"
            value={envPreset}
            onChange={(e) => setEnvPreset(e.target.value as EnvironmentType)}
            title="Environment Lighting"
            aria-label="Select environment lighting"
          >
            <option value="city">🏙️ Daylight</option>
            <option value="studio">💡 Studio</option>
            <option value="sunset">🌅 Sunset</option>
          </select>
        </div>

        {/* Floating Snapshot Button */}
        <button
          className="viewer-snapshot-button"
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
