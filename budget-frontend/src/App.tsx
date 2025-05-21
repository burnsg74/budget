import {Route, Routes} from "react-router-dom";
import Trends from "./pages/Trends/Trends";
import Accounts from "./pages/Accounts/Accounts";
import Calendar from "./pages/Calendar/Calendar";
import Budget from "./pages/Budget/Budget";
import Ledger from "./pages/Ledger/Ledger";
import TopNav from "./components/TopNav/TopNav";
import Upload from "./pages/Uploader/Upload";
import Home from "./pages/Home/Home";
import Unknown from "./pages/Unknown/Unknown";

function App() {
    return (
        <>
            <TopNav/>
            <main>
                <Routes>
                    <Route path="/" element={<Home/>}/>
                    <Route path="/unknown" element={<Unknown/>}/>
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
