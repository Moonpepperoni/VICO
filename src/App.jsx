import './App.css';
import FileForm from './FileForm';
import { useState, useCallback, useRef } from "react";
import tokeniseRegex from './TacTokens';
import parseTac from './TacParser';
import Flow from './Flow';
import CFG from './cfg';
import { applyNodeChanges } from '@xyflow/react';
import FlowAnalyser from './flow-analysis';
import convertToVisibleGraph from './FlowGraph';

function App() {
    const [tac, setTac] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [algStates, setAlgStates] = useState([]);
    const [algStateIndex, setAlgStateIndex] = useState(null);
    const analyser = useRef(new FlowAnalyser());

    const readTac = (fileData) => {
        setTac(parseTac(tokeniseRegex(fileData)));
    }

    if (tac && nodes.length == 0) {
        let states = analyser.current.do(tac);
        setAlgStates(states);
        setAlgStateIndex(0);
        let [nodes, edges] = convertToVisibleGraph({ verteces: states[0].verteces, edges: states[0].edges });
        setNodes(nodes);
        setEdges(edges);
    }

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );

    const onStepClick = () => {
        let newIndex = algStateIndex + 1;
        setAlgStateIndex(newIndex);
        let [nodes, edges] = convertToVisibleGraph({ verteces: algStates[newIndex].verteces, edges: algStates[newIndex].edges });
        setNodes(nodes);
        setEdges(edges);
    }

    return (
        <div style={{ height: '100vh', width: '100vw', display: "flex", flexDirection: 'row' }}>
            <div style={{ flex: "1 0 0", display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '20%' }}>
                    <FileForm onRead={readTac} />
                </div>
                <button onClick={onStepClick}>Step</button>
                {tac?.map(quadruple => <p style={{ textAlign: "left" }}><it>{quadruple.label}</it> | {quadruple.toString()}</p>)}
            </div>
            <div style={{ width: "70%", flex: "2 0 0" }}>
                <Flow nodes={nodes} edges={edges} onNodesChange={onNodesChange}></Flow>
            </div>

        </div>
    )
}

export default App
