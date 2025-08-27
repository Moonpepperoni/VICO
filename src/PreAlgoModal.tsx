import React, {type ChangeEvent, useState} from "react";
import {Button, Card, Form, Modal} from "react-bootstrap";
import type {FlowAlgorithmSelector} from "./service/data-flow-drive-service.ts";


export interface PreAlgoModalProps {
    selectedAlgorithm: FlowAlgorithmSelector["kind"] | null;
    possibleVariables: Set<string>;
    handleClose: () => void;
    handleStart: (selector: FlowAlgorithmSelector, practiceModeRequested: boolean) => void;
}

export const PreAlgoModal: React.FC<PreAlgoModalProps> = ({
                                                              selectedAlgorithm,
                                                              handleClose,
                                                              handleStart,
                                                              possibleVariables,
                                                          }) => {
    const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
    const [practiceMode, setPracticeMode] = useState<boolean>(false);

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
            setSelectedVariables(new Set(possibleVariables));
        } else {
            setSelectedVariables(new Set());
        }
    }

    const handlePracticeClicked = (event: ChangeEvent<HTMLInputElement>) => {
        setPracticeMode(event.target.checked);
    }

    const onStart = () => {
        switch (selectedAlgorithm) {
            case 'liveness-basic-blocks':
                handleStart({kind: 'liveness-basic-blocks', liveOut: selectedVariables}, practiceMode);
                break;
            case 'liveness-single-instruction':
                handleStart({kind: 'liveness-single-instruction', liveOut: selectedVariables}, practiceMode);
                break;
            case 'reaching-definitions-basic-blocks':
                handleStart({kind: 'reaching-definitions-basic-blocks'}, practiceMode);
                break;
            case 'constant-propagation-basic-blocks':
                handleStart({kind: 'constant-propagation-basic-blocks'}, practiceMode);
        }

    };

    const algorithmName = (() => {
        if (selectedAlgorithm === null) {
            return 'No algorithm was selected';
        }
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
        if (selectedAlgorithm === null) {
            return 'No algorithm was selected';
        }
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
        data-cy="pre-algo-modal"
        show={selectedAlgorithm !== null}
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
                        <Form.Check data-cy="pre-algo-modal-check-all-live-out" key="all" type="checkbox" label="Alle Variablen"
                                    checked={selectedVariables.size === possibleVariables.size}
                                    onChange={handleAllClicked}/>
                        {[...possibleVariables].map((variable) => {
                            return <Form.Check
                                key={variable}
                                type="checkbox"
                                label={variable}
                                checked={selectedVariables.has(variable)}
                                onChange={(e) => handleVariableToggle(variable, e.target.checked)}
                            />
                        })}
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Übungsmodus einstellungen:</Form.Label>
                        <Form.Check key='training' type="switch" label="Übungsmodus ein-/ausschalten"
                                    defaultChecked={false} checked={practiceMode} onChange={handlePracticeClicked}/>
                        <Form.Text>Der Übungsmodus hilft dabei das Verständnis zu festigen.</Form.Text>

                    </Form.Group>
                </Form>
            }

        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
                Zurück
            </Button>
            <Button data-cy="pre-algo-modal-start-button" variant="success" onClick={onStart}>Starten</Button>
        </Modal.Footer>
    </Modal>
};