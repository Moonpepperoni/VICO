import ELK from 'elkjs/lib/elk.bundled.js';
import { MarkerType } from '@xyflow/react';
const elk = new ELK();


export const getLayoutedElements = (nodes, edges, setNodes, setEdges) => {
    const layoutOptions = {
        'algorithm': "layered",
        "elk.direction": "DOWN",
        "elk.edgeRouting": "POLYLINE",
        "elk.layered.considerModelOrder.strategy": "PREFER_NODES"
    }
    const nodeIds = nodes.map(n => n.id);
    const graph = {
        id: 'root',
        layoutOptions: layoutOptions,
        children: nodes.map((node) => ({
            ...node,
            width: node.measured.width,
            height: node.measured.height,
        })),
        edges: edges.filter(e => nodeIds.includes(e.target)).map(e => +e.target < +e.source ? { ...e, target: e.source, source: e.target, reverse: true } : { ...e, reverse: false }),
    };

    elk.layout(graph).then(({ children, edges: inner_edges }) => {
        // By mutating the children in-place we saves ourselves from creating a
        // needless copy of the nodes array.
        children.forEach((node) => {
            node.position = { x: node.x, y: node.y };
        });

        let new_edges = inner_edges.map(edge => {
            let section = edge?.sections?.[0];
            let points = section?.bendPoints
                ? [section.startPoint, ...section.bendPoints, section.endPoint]
                : [section?.startPoint, section?.endPoint];
            let target = edge.reverse ? edge.source : edge.target;
            let source = edge.reverse ? edge.target : edge.source;
            if (edge.reverse) {
                points.reverse();
            }
            return {
                ...edge,
                target,
                source,
                type: 'elk',
                data: { points },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                    color: '#FF0072',
                },
            };
        });

        setNodes(children);
        setEdges(new_edges);
    });
}