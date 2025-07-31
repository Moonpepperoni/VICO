import React from 'react';
import {ControlSidebar} from "./ControlSidebar.tsx";

interface VisualizationAreaProps {
    fileName: string;
    fileContent: string;
}

export const FlowVisualisationArea: React.FC<VisualizationAreaProps> = ({
                                                                            fileName, fileContent,
                                                                        }) => {
    const lineCount = fileContent.split('\n').filter(line => line.trim() !== '').length;

    return (<>
        <div
            className="flex-grow-1 position-relative"
            style={{
                transition: 'margin-left 0.3s ease'
            }}
        >
            <div className="h-100 w-100 bg-white border rounded m-2 p-4 d-flex flex-column">

                {/* Main Content Area */}
                <div className="flex-grow-1 bg-light rounded p-4 d-flex align-items-center justify-content-center">
                    <div className="text-center text-muted">
                        <div className="display-1 mb-3">🔧</div>
                        <h4>Algorithmus-Visualisierung</h4>
                        <p className="lead mb-4">
                            Hier wird die schrittweise Ausführung des gewählten Optimierungsalgorithmus
                            visualisiert.
                        </p>

                        {/* Preview of file content */}
                        <div className="bg-white border rounded p-3 text-start" style={{maxWidth: '600px'}}>
                            <h6 className="text-dark mb-2">Vorschau: {fileName}</h6>
                            <pre className="mb-0 text-muted"
                                 style={{fontSize: '0.8rem', overflow: 'auto', maxHeight: '200px'}}>
                {fileContent.split('\n').slice(0, 10).join('\n')}
                                {lineCount > 10 && '\n... (' + (lineCount - 10) + ' weitere Zeilen)'}
              </pre>
                        </div>

                        <div className="mt-4">
                            <p className="mb-0">
                                <strong>Anleitung:</strong> Wählen Sie einen Algorithmus aus der linken
                                Seitenleiste,
                                um mit der Visualisierung zu beginnen.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
            <ControlSidebar
                selectedAlgorithm={null}
                handleNext={() => {
                }}
                handlePrevious={() => {
                }}
                handleReset={() => {
                }}
                explanationText={"Hier wird eine Erklärung gezeigt"}
            />
        </>);
};