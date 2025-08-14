import React from 'react';
import { Button, Alert, Stack, Container } from 'react-bootstrap';
import type {FlowAlgorithmSelector} from "./service/flow-service.ts";

interface AlgorithmMenuProps {
    isVisible: boolean;
    onToggle: () => void;
    onBackToWelcome: () => void;
    selectedAlgorithm: string | null;
    onAlgorithmSelect: (algorithm: FlowAlgorithmSelector["kind"]) => void;
}

export const AlgorithmMenu: React.FC<AlgorithmMenuProps> = ({
                                                                isVisible,
                                                                onToggle,
                                                                onBackToWelcome,
                                                                selectedAlgorithm,
                                                                onAlgorithmSelect
                                                            }) => {

    const flowAlgorithms : Array<{id: FlowAlgorithmSelector["kind"], name: string}> = [
        {id: 'liveness-basic-blocks', name: 'Liveness (Basic Blocks)'},
        {id: 'liveness-single-instruction', name: "Liveness (Single Instructions)"},
        {id: 'reaching-definitions-basic-blocks', name: 'Reaching Definitions (Basic Blocks)'},
    ];

    return (
        <>
            {/* Toggle Button - Always visible */}
            <div
                className="position-fixed bg-primary text-white d-flex align-items-center justify-content-center"
                style={{
                    top: '60px',
                    left: isVisible ? '280px' : '0px',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    zIndex: 1000,
                    transition: 'left 0.3s ease',
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px'
                }}
                onClick={onToggle}
            >
                {isVisible ? '←' : '→'}
            </div>

            {/* Menu Panel */}
            <div
                className={`bg-light border-end position-relative ${isVisible ? '' : 'd-none'}`}
                style={{
                    width: '280px',
                    minWidth: '280px',
                    transition: 'transform 0.3s ease'
                }}
            >
                <Container className="p-3 h-100 d-flex flex-column">
                    {/* Back Button */}
                    <Button
                        variant="outline-secondary"
                        className="mb-4 w-100"
                        onClick={onBackToWelcome}
                    >
                        ← Zurück zur Startseite
                    </Button>

                    {/* Algorithm Selection */}
                    <div className="mb-4">
                        <h5 className="text-muted mb-3">Flowalgorithmen:</h5>
                        <Stack gap={2}>
                            {flowAlgorithms.map((algorithm) => (
                                <Button
                                    key={algorithm.id}
                                    variant={selectedAlgorithm === algorithm.id ? 'primary' : 'outline-primary'}
                                    className="text-start"
                                    onClick={() => onAlgorithmSelect(algorithm.id)}
                                >
                                    {algorithm.name}
                                </Button>
                            ))}
                        </Stack>
                    </div>

                    {/* Info Section */}
                    <div className="mt-auto">
                        <Alert variant="info">
                            <small>
                                <strong>Tipp:</strong> Wählen Sie einen Algorithmus aus, um die Visualisierung zu
                                starten.
                            </small>
                        </Alert>
                    </div>
                </Container>
            </div>
        </>
    );
};