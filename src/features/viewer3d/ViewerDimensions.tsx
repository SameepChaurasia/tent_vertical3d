import { Html } from '@react-three/drei';
import {
  useConfiguratorStore,
  selectProductDefinition,
  selectCurrentSizeId,
} from '../configurator/configurator.store';

interface ViewerDimensionsProps {
  visible: boolean;
}

export function ViewerDimensions({ visible }: ViewerDimensionsProps) {
  if (!visible) return null;

  const productDef = useConfiguratorStore(selectProductDefinition);
  const sizeId = useConfiguratorStore(selectCurrentSizeId);
  const modelVariant = productDef && sizeId ? productDef.models[sizeId] : null;

  const dimColor = '#F5A623';
  const halfWidth = 1.08;
  const eavesHeight = 1.52;
  const peakHeight = 2.18;

  /* Derive real dimensions from model definition */
  const widthInches = modelVariant?.physicalWidthInches ?? 120;
  const heightInches = modelVariant?.physicalHeightInches ?? 134;

  const widthFeet = Math.floor(widthInches / 12);
  const widthRemainderInches = widthInches % 12;
  const widthMeters = (widthInches * 0.0254).toFixed(2);
  const widthLabel = `${widthFeet}' ${widthRemainderInches > 0 ? `${widthRemainderInches}"` : '0"'} (${widthMeters} m)`;

  const peakFeet = Math.floor(heightInches / 12);
  const peakRemainderInches = heightInches % 12;
  const peakMeters = (heightInches * 0.0254).toFixed(2);
  const peakLabel = `${peakFeet}' ${peakRemainderInches > 0 ? `${peakRemainderInches}"` : '0"'} (${peakMeters} m)`;

  return (
    <group>
      {/* ── Width Dimension ── */}
      <group position={[0, 0.04, halfWidth + 0.18]}>
        {/* Main horizontal bar */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[halfWidth * 2, 0.008, 0.008]} />
          <meshBasicMaterial color={dimColor} />
        </mesh>
        {/* Left end cap */}
        <mesh position={[-halfWidth, 0, 0]}>
          <boxGeometry args={[0.008, 0.05, 0.008]} />
          <meshBasicMaterial color={dimColor} />
        </mesh>
        {/* Right end cap */}
        <mesh position={[halfWidth, 0, 0]}>
          <boxGeometry args={[0.008, 0.05, 0.008]} />
          <meshBasicMaterial color={dimColor} />
        </mesh>
        {/* Dimension Label */}
        <Html position={[0, 0.06, 0]} center distanceFactor={8}>
          <div className="dimension-badge">
            <span className="dimension-title">Width</span>
            <span className="dimension-value">{widthLabel}</span>
          </div>
        </Html>
      </group>

      {/* ── Clearance Height (Valance: 7.2 ft / 2.20 m) ── */}
      <group position={[halfWidth + 0.18, 0, halfWidth]}>
        {/* Main vertical bar */}
        <mesh position={[0, eavesHeight / 2, 0]}>
          <boxGeometry args={[0.008, eavesHeight, 0.008]} />
          <meshBasicMaterial color={dimColor} />
        </mesh>
        {/* Bottom cap */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.05, 0.008, 0.008]} />
          <meshBasicMaterial color={dimColor} />
        </mesh>
        {/* Top cap */}
        <mesh position={[0, eavesHeight, 0]}>
          <boxGeometry args={[0.05, 0.008, 0.008]} />
          <meshBasicMaterial color={dimColor} />
        </mesh>
        {/* Dimension Label */}
        <Html position={[0, eavesHeight / 2, 0]} center distanceFactor={8}>
          <div className="dimension-badge">
            <span className="dimension-title">Clearance</span>
            <span className="dimension-value">7' 2" (2.18 m)</span>
          </div>
        </Html>
      </group>

      {/* ── Total Peak Height (11.2 ft / 3.40 m) ── */}
      <group position={[-halfWidth - 0.18, 0, -halfWidth]}>
        {/* Main vertical bar */}
        <mesh position={[0, peakHeight / 2, 0]}>
          <boxGeometry args={[0.008, peakHeight, 0.008]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>
        {/* Bottom cap */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.05, 0.008, 0.008]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>
        {/* Top cap */}
        <mesh position={[0, peakHeight, 0]}>
          <boxGeometry args={[0.05, 0.008, 0.008]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>
        {/* Dimension Label */}
        <Html position={[0, peakHeight / 2, 0]} center distanceFactor={8}>
          <div className="dimension-badge dimension-badge-blue">
            <span className="dimension-title">Peak Height</span>
            <span className="dimension-value">{peakLabel}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}
