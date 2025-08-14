import React, {type ChangeEvent, useState} from "react";
import {type FlowAlgorithmSelector, type FlowService, getFlowServiceInstanceFor} from "./service/flow-service.ts";
import {Button, Card, Form, Modal} from "react-bootstrap";
import type {TacProgram} from "./tac/program.ts";


export interface PreAlgoModalProps {
    selectedAlgorithm: FlowAlgorithmSelector["kind"];
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
        switch (selectedAlgorithm) {
            case 'liveness-basic-blocks':
            case 'liveness-single-instruction':
                handleStart(getFlowServiceInstanceFor(program, {
                    kind: selectedAlgorithm,
                    liveOut: selectedVariables,
                }));
                break;
            case 'reaching-definitions-basic-blocks':
            case 'constant-propagation-basic-blocks':
                handleStart(getFlowServiceInstanceFor(program, {kind: selectedAlgorithm}));
                break;
            default: {
                const _exhaustiveCheck: never = selectedAlgorithm;
                throw new Error(`Unknown algorithm: ${_exhaustiveCheck}`);
            }
        }
    };

    const algorithmName = (() => {
        switch (selectedAlgorithm) {
            case 'liveness-basic-blocks':
                return 'Liveness (Basic Blocks)';
            case 'liveness-single-instruction':
                return 'Liveness (Single Instruction)';
            case 'reaching-definitions-basic-blocks':
                return 'Reaching Definitions (Basic Blocks)';
            case 'constant-propagation-basic-blocks':
                return 'Constant Propagation (Basic Blocks)';
            default: {
                const _exhaustiveCheck: never = selectedAlgorithm;
                throw new Error(`Unknown algorithm: ${_exhaustiveCheck}`);
            }
        }
    })();

    const algorithmDescription = (() => {
        switch (selectedAlgorithm) {
            case 'liveness-basic-blocks':
            case 'liveness-single-instruction':
                return 'Dieser Algorithmus berechnet, welche Variablen an jedem Programmpunkt "lebendig" sind, d.h. deren aktueller Wert in der Zukunft noch gelesen werden könnte. Eine Variable ist an einem Punkt lebendig, wenn es einen Pfad vom aktuellen Punkt zu einer Verwendung der Variable gibt, ohne dass die Variable neu definiert wird.';
            case 'reaching-definitions-basic-blocks':
                return 'Der Reaching Definitions Algorithmus berechnet für jeden Programmpunkt, welche Variablendefinitionen (Zuweisungen) diesen Punkt erreichen können. Eine Definition erreicht einen Punkt, wenn es einen Pfad von der Definition zum Punkt gibt, auf dem die Variable nicht neu definiert wird. Dies ist nützlich, um zu verstehen, woher Variablenwerte stammen können.';
            case 'constant-propagation-basic-blocks':
                return 'Dieser Algorithmus analysiert, welche Variablen an bestimmten Programmpunkten konstante Werte haben. Er verfolgt Zuweisungen von Konstanten und propagiert diese durch das Programm, solange keine mehrdeutigen Zuweisungen oder Berechnungen auftreten. Dies ermöglicht Optimierungen wie das Ersetzen von Variablen durch ihre konstanten Werte.';
            default: {
                const _exhaustiveCheck: never = selectedAlgorithm;
                throw new Error(`Unknown algorithm: ${_exhaustiveCheck}`);
            }
        }
    })();

    return <Modal
        show={show}
        onHide={handleClose}
        backdrop="static"
        keyboard={false}
        centered
    >
        <Modal.Header closeButton>
            <Modal.Title>
                {algorithmName}
            </Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Card>
                <Card.Header>
                    <Card.Title>Beschreibung</Card.Title>
                </Card.Header>
                <Card.Body>
                    <Card.Text>
                        {algorithmDescription}
                    </Card.Text>
                </Card.Body>
            </Card>
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