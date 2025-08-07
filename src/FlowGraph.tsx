import {
    Background,
    Controls,
    type Edge,
    MiniMap,
    type Node,
    type OnNodesChange,
    ReactFlow
} from "@xyflow/react";
import React from "react";
import '@xyflow/react/dist/style.css';
import FlowNode from "./FlowNode.tsx";
import FlowEdge from "./FlowEdgeData.tsx";

// CARE!: the onNodesChange is never used but is required to put ReactFlow in controlledFlow mode, which is needed
// so that we can access the measured attributes on nodes
interface FlowGraphProps {
    nodes : Array<Node>,
    edges : Array<Edge>,
    onNodesChange : OnNodesChange,
}

const nodeTypes = {
    flow: FlowNode,
};

const edgeTypes = {
    flow: FlowEdge,
};

export const FlowGraph:React.FC<FlowGraphProps> = ({nodes, edges, onNodesChange}) => {
    return <>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} nodesDraggable={false} fitView minZoom={0.4} maxZoom={3}>
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable={true}></MiniMap>
        </ReactFlow>
    </>
};