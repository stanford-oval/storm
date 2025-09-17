# Visualization Components

This directory contains interactive data visualization components built with D3.js and React.

## Components

### MindMap

An interactive D3.js-based mind map visualization for Co-STORM knowledge spaces.

**Features:**

- Force-directed graph layout
- Interactive node expansion/collapse
- Real-time updates during discourse
- Zoom, pan, and search functionality
- Node clustering and filtering
- Customizable themes and styling

**Usage:**

```tsx
import { MindMap } from '@/components/visualization/MindMap';
import { MindMapNode, MindMapLink } from '@/types/mindmap';

const nodes: MindMapNode[] = [
  {
    id: '1',
    label: 'Main Topic',
    type: 'topic',
    level: 0,
    data: { content: 'This is the main topic' },
  },
  // ... more nodes
];

const links: MindMapLink[] = [
  {
    id: 'link1',
    source: '1',
    target: '2',
    type: 'hierarchy',
    strength: 1,
  },
  // ... more links
];

function MyComponent() {
  const handleNodeClick = (node: MindMapNode) => {
    console.log('Node clicked:', node);
  };

  return (
    <MindMap
      initialNodes={nodes}
      initialLinks={links}
      width={800}
      height={600}
      onNodeClick={handleNodeClick}
      showControls={true}
      showMinimap={true}
    />
  );
}
```

**Props:**

- `initialNodes`: Array of mind map nodes
- `initialLinks`: Array of links between nodes
- `width/height`: Dimensions of the visualization
- `onNodeClick/onNodeDoubleClick`: Node interaction handlers
- `onLinkClick`: Link interaction handler
- `editable`: Whether the mind map can be edited
- `showControls`: Show/hide control panel
- `showMinimap`: Show/hide minimap

**Node Types:**

- `topic`: Main topics (blue)
- `subtopic`: Subtopics (cyan)
- `research`: Research findings (green)
- `expert`: Expert perspectives (orange)
- `concept`: Abstract concepts (purple)

**Link Types:**

- `hierarchy`: Parent-child relationships
- `reference`: Citations and references
- `similarity`: Similar concepts
- `contradiction`: Conflicting information

## Hooks

### useMindMap

Manages mind map state and D3.js simulation.

```tsx
const { state, actions, computed, refs } = useMindMap(
  initialNodes,
  initialLinks
);

// Add a new node
actions.addNode({
  label: 'New Node',
  type: 'concept',
  level: 1,
  data: { content: 'Node content' },
});

// Update node
actions.updateNode('node-id', { label: 'Updated Label' });

// Get filtered nodes
const visibleNodes = computed.visibleNodes;
```

## Types

See `src/types/mindmap.ts` for comprehensive type definitions including:

- `MindMapNode`: Node structure and properties
- `MindMapLink`: Link structure and properties
- `MindMapState`: Complete state interface
- `MindMapConfig`: Configuration options

## Customization

The mind map supports extensive customization through the config object:

```tsx
const customConfig = {
  nodeColors: {
    topic: '#ff6b6b',
    subtopic: '#4ecdc4',
    // ... other colors
  },
  forceStrength: -500,
  linkDistance: 150,
  clustering: {
    enabled: true,
    algorithm: 'kmeans',
  },
};
```

## Performance

- Optimized for up to 1000 nodes with good performance
- Virtual rendering for large datasets
- Efficient force simulation updates
- Clustered rendering for better performance with many nodes
