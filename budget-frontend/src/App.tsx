import TopNav from "./components/TopNav/TopNav.tsx";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/HomePage.tsx";
import Calendar from "./pages/CalendarPage.tsx";
import Accounts from "./pages/AccountsPage.tsx";
import Ledger from "./pages/LedgerPage.tsx";

function App() {
  return (
    <div className="App">
      <TopNav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/ledger" element={<Ledger />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
