import ELK from 'elkjs/lib/elk.bundled.js';
import {type Edge, MarkerType, type Node} from '@xyflow/react';
import {type ElkExtendedEdge} from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

export const layoutElements = (nodes: Array<Node>, edges: Array<Edge> , backEdges : Set<string> ,setNodes: (nodes: Array<Node>) => void, setEdges: (edges: Array<Edge>) => void) => {
    const layoutOptions = {
        'algorithm': "layered",
        "elk.direction": "DOWN",
        "elk.edgeRouting": "POLYLINE",
        "elk.layered.considerModelOrder.strategy": "PREFER_NODES",
        "elk.spacing.nodeSelfLoop": "20.0",
    };

    const nodeIds = nodes.map(n => n.id);
    const graph = {
        id: 'root',
        layoutOptions: layoutOptions,
        children: nodes.map((node) => ({
            extNode: node,
            id: node.id,
            width: node.measured?.width ?? 0,
            height: node.measured?.height ?? 0,
        })),
        edges: edges.filter(e => nodeIds.includes(e.target)).map(e => backEdges.has(e.id) ? {
            id: e.id,
            extEdge: e,
            targets: [e.source],
            sources: [e.target],
        } : {id: e.id, extEdge: e, sources: [e.source], targets: [e.target]}),
    };

    elk.layout(graph).then(({children, edges: inner_edges}) => {
        const new_nodes = children?.map(node => {
            return {
                ...node.extNode,
                position: {
                    x: node.x ?? 0, y: node.y ?? 0,
                }
            };
        });
        const new_edges = (inner_edges as Array<ElkExtendedEdge & {extEdge: Edge }>).map(edge => {
            const section = edge?.sections?.[0];
            const points = section?.bendPoints
                ? [section.startPoint, ...section.bendPoints, section.endPoint]
                : [section?.startPoint, section?.endPoint];
            const target = backEdges.has(edge.id) ? edge.sources[0] : edge.targets[0];
            const source = backEdges.has(edge.id) ? edge.targets[0] : edge.sources[0];
            if (backEdges.has(edge.id)) {
                points.reverse();
            }
            return {
                ...edge.extEdge,
                target,
                source,
                type: 'flow',
                data: {points},
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                    color: '#FF0072',
                },
            };
        });

        setNodes(new_nodes ?? []);
        setEdges(new_edges);
    });
}