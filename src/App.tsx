import React, {useState} from 'react';
import {TopBar} from './TopBar';
import {WelcomePage} from './WelcomePage';
import {AnalysisPage} from './AnalysisPage';
import 'bootstrap/dist/css/bootstrap.css'
import {enableMapSet} from "immer";

enableMapSet();

interface FileData {
    name: string;
    content: string;
}

const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<'welcome' | 'analysis'>('welcome');
    const [uploadedFile, setUploadedFile] = useState<FileData | null>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.name.endsWith('.tac')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setUploadedFile({
                    name: file.name, content: e.target?.result as string
                });
                setCurrentPage('analysis');
            };
            reader.readAsText(file);
        } else {
            alert('Bitte wählen Sie eine .tac Datei aus.');
        }
    };

    const handleBackToWelcome = () => {
        setCurrentPage('welcome');
        setUploadedFile(null);
    };

    return (<div className="vh-100 vw-100 d-flex flex-column">
            <TopBar/>

            <div className="flex-grow-1 overflow-hidden">
                {currentPage === 'welcome' && (<WelcomePage onFileUpload={handleFileUpload}/>)}
                {currentPage === 'analysis' && (<AnalysisPage
                        fileName={uploadedFile?.name || ''}
                        fileContent={uploadedFile?.content || ''}
                        onBackToWelcome={handleBackToWelcome}
                    />)}
            </div>
        </div>);
};

export default App;