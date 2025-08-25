import React, {useCallback, useState} from 'react';
import {AlgorithmMenu} from './AlgorithmMenu';
import {FlowVisualisationArea} from './FlowVisualisationArea.tsx';
import {FileContentArea} from "./FileContentArea.tsx";
import type {FlowAlgorithmSelector} from "./service/data-flow-drive-service.ts";
import {useDataFlowService} from "./DataFlowDriveServiceHook.tsx";
import {PreAlgoModal} from "./PreAlgoModal.tsx";

export const AnalysisPage: React.FC<{
    fileName: string;
    fileContent: string;
    onBackToWelcome: () => void
}> = ({fileName, fileContent, onBackToWelcome}) => {
    const [algoSelectionMenuVisible, setAlgoSelectionMenuVisible] = useState(true);
    const [preSelectedAlgorithm, setPreSelectedAlgorithm] = useState<FlowAlgorithmSelector["kind"] | null>(null);
    const {state, stepForward, stepBackward, stepToEnd, setProgramText, deselectAlgorithm, setAlgorithm} = useDataFlowService({initialProgramText: fileContent});
    const {programErrors, currentAlgorithm, currentValue, canStepForward, canStepBackward, programText} = state;

    const toggleMenu = () => {
        setAlgoSelectionMenuVisible(!algoSelectionMenuVisible);
    };

    const handleCloseAlgoStart = () => {
        setPreSelectedAlgorithm(null);
    }

    const handleAlgorithmSelect = (algorithm: FlowAlgorithmSelector["kind"]) => {
        setPreSelectedAlgorithm(algorithm);
        setAlgoSelectionMenuVisible(false);
    }

    const handleAlgorithmStart = (selector : FlowAlgorithmSelector, requested: boolean) => {
        setPreSelectedAlgorithm(null);
        setAlgorithm(selector);
    }

    // Function to handle file content saving and parsing
    const handleSaveContent = useCallback(async (newContent: string) => {
        setProgramText(newContent);
    }, [setProgramText]);

    return (<div className="d-flex h-100">
        {/* Collapsible Algorithm Menu */}
        <AlgorithmMenu
            isVisible={algoSelectionMenuVisible}
            onToggle={toggleMenu}
            onBackToWelcome={onBackToWelcome}
            selectedAlgorithm={preSelectedAlgorithm}
            onAlgorithmSelect={handleAlgorithmSelect}
        />

        <PreAlgoModal selectedAlgorithm={preSelectedAlgorithm} handleClose={handleCloseAlgoStart} handleStart={handleAlgorithmStart} possibleVariables={new Set("a")}/>

        {/* Main Content Area */}
        <div className="flex-grow-1 d-flex">
            {/* Visualization Area */}
            {currentAlgorithm !== undefined ? (
                    <FlowVisualisationArea
                        selectedAlgorithm={currentAlgorithm}
                        serviceValue={currentValue}
                        canStepForward={canStepForward}
                        canStepBackward={canStepBackward}
                        stepForward={stepForward}
                        stepBackward={stepBackward}
                        stepToEnd={stepToEnd}
                        onEndRequest={() => {
                            deselectAlgorithm();
                        }}
                    />
            ) : (
                <FileContentArea
                    fileContent={programText || fileContent}
                    fileName={fileName}
                    programErrors={programErrors}
                    onSave={handleSaveContent}
                />
            )}
        </div>
        </div>);
};