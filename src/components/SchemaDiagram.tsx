"use client";

import React, { useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { GlassCard } from "@liquefy-ui/react";

// Custom Node for Tables
const TableNode = ({ data }: any) => {
  return (
    <GlassCard style={{
      minWidth: '220px',
      padding: 0,
      overflow: 'hidden',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#888', width: '8px', height: '8px' }} />
      <div style={{
        background: 'var(--primary-color)',
        color: '#fff',
        padding: '10px 14px',
        fontWeight: 800,
        textAlign: 'center',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '14px'
      }}>
        {data.name}
      </div>
      <div style={{ padding: '8px 0', background: 'var(--bg-card)' }}>
        {data.fields.map((field: any) => (
          <div key={field.name} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 14px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '12px'
          }}>
            <span style={{ 
              fontWeight: field.isId ? 800 : 500, 
              display: 'flex', 
              gap: '6px', 
              alignItems: 'center',
              color: 'var(--text-primary)'
            }}>
              {field.isId && <span title="Primary Key">🔑</span>}
              {field.kind === 'object' && <span title="Relation" style={{color: 'var(--primary-color)'}}>🔗</span>}
              {field.name}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>
              {field.type}{field.isList ? '[]' : ''}{!field.isRequired ? '?' : ''}
            </span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#888', width: '8px', height: '8px' }} />
    </GlassCard>
  );
};

const nodeTypes = {
  table: TableNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, marginx: 50, marginy: 50, nodesep: 100, ranksep: 200 });

  nodes.forEach((node) => {
    // Estimate width and height
    dagreGraph.setNode(node.id, { width: 250, height: 50 + node.data.fields.length * 30 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - (25 + node.data.fields.length * 15),
      },
    };
  });

  return { nodes: newNodes, edges };
};

export default function SchemaDiagram({ models }: { models: any[] }) {
  const initialNodes = useMemo(() => {
    return models.map((model) => ({
      id: model.name,
      type: 'table',
      data: { name: model.name, fields: model.fields },
      position: { x: 0, y: 0 },
    }));
  }, [models]);

  const initialEdges = useMemo(() => {
    const edges: any[] = [];
    models.forEach((model) => {
      model.fields.forEach((field: any) => {
        // Only draw edge if it's a relation and it's the side that holds the scalar (to avoid duplicates)
        // Usually, the field with relationName and kind='object' and not a list is the foreign key holder
        if (field.kind === 'object' && !field.isList) {
          edges.push({
            id: `e-${model.name}-${field.type}-${field.name}`,
            source: model.name,
            target: field.type,
            label: field.name,
            animated: true,
            style: { stroke: 'var(--primary-color)', strokeWidth: 2 },
            labelStyle: { fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: 'var(--bg-card)' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'var(--primary-color)',
            },
          });
        }
      });
    });
    return edges;
  }, [models]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges, 'LR'),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 180px)', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        colorMode="system" // Adapts automatically to system/context if using ReactFlow 11+ but we'll style explicitly
      >
        <MiniMap 
          nodeColor={(n) => 'var(--primary-color)'}
          maskColor="rgba(0, 0, 0, 0.4)"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        />
        <Controls />
        <Background color="var(--text-light)" gap={20} size={1.5} />
      </ReactFlow>
    </div>
  );
}
