import React, {useState} from 'react';
import {TopBar} from './TopBar';
import {type FileData, WelcomePage} from './WelcomePage';
import {AnalysisPage} from './AnalysisPage';
import 'bootstrap/dist/css/bootstrap.css'
import {enableMapSet} from "immer";
import {MathJaxContext} from "better-react-mathjax";

enableMapSet();

const mathJaxConfig = {
    tex: {
        packages: { '[+]': ['require', 'ams'] },
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
    },
};



const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<'welcome' | 'analysis'>('welcome');
    const [fileData, setFileData] = useState<FileData | null>(null);


    const handleBackToWelcome = () => {
        setCurrentPage('welcome');
        setFileData(null);
    };

    const onFileDataChange = (newFileData: FileData) => {
        setFileData(newFileData);
        setCurrentPage('analysis');
    }

    return (<div className="vh-100 vw-100 d-flex flex-column">
            <TopBar/>

            <MathJaxContext version={3} config={mathJaxConfig}>


            <div className="flex-grow-1 overflow-hidden">
                {currentPage === 'welcome' && (<WelcomePage setFileData={onFileDataChange}/>)}
                {currentPage === 'analysis' && (<AnalysisPage
                        fileName={fileData?.name || ''}
                        fileContent={fileData?.content || ''}
                        onBackToWelcome={handleBackToWelcome}
                    />)}
            </div>
            </MathJaxContext>
        </div>);
};

export default App;