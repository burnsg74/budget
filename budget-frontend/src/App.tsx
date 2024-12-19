import {Route, Routes} from "react-router-dom";
import Accounts from "./pages/Accounts/Accounts";
import Calendar from "./pages/Calendar/Calendar";
import HomePage from "./pages/Home/Home";
import Ledger from "./pages/Ledger/Ledger";
import TopNav from "./components/TopNav/TopNav";
import UploadPage from "./pages/Uploader/Upload";

function App() {
    return (
        <>
            <TopNav/>
            <main>
                <Routes>
                    <Route path="/" element={<HomePage/>}/>
                    <Route path="/calendar" element={<Calendar/>}/>
                    <Route path="/accounts" element={<Accounts/>}/>
                    <Route path="/ledger" element={<Ledger/>}/>
                    <Route path="/upload" element={<UploadPage/>}/>
                </Routes>
            </main>
        </>
    );
}

export default App;
