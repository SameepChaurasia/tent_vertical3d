import { useEffect, useRef, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  useConfiguratorStore,
  selectProductDefinition,
  selectCurrentSizeId,
  selectSectionConfig,
  selectCurrentOptions,
} from '../configurator/configurator.store';
import type { SectionConfig } from '../../domain/schemas';

/**
 * CanopyModel — loads and renders the tent GLB model and procedural walls.
 *
 * KEY DECISIONS:
 * - Nodes and materials are matched by NAME from the ProductDefinition, never by index.
 *   This handles the material-order difference in the 8×8 model.
 * - The fabric_Mat base colour map is replaced by a CanvasTexture that the
 *   2D editor pipeline writes to. Set flipY=false (glTF UV convention).
 * - The metal material is cloned so the frame colour can be changed independently.
 * - Procedural side walls and half walls are generated and attached to the frame
 *   based on user configuration choices, matching the real product catalog.
 * - Frame visibility toggles dynamically when "Canopy Only (No Frame)" is selected.
 * - Images are pre-loaded into an HTMLImageElement cache so drawImage is synchronous.
 */

/* ── Image cache for uploaded assets (module-level, not per-render) ── */
const imageCache = new Map<string, HTMLImageElement>();

function getOrLoadImage(objectUrl: string, onLoaded?: () => void): HTMLImageElement | null {
  const cached = imageCache.get(objectUrl);
  if (cached?.complete) return cached;

  if (!cached) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = objectUrl;
    img.onload = () => {
      onLoaded?.();
      useConfiguratorStore.getState().selectLayer(
        useConfiguratorStore.getState().selectedLayerId,
      );
    };
    imageCache.set(objectUrl, img);
  }
  return null;
}

/**
 * Renders a SectionConfig's layers onto a 2D canvas.
 *
 * This function is the bridge between the Zustand configuration state
 * and the Three.js CanvasTexture. It runs on every configuration change,
 * painting the base colour first, then each layer on top.
 */
function renderSectionToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sectionConfig: SectionConfig,
  onImageLoaded?: () => void,
): void {
  /* Clear and fill base colour */
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = sectionConfig.baseColor;
  ctx.fillRect(0, 0, width, height);

  /* Sort layers by zIndex for correct stacking */
  const sortedLayers = [...sectionConfig.layers].sort(
    (a, b) => a.zIndex - b.zIndex,
  );

  for (const layer of sortedLayers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;

    const x = layer.normalizedX * width;
    const y = layer.normalizedY * height;

    ctx.translate(x, y);
    ctx.rotate((layer.rotationDegrees * Math.PI) / 180);
    ctx.scale(layer.scale, layer.scale);

    if (layer.kind === 'text') {
      /* Scale font for high-DPI texture (2048px canvas vs ~512px editor) */
      const fontSize = layer.fontSizePt * (width / 512);
      const cleanFont = layer.fontFamily.includes(' ') ? `"${layer.fontFamily}"` : layer.fontFamily;
      ctx.font = `600 ${fontSize}px ${cleanFont}, sans-serif`;
      ctx.fillStyle = layer.fill;
      ctx.textAlign = layer.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.content, 0, 0);
    }

    if (layer.kind === 'image') {
      const asset = useConfiguratorStore.getState().assetRegistry.get(layer.assetId);
      if (asset) {
        const img = getOrLoadImage(asset.objectUrl, onImageLoaded);
        if (img) {
          const drawWidth = layer.normalizedWidth * width;
          const drawHeight = layer.normalizedHeight * height;
          ctx.drawImage(
            img,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight,
          );
        }
      }
    }

    ctx.restore();
  }
}

interface ProceduralWallsProps {
  sideWallsOption: string;
  halfWallsOption: string;
  tentBounds: { halfWidth: number; halfDepth: number; eavesHeight: number };
  canopyBaseColor: string;
  sideWallsConfig: SectionConfig | null;
  halfWallsConfig: SectionConfig | null;
  metalColor: string;
}

function ProceduralWalls({
  sideWallsOption,
  halfWallsOption,
  tentBounds,
  canopyBaseColor,
  sideWallsConfig,
  halfWallsConfig,
  metalColor,
}: ProceduralWallsProps) {
  const { halfWidth, halfDepth, eavesHeight } = tentBounds;

  const wallColor = sideWallsConfig?.baseColor ?? canopyBaseColor;
  const halfWallColor = halfWallsConfig?.baseColor ?? canopyBaseColor;

  const hasBackWall =
    sideWallsOption.startsWith('wall-1') || sideWallsOption.startsWith('wall-3');
  const hasSideWalls = sideWallsOption.startsWith('wall-3');
  const hasHalfWalls = halfWallsOption.startsWith('half-wall');

  const wallWidth = halfWidth * 2;
  const wallDepth = halfDepth * 2;
  const halfWallHeight = eavesHeight * 0.48;

  /* Offscreen canvas & texture for side walls if custom layers exist */
  const wallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wallTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const [hasWallLayers, setHasWallLayers] = useState(false);

  useEffect(() => {
    if (!wallCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      wallCanvasRef.current = canvas;
      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      wallTextureRef.current = texture;
    }
  }, []);

  useEffect(() => {
    if (!wallCanvasRef.current || !sideWallsConfig) return;
    const ctx = wallCanvasRef.current.getContext('2d');
    if (!ctx) return;

    if (sideWallsConfig.layers.length > 0) {
      renderSectionToCanvas(ctx, 1024, 1024, sideWallsConfig);
      if (wallTextureRef.current) {
        wallTextureRef.current.needsUpdate = true;
      }
      setHasWallLayers(true);
    } else {
      setHasWallLayers(false);
    }
  }, [sideWallsConfig]);

  const wallMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: hasWallLayers ? '#ffffff' : wallColor,
      map: hasWallLayers ? wallTextureRef.current : null,
      roughness: 0.7,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }, [wallColor, hasWallLayers]);

  const halfWallMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: halfWallColor,
      roughness: 0.7,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }, [halfWallColor]);

  const metalMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: metalColor,
      metalness: 0.85,
      roughness: 0.25,
    });
  }, [metalColor]);

  if (!hasBackWall && !hasSideWalls && !hasHalfWalls) {
    return null;
  }

  return (
    <group>
      {/* ── Back Wall (wall-1 or wall-3) ── */}
      {hasBackWall && (
        <mesh
          position={[0, eavesHeight / 2, -halfDepth]}
          rotation={[0, 0, 0]}
          material={wallMaterial}
          castShadow
          receiveShadow
        >
          <planeGeometry args={[wallWidth, eavesHeight]} />
        </mesh>
      )}

      {/* ── Side Walls (wall-3: Left + Right) ── */}
      {hasSideWalls && (
        <>
          <mesh
            position={[-halfWidth, eavesHeight / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            material={wallMaterial}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[wallDepth, eavesHeight]} />
          </mesh>

          <mesh
            position={[halfWidth, eavesHeight / 2, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            material={wallMaterial}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[wallDepth, eavesHeight]} />
          </mesh>
        </>
      )}

      {/* ── Half Walls (Set of 2: Left + Right with top clamp rails) ── */}
      {hasHalfWalls && (
        <>
          {/* Left half wall */}
          <mesh
            position={[-halfWidth, halfWallHeight / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            material={halfWallMaterial}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[wallDepth, halfWallHeight]} />
          </mesh>
          {/* Left rail */}
          <mesh
            position={[-halfWidth, halfWallHeight, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={metalMaterial}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.018, wallDepth, 16]} />
          </mesh>

          {/* Right half wall */}
          <mesh
            position={[halfWidth, halfWallHeight / 2, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            material={halfWallMaterial}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[wallDepth, halfWallHeight]} />
          </mesh>
          {/* Right rail */}
          <mesh
            position={[halfWidth, halfWallHeight, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={metalMaterial}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.018, wallDepth, 16]} />
          </mesh>
        </>
      )}
    </group>
  );
}

export function CanopyModel() {
  const productDef = useConfiguratorStore(selectProductDefinition);
  const sizeId = useConfiguratorStore(selectCurrentSizeId);
  const canopyConfig = useConfiguratorStore(selectSectionConfig('canopy'));
  const frameConfig = useConfiguratorStore(selectSectionConfig('frame'));
  const sideWallsConfig = useConfiguratorStore(selectSectionConfig('side-walls'));
  const halfWallsConfig = useConfiguratorStore(selectSectionConfig('half-walls'));
  const currentOptions = useConfiguratorStore(selectCurrentOptions);

  const frameType = currentOptions['frame-type'] ?? 'with-frame';
  const sideWallsOption = currentOptions['side-walls'] ?? 'none';
  const halfWallsOption = currentOptions['half-walls'] ?? 'none';

  const modelVariant = productDef && sizeId ? productDef.models[sizeId] : null;
  const modelUrl = modelVariant?.url ?? '/models/canopy-5x5.glb';

  const { scene } = useGLTF(modelUrl);
  const modelRef = useRef<THREE.Group>(null);
  const canvasTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const metalMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const { invalidate: invalidateFrame } = useThree();

  const [, setTextureVersion] = useState(0);

  /* Create the offscreen canvas for fabric texture — persistent across re-renders */
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 2048;
      offscreenCanvasRef.current = canvas;
    }
    return () => {
      offscreenCanvasRef.current = null;
    };
  }, []);

  /* Clone the scene and set up materials */
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    if (!modelVariant) return cloned;

    /* Traverse and find materials by name — not by index */
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((mat, index) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;

        /* ── Fabric outer material ── */
        if (mat.name === modelVariant.materialMap.fabricOuter) {
          const fabricMat = mat.clone();

          if (offscreenCanvasRef.current) {
            const canvasTexture = new THREE.CanvasTexture(offscreenCanvasRef.current);
            canvasTexture.flipY = false;
            canvasTexture.colorSpace = THREE.SRGBColorSpace;
            canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
            canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
            canvasTexture.anisotropy = 8;
            canvasTexture.minFilter = THREE.LinearMipMapLinearFilter;
            canvasTexture.magFilter = THREE.LinearFilter;

            fabricMat.map = canvasTexture;
            canvasTextureRef.current = canvasTexture;
          }

          fabricMaterialRef.current = fabricMat;

          if (Array.isArray(child.material)) {
            child.material[index] = fabricMat;
          } else {
            child.material = fabricMat;
          }
        }

        /* ── Metal material ── */
        if (mat.name === modelVariant.materialMap.metal) {
          const metalMat = mat.clone();
          metalMaterialRef.current = metalMat;

          if (Array.isArray(child.material)) {
            child.material[index] = metalMat;
          } else {
            child.material = metalMat;
          }
        }
      });

      child.castShadow = true;
      child.receiveShadow = true;
    });

    /* Normalise: centre and place on ground plane */
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    cloned.position.set(-center.x, -box.min.y, -center.z);

    const targetHeight = 2.2;
    const scale = targetHeight / size.y;
    cloned.scale.setScalar(scale);
    cloned.position.multiplyScalar(scale);

    return cloned;
  }, [scene, modelVariant]);

  /* ── Sync: 2D configuration → 3D canvas texture (throttled with rAF) ── */
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = offscreenCanvasRef.current;
    if (!canvas || !canopyConfig) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      renderSectionToCanvas(ctx, canvas.width, canvas.height, canopyConfig, () => {
        setTextureVersion((v) => v + 1);
      });

      if (canvasTextureRef.current) {
        canvasTextureRef.current.needsUpdate = true;
        invalidateFrame();
      }
      rafIdRef.current = null;
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [canopyConfig, invalidateFrame]);

  /* ── Sync: frame colour ── */
  useEffect(() => {
    if (metalMaterialRef.current && frameConfig) {
      metalMaterialRef.current.color.set(frameConfig.baseColor);
      invalidateFrame();
    }
  }, [frameConfig?.baseColor, invalidateFrame]);

  /* ── Sync: frame visibility (Canopy Only vs With Frame) ── */
  useEffect(() => {
    if (!modelRef.current) return;
    const isFrameVisible = frameType !== 'canopy-only';
    modelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const matName = Array.isArray(child.material)
          ? child.material[0]?.name
          : child.material?.name;
        if (
          matName === modelVariant?.materialMap.metal ||
          child.name.toLowerCase().includes('leg') ||
          child.name.toLowerCase().includes('mechanism')
        ) {
          child.visible = isFrameVisible;
        }
      }
    });
    invalidateFrame();
  }, [frameType, modelVariant, invalidateFrame]);

  /* ── Cleanup: dispose GPU resources ── */
  useEffect(() => {
    return () => {
      canvasTextureRef.current?.dispose();
      fabricMaterialRef.current?.dispose();
      metalMaterialRef.current?.dispose();
    };
  }, []);

  const tentBounds = useMemo(() => {
    const widthRatio = modelVariant ? modelVariant.physicalWidthInches / 60 : 1;
    return {
      halfWidth: 1.08 * (0.85 + 0.15 * widthRatio),
      halfDepth: 1.08 * (0.85 + 0.15 * widthRatio),
      eavesHeight: 1.52,
    };
  }, [modelVariant]);

  return (
    <group>
      <primitive ref={modelRef} object={clonedScene} />
      <ProceduralWalls
        sideWallsOption={sideWallsOption}
        halfWallsOption={halfWallsOption}
        tentBounds={tentBounds}
        canopyBaseColor={canopyConfig?.baseColor ?? '#F5A623'}
        sideWallsConfig={sideWallsConfig}
        halfWallsConfig={halfWallsConfig}
        metalColor={frameConfig?.baseColor ?? '#CCCCCC'}
      />
    </group>
  );
}

/* Preload all three canopy models so size switching is instantaneous */
useGLTF.preload('/models/canopy-5x5.glb');
useGLTF.preload('/models/canopy-6-5x6-5.glb');
useGLTF.preload('/models/canopy-8x8.glb');
