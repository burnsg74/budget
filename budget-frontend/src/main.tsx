import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {BrowserRouter} from "react-router-dom";

// StrictMode make two passes over the tree, first to detect side effects, and second to render the tree.
// It helps to find potential problems in the application.
// It is not recommended to use it in production.
createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
    <App />
    </BrowserRouter>
)
