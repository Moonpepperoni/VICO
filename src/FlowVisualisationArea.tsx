import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FlowGraph} from "./FlowGraph.tsx";
import type {TacProgram} from "./tac/program.ts";
import {applyNodeChanges, type Edge, type Node, type NodeChange, ReactFlowProvider} from "@xyflow/react";
import {
    type FlowAlgorithmSelector,
    type FlowService,
    type FlowState,
    getFlowServiceInstanceFor
} from "./service/flow-service.ts";
import {Alert, Button, ButtonGroup, Card,} from "react-bootstrap";
import convertToReactFlow from "./converter.ts";
import useLayout from "./LayoutHook.tsx";
import {PreAlgoModal} from "./PreAlgoModal.tsx";

interface VisualizationAreaProps {
    program: TacProgram;
    selectedAlgorithm: FlowAlgorithmSelector["kind"];
    onEndRequest: () => void;
}

type ExecutionState = {
    phase: "prerunning", explanationText: string,
} | {
    phase: "running", serviceValue: FlowState | undefined, hasNext: boolean, hasPrevious: boolean,
};

const startState: ExecutionState = {
    phase: "prerunning", explanationText: "Hier wird eine Erklärung angezeigt"
};

export const FlowVisualisationArea: React.FC<VisualizationAreaProps> = ({program, selectedAlgorithm, onEndRequest}) => {
    return <ReactFlowProvider>
        <DisplayArea program={program} selectedAlgorithm={selectedAlgorithm} onEndRequest={onEndRequest}/>
    </ReactFlowProvider>
};

export const DisplayArea: React.FC<VisualizationAreaProps> = ({program, selectedAlgorithm, onEndRequest}) => {

    const flowService = useRef<FlowService | undefined>(undefined);
    const [nodes, setNodes] = useState<Array<Node>>([]);
    const [edges, setEdges] = useState<Array<Edge>>([]);
    const [executionState, setExecutionState] = useState<ExecutionState>(startState);

    const {
        layoutedNodes,
        layoutedEdges
    } = useLayout({
        backEdges: new Set(
            executionState.phase === 'running'
            && executionState.serviceValue?.edges
                .filter(e => e.isBackEdge)
                .map(e => `${e.src}-${e.target}`)
            || [])
    });

    useEffect(() => {
        switch (selectedAlgorithm) {
            case 'liveness-basic-blocks':
            case 'liveness-single-instruction':
                flowService.current = getFlowServiceInstanceFor(program, {kind: selectedAlgorithm, liveOut: new Set()});
                break;
            case 'reaching-definitions-basic-blocks':
                flowService.current = getFlowServiceInstanceFor(program, {kind: selectedAlgorithm});
                break;
            default: {
                const exhaustiveCheck: never = selectedAlgorithm;
                throw new Error(`Unbekannter Algorithmus: ${exhaustiveCheck}`);
            }

        }
        setExecutionState(startState);
    }, [program, selectedAlgorithm]);

    useEffect(() => {
        if (executionState.phase === 'prerunning' || executionState.serviceValue === undefined) {
            setNodes([]);
            setEdges([]);
            return;
        }
        const {nodes, edges} = convertToReactFlow(executionState.serviceValue);
        setNodes((oldNodes) => {
            nodes.map((node) => {
                const oldNode = oldNodes.find((n) => n.id === node.id);
                if (oldNode) {
                    node.position = oldNode.position;
                }
                return node;
            })
            return nodes;
        });
        setEdges(edges);
    }, [executionState]);

    useEffect(() => {
        if (layoutedNodes.length > 0) {
            setNodes(layoutedNodes);
        }
    }, [layoutedNodes]);

    useEffect(() => {
        if (layoutedEdges.length > 0) {
            setEdges(layoutedEdges as Array<Edge>);
        }
    }, [layoutedEdges]);

    const onStart = (service : FlowService) => {
        flowService.current = service;
        service.advance();
        updateStateFromService();
    }


    // Hilfsfunktion zur Synchronisierung von Service-Zustand und React-State
    const updateStateFromService = useCallback(() => {
        if (flowService.current) {
            const hasNext = flowService.current.hasNext();
            const hasPrevious = flowService.current.hasPrevious();
            const serviceValue = flowService.current.currentValue();
            setExecutionState({phase: "running", serviceValue, hasNext, hasPrevious});
        }
    }, []);

    const advanceService = () => {
        flowService.current?.advance();
        updateStateFromService();
    }

    const advanceToEnd = () => {
        flowService.current?.advanceToEnd();
        updateStateFromService();
    }

    const goBack = () => {
        flowService.current?.previous();
        updateStateFromService();
    }

    const onNodesChange = useCallback(
        (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );


    return (<>
        <PreAlgoModal program={program} selectedAlgorithm={selectedAlgorithm} handleClose={onEndRequest}
                      show={executionState.phase === 'prerunning'} handleStart={onStart}/>
        <div
            className="flex-grow-1 position-relative"
            style={{
                transition: 'margin-left 0.3s ease'
            }}
        >
            <div className="h-100 w-100 bg-white border rounded m-2 p-4 d-flex flex-column">
                <FlowGraph nodes={nodes} edges={edges} onNodesChange={onNodesChange}/>
            </div>
        </div>
        <div
            className="bg-light border-start d-flex flex-column"
            style={{width: '320px', minWidth: '320px'}}
        >
            {/* Step Explanation Area */}
            <div className="flex-grow-1 p-3 border-bottom">
                <h5 className="text-muted mb-3">Schritt-für-Schritt Erklärung</h5>

                <Card>
                    <Card.Header className="bg-primary text-white">
                        <h6 className="mb-0">Aktueller Schritt</h6>
                    </Card.Header>
                    <Card.Body>
                        <p className="mb-0">{executionState.phase === 'prerunning' ? executionState.explanationText : executionState.serviceValue?.reason}</p>
                    </Card.Body>
                </Card>
            </div>

            {/* Control Panel */}
            <div className="p-3">
                <h6 className="text-muted mb-3">Steuerung</h6>
                {/* Playback Controls */}
                <div className="mb-3">
                    <div className="d-grid gap-2">
                        {executionState.phase === "running" && <>
                            <ButtonGroup>
                                <Button
                                    variant="outline-primary"
                                    onClick={goBack}
                                    disabled={!executionState.hasPrevious}
                                >
                                    ⏮ Vorheriger
                                </Button>
                                <Button
                                    variant="outline-primary"
                                    onClick={advanceService}
                                    disabled={!executionState.hasNext}
                                >
                                    Nächster ⏭
                                </Button>
                            </ButtonGroup>
                            <Button
                                variant="secondary"
                                onClick={advanceToEnd}
                                disabled={!executionState.hasNext}
                            >
                                Zum Ende
                            </Button>
                            <Button variant="danger" onClick={onEndRequest}>
                                Beenden
                            </Button></>}
                    </div>
                </div>

                {/* Algorithm Info */}
                <Alert variant="info">
                    <small>
                        <strong>Aktiver Algorithmus:</strong><br/>
                        {selectedAlgorithm === 'liveness-single-instruction' && 'Liveness (Single Instructions)'}
                        {selectedAlgorithm === 'liveness-basic-blocks' && 'Liveness (Basic Blocks)'}
                        {selectedAlgorithm === 'reaching-definitions-basic-blocks' && 'Reaching Definitions (Basic Blocks)'}
                        {selectedAlgorithm === null && 'Keiner ausgewählt'}
                    </small>
                </Alert>
            </div>
        </div>
    </>);
};