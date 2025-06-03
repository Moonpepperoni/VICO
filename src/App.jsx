import './App.css'
import FileForm from './FileForm'
import { useState } from "react";
import tokeniseRegex from './TacTokens';

function App() {
    const [textData, setTextData] = useState(null);


    return (
        <>
            <div style={{ maxWidth: '50%', maxHeight: '50%', margin: 'auto auto auto auto' }}>
                <FileForm onRead={setTextData} />
            </div>
            {(textData ? tokeniseRegex(textData).map(token => <p style={{textAlign : "left"}}>{token.toString()}</p>) : null)}
        </>
    )
}

export default App
