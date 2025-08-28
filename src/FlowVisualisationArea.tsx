import React, {useCallback, useEffect, useState} from 'react';
import {FlowGraph} from "./FlowGraph.tsx";
import {applyNodeChanges, type Edge, type Node, type NodeChange, ReactFlowProvider} from "@xyflow/react";
import {Alert, Button, ButtonGroup, Card,} from "react-bootstrap";
import convertToReactFlow from "./converter.ts";
import useLayout from "./LayoutHook.tsx";
import {MathRenderer} from "./MathRenderer.tsx";
import type {FlowAlgorithmSelector, FlowState} from "./service/data-flow-drive-service.ts";

interface VisualizationAreaProps {
    serviceValue: FlowState | undefined;
    canStepForward: boolean;
    canStepBackward: boolean;
    stepForward: () => void;
    stepBackward: () => void;
    stepToEnd: () => void;
    selectedAlgorithm: FlowAlgorithmSelector["kind"];
    onEndRequest: () => void;
}

export const FlowVisualisationArea: React.FC<VisualizationAreaProps> = ({
                                                                            selectedAlgorithm, onEndRequest,
                                                                            serviceValue,
                                                                            canStepForward,
                                                                            canStepBackward,
                                                                            stepForward,
                                                                            stepBackward,
                                                                            stepToEnd,
                                                                        }) => {
    return <ReactFlowProvider>
        <DisplayArea selectedAlgorithm={selectedAlgorithm} serviceValue={serviceValue} canStepForward={canStepForward}
                     canStepBackward={canStepBackward} onEndRequest={onEndRequest} stepForward={stepForward}
                     stepBackward={stepBackward} stepToEnd={stepToEnd}/>
    </ReactFlowProvider>
};

export const DisplayArea: React.FC<VisualizationAreaProps> = ({
                                                                  selectedAlgorithm, onEndRequest,
                                                                  serviceValue,
                                                                  canStepForward,
                                                                  canStepBackward,
                                                                  stepForward,
                                                                  stepBackward,
                                                                  stepToEnd,
                                                              }) => {

    const [nodes, setNodes] = useState<Array<Node>>([]);
    const [edges, setEdges] = useState<Array<Edge>>([]);

    const {
        layoutedNodes,
        layoutedEdges
    } = useLayout({
        backEdges: new Set(
            serviceValue?.edges
                .filter(e => e.isBackEdge)
                .map(e => `${e.src}-${e.target}`)
            || [])
    });

    useEffect(() => {
        if (serviceValue === undefined) {
            setNodes([]);
            setEdges([]);
            return;
        }
        // we know serviceValue is defined here
        const {nodes, edges} = convertToReactFlow(serviceValue!);
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
    }, [serviceValue]);

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


    const onNodesChange = useCallback(
        (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );


    return (<>
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
            style={{width: '20%', minWidth: '350px'}}
        >
            {/* Step Explanation Area */}
            <div className="flex-grow-1 p-3 border-bottom">
                <h5 className="text-muted mb-3">Schritt-für-Schritt Erklärung</h5>

                <Card>
                    <Card.Header className="bg-primary text-white">
                        <h6 className="mb-0">Aktueller Schritt</h6>
                    </Card.Header>
                    <Card.Body data-cy="algo-step-explanation-body">
                        {serviceValue?.explanation === undefined ?
                            <p className="mb-0">Hier wird eine Erklärung angezeigt</p> :
                            serviceValue?.explanation.map(e => {
                                if (e.kind === 'text') {
                                    return <p data-cy="algo-step-explanation-line" className="mb-0">{e.content}</p>
                                } else {
                                    return <MathRenderer data-cy="algo-step-explanation-line" formula={e.content}/>
                                }
                            })}
                    </Card.Body>
                </Card>
            </div>

            {/* Control Panel */}
            <div data-cy="algo-control-menu" className="p-3">
                <h6 className="text-muted mb-3">Steuerung</h6>
                {/* Playback Controls */}
                <div className="mb-3">
                    <div className="d-grid gap-2">
                        <ButtonGroup>
                            <Button
                                data-cy="algo-control-step-back-button"
                                variant="outline-primary"
                                onClick={stepBackward}
                                disabled={!canStepBackward}
                            >
                                ⏮ Vorheriger
                            </Button>
                            <Button
                                data-cy="algo-control-step-forward-button"
                                variant="outline-primary"
                                onClick={stepForward}
                                disabled={!canStepForward}
                            >
                                Nächster ⏭
                            </Button>
                        </ButtonGroup>
                        <Button
                            data-cy="algo-control-step-to-end-button"
                            variant="secondary"
                            onClick={stepToEnd}
                            disabled={!canStepForward}
                        >
                            Zum Ende
                        </Button>
                        <Button data-cy="algo-control-stop-button" variant="danger" onClick={onEndRequest}>
                            Beenden
                        </Button>
                    </div>
                </div>

                {/* Algorithm Info */}
                <Alert variant="info">
                    <small>
                        <strong>Aktiver Algorithmus:</strong><br/>
                        {selectedAlgorithm === 'liveness-single-instruction' && 'Liveness (Single Instructions)'}
                        {selectedAlgorithm === 'liveness-basic-blocks' && 'Liveness (Basic Blocks)'}
                        {selectedAlgorithm === 'reaching-definitions-basic-blocks' && 'Reaching Definitions (Basic Blocks)'}
                        {selectedAlgorithm === 'constant-propagation-basic-blocks' && 'Constant Propagation (Basic Blocks)'}
                        {selectedAlgorithm === null && 'Keiner ausgewählt'}
                    </small>
                </Alert>
            </div>
        </div>
    </>);
};