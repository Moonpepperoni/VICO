import React from "react";
import {Container, Row, Col, Button} from 'react-bootstrap';

const EXAMPLE_CODE = `inc1 = 2
inc2 = inc1 + 2
i = 0
res = 0
LOOP_START: if i < 10 goto LOOP_END
mod = i % 2
if mod == 0 goto ELSE_BRANCH
res = res + inc1
goto BRANCH_END
ELSE_BRANCH: res = res + inc2
BRANCH_END: i = i + 1 
goto LOOP_START
LOOP_END: final = res`;

export interface WelcomeContentProps {
    onGoClick : (content :string, name : string) => void,
}

export const WelcomeContent: React.FC<WelcomeContentProps> = ({onGoClick}) => {
    const scrollToFileUpload = () => {
        const fileUploadElement = document.getElementById('file-upload-section');
        if (fileUploadElement) {
            fileUploadElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <Container fluid>
            {/* Header Section */}
            <div className="text-center mb-5 py-5">
                <h1 className="display-4 mb-4">Willkommen bei VICO</h1>
                <p className="lead mb-4">
                    VICO ist ein interaktives Lern-Tool zur Visualisierung von Optimierungsalgorithmen
                    in Compilern, speziell für 3-Adress-Code (Three-Address Code). Es hilft dabei,
                    komplexe Compiler-Optimierungen zu verstehen und zu analysieren.
                </p>
                <Button
                    variant="primary"
                    size="lg"
                    onClick={scrollToFileUpload}
                    className="me-3"
                    data-cy="start-scroll-upload-button"
                >
                    Eigene Datei hochladen
                </Button>
                <Button data-cy="start-example-button" variant="dark" size="lg" onClick={() => onGoClick(EXAMPLE_CODE, "example.tac")}>
                    Einfach loslegen
                </Button>
            </div>

            {/* Two Column Section */}
            <Row className="mb-5">
                <Col lg={6}>
                    <div className="pe-4">
                        <h2 className="h3 mb-3">Verwendung des Tools</h2>
                        <ol className="ps-3">
                            <li className="mb-3">Lade eine .tac-Datei mit deinem eigenen 3-Adress-Code hoch</li>
                            <li className="mb-3">Das Tool analysiert den Code automatisch</li>
                            <li className="mb-3">Beobachte, wie der Algorithmus Schritt-für-Schritt ausgeführt wird</li>
                        </ol>
                    </div>
                </Col>

                <Col lg={6}>
                    <div className="ps-4">
                        <h2 className="h3 mb-3">3-Adress-Code Struktur</h2>
                        <p className="mb-3">
                            3-Adress-Code ist eine Zwischendarstellung in Compilern, bei der jede Anweisung
                            höchstens drei Adressen enthält:
                        </p>
                        <ul className="list-unstyled ps-3">
                            <li className="mb-2"><strong>x = y op z</strong> - Binäre Operation</li>
                            <li className="mb-2"><strong>x = op y</strong> - Unäre Operation</li>
                            <li className="mb-2"><strong>x = y</strong> - Zuweisung</li>
                            <li className="mb-2"><strong>goto L</strong> - Unbedingter Sprung</li>
                            <li className="mb-2"><strong>if x relop y goto L</strong> - Bedingter Sprung</li>
                            <li className="mb-2"><strong>L: x = y</strong> - Erstellen einer Sprungmarke</li>
                        </ul>
                    </div>
                </Col>
            </Row>
        </Container>
    );
};