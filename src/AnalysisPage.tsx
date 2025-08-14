import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AlgorithmMenu} from './AlgorithmMenu';
import {FlowVisualisationArea} from './FlowVisualisationArea.tsx';
import {FileContentArea} from "./FileContentArea.tsx";
import {TacCollectiveError, type TacError} from "./tac/tac-errors.ts";
import {readProgramFromText, TacProgram} from "./tac/program.ts";
import type {FlowAlgorithmSelector} from "./service/flow-service.ts";

export const AnalysisPage: React.FC<{
    fileName: string;
    fileContent: string;
    onBackToWelcome: () => void
}> = ({fileName, fileContent: initialFileContent, onBackToWelcome}) => {
    const [isMenuVisible, setIsMenuVisible] = useState(true);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState<FlowAlgorithmSelector["kind"] | null>(null);
    const [fileContent, setFileContent] = useState(initialFileContent);
    const [programErrors, setProgramErrors] = useState<Array<TacError>>([]);
    const hasUnsavedChanges = useRef(false);
    const program = useRef<TacProgram | undefined>(undefined);

    useEffect(() => {
        try {
            program.current = readProgramFromText(fileContent);
            setProgramErrors([]);
        } catch (error) {
            console.error("Error parsing content:", error);
            if (error instanceof TacCollectiveError) {
                setProgramErrors(error.errors);
                program.current = undefined;
            }
        }
    }, [fileContent]);

    const toggleMenu = () => {
        setIsMenuVisible(!isMenuVisible);
    };

    const handleInputChanged = () => {
        hasUnsavedChanges.current = true;
    }

    const handleAlgorithmSelect = (algorithm: FlowAlgorithmSelector["kind"]) => {
        setSelectedAlgorithm(algorithm);
        setIsMenuVisible(false);
    }

    // Function to handle file content saving and parsing
    const handleSaveContent = useCallback(async (newContent: string) => {
        hasUnsavedChanges.current = false;
        setFileContent(newContent);
    }, []);

    return (<div className="d-flex h-100">
        {/* Collapsible Algorithm Menu */}
        <AlgorithmMenu
            isVisible={isMenuVisible}
            onToggle={toggleMenu}
            onBackToWelcome={onBackToWelcome}
            selectedAlgorithm={selectedAlgorithm}
            onAlgorithmSelect={handleAlgorithmSelect}
        />

        {/* Main Content Area */}
        <div className="flex-grow-1 d-flex">
            {/* Visualization Area */}
            {selectedAlgorithm && program.current ? (
                    <FlowVisualisationArea
                        program={program.current}
                        selectedAlgorithm={selectedAlgorithm}
                        onEndRequest={() => {
                            setSelectedAlgorithm(null);
                            setFileContent(initialFileContent);
                            setProgramErrors([]);
                        }}
                    />
            ) : (
                <FileContentArea
                    fileContent={fileContent}
                    fileName={fileName}
                    programErrors={programErrors}
                    onSave={handleSaveContent}
                    onChange={handleInputChanged}
                />
            )}
        </div>
    </div>);
};