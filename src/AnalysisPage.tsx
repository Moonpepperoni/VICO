import React, {useState} from 'react';
import {AlgorithmMenu} from './AlgorithmMenu';
import {FlowVisualisationArea} from './FlowVisualisationArea.tsx';

export const AnalysisPage: React.FC<{
    fileName: string; fileContent: string; onBackToWelcome: () => void
}> = ({fileName, fileContent, onBackToWelcome}) => {
    const [isMenuVisible, setIsMenuVisible] = useState(true);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState<string | null>(null);

    const toggleMenu = () => {
        setIsMenuVisible(!isMenuVisible);
    };

    return (<div className="d-flex h-100">
            {/* Collapsible Algorithm Menu */}
            <AlgorithmMenu
                isVisible={isMenuVisible}
                onToggle={toggleMenu}
                onBackToWelcome={onBackToWelcome}
                selectedAlgorithm={selectedAlgorithm}
                onAlgorithmSelect={setSelectedAlgorithm}
            />

            {/* Main Content Area */}
            <div className="flex-grow-1 d-flex">
                {/* Visualization Area */}
                <FlowVisualisationArea
                    fileName={fileName}
                    fileContent={fileContent}
                />
            </div>
        </div>);
};