import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Stage, Layer, Rect, Text, Transformer, Group, Image as KonvaImage, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import {
  useConfiguratorStore,
  selectProductDefinition,
  selectActiveSectionId,
  selectSectionConfig,
  selectSelectedLayerId,
  selectCurrentOptions,
} from '../configurator/configurator.store';
import type { ImageLayer, AssetEntry } from '../../domain/schemas';

const EDITOR_WIDTH = 320;
const EDITOR_HEIGHT = 320;

interface EditorImageProps {
  layer: ImageLayer;
  asset: AssetEntry | null;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onClick: () => void;
}

function EditorImageLayer({
  layer,
  asset,
  onDragEnd,
  onTransformEnd,
  onClick,
}: EditorImageProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!asset?.objectUrl) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = asset.objectUrl;
    img.onload = () => setImage(img);
  }, [asset?.objectUrl]);

  if (!image) return null;

  const width = layer.normalizedWidth * EDITOR_WIDTH;
  const height = layer.normalizedHeight * EDITOR_HEIGHT;

  return (
    <KonvaImage
      id={`layer-${layer.id}`}
      image={image}
      x={layer.normalizedX * EDITOR_WIDTH}
      y={layer.normalizedY * EDITOR_HEIGHT}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={layer.rotationDegrees}
      scaleX={layer.scale}
      scaleY={layer.scale}
      opacity={layer.opacity}
      draggable={!layer.locked}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      onClick={onClick}
    />
  );
}

/**
 * 2D Design Editor — Konva-based canvas for designing tent artwork.
 *
 * SYNC ARCHITECTURE: This component is a pure projection of the Zustand store.
 * User interactions (drag, resize, rotate) update the store, which triggers
 * re-render of both this editor and the 3D canvas texture.
 */
export function DesignEditor() {
  const productDef = useConfiguratorStore(selectProductDefinition);
  const activeSectionId = useConfiguratorStore(selectActiveSectionId);
  const selectedLayerId = useConfiguratorStore(selectSelectedLayerId);
  const currentOptions = useConfiguratorStore(selectCurrentOptions);
  const sectionConfig = useConfiguratorStore(
    selectSectionConfig(activeSectionId ?? 'canopy'),
  );
  const updateLayer = useConfiguratorStore((s) => s.updateLayer);
  const selectLayer = useConfiguratorStore((s) => s.selectLayer);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);

  /* Visible printable sections based on activeWhen */
  const visibleSections = useMemo(() => {
    if (!productDef) return [];
    return productDef.sections
      .filter((s) => s.kind === 'printable')
      .filter((section) => {
        if (!section.activeWhen) return true;
        return Object.entries(section.activeWhen).every(([groupId, allowedChoices]) => {
          const currentChoice = currentOptions[groupId];
          return currentChoice && allowedChoices.includes(currentChoice);
        });
      });
  }, [productDef, currentOptions]);

  /* Fallback active section if current active section becomes inactive */
  useEffect(() => {
    if (visibleSections.length > 0 && activeSectionId) {
      const isCurrentActive = visibleSections.some((s) => s.id === activeSectionId);
      if (!isCurrentActive && visibleSections[0]) {
        useConfiguratorStore.getState().setActiveSection(visibleSections[0].id);
      }
    }
  }, [visibleSections, activeSectionId]);

  /* Attach transformer to selected node */
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (selectedLayerId && stageRef.current) {
      const node = stageRef.current.findOne(`#layer-${selectedLayerId}`);
      if (node) {
        transformer.nodes([node]);
        selectedNodeRef.current = node;
      } else {
        transformer.nodes([]);
        selectedNodeRef.current = null;
      }
    } else {
      transformer.nodes([]);
      selectedNodeRef.current = null;
    }

    transformer.getLayer()?.batchDraw();
  }, [selectedLayerId]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current) {
        selectLayer(null);
        return;
      }

      const clickedId = e.target.id();
      if (clickedId?.startsWith('layer-')) {
        const layerId = clickedId.replace('layer-', '');
        selectLayer(layerId);
      }
    },
    [selectLayer],
  );

  const handleDragEnd = useCallback(
    (layerId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      if (!activeSectionId) return;
      const node = e.target;
      updateLayer(activeSectionId, layerId, {
        normalizedX: node.x() / EDITOR_WIDTH,
        normalizedY: node.y() / EDITOR_HEIGHT,
      });
    },
    [activeSectionId, updateLayer],
  );

  const handleTransformEnd = useCallback(
    (layerId: string, e: Konva.KonvaEventObject<Event>) => {
      if (!activeSectionId) return;
      const node = e.target;
      const scaleX = node.scaleX();
      const rotation = node.rotation();

      /* Reset the node scale and apply it to the data model */
      node.scaleX(1);
      node.scaleY(1);

      updateLayer(activeSectionId, layerId, {
        normalizedX: node.x() / EDITOR_WIDTH,
        normalizedY: node.y() / EDITOR_HEIGHT,
        scale: scaleX,
        rotationDegrees: rotation,
      });
    },
    [activeSectionId, updateLayer],
  );

  if (!sectionConfig || !productDef) {
    return (
      <div className="editor-2d-empty">
        <p>Select a section to start designing</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 my-1">
      {/* Surface switcher — ONLY shown when multiple surfaces (walls) are selected */}
      {visibleSections.length > 1 && (
        <div className="flex flex-col gap-1.5 p-2 bg-slate-900/80 border border-slate-700 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
            🎨 Design Surface
          </span>
          <div className="flex gap-1.5">
            {visibleSections.map((section) => {
              const isSelected = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                  onClick={() => useConfiguratorStore.getState().setActiveSection(section.id)}
                >
                  {section.id === 'canopy' ? '⛺ Roof Canopy' : `🧱 ${section.label}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Artboard Card */}
      <div className="bg-[#121622] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
            <div>
              <span className="text-xs font-bold tracking-wider text-white uppercase block">
                {activeSectionId === 'canopy' ? '⛺ Canopy Roof & Valance Canvas' : '🧱 Print Surface Canvas'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Precision UV Unwrap • Live 3D Texture Projection
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-3 py-1 rounded-full">
            2048 × 2048 MASTER
          </span>
        </div>
        <div className="editor-2d-canvas-wrapper flex flex-col justify-center items-center py-2">
          <div className="rounded-2xl p-2 bg-[#0a0d14] border border-white/[0.08] shadow-2xl">
            <div className="rounded-xl overflow-hidden shadow-inner border border-white/5">
              <Stage
                ref={stageRef}
                width={EDITOR_WIDTH}
                height={EDITOR_HEIGHT}
                onClick={handleStageClick}
              >
            <Layer>
              {/* Base colour fill */}
              <Rect
                x={0}
                y={0}
                width={EDITOR_WIDTH}
                height={EDITOR_HEIGHT}
                fill={sectionConfig.baseColor}
                listening={false}
              />

            {/* Clear CAD region polygons with directional notations & areas */}
            {productDef.sections
              .find((s) => s.id === activeSectionId)
              ?.printRegions.map((region) => {
                const flatPoints = region.uvPolygon.flatMap((p) => [
                  p.u * EDITOR_WIDTH,
                  p.v * EDITOR_HEIGHT,
                ]);

                const avgX =
                  (region.uvPolygon.reduce((acc, p) => acc + p.u, 0) / region.uvPolygon.length) *
                  EDITOR_WIDTH;
                const avgY =
                  (region.uvPolygon.reduce((acc, p) => acc + p.v, 0) / region.uvPolygon.length) *
                  EDITOR_HEIGHT;

                let labelText = region.label.toUpperCase();
                let fontSize = 9;
                let textColor = '#ffffffb0';
                let labelYOffset = 0;
                let isFrontFace = false;

                if (region.id === 'roof-front') {
                  labelText = '▼ FRONT FACE (3D FRONT)';
                  fontSize = 10;
                  textColor = '#fef08a';
                  labelYOffset = 18;
                  isFrontFace = true;
                } else if (region.id === 'valance-front') {
                  labelText = 'FRONT VALANCE';
                  fontSize = 8;
                  textColor = '#fef08acc';
                  isFrontFace = true;
                } else if (region.id === 'roof-back') {
                  labelText = '▲ BACK FACE';
                  fontSize = 9;
                  textColor = '#ffffffcc';
                  labelYOffset = -6;
                } else if (region.id === 'valance-back') {
                  labelText = 'BACK VALANCE';
                  fontSize = 8;
                  textColor = '#ffffff99';
                } else if (region.id === 'roof-left') {
                  labelText = '◀ LEFT FACE';
                  fontSize = 8;
                  textColor = '#ffffffcc';
                } else if (region.id === 'roof-right') {
                  labelText = 'RIGHT FACE ▶';
                  fontSize = 8;
                  textColor = '#ffffffcc';
                } else if (region.id === 'valance-left' || region.id === 'valance-right') {
                  labelText = 'VALANCE';
                  fontSize = 7;
                  textColor = '#ffffff80';
                }

                return (
                  <Group key={region.id}>
                    {/* Exact CAD polygon border & subtle panel fill */}
                    <Line
                      points={flatPoints}
                      closed
                      stroke={isFrontFace ? '#f59e0b90' : '#ffffff35'}
                      strokeWidth={isFrontFace ? 1.5 : 1}
                      dash={[4, 3]}
                      fill={region.id === 'roof-front' ? '#f59e0b12' : '#ffffff05'}
                      listening={false}
                    />
                    {/* High-visibility label notation */}
                    <Text
                      text={labelText}
                      x={avgX - 60}
                      y={avgY - fontSize / 2 + labelYOffset}
                      width={120}
                      align="center"
                      fontSize={fontSize}
                      fontStyle="bold"
                      fill={textColor}
                      shadowColor="#000000"
                      shadowBlur={2}
                      shadowOpacity={0.8}
                      listening={false}
                    />
                  </Group>
                );
              })}

            {/* Center Peak Marker for Canopy */}
            {activeSectionId === 'canopy' && (
              <Group listening={false}>
                <Circle
                  x={0.5 * EDITOR_WIDTH}
                  y={0.5 * EDITOR_HEIGHT}
                  radius={4}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                <Text
                  text="▲ PEAK"
                  x={0.5 * EDITOR_WIDTH - 30}
                  y={0.5 * EDITOR_HEIGHT - 14}
                  width={60}
                  align="center"
                  fontSize={8}
                  fontStyle="bold"
                  fill="#f59e0b"
                  shadowColor="#000000"
                  shadowBlur={2}
                />
              </Group>
            )}

            {/* Design layers */}
            {sectionConfig.layers.map((layer) => {
              if (!layer.visible) return null;

              if (layer.kind === 'text') {
                const scaledFontSize = layer.fontSizePt * (EDITOR_WIDTH / 512);
                return (
                  <Text
                    key={layer.id}
                    id={`layer-${layer.id}`}
                    x={layer.normalizedX * EDITOR_WIDTH}
                    y={layer.normalizedY * EDITOR_HEIGHT}
                    text={layer.content}
                    fontSize={scaledFontSize}
                    fontFamily={layer.fontFamily}
                    fill={layer.fill}
                    align={layer.align}
                    opacity={layer.opacity}
                    rotation={layer.rotationDegrees}
                    draggable={!layer.locked}
                    offsetX={0}
                    offsetY={scaledFontSize / 2}
                    onDragEnd={(e) => handleDragEnd(layer.id, e)}
                    onTransformEnd={(e) => handleTransformEnd(layer.id, e)}
                    onClick={() => selectLayer(layer.id)}
                  />
                );
              }

              if (layer.kind === 'image') {
                const asset = useConfiguratorStore.getState().assetRegistry.get(layer.assetId) ?? null;
                return (
                  <EditorImageLayer
                    key={layer.id}
                    layer={layer}
                    asset={asset}
                    onDragEnd={(e) => handleDragEnd(layer.id, e)}
                    onTransformEnd={(e) => handleTransformEnd(layer.id, e)}
                    onClick={() => selectLayer(layer.id)}
                  />
                );
              }

              return null;
            })}

            {/* Transformer for selected element */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                return newBox;
              }}
              rotateEnabled
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
              ]}
            />
          </Layer>
            </Stage>
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400 pt-2 font-medium">
          💡 Drag elements on canvas • Corner anchors scale &amp; rotate • Updates 3D model live
        </p>
      </div>
    </div>
  </div>
);
}
