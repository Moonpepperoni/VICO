import React from 'react';
import { Container } from 'react-bootstrap';
import { WelcomeContent } from "./WelcomeContent.tsx";
import { FileUpload } from "./FileUpload.tsx";

export const WelcomePage: React.FC<{
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
}> = ({ onFileUpload }) => (
    <Container fluid className="overflow-auto" style={{ height: '100%' }}>
        <WelcomeContent />
        <FileUpload onFileUpload={onFileUpload} />
    </Container>
);