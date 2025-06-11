import './App.css';
import FileForm from './FileForm';
import { useState, useCallback, useRef } from "react";
import { enableMapSet } from 'immer';
import tokeniseRegex from './TacTokens';
import parseTac from './TacParser';
import Flow from './Flow';
import CFG from './cfg';
import { applyNodeChanges } from '@xyflow/react';
import FlowAnalyser from './flow-analysis';
import convertToVisibleGraph from './FlowGraph';
import { SingleInstructionBlock } from './block';

enableMapSet();

function App() {
    const [blocks, setBlocks] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [algStates, setAlgStates] = useState([]);
    const [algStateIndex, setAlgStateIndex] = useState(null);
    const analyser = useRef(new FlowAnalyser());

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
        let states = analyser.current.do(blocks);
        setAlgStates(states);
        setAlgStateIndex(0);
        let [nodes, edges] = convertToVisibleGraph({ verteces: states[0].verteces });
        setNodes(nodes);
        setEdges(edges);
    }

    const onStepForward = () => {
        let newIndex = algStateIndex + 1;
        if (newIndex >= algStates.length) {
            console.log("no more stuff");
            return;
        }
        setAlgStateIndex(newIndex);
        let [nodes, edges] = convertToVisibleGraph({ verteces: algStates[newIndex].verteces, edges: algStates[newIndex].edges });
        setNodes(nodes);
        setEdges(edges);
    }

    const onStepBackward = () => {
        let newIndex = algStateIndex - 1;
        if (newIndex < 0) return;
        setAlgStateIndex(newIndex);
        let [nodes, edges] = convertToVisibleGraph({ verteces: algStates[newIndex].verteces, edges: algStates[newIndex].edges });
        setNodes(nodes);
        setEdges(edges);
    }

    return (
        <div style={{ height: '100vh', width: '100vw', display: "flex", flexDirection: 'row' }}>
            <div style={{ flex: "1 0 0", display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '20%' }}>
                    <FileForm onRead={readBlocks} />
                </div>
                <button onClick={doAnalysis}>Start analysis</button>
                <button onClick={onStepForward}>Step forward</button>
                <button onClick={onStepBackward}>Step backward</button>
            </div>
            <div style={{ width: "70%", flex: "2 0 0" }}>
                <Flow nodes={nodes} edges={edges} onNodesChange={onNodesChange}></Flow>
            </div>

        </div>
    )
}

export default App
