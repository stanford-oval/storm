'use client';

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Upload,
  Filter,
  Settings,
} from 'lucide-react';
import { useMindMap } from '../../hooks/useMindMap';
import { MindMapNode, MindMapLink } from '../../types/mindmap';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';

interface MindMapProps {
  initialNodes?: MindMapNode[];
  initialLinks?: MindMapLink[];
  width?: number;
  height?: number;
  className?: string;
  onNodeClick?: (node: MindMapNode) => void;
  onNodeDoubleClick?: (node: MindMapNode) => void;
  onLinkClick?: (link: MindMapLink) => void;
  editable?: boolean;
  showControls?: boolean;
  showMinimap?: boolean;
}

export const MindMap: React.FC<MindMapProps> = ({
  initialNodes = [],
  initialLinks = [],
  width = 800,
  height = 600,
  className = '',
  onNodeClick,
  onNodeDoubleClick,
  onLinkClick,
  editable = true,
  showControls = true,
  showMinimap = true,
}) => {
  const { state, actions, computed, refs } = useMindMap(
    initialNodes,
    initialLinks
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);

  // Update viewport dimensions
  useEffect(() => {
    actions.updateViewport({ width, height });
  }, [width, height, actions]);

  // Initialize D3 visualization
  const initializeVisualization = useCallback(() => {
    if (!refs.svg.current || !containerRef.current) return;

    const svg = d3.select(refs.svg.current);
    const container = d3.select(containerRef.current);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create main group for zooming and panning
    const g = svg.append('g').attr('class', 'mind-map-group');

    // Create clusters group
    const clustersGroup = g.append('g').attr('class', 'clusters');

    // Create links group
    const linksGroup = g.append('g').attr('class', 'links');

    // Create nodes group
    const nodesGroup = g.append('g').attr('class', 'nodes');

    // Set up zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', event => {
        const { x, y, k } = event.transform;
        actions.updateViewport({
          scale: k,
          translateX: x,
          translateY: y,
        });
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initialize transform
    const initialTransform = d3.zoomIdentity
      .translate(state.viewport.translateX, state.viewport.translateY)
      .scale(state.viewport.scale);
    svg.call(zoom.transform, initialTransform);

    return { svg, g, clustersGroup, linksGroup, nodesGroup };
  }, [refs.svg, state.viewport, actions]);

  // Render clusters
  const renderClusters = useCallback(
    (clustersGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      const clusters = clustersGroup
        .selectAll<SVGCircleElement, any>('.cluster')
        .data(state.clusters, (d: any) => d.id);

      clusters.exit().remove();

      const clustersEnter = clusters
        .enter()
        .append('circle')
        .attr('class', 'cluster')
        .attr('fill', d => d.color)
        .attr('opacity', d => d.opacity)
        .attr('stroke', 'none')
        .attr('pointer-events', 'none');

      clusters
        .merge(clustersEnter)
        .transition()
        .duration(state.config.animation.duration)
        .attr('cx', d => d.center.x)
        .attr('cy', d => d.center.y)
        .attr('r', d => d.radius);
    },
    [state.clusters, state.config.animation.duration]
  );

  // Render links
  const renderLinks = useCallback(
    (linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      const links = linksGroup
        .selectAll<SVGLineElement, any>('.link')
        .data(computed.visibleLinks, (d: any) => d.id);

      links.exit().remove();

      const linksEnter = links
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke-width', d => d.style?.width || 2)
        .attr('stroke', d => d.style?.color || state.config.linkColors[d.type])
        .attr('stroke-opacity', d => d.style?.opacity || 0.7)
        .attr('stroke-dasharray', d => (d.style?.animated ? '5,5' : 'none'))
        .style('cursor', onLinkClick ? 'pointer' : 'default');

      if (onLinkClick) {
        linksEnter.on('click', (event, d) => {
          event.stopPropagation();
          onLinkClick(d);
        });
      }

      links
        .merge(linksEnter)
        .attr('x1', d => {
          const source = computed.visibleNodes.find(n => n.id === d.source);
          return source?.position?.x || 0;
        })
        .attr('y1', d => {
          const source = computed.visibleNodes.find(n => n.id === d.source);
          return source?.position?.y || 0;
        })
        .attr('x2', d => {
          const target = computed.visibleNodes.find(n => n.id === d.target);
          return target?.position?.x || 0;
        })
        .attr('y2', d => {
          const target = computed.visibleNodes.find(n => n.id === d.target);
          return target?.position?.y || 0;
        });
    },
    [
      computed.visibleLinks,
      computed.visibleNodes,
      state.config.linkColors,
      onLinkClick,
    ]
  );

  // Render nodes
  const renderNodes = useCallback(
    (nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      const nodes = nodesGroup
        .selectAll<SVGGElement, any>('.node')
        .data(computed.visibleNodes, (d: any) => d.id);

      nodes.exit().remove();

      const nodesEnter = nodes
        .enter()
        .append('g')
        .attr('class', 'node')
        .style('cursor', 'pointer')
        .call(
          d3
            .drag<SVGGElement, MindMapNode>()
            .on('start', (event, d) => {
              if (!event.active && refs.simulation.current) {
                refs.simulation.current.alphaTarget(0.3).restart();
              }
              (d as any).fx = d.position?.x;
              (d as any).fy = d.position?.y;
            })
            .on('drag', (event, d) => {
              (d as any).fx = event.x;
              (d as any).fy = event.y;
              actions.updateNode(d.id, {
                position: { x: event.x, y: event.y },
              });
            })
            .on('end', (event, d) => {
              if (!event.active && refs.simulation.current) {
                refs.simulation.current.alphaTarget(0);
              }
              (d as any).fx = null;
              (d as any).fy = null;
            })
        );

      // Add circle for node
      nodesEnter
        .append('circle')
        .attr('class', 'node-circle')
        .attr('r', d => d.style?.size || 20)
        .attr('fill', d => d.style?.color || state.config.nodeColors[d.type])
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

      // Add text label
      nodesEnter
        .append('text')
        .attr('class', 'node-label')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#fff')
        .style('pointer-events', 'none')
        .text(d =>
          d.label.length > 10 ? d.label.substring(0, 10) + '...' : d.label
        );

      // Add expansion indicator for nodes with children
      nodesEnter
        .append('circle')
        .attr('class', 'expansion-indicator')
        .attr('r', 4)
        .attr('cx', 15)
        .attr('cy', -15)
        .attr('fill', '#fff')
        .attr('stroke', d => d.style?.color || state.config.nodeColors[d.type])
        .attr('stroke-width', 2)
        .style('display', d =>
          d.children && d.children.length > 0 ? 'block' : 'none'
        );

      // Event handlers
      const nodeGroups = nodes.merge(nodesEnter);

      nodeGroups
        .on('click', (event, d) => {
          event.stopPropagation();
          if (event.detail === 1) {
            // Single click
            actions.selectNodes([d.id]);
            onNodeClick?.(d);
          }
        })
        .on('dblclick', (event, d) => {
          event.stopPropagation();
          onNodeDoubleClick?.(d);
          actions.toggleNodeExpansion(d.id);
        })
        .on('mouseenter', (event, d) => {
          actions.setHoveredNode(d.id);
        })
        .on('mouseleave', () => {
          actions.setHoveredNode(undefined);
        });

      // Update positions
      nodeGroups
        .transition()
        .duration(100)
        .attr(
          'transform',
          d => `translate(${d.position?.x || 0}, ${d.position?.y || 0})`
        );

      // Update selection highlighting
      nodeGroups
        .select('.node-circle')
        .attr('stroke-width', d =>
          state.selectedNodes.includes(d.id)
            ? 4
            : state.hoveredNode === d.id
              ? 3
              : 2
        )
        .attr('stroke', d =>
          state.selectedNodes.includes(d.id)
            ? '#fbbf24'
            : state.hoveredNode === d.id
              ? '#60a5fa'
              : '#fff'
        );
    },
    [
      computed.visibleNodes,
      state.config.nodeColors,
      state.selectedNodes,
      state.hoveredNode,
      actions,
      refs.simulation,
      onNodeClick,
      onNodeDoubleClick,
    ]
  );

  // Main render effect
  useEffect(() => {
    const result = initializeVisualization();
    if (!result) return;

    const { clustersGroup, linksGroup, nodesGroup } = result;

    renderClusters(clustersGroup);
    renderLinks(linksGroup);
    renderNodes(nodesGroup);
  }, [initializeVisualization, renderClusters, renderLinks, renderNodes]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (refs.svg.current && zoomBehaviorRef.current) {
      d3.select(refs.svg.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1.5);
    }
  }, [refs.svg]);

  const handleZoomOut = useCallback(() => {
    if (refs.svg.current && zoomBehaviorRef.current) {
      d3.select(refs.svg.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 0.67);
    }
  }, [refs.svg]);

  const handleResetView = useCallback(() => {
    if (refs.svg.current && zoomBehaviorRef.current) {
      d3.select(refs.svg.current)
        .transition()
        .duration(500)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
      actions.resetView();
    }
  }, [refs.svg, actions]);

  // Node type filter options
  const nodeTypeOptions = useMemo(
    () => [
      { value: 'topic', label: 'Topics', color: state.config.nodeColors.topic },
      {
        value: 'subtopic',
        label: 'Subtopics',
        color: state.config.nodeColors.subtopic,
      },
      {
        value: 'research',
        label: 'Research',
        color: state.config.nodeColors.research,
      },
      {
        value: 'expert',
        label: 'Experts',
        color: state.config.nodeColors.expert,
      },
      {
        value: 'concept',
        label: 'Concepts',
        color: state.config.nodeColors.concept,
      },
    ],
    [state.config.nodeColors]
  );

  return (
    <div
      className={`mind-map-container relative ${className}`}
      ref={containerRef}
    >
      {/* Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-4 top-4 z-10 flex flex-wrap gap-2"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                type="text"
                placeholder="Search nodes..."
                value={state.searchQuery}
                onChange={e => actions.setSearchQuery(e.target.value)}
                className="w-64 pl-10"
              />
            </div>

            {/* Zoom Controls */}
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetView}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter */}
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>

            {/* Export/Import */}
            <div className="flex gap-1">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node type legend */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 top-4 z-10"
          >
            <Card className="p-3">
              <h3 className="mb-2 text-sm font-semibold">Node Types</h3>
              <div className="space-y-1">
                {nodeTypeOptions.map(option => (
                  <div
                    key={option.value}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                    <span>{option.label}</span>
                    <span className="text-gray-400">
                      (
                      {
                        computed.visibleNodes.filter(
                          n => n.type === option.value
                        ).length
                      }
                      )
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main SVG */}
      <svg
        ref={refs.svg}
        width={width}
        height={height}
        className="rounded-lg border bg-white"
        style={{ userSelect: 'none' }}
      />

      {/* Minimap */}
      <AnimatePresence>
        {showMinimap && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-4 right-4 z-10"
          >
            <Card className="p-2">
              <svg
                width={120}
                height={80}
                className="rounded border bg-gray-50"
              >
                {/* Minimap implementation */}
                <rect
                  x={0}
                  y={0}
                  width={120}
                  height={80}
                  fill="none"
                  stroke="#e5e7eb"
                />
                {/* Viewport indicator */}
                <rect
                  x={5}
                  y={5}
                  width={110 / state.viewport.scale}
                  height={70 / state.viewport.scale}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#3b82f6"
                  strokeWidth="1"
                />
              </svg>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {state.isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-white bg-opacity-75"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
