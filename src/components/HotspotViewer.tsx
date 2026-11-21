import type { KeyboardEvent } from 'react';
import { playPageFlip } from '../audio/audio';
import type { Diagram, Shape } from '../model/manifest';
import { Tooltip } from './Tooltip';
import '../styles/hotspot.css';

export interface HotspotViewerProps {
  diagram: Diagram;
  /** Called with the hotspot's section_id. */
  onNavigate: (sectionId: string) => void;
}

function renderShape(shape: Shape, i: number) {
  const fill = shape.kind === 'line' ? undefined : (shape.fill ?? 'none');
  const stroke = shape.stroke ?? 'currentColor';
  switch (shape.kind) {
    case 'rect':
      return (
        <rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={fill} stroke={stroke} />
      );
    case 'circle':
      return <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} stroke={stroke} />;
    case 'line':
      return <line key={i} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={stroke} />;
    case 'polygon':
      return <polygon key={i} points={shape.points.map((p) => p.join(',')).join(' ')} fill={fill} stroke={stroke} />;
  }
}

/**
 * Renders a diagram as SVG in a 0..100 coordinate space. Each hotspot is a
 * focusable button placed at (x, y) in that space, wrapped in a Tooltip.
 * Tooltip renders HTML, so hotspots sit in an overlay positioned by percent
 * rather than inside the shapes SVG.
 */
export function HotspotViewer({ diagram, onNavigate }: HotspotViewerProps) {
  const activate = (sectionId: string) => {
    playPageFlip();
    onNavigate(sectionId);
  };

  return (
    <div className="hotspot-viewer">
      <svg
        className="hotspot-shapes"
        viewBox="0 0 100 100"
        role="img"
        aria-label={diagram.title}
        preserveAspectRatio="xMidYMid meet"
      >
        {diagram.shapes.map(renderShape)}
      </svg>
      {diagram.hotspots.map((h, i) => {
        const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            activate(h.section_id);
          }
        };
        return (
          <div key={`${h.section_id}-${i}`} className="hotspot-anchor" style={{ left: `${h.x}%`, top: `${h.y}%` }}>
            <Tooltip text={h.label}>
              <svg className="hotspot-marker" viewBox="-8 -8 16 16" aria-hidden={false}>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={h.label}
                  className="hotspot-button"
                  data-x={h.x}
                  data-y={h.y}
                  onClick={() => activate(h.section_id)}
                  onKeyDown={onKeyDown}
                >
                  <rect x={-7} y={-7} width={14} height={14} />
                  <text x={0} y={1} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
                    {i + 1}
                  </text>
                </g>
              </svg>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
