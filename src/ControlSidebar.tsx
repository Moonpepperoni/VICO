import React from "react";
import {Alert, Button, ButtonGroup, Card} from 'react-bootstrap';

interface ControlSidebarProps {
    selectedAlgorithm: string | null;
    handleNext: () => void;
    handlePrevious: () => void;
    handleReset: () => void;
    explanationText: string;
    handleStop: () => void;
    handleEnd: () => void;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
                                                                  selectedAlgorithm,
                                                                  explanationText,
                                                                  handlePrevious,
                                                                  handleReset,
                                                                  handleNext,
                                                                  handleStop,
    handleEnd,
                                                              }) => {
    return (
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
                        <p className="mb-0">{explanationText}</p>
                    </Card.Body>
                </Card>
            </div>

            {/* Control Panel */}
            <div className="p-3">
                <h6 className="text-muted mb-3">Steuerung</h6>

                {/* Playback Controls */}
                <div className="mb-3">
                    <div className="d-grid gap-2">
                        <ButtonGroup>
                            <Button
                                variant="outline-primary"
                                onClick={handlePrevious}
                                disabled={!selectedAlgorithm}
                            >
                                ⏮ Vorheriger
                            </Button>
                            <Button
                                variant="outline-primary"
                                onClick={handleNext}
                                disabled={true}
                            >
                                Nächster ⏭
                            </Button>
                        </ButtonGroup>
                        <Button
                            variant="secondary"
                            onClick={handleReset}
                            disabled={true}
                        >
                            🔄 Zum Anfang
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleEnd}
                            disabled={true}
                        >
                            Zum Ende
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleStop}
                            disabled={true}
                        >
                            Beenden
                        </Button>
                    </div>
                </div>

                {/* Algorithm Info */}
                <Alert variant="info">
                    <small>
                        <strong>Aktiver Algorithmus:</strong><br/>
                        {selectedAlgorithm === 'dead-code' && 'Dead Code Elimination'}
                        {selectedAlgorithm === 'constant-folding' && 'Constant Folding'}
                        {selectedAlgorithm === 'common-subexpression' && 'Common Subexpression Elimination'}
                        {selectedAlgorithm === 'copy-propagation' && 'Copy Propagation'}
                        {selectedAlgorithm === 'loop-optimization' && 'Loop Optimization'}
                        {selectedAlgorithm === 'register-allocation' && 'Register Allocation'}
                        {selectedAlgorithm === null && 'Keiner ausgewählt'}
                    </small>
                </Alert>
            </div>
        </div>
    );
};