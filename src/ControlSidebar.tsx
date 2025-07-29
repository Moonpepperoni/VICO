interface ControlSidebarProps {
    selectedAlgorithm: string | null;
    handleNext : () => void;
    handlePrevious : () => void;
    handleReset : () => void;
    explanationText : string;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({selectedAlgorithm, explanationText, handlePrevious, handleReset, handleNext}) => {

    return (<div
            className="bg-light border-start d-flex flex-column"
            style={{width: '320px', minWidth: '320px'}}
        >
            {/* Step Explanation Area */}
            <div className="flex-grow-1 p-3 border-bottom">
                <h5 className="text-muted mb-3">Schritt-für-Schritt Erklärung</h5>

                <div className="card">
                    <div className="card-header bg-primary text-white">
                        <h6 className="mb-0">Aktueller Schritt</h6>
                    </div>
                    <div className="card-body">
                        <p className="mb-0">{explanationText}</p>
                    </div>
                </div>

            </div>

            {/* Control Panel */}
            <div className="p-3">
                <h6 className="text-muted mb-3">Steuerung</h6>

                {/* Playback Controls */}
                <div className="mb-3">
                    <div className="d-grid gap-2">
                        <div className="btn-group">
                            <button
                                className="btn btn-outline-primary"
                                onClick={handlePrevious}
                                disabled={!selectedAlgorithm}
                            >
                                ⏮ Zurück
                            </button>
                            <button
                                className="btn btn-outline-primary"
                                onClick={handleNext}
                                disabled={true}
                            >
                                Weiter ⏭
                            </button>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={handleReset}
                            disabled={true}
                        >
                            🔄 Reset
                        </button>
                    </div>
                </div>

                {/* Algorithm Info */}
                {(<div className="alert alert-info">
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
                    </div>)}
            </div>
        </div>);
};