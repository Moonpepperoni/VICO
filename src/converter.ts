import type {Edge, Node} from "@xyflow/react";
import type {FlowEdgeData, FlowNodeData, FlowState} from "./service/flow-service.ts";


export default function convertToReactFlow(state: FlowState): { nodes: Array<Node>, edges: Array<Edge & {isBackEdge : boolean}> } {

    return {
        nodes: convertNodes(state.nodes),
        edges: convertEdges(state.edges),
    }
}

function convertEdges(edges: Array<FlowEdgeData>): Array<Edge & {isBackEdge : boolean}> {
    return edges.map(edge => {
        return {
            type: "flow",
            id: `${edge.src}-${edge.target}`,
            source: `${edge.src}`,
            target: `${edge.target}`,
            isBackEdge: edge.isBackEdge,
        }
    });
}


function convertNodes(nodeData: Array<FlowNodeData>): Array<Node> {
    return nodeData.map(node => {
        return {
            type: "flow",
            id: `${node.id}`,
            data: node,
            position: {x: 0, y: 0},
        }
    });
}