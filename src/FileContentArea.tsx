import React, {useState} from "react";
import {TacError} from "./tac/tac-errors.ts";
import CodeMirror from '@uiw/react-codemirror';
import {EditorView} from '@codemirror/view';
import {ErrorList} from "./ErrorList";

interface FileContentAreaProps {
    fileName: string;
    fileContent: string;
    programErrors: Array<TacError>;
    onSave?: (newContent: string) => void;
    onChange?: () => void;
}

export const FileContentArea: React.FC<FileContentAreaProps> = ({
                                                                    fileContent: initialFileContent,
                                                                    programErrors,
                                                                    fileName,
                                                                    onSave,
                                                                    onChange,
                                                                }) => {
    const [fileContent, setFileContent] = useState(initialFileContent);
    const [isModified, setIsModified] = useState(false);

    const handleContentChange = (value: string) => {
        setFileContent(value);
        if (!isModified) onChange?.();
        setIsModified(true);
    };

    const handleSave = () => {
        if (onSave) {
            onSave(fileContent);
            setIsModified(false);
        }
    };

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

    return (<div
            className="flex-grow-1 position-relative d-flex flex-column me-3"
            style={{
                transition: 'margin-left 0.3s ease', height: '100%'
            }}
        >
            {/* Save Button */}
            <div className="mt-3 text-end">
                <button
                    disabled={!isModified}
                    className="btn btn-primary"
                    onClick={handleSave}
                >
                    Änderungen speichern
                </button>
            </div>
            <div className="h-100 w-100 bg-white border rounded m-2 p-4 d-flex flex-column">
                <h5 className="mb-3">Datei: {fileName}</h5>

                {/* Text Editor Area */}
                <div className="flex-grow-1" style={{minHeight: 0}}>
                    <CodeMirror
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
                            borderRadius: '4px', overflow: 'auto'
                        }}
                    />
                </div>

                {/* Error List Component */}
                <div className="mt-3">
                    <ErrorList errors={programErrors}/>
                </div>


            </div>
        </div>);
};