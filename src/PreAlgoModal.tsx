import React, {type ChangeEvent, useState} from "react";
import {type FlowAlgorithmSelector, type FlowService, getFlowServiceInstanceFor} from "./service/flow-service.ts";
import {Button, Form, Modal} from "react-bootstrap";
import type {TacProgram} from "./tac/program.ts";


export interface PreAlgoModalProps {
    selectedAlgorithm: FlowAlgorithmSelector["kind"] | null;
    show: boolean;
    handleClose: () => void;
    handleStart: (service: FlowService) => void;
    program: TacProgram;
}

export const PreAlgoModal: React.FC<PreAlgoModalProps> = ({
                                                              program,
                                                              selectedAlgorithm,
                                                              handleClose,
                                                              show,
                                                              handleStart
                                                          }) => {
    const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());

    const handleVariableToggle = (variable: string, checked: boolean) => {
        setSelectedVariables(prevState => {
            const newSet = new Set(prevState);
            if (checked) {
                newSet.add(variable);
            } else {
                newSet.delete(variable);
            }
            return newSet;
        });
    };

    const handleAllClicked = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedVariables(new Set(program.usedVariables));
        } else {
            setSelectedVariables(new Set());
        }
    }

    const onStart = () => {
        if (selectedAlgorithm === 'liveness-basic-blocks' || selectedAlgorithm === 'liveness-single-instruction') {
            handleStart(getFlowServiceInstanceFor(program, {
                kind: selectedAlgorithm,
                liveOut: selectedVariables
            }));
        } else {
            handleStart(getFlowServiceInstanceFor(program, {kind: 'reaching-definitions-basic-blocks'}));
        }
    };

    return <Modal
        show={show}
        onHide={handleClose}
        backdrop="static"
        keyboard={false}
    >
        <Modal.Header closeButton>
            <Modal.Title>
                {selectedAlgorithm === 'reaching-definitions-basic-blocks' && 'Reaching Definitions (Basic Blocks)'}
                {selectedAlgorithm === 'liveness-basic-blocks' && 'Liveness (Basic Blocks)'}
                {selectedAlgorithm === 'liveness-single-instruction' && 'Liveness (Single Instruction)'}
            </Modal.Title>
        </Modal.Header>
        <Modal.Body>
            Hier steht eine Beschreibung des Algorithmus
            {(selectedAlgorithm === 'liveness-basic-blocks' || selectedAlgorithm === 'liveness-single-instruction') &&
                <Form>
                    <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
                        <Form.Label>Live-Out Variablen auswählen:</Form.Label>
                        <Form.Check key="all" type="checkbox" label="Alle Variablen"
                                    checked={selectedVariables.size === program.usedVariables.size}
                                    onChange={handleAllClicked}/>
                        {[...program.usedVariables].map((variable) => {
                            return <Form.Check
                                key={variable}
                                type="checkbox"
                                label={variable}
                                checked={selectedVariables.has(variable)}
                                onChange={(e) => handleVariableToggle(variable, e.target.checked)}
                            />
                        })}
                    </Form.Group>
                </Form>
            }
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
                Zurück
            </Button>
            <Button variant="success" onClick={onStart}>Starten</Button>
        </Modal.Footer>
    </Modal>
};