import {Route, Routes} from "react-router-dom";
import Trends from "./pages/Trends/Trends";
import Accounts from "./pages/Accounts/Accounts";
import Calendar from "./pages/Calendar/Calendar";
import Budget from "./pages/Budget/Budget";
import Ledger from "./pages/Ledger/Ledger";
import TopNav from "./components/TopNav/TopNav";
import Upload from "./pages/Uploader/Upload";

function App() {
    return (
        <>
            <TopNav/>
            <main>
                <Routes>
                    <Route path="/" element={<Budget/>}/>
                    <Route path="/trends" element={<Trends/>}/>
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
