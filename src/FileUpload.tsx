// File Upload Component
import React from "react";

export const FileUpload: React.FC<{
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
}> = ({onFileUpload}) => (<div id="file-upload-section" className="container-fluid py-5 bg-light">
        <div className="row justify-content-center">
            <div className="col-lg-6">
                <div className="card shadow">
                    <div className="card-header bg-primary text-white text-center">
                        <h3 className="card-title mb-0">Datei hochladen</h3>
                    </div>
                    <div className="card-body">
                        <div className="text-center mb-4">
                            <i className="display-1 text-muted">📄</i>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="fileInput" className="form-label">
                                Wählen Sie eine .tac Datei aus:
                            </label>
                            <input
                                type="file"
                                className="form-control"
                                id="fileInput"
                                accept=".tac"
                                onChange={onFileUpload}
                            />
                        </div>
                        <div className="alert alert-info">
                            <small>
                                <strong>Hinweis:</strong> Nur .tac Dateien werden unterstützt.
                                Diese sollten gültigen 3-Adress-Code enthalten.
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>);
