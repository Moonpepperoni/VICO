import './App.css'
import FileForm from './FileForm'
import { useState } from "react";

function App() {
    const [textData, setTextData] = useState(null);

    return (
        <>
            <div style={{ maxWidth: '50%', maxHeight: '50%', margin: 'auto auto auto auto' }}>
                <FileForm onRead={setTextData} />
            </div>
            <p>{(textData === null) ? "Nichts gelesen" : textData}</p>
        </>
    )
}

export default App
