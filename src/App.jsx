import './App.css'
import FileForm from './FileForm'
import { useState } from "react";
import tokeniseRegex from './TacTokens';
import parseTac from './TacParser';

function App() {
    const [textData, setTextData] = useState(null);


    return (
        <>
            <div style={{ maxWidth: '50%', maxHeight: '50%', margin: 'auto auto auto auto' }}>
                <FileForm onRead={setTextData} />
            </div>
            {(textData ? parseTac(tokeniseRegex(textData)).map(quadruple => <p style={{textAlign : "left"}}><it>{quadruple.label}</it> | {quadruple.toString()}</p>) : null)}
        </>
    )
}

export default App
