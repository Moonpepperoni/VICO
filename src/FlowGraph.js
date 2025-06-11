import { MarkerType } from "@xyflow/react";

export default function convertToVisibleGraph({ verteces, edges }) {
    let nodes = [];
    let displayEdges = [];
    let idCounter = 0;

    verteces.forEach(({ instruction, data }) => {
        nodes.push({
            instruction,
            type: "instruction",
            position: { x: idCounter * 15, y: idCounter * 100 },
            id: `${instruction.id}`,
            data: { instruction: instruction, label: `use: ${[...data.use]} def: ${[...data.def]} in: ${[...data.inSet]} out: ${[...data.outSet]}` }
        });
        idCounter++;
    });

    edges.forEach(({ src, end }) => {
        displayEdges.push(newEdge({ id: src, target: end }))
    })

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