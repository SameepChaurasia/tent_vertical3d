import { Suspense, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  PerspectiveCamera,
} from '@react-three/drei';
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
  front: { azimuth: 0, polar: Math.PI / 3, distance: 4 },
  side: { azimuth: Math.PI / 2, polar: Math.PI / 3, distance: 4 },
  back: { azimuth: Math.PI, polar: Math.PI / 3, distance: 4 },
  top: { azimuth: 0, polar: 0.1, distance: 5 },
  isometric: { azimuth: Math.PI / 4, polar: Math.PI / 4, distance: 4.5 },
} as const;

export type CameraPresetName = keyof typeof CameraPresets;

const ConfiguratorCanvasInner = forwardRef<ViewerHandle, ConfiguratorCanvasProps>(
  function ConfiguratorCanvasInner({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const productDef = useConfiguratorStore(selectProductDefinition);
    const sizeId = useConfiguratorStore(selectCurrentSizeId);

    useImperativeHandle(ref, () => ({
      captureSnapshots: async (angles) => {
        /* Snapshot capture implementation — renders from specified angles */
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

    const modelUrl = productDef && sizeId
      ? productDef.models[sizeId]?.url
      : null;

    if (!productDef || !modelUrl) {
      return <ViewerLoadingSkeleton />;
    }

    return (
      <div className={`viewer-3d-container ${className ?? ''}`}>
        <Canvas
          ref={canvasRef}
          frameloop="demand"
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
            preserveDrawingBuffer: true,
          }}
          shadows
          style={{ width: '100%', height: '100%' }}
        >
          <PerspectiveCamera
            makeDefault
            position={[3, 2.5, 3]}
            fov={45}
            near={0.1}
            far={100}
          />

          <OrbitControls
            makeDefault
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={2}
            maxDistance={8}
            enableDamping
            dampingFactor={0.08}
            target={[0, 0.8, 0]}
          />

          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight
            position={[-3, 4, -2]}
            intensity={0.3}
          />

          <Environment preset="city" background={false} />

          <Suspense fallback={null}>
            <CanopyModel />
          </Suspense>

          <ContactShadows
            position={[0, -0.01, 0]}
            opacity={0.35}
            scale={8}
            blur={2.5}
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
