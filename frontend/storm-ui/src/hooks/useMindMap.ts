import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  MindMapNode,
  MindMapLink,
  MindMapState,
  MindMapConfig,
  MindMapViewport,
  MindMapCluster,
} from '../types/mindmap';

const defaultConfig: MindMapConfig = {
  forceStrength: -300,
  linkDistance: 100,
  collideRadius: 30,
  centerForce: 0.1,
  alphaDecay: 0.02,
  nodeColors: {
    topic: '#3b82f6',
    subtopic: '#06b6d4',
    research: '#10b981',
    expert: '#f59e0b',
    concept: '#8b5cf6',
  },
  linkColors: {
    hierarchy: '#6b7280',
    reference: '#10b981',
    similarity: '#3b82f6',
    contradiction: '#ef4444',
  },
  animation: {
    duration: 500,
    easing: 'ease-in-out',
  },
  clustering: {
    enabled: true,
    algorithm: 'kmeans',
    minClusterSize: 3,
  },
};

const defaultViewport: MindMapViewport = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  width: 800,
  height: 600,
};

export const useMindMap = (
  initialNodes: MindMapNode[] = [],
  initialLinks: MindMapLink[] = []
) => {
  const [state, setState] = useState<MindMapState>({
    nodes: initialNodes,
    links: initialLinks,
    clusters: [],
    viewport: defaultViewport,
    config: defaultConfig,
    selectedNodes: [],
    hoveredNode: undefined,
    searchQuery: '',
    filteredTypes: [],
    isLoading: false,
    lastUpdate: new Date().toISOString(),
  });

  const simulationRef = useRef<d3.Simulation<
    MindMapNode & d3.SimulationNodeDatum,
    MindMapLink
  > | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Initialize D3 simulation
  const initializeSimulation = useCallback(() => {
    if (!simulationRef.current) {
      simulationRef.current = d3
        .forceSimulation<MindMapNode & d3.SimulationNodeDatum>(
          state.nodes as (MindMapNode & d3.SimulationNodeDatum)[]
        )
        .force(
          'link',
          d3
            .forceLink<MindMapNode & d3.SimulationNodeDatum, MindMapLink>(
              state.links
            )
            .id(d => d.id)
            .distance(state.config.linkDistance)
        )
        .force(
          'charge',
          d3.forceManyBody().strength(state.config.forceStrength)
        )
        .force(
          'center',
          d3.forceCenter(state.viewport.width / 2, state.viewport.height / 2)
        )
        .force(
          'collision',
          d3.forceCollide().radius(state.config.collideRadius)
        )
        .alphaDecay(state.config.alphaDecay);
    }

    // Update simulation on state change
    simulationRef.current
      .nodes(state.nodes as (MindMapNode & d3.SimulationNodeDatum)[])
      .force(
        'link',
        d3
          .forceLink<MindMapNode & d3.SimulationNodeDatum, MindMapLink>(
            state.links
          )
          .id(d => d.id)
          .distance(state.config.linkDistance)
      );

    simulationRef.current.restart();
  }, [state.nodes, state.links, state.config, state.viewport]);

  // Clustering algorithms
  const performClustering = useCallback(
    (nodes: MindMapNode[]): void => {
      if (
        !state.config.clustering.enabled ||
        nodes.length < state.config.clustering.minClusterSize
      ) {
        setState(prev => ({ ...prev, clusters: [] }));
        return;
      }

      // Simple k-means clustering based on position and type
      const clusters: MindMapCluster[] = [];
      const k = Math.min(
        5,
        Math.floor(nodes.length / state.config.clustering.minClusterSize)
      );

      // Group nodes by type first
      const typeGroups = nodes.reduce(
        (acc, node) => {
          if (!acc[node.type]) acc[node.type] = [];
          acc[node.type].push(node);
          return acc;
        },
        {} as Record<string, MindMapNode[]>
      );

      let clusterId = 0;
      for (const [type, typeNodes] of Object.entries(typeGroups)) {
        if (typeNodes.length >= state.config.clustering.minClusterSize) {
          const centroid = typeNodes.reduce(
            (acc, node) => ({
              x: acc.x + (node.position?.x || 0),
              y: acc.y + (node.position?.y || 0),
            }),
            { x: 0, y: 0 }
          );

          centroid.x /= typeNodes.length;
          centroid.y /= typeNodes.length;

          clusters.push({
            id: `cluster-${clusterId++}`,
            label: `${type.charAt(0).toUpperCase() + type.slice(1)} Group`,
            nodeIds: typeNodes.map(n => n.id),
            center: centroid,
            radius: Math.sqrt(typeNodes.length) * 20,
            color:
              state.config.nodeColors[
                type as keyof typeof state.config.nodeColors
              ] || '#6b7280',
            opacity: 0.1,
          });
        }
      }

      setState(prev => ({ ...prev, clusters }));
    },
    [state.config]
  );

  // Node actions
  const addNode = useCallback(
    (node: Omit<MindMapNode, 'id'>) => {
      const newNode: MindMapNode = {
        ...node,
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        position: { x: state.viewport.width / 2, y: state.viewport.height / 2 },
      };

      setState(prev => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
        lastUpdate: new Date().toISOString(),
      }));
    },
    [state.viewport]
  );

  const updateNode = useCallback(
    (id: string, updates: Partial<MindMapNode>) => {
      setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(node =>
          node.id === id ? { ...node, ...updates } : node
        ),
        lastUpdate: new Date().toISOString(),
      }));
    },
    []
  );

  const removeNode = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== id),
      links: prev.links.filter(
        link => link.source !== id && link.target !== id
      ),
      selectedNodes: prev.selectedNodes.filter(nodeId => nodeId !== id),
      lastUpdate: new Date().toISOString(),
    }));
  }, []);

  const addLink = useCallback((link: Omit<MindMapLink, 'id'>) => {
    const newLink: MindMapLink = {
      ...link,
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setState(prev => ({
      ...prev,
      links: [...prev.links, newLink],
      lastUpdate: new Date().toISOString(),
    }));
  }, []);

  const removeLink = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      links: prev.links.filter(link => link.id !== id),
      lastUpdate: new Date().toISOString(),
    }));
  }, []);

  const toggleNodeExpansion = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === id
          ? {
              ...node,
              style: { ...node.style, expanded: !node.style?.expanded },
            }
          : node
      ),
      lastUpdate: new Date().toISOString(),
    }));
  }, []);

  const selectNodes = useCallback((ids: string[]) => {
    setState(prev => ({ ...prev, selectedNodes: ids }));
  }, []);

  const setHoveredNode = useCallback((id?: string) => {
    setState(prev => ({ ...prev, hoveredNode: id }));
  }, []);

  const updateViewport = useCallback((viewport: Partial<MindMapViewport>) => {
    setState(prev => ({
      ...prev,
      viewport: { ...prev.viewport, ...viewport },
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setFilteredTypes = useCallback((types: MindMapNode['type'][]) => {
    setState(prev => ({ ...prev, filteredTypes: types }));
  }, []);

  const resetView = useCallback(() => {
    setState(prev => ({
      ...prev,
      viewport: defaultViewport,
      selectedNodes: [],
      hoveredNode: undefined,
      searchQuery: '',
      filteredTypes: [],
    }));

    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  }, []);

  const exportData = useCallback(() => {
    return { nodes: state.nodes, links: state.links };
  }, [state.nodes, state.links]);

  const importData = useCallback(
    (data: { nodes: MindMapNode[]; links: MindMapLink[] }) => {
      setState(prev => ({
        ...prev,
        nodes: data.nodes,
        links: data.links,
        lastUpdate: new Date().toISOString(),
      }));
    },
    []
  );

  // Filter visible nodes based on search and type filters
  const visibleNodes = useCallback(() => {
    return state.nodes.filter(node => {
      const matchesSearch =
        !state.searchQuery ||
        node.label.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        node.data?.content
          ?.toLowerCase()
          .includes(state.searchQuery.toLowerCase());

      const matchesTypeFilter =
        state.filteredTypes.length === 0 ||
        state.filteredTypes.includes(node.type);

      return matchesSearch && matchesTypeFilter;
    });
  }, [state.nodes, state.searchQuery, state.filteredTypes]);

  // Initialize simulation on mount
  useEffect(() => {
    initializeSimulation();
    return () => {
      simulationRef.current?.stop();
    };
  }, [initializeSimulation]);

  // Update clustering when nodes change
  useEffect(() => {
    if (state.nodes.length > 0) {
      performClustering(state.nodes);
    }
  }, [state.nodes, performClustering]);

  return {
    state,
    actions: {
      addNode,
      updateNode,
      removeNode,
      addLink,
      removeLink,
      toggleNodeExpansion,
      selectNodes,
      setHoveredNode,
      updateViewport,
      setSearchQuery,
      setFilteredTypes,
      resetView,
      exportData,
      importData,
    },
    computed: {
      visibleNodes: visibleNodes(),
      visibleLinks: state.links.filter(
        link =>
          visibleNodes().some(n => n.id === link.source) &&
          visibleNodes().some(n => n.id === link.target)
      ),
    },
    refs: {
      simulation: simulationRef,
      svg: svgRef,
    },
  };
};
