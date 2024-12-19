import React from 'react';
import {useDropzone} from 'react-dropzone';
import {useNavigate} from "react-router-dom";
import {useState} from 'react';

const FileUploadPage: React.FC = () => {
    const navigate = useNavigate();

    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadComplete, setUploadComplete] = useState<boolean>(false);
    const onDrop = async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const formData = new FormData();
        acceptedFiles.forEach((file) => {
            formData.append('file', file);
        });

        setUploadProgress(0);
        setUploadComplete(false);
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                },
            });

            const responseData = await response.json();
            setUploadProgress(null);
            setUploadComplete(true);

            setTimeout(() => {
                navigate('/');
            }, 1000);
            console.log('File uploaded successfully:', responseData);
        } catch (error) {
            setUploadProgress(null);
            console.error('Error uploading file:', error);
        }
    };

    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop});

    const renderUploadProgress = () => {
        if (uploadProgress !== null) {
            return <p>Uploading: {uploadProgress}%</p>;
        }
        if (uploadComplete) {
            return <p>Upload complete!</p>;
        }
        return null;
    };

    return (
        <div
            {...getRootProps()}
            style={{
                border: '2px dashed #cccccc',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
            }}
        >
            <input {...getInputProps()} />
            {isDragActive ? (
                <p>Drop the file here...</p>
            ) : (
                <>
                    <p>Drag & drop a file here, or click to select one</p>
                    {renderUploadProgress()}
                </>
            )}
        </div>
    );
};

export default FileUploadPage;