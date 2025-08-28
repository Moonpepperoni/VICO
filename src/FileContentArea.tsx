import React, {useState} from "react";
import CodeMirror from '@uiw/react-codemirror';
import {EditorView} from '@codemirror/view';
import {ErrorList} from "./ErrorList";
import { Container, Row, Col, Button} from 'react-bootstrap';

// Simple theme for 3-address code
const threeAddressCodeTheme = EditorView.theme({
    "&": {
        fontSize: "14px", fontFamily: "monospace",
    }, ".cm-content": {
        fontFamily: "'Courier New', Courier, monospace", caretColor: "#0e9"
    }, ".cm-line": {
        padding: "0 4px", lineHeight: "1.6"
    }
});

interface FileContentAreaProps {
    fileName: string;
    fileContent: string;
    programErrors: Array<{line: number, reason : string}>;
    onSave?: (newContent: string) => void;
}

export const FileContentArea: React.FC<FileContentAreaProps> = ({
                                                                    fileContent: initialFileContent,
                                                                    programErrors,
                                                                    fileName,
                                                                    onSave,
                                                                }) => {
    const [fileContent, setFileContent] = useState(initialFileContent);
    const [isModified, setIsModified] = useState(false);

    const handleContentChange = (value: string) => {
        setFileContent(value);
        setIsModified(true);
    };

    const handleSave = () => {
        if (onSave) {
            onSave(fileContent);
            setIsModified(false);
        }
    };

    return (
        <Container
            fluid
            className="d-flex flex-column me-3 mt-5"
            style={{
                transition: 'margin-left 0.3s ease',
                height: '95%',
                overflow: 'hidden'
            }}
        >
            {/* Save Button */}
            <Row className="my-2">
                <Col xs={6}>
                    <h5>Datei: {fileName}</h5>
                </Col>
                <Col xs={6} className="text-end">
                    <Button
                        data-cy='code-editor-save-button'
                        disabled={!isModified}
                        variant="primary"
                        onClick={handleSave}
                    >
                        Änderungen speichern
                    </Button>
                </Col>
            </Row>

            {/* Main content with fixed proportions */}
            <div className="d-flex flex-column" style={{
                height: 'calc(95% - 60px)', /* Abzüglich der Header-Höhe */
                overflow: 'hidden'
            }}>
                {/* Code Editor - 75% of remaining height */}
                <div style={{
                    height: '75%',
                    overflow: 'hidden',
                    marginBottom: '10px'
                }}>
                    <CodeMirror
                        data-cy="code-editor-area"
                        value={fileContent}
                        height="100%"
                        basicSetup={{
                            lineNumbers: true,
                            highlightActiveLine: true,
                            highlightSpecialChars: false,
                            foldGutter: false,
                            dropCursor: true,
                            allowMultipleSelections: true,
                            indentOnInput: false,
                            syntaxHighlighting: false,
                            bracketMatching: false,
                            closeBrackets: false,
                            autocompletion: false,
                            rectangularSelection: true,
                            crosshairCursor: false,
                            highlightSelectionMatches: false
                        }}
                        extensions={[threeAddressCodeTheme]}
                        onChange={handleContentChange}
                        style={{
                            borderRadius: '4px',
                            border: '1px solid #dee2e6',
                            height: '100%',
                            overflow: 'auto'
                        }}
                    />
                </div>

                {/* Error List - 25% of remaining height */}
                <div style={{
                    height: '25%',
                    overflow: 'hidden'
                }}>
                    <ErrorList errors={programErrors} />
                </div>
            </div>
        </Container>
    );
};