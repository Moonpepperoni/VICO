import './App.css';
import FileForm from './FileForm';
import { useState, useCallback, useRef, useEffect } from "react";
import { enableMapSet } from 'immer';
import tokeniseRegex from './TacTokens';
import parseTac from './TacParser';
import Flow from './Flow';
import { applyNodeChanges } from '@xyflow/react';
import FlowAnalyser from './flow-analysis';
import convertToVisibleGraph from './FlowGraph';
import { SingleInstructionBlock } from './block';
import toBasicBlocks from './basic-blocks';
import { getLayoutedElements } from './alt_layout';

enableMapSet();

function App() {
    const [blocks, setBlocks] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [algStateIndex, setAlgStateIndex] = useState(null);
    const analyser = useRef(null);
    const algStates = useRef(null);


    useEffect(() => {
        if (!algStates.current) {
            return;
        }
        let states = algStates.current[algStateIndex];
        let [newNodes, newEdges] = convertToVisibleGraph({ verteces: states.verteces });
        setNodes(oldNodes => {
            let cache = new Map();
            oldNodes.forEach(node => {
                cache[node.id] = node;
            });
            return newNodes.map(nnode => {
                let old = cache[nnode.id];
                if (!old) {
                    return nnode;
                }
                return ({
                    ...nnode,
                    position: old.position,
                });
            });
        });
        setEdges(newEdges);
    }, [algStates, algStateIndex]);


    const readBlocks = (fileData) => {
        setBlocks(parseTac(tokeniseRegex(fileData)).map(SingleInstructionBlock.fromInstruction));
    }

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );

    const doAnalysis = () => {
        if (!blocks) {
            return;
        }
        analyser.current = new FlowAnalyser();
        let states = analyser.current.do(blocks);
        algStates.current = states;
        setAlgStateIndex(0);
    };

    const onStepForward = () => {
        let newIndex = algStateIndex + 1;
        if (newIndex >= algStates.current.length) {
            console.log("no more stuff");
            return;
        }
        setAlgStateIndex(newIndex);
    };

    const onStepBackward = () => {
        let newIndex = algStateIndex - 1;
        if (newIndex < 0) {
            console.log("cant go back beyond start");
            return;
        }
        setAlgStateIndex(newIndex);
    };

    const convertToBasicBlocks = () => {
        setBlocks(toBasicBlocks(blocks));
        setAlgStateIndex(null);
        algStates.current = null;
        setEdges([]);
        setNodes([]);
    }

    const onLayoutPressed = () => {
        getLayoutedElements(nodes, edges, setNodes, setEdges);
    }

    return (
        <div style={{ height: '100vh', width: '100vw', display: "flex", flexDirection: 'row' }}>
            <div style={{ flex: "1 0 0", display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '20%' }}>
                    <FileForm onRead={readBlocks} />
                </div>
                <button onClick={convertToBasicBlocks}>Convert to Basic Blocks</button>
                <button onClick={doAnalysis}>Start analysis</button>
                <button onClick={onStepForward}>Step forward</button>
                <button onClick={onStepBackward}>Step backward</button>
                <button onClick={onLayoutPressed}>Layout</button>
            </div>
            <div style={{ width: "70%", flex: "2 0 0" }}>
                <Flow nodes={nodes} edges={edges} onNodesChange={onNodesChange}></Flow>
            </div>

        </div>
    )
}

export default App
