import { MarkerType } from "@xyflow/react";

export default class CFG {
    nodes;
    #idCounter;
    #edges;

    constructor() {
        this.nodes = [];
        this.#edges = [];
        this.#idCounter = 0;
    }

    addInstruction(instruction) {
        this.nodes.push({
            instruction,
            type: "instruction",
            position: { x: this.#idCounter * 15, y: this.#idCounter * 100 },
            id: `${this.#idCounter++}`,
            data: { label: `${instruction.label} | ${instruction.toString()}` }
        })
    }

    get edges() {
        if (this.#edges.length <= 0) {
            for (let { instruction, id } of this.nodes) {
                switch (instruction.type) {
                    case 'jmp':
                    case 'cjmp': {
                        let target = instruction.result.val;
                        if (+target <= +id) {
                            this.#edges.push(newBackEdge({ id, target }));
                        } else {
                            this.#edges.push(newEdge({ id, target }));
                        }
                        if (instruction.type === 'cjmp') {
                            let target = (+id) + 1;
                            this.#edges.push(newEdge({ id, target }));

                        }
                    }
                        break;
                    default: {
                        let target = (+id) + 1;
                        this.#edges.push(newEdge({ id, target }))
                    }


                }
            }
        }
        return this.#edges;
    }
}


function newEdge({ id, target }) {
    return {
        id: `${id}-${target}`,
        source: id,
        target: `${target}`,
        type: 'bezier',
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

function newBackEdge({ id, target }) {
    return {
        id: `${id}-${target}`,
        source: id,
        target: `${target}`,
        type: 'bezier',
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
        sourceHandle: 'backout',
        targetHandle: 'backin'
    }
}