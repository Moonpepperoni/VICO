import React from "react";

export const WelcomeContent: React.FC = () => {
    const scrollToFileUpload = () => {
        const fileUploadElement = document.getElementById('file-upload-section');
        if (fileUploadElement) {
            fileUploadElement.scrollIntoView({behavior: 'smooth'});
        }
    };

    return (<div className="container-fluid">
            {/* Header Section */}
            <div className="text-center mb-5 py-5">
                <h1 className="display-4 mb-4">Willkommen bei VICO</h1>
                <p className="lead mb-4">
                    VICO ist ein interaktives Lern-Tool zur Visualisierung von Optimierungsalgorithmen
                    in Compilern, speziell für 3-Adress-Code (Three-Address Code). Es hilft dabei,
                    komplexe Compiler-Optimierungen zu verstehen und zu analysieren.
                </p>
                <button
                    className="btn btn-primary btn-lg"
                    onClick={scrollToFileUpload}
                >
                    Gleich loslegen
                </button>
            </div>

            {/* Two Column Section */}
            <div className="row mb-5">
                <div className="col-lg-6">
                    <div className="pe-4">
                        <h2 className="h3 mb-3">Verwendung des Tools</h2>
                        <ol className="ps-3">
                            <li className="mb-3">Laden Sie eine .tac-Datei mit Ihrem 3-Adress-Code hoch</li>
                            <li className="mb-3">Das Tool analysiert den Code automatisch</li>
                            <li className="mb-3">Verwenden Sie die Steuerelemente zur Visualisierung verschiedener
                                Optimierungen
                            </li>
                            <li className="mb-3">Beobachten Sie die schrittweise Transformation des Codes</li>
                        </ol>
                    </div>
                </div>

                <div className="col-lg-6">
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
                        </ul>
                    </div>
                </div>
            </div>
        </div>);
};