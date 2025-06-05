import { useRef, useState } from "react";

export default function FileForm({ onRead }) {
    const inputRef = useRef(null);
    const [visualState, setVisualState] = useState('default');
    const [currentFile, setCurrentFile] = useState(null);

    const confirmFile = f => {
        const reader = new FileReader();
        reader.onload = (e) => {
            onRead(e.target.result);
        };
        reader.readAsText(f);
    }

    const onNewFile = f => {
        console.log(`new file: ${f.name}`);
        setCurrentFile(f);
    }

    const onButtonClick = e => {
        e.preventDefault();
        e.stopPropagation();
        const input = inputRef.current;
        input.click()
    }

    const onDragEnter = e => {
        e.preventDefault();
        e.stopPropagation();
    }

    const onDragOver = e => {
        e.preventDefault();
        e.stopPropagation();
        if (visualState === 'default') {
            setVisualState('hovering');
        }
    }

    const onDragLeave = e => {
        e.preventDefault();
        e.stopPropagation();
        setVisualState("default");
    }

    const onDrop = e => {
        e.stopPropagation();
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        setVisualState("confirm");
        onNewFile(f);
    }

    const onFileChange = e => {
        const f = e.target.files[0];
        onNewFile(f);
        setVisualState("confirm");
    }

    const onConfirm = () => {
        confirmFile(currentFile);
        setVisualState("default");
    }

    return (
        <div onDragLeave={onDragLeave} onDragOver={onDragOver} onDragEnter={onDragEnter} onDrop={onDrop} style={{ borderStyle: "dotted", borderWidth: "5px 5px 5px 5px", borderColor: (visualState === 'default' ? "black" : "green"), width: "100%", height: "100%", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
            {
                (visualState === 'default') ?
                    <><p>Ziehe eine Datei hierhin oder drücke den Button</p>
                        <input onChange={onFileChange} ref={inputRef} type="file" hidden />
                        <button onClick={onButtonClick} type="button">Neue Datei hochladen</button></> :
                    (visualState === 'hovering') ?
                        (<>
                            <p>Loslassen zum hochladen</p>
                        </>) :
                        <>
                            <p>Datei {currentFile.name} wurde hochgeladen. Soll sie benutzt werden?</p>
                            <button onClick={onConfirm}>Bestätigen</button>
                        </>
            }

        </div>
    );
}