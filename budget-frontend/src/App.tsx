import {Route, Routes} from "react-router-dom";
import Accounts from "./pages/Accounts/Accounts";
import Calendar from "./pages/Calendar/Calendar";
import Ledger from "./pages/Ledger/Ledger";
import TopNav from "./components/TopNav/TopNav";
import Upload from "./pages/Uploader/Upload";
import Home from "./pages/Home/Home";

function App() {
    return (
        <>
            <TopNav/>
            <main>
                <Routes>
                    <Route path="/" element={<Home/>}/>
                    <Route path="/calendar" element={<Calendar/>}/>
                    <Route path="/accounts" element={<Accounts/>}/>
                    <Route path="/ledger" element={<Ledger/>}/>
                    <Route path="/upload" element={<Upload/>}/>
                </Routes>
            </main>
        </>
    );
}

export default App;
