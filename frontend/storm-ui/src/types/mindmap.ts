export interface MindMapNode {
  id: string;
  label: string;
  type: 'topic' | 'subtopic' | 'research' | 'expert' | 'concept';
  level: number;
  parentId?: string;
  children?: string[];
  data?: {
    content?: string;
    citations?: string[];
    confidence?: number;
    timestamp?: string;
    author?: string;
    category?: string;
    tags?: string[];
  };
  style?: {
    color?: string;
    size?: number;
    expanded?: boolean;
    highlighted?: boolean;
  };
  position?: {
    x: number;
    y: number;
  };
}

export interface MindMapLink {
  id: string;
  source: string;
  target: string;
  type: 'hierarchy' | 'reference' | 'similarity' | 'contradiction';
  strength: number;
  label?: string;
  style?: {
    color?: string;
    width?: number;
    opacity?: number;
    animated?: boolean;
  };
}

export interface MindMapCluster {
  id: string;
  label: string;
  nodeIds: string[];
  center: { x: number; y: number };
  radius: number;
  color: string;
  opacity: number;
}

export interface MindMapViewport {
  scale: number;
  translateX: number;
  translateY: number;
  width: number;
  height: number;
}

export interface MindMapConfig {
  forceStrength: number;
  linkDistance: number;
  collideRadius: number;
  centerForce: number;
  alphaDecay: number;
  nodeColors: Record<MindMapNode['type'], string>;
  linkColors: Record<MindMapLink['type'], string>;
  animation: {
    duration: number;
    easing: string;
  };
  clustering: {
    enabled: boolean;
    algorithm: 'kmeans' | 'hierarchical' | 'dbscan';
    minClusterSize: number;
  };
}

export interface MindMapState {
  nodes: MindMapNode[];
  links: MindMapLink[];
  clusters: MindMapCluster[];
  viewport: MindMapViewport;
  config: MindMapConfig;
  selectedNodes: string[];
  hoveredNode?: string;
  searchQuery: string;
  filteredTypes: MindMapNode['type'][];
  isLoading: boolean;
  lastUpdate: string;
}

export interface MindMapActions {
  addNode: (node: Omit<MindMapNode, 'id'>) => void;
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  removeNode: (id: string) => void;
  addLink: (link: Omit<MindMapLink, 'id'>) => void;
  removeLink: (id: string) => void;
  toggleNodeExpansion: (id: string) => void;
  selectNodes: (ids: string[]) => void;
  setHoveredNode: (id?: string) => void;
  updateViewport: (viewport: Partial<MindMapViewport>) => void;
  setSearchQuery: (query: string) => void;
  setFilteredTypes: (types: MindMapNode['type'][]) => void;
  resetView: () => void;
  exportData: () => { nodes: MindMapNode[]; links: MindMapLink[] };
  importData: (data: { nodes: MindMapNode[]; links: MindMapLink[] }) => void;
}
