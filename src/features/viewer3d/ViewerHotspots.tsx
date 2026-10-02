import { useState } from 'react';
import { Html } from '@react-three/drei';

interface HotspotData {
  id: string;
  position: [number, number, number];
  title: string;
  description: string;
  tag: string;
}

const HOTSPOTS: HotspotData[] = [
  {
    id: 'peak-fabric',
    position: [0, 2.15, 0],
    title: '600D Commercial Canopy',
    description: 'PU-coated waterproof polyester with UV50+ solar shield and CPAI-84 certified flame resistance.',
    tag: 'Fabric Tech',
  },
  {
    id: 'scissor-truss',
    position: [0, 1.68, 0],
    title: 'Extruded Scissor Truss',
    description: 'Aircraft-grade anodized aluminum alloy with composite joint brackets for extreme wind resistance.',
    tag: 'Frame Structure',
  },
  {
    id: 'leg-slider',
    position: [1.08, 0.25, 1.08],
    title: 'Telescopic Push-Button Leg',
    description: '3 adjustable height positions with pinch-free push-button releases and reinforced stake footplates.',
    tag: 'Hardware',
  },
];

interface ViewerHotspotsProps {
  visible: boolean;
}

export function ViewerHotspots({ visible }: ViewerHotspotsProps) {
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);

  if (!visible) return null;

  return (
    <group>
      {HOTSPOTS.map((hotspot) => {
        const isActive = activeHotspotId === hotspot.id;

        return (
          <group key={hotspot.id} position={hotspot.position}>
            <Html center distanceFactor={8} zIndexRange={[100, 0]}>
              <div className="hotspot-wrapper">
                <button
                  className={`hotspot-pin ${isActive ? 'hotspot-pin-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveHotspotId(isActive ? null : hotspot.id);
                  }}
                  title={hotspot.title}
                  aria-expanded={isActive}
                >
                  <span className="hotspot-pulse" />
                  <span className="hotspot-icon">+</span>
                </button>

                {isActive && (
                  <div
                    className="hotspot-card"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-label={hotspot.title}
                  >
                    <div className="hotspot-card-header">
                      <span className="hotspot-card-tag">{hotspot.tag}</span>
                      <button
                        className="hotspot-card-close"
                        onClick={() => setActiveHotspotId(null)}
                        aria-label="Close feature details"
                      >
                        ✕
                      </button>
                    </div>
                    <h4 className="hotspot-card-title">{hotspot.title}</h4>
                    <p className="hotspot-card-desc">{hotspot.description}</p>
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
