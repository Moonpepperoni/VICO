import { MarkerType } from "@xyflow/react";

export default function convertToVisibleGraph({ verteces }) {
    let nodes = [];
    let displayEdges = [];
    let idCounter = 0;

    verteces.forEach(({ block, data }) => {
        nodes.push({
            block,
            type: "block",
            position: { x: idCounter * 15, y: idCounter * 100 },
            id: `${block.id}`,
            data: { block, label: `use: ${[...data.use]} def: ${[...data.def]} in: ${[...data.inSet]} out: ${[...data.outSet]}` }
        });
        idCounter++;
    });

    for (let v of verteces) {
        v.block.targets.forEach(t => {
            displayEdges.push(newEdge({ id: v.block.id, target: t }));
        });
    }

    return [nodes, displayEdges];
}

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
        sourceHandle: 'next',
        targetHandle: 'prev'
    }
}