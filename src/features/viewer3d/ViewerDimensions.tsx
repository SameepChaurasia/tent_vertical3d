import { Html } from '@react-three/drei';

interface ViewerDimensionsProps {
  visible: boolean;
}

export function ViewerDimensions({ visible }: ViewerDimensionsProps) {
  if (!visible) return null;

  const dimColor = '#F5A623';
  const halfWidth = 1.08;
  const eavesHeight = 1.52;
  const peakHeight = 2.18;

  return (
    <group>
      {/* ── Width Dimension (Front: 10 ft / 3.05 m) ── */}
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
            <span className="dimension-value">10' 0" (3.05 m)</span>
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
            <span className="dimension-value">11' 2" (3.40 m)</span>
          </div>
        </Html>
      </group>
    </group>
  );
}
