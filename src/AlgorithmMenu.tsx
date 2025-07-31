import React from 'react';

interface AlgorithmMenuProps {
    isVisible: boolean;
    onToggle: () => void;
    onBackToWelcome: () => void;
    selectedAlgorithm: string | null;
    onAlgorithmSelect: (algorithm: string) => void;
}

export const AlgorithmMenu: React.FC<AlgorithmMenuProps> = ({
                                                                isVisible,
                                                                onToggle,
                                                                onBackToWelcome,
                                                                selectedAlgorithm,
                                                                onAlgorithmSelect
                                                            }) => {

    const flowAlgorithms = [{id: 'constant-propagation', name: 'Constant Propagation'}, {
        id: 'liveness-instructions',
        name: 'Liveness (Single Instructions)'
    }, {id: 'liveness-basic-blocks', name: 'Liveness (Basic Blocks)'}, {
        id: 'reaching-definitions',
        name: 'Reaching Definitions'
    },];

    return (<>
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
                    width: '280px', minWidth: '280px', transition: 'transform 0.3s ease'
                }}
            >
                <div className="p-3 h-100 d-flex flex-column">
                    {/* Back Button */}
                    <button
                        className="btn btn-outline-secondary mb-4 w-100"
                        onClick={onBackToWelcome}
                    >
                        ← Zurück zur Startseite
                    </button>

                    {/* Algorithm Selection */}
                    <div className="mb-4">
                        <h5 className="text-muted mb-3">Flowalgorithmen:</h5>
                        <div className="d-grid gap-2">
                            {flowAlgorithms.map((algorithm) => (<button
                                    key={algorithm.id}
                                    className={`btn text-start ${selectedAlgorithm === algorithm.id ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => onAlgorithmSelect(algorithm.id)}
                                >
                                    {algorithm.name}
                                </button>))}
                        </div>
                    </div>


                    {/* Info Section */}
                    <div className="mt-auto">
                        <div className="alert alert-info">
                            <small>
                                <strong>Tipp:</strong> Wählen Sie einen Algorithmus aus, um die Visualisierung zu
                                starten.
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </>);
};