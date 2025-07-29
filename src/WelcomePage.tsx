import React from 'react';
import {WelcomeContent} from "./WelcomeContent.tsx";
import {FileUpload} from "./FileUpload.tsx";

export const WelcomePage: React.FC<{
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
}> = ({onFileUpload}) => (<div className="overflow-auto" style={{height: '100%'}}>
        <WelcomeContent/>
        <FileUpload onFileUpload={onFileUpload}/>
    </div>);