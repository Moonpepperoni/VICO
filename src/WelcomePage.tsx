import React from 'react';
import { Container } from 'react-bootstrap';
import { WelcomeContent } from "./WelcomeContent.tsx";
import { FileUpload } from "./FileUpload.tsx";

export interface FileData {
    content: string;
    name: string;
}

export const WelcomePage: React.FC<{
    setFileData: (fileData: FileData) => void
}> = ({ setFileData }) => {
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.name.endsWith('.tac')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setFileData({
                    name: file.name, content: e.target?.result as string
                });
            };
            reader.readAsText(file);
        } else {
            alert('Bitte wählen Sie eine .tac Datei aus.');
        }
    };
    return (<Container fluid className="overflow-auto" style={{ height: '100%' }}>
        <WelcomeContent onGoClick={(content, name) => setFileData({ content, name })}/>
        <FileUpload onFileUpload={handleFileUpload} />
    </Container>);
}

