import { MarkerType } from "@xyflow/react";

export default function convertToVisibleGraph({ verteces }) {
    let nodes = [];
    let displayEdges = [];

    verteces.forEach(({ block, data }) => {
        nodes.push({
            block,
            type: "block",
            position: { x: 0, y: 0 },
            id: `${block.id}`,
            data: { block, label: `use: ${[...data.use]} def: ${[...data.def]} in: ${[...data.inSet]} out: ${[...data.outSet]}` }
        });
    });

    for (let v of verteces) {
        v.block.targets.forEach(t => {
            displayEdges.push(newEdge({ id: v.block.id, target: t }));
        });
    }

    return [nodes, displayEdges];
}

// TODO: fix self recursive edges
function newEdge({ id, target }) {
    return {
        id: `${id}-${target}`,
        source: `${id}`,
        target: `${target}`,
        type: 'default',
        markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#FF0072',
        },
        style: {
            strokeWidth: 2,
            stroke: '#FF0072',
        },
    }
}